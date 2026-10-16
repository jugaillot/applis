/* Atelier — synchronisation des projets avec le serveur.
   Chaque projet est d'abord enregistré sur l'appareil (fonctionne hors connexion),
   puis envoyé au serveur dès que la connexion est là. Les projets créés ailleurs
   sont récupérés automatiquement pour rester disponibles hors connexion. */
(function () {
  'use strict';
  const API = '/api.php';
  let db = null;
  function open() {
    if (db) return Promise.resolve(db);
    return new Promise((res, rej) => {
      let r; try { r = indexedDB.open('atelier', 1); } catch (e) { return rej(e); }
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv'); };
      r.onsuccess = () => { db = r.result; res(db); };
      r.onerror = () => rej(r.error);
    });
  }
  async function get(k) { const d = await open(); return new Promise((res, rej) => { const q = d.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
  async function set(k, v) { const d = await open(); return new Promise((res, rej) => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(true); t.onerror = () => rej(t.error); }); }
  async function del(k) { const d = await open(); return new Promise(res => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').delete(k); t.oncomplete = res; t.onerror = res; }); }
  async function keys(prefix) { const d = await open(); return new Promise((res, rej) => { const q = d.transaction('kv').objectStore('kv').getAllKeys(); q.onsuccess = () => res(q.result.filter(k => typeof k === 'string' && k.startsWith(prefix))); q.onerror = () => rej(q.error); }); }

  const listeners = new Set();
  let state = { state: 'idle', pending: 0, message: '' };
  function emit(s) { state = Object.assign({}, state, s); listeners.forEach(f => { try { f(state); } catch (e) {} }); }
  async function countPending() { let n = 0; for (const k of await keys('doc:')) { const r = await get(k); if (r && r.dirty) n++; } for (const k of await keys('blob:')) { const r = await get(k); if (r && r.dirty) n++; } return n; }

  const genId = app => app + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  let timer = 0, running = false, again = false, serverMeta = null;
  function schedule(ms) { clearTimeout(timer); timer = setTimeout(syncNow, ms == null ? 1500 : ms); }

  async function api(a, params, opts) {
    const q = new URLSearchParams(Object.assign({ a }, params || {}));
    const r = await fetch(API + '?' + q.toString(), Object.assign({ credentials: 'same-origin', cache: 'no-store' }, opts || {}));
    return r;
  }

  async function syncNow() {
    if (running) { again = true; return; }
    if (!navigator.onLine) { emit({ state: 'offline', pending: await countPending() }); return; }
    running = true; emit({ state: 'syncing' });
    try {
      let r = await api('list');
      if (!r.ok) throw new Error(r.status === 401 ? 'non connecté' : 'serveur ' + r.status);
      serverMeta = await r.json();
      const sdocs = serverMeta.docs || {};
      // 1. envoi des modifications locales
      for (const k of await keys('doc:')) {
        const rec = await get(k); if (!rec || !rec.dirty) continue;
        if (rec.deleted) {
          if (sdocs[rec.id] && !sdocs[rec.id].deleted) { const d = await api('del', { id: rec.id }, { method: 'POST' }); if (!d.ok) throw new Error('suppression ' + d.status); }
          await del(k); continue;
        }
        const force = rec.app === 'reglages' ? 1 : 0;
        const p = await api('put', { id: rec.id, base: rec.rev || 0, app: rec.app, name: rec.name, force }, { method: 'POST', body: rec.data, headers: { 'Content-Type': 'application/json' } });
        if (p.status === 409) {
          // modifié ailleurs entre-temps : on garde les deux versions
          const copy = Object.assign({}, rec, { id: genId(rec.app), name: rec.name + ' (conflit ' + new Date().toLocaleString('fr-FR') + ')', rev: 0, dirty: true });
          await set('doc:' + copy.id, copy);
          window.dispatchEvent(new CustomEvent('atelier-conflict', { detail: { id: rec.id, copyId: copy.id, name: copy.name } }));
          const g = await api('get', { id: rec.id });
          if (g.ok) { await set(k, Object.assign({}, rec, { data: await g.text(), rev: +(g.headers.get('X-Rev') || 0), dirty: false, updated: (sdocs[rec.id] || {}).updated || Date.now() })); }
          again = true; continue;
        }
        if (!p.ok) throw new Error('envoi ' + p.status);
        const m = await p.json();
        const now = await get(k);
        if (now && now.updated === rec.updated) await set(k, Object.assign({}, now, { rev: m.rev, dirty: false }));
        else if (now) await set(k, Object.assign({}, now, { rev: m.rev }));
      }
      for (const k of await keys('blob:')) {
        const rec = await get(k); if (!rec || !rec.dirty) continue;
        const key = k.slice(5);
        const p = await api('putblob', { id: key, type: rec.blob.type || '' }, { method: 'POST', body: rec.blob });
        if (!p.ok) throw new Error('envoi image ' + p.status);
        await set(k, Object.assign({}, rec, { dirty: false }));
      }
      // 2. récupération des projets créés ou modifiés ailleurs
      r = await api('list'); serverMeta = await r.json();
      let changed = false;
      for (const id in serverMeta.docs) {
        const m = serverMeta.docs[id], k = 'doc:' + id, rec = await get(k);
        if (m.deleted) { if (rec && !rec.dirty) { await del(k); changed = true; } continue; }
        if (rec && (rec.dirty || (rec.rev || 0) >= m.rev)) continue;
        const g = await api('get', { id });
        if (!g.ok) continue;
        await set(k, { id, app: m.app, name: m.name, data: await g.text(), rev: m.rev, updated: m.updated, dirty: false });
        changed = true;
        if (id === 'reglages.encres') { try { const v = JSON.parse((await get(k)).data); localStorage.setItem('atelierRiso.inks', JSON.stringify(v)); window.dispatchEvent(new CustomEvent('atelier-inks')); } catch (e) {} }
      }
      if (changed) window.dispatchEvent(new CustomEvent('atelier-docs'));
      const pending = await countPending();
      emit({ state: pending ? 'pending' : 'ok', pending, message: '', last: Date.now() });
    } catch (e) {
      emit({ state: 'error', message: e.message || String(e), pending: await countPending() });
    } finally {
      running = false;
      if (again) { again = false; schedule(500); }
    }
  }

  const Sync = {
    genId,
    /* enregistre un projet (localement tout de suite, puis sur le serveur) */
    async save(app, id, name, data, opts) {
      id = id || genId(app);
      const prev = await get('doc:' + id);
      const str = typeof data === 'string' ? data : JSON.stringify(data);
      if (prev && !prev.deleted && prev.data === str && (!name || prev.name === name)) return id; // rien n'a changé
      const rec = { id, app, name: name || (prev && prev.name) || id, data: str, rev: prev ? prev.rev || 0 : 0, updated: Date.now(), dirty: true };
      await set('doc:' + id, rec);
      emit({ state: navigator.onLine ? 'pending' : 'offline', pending: await countPending() });
      schedule(opts && opts.lazy ? 20000 : 800);
      return id;
    },
    async load(id) { const rec = await get('doc:' + id); if (!rec || rec.deleted) return null; return JSON.parse(rec.data); },
    async info(id) { const rec = await get('doc:' + id); return rec && !rec.deleted ? { id: rec.id, name: rec.name, updated: rec.updated, dirty: rec.dirty } : null; },
    async rename(id, name) { const rec = await get('doc:' + id); if (!rec) return; rec.name = name; rec.updated = Date.now(); rec.dirty = true; await set('doc:' + id, rec); schedule(800); },
    async remove(id) { const rec = await get('doc:' + id); if (!rec) return; await set('doc:' + id, { id, app: rec.app, name: rec.name, deleted: true, dirty: true, updated: Date.now() }); schedule(500); },
    async list(app) {
      const out = [];
      for (const k of await keys('doc:')) { const r = await get(k); if (r && !r.deleted && r.app === app) out.push({ id: r.id, name: r.name, updated: r.updated, dirty: !!r.dirty, size: (r.data || '').length }); }
      return out.sort((a, b) => b.updated - a.updated);
    },
    async saveBlob(key, blob) { await set('blob:' + key, { blob, dirty: true }); schedule(1500); },
    async getBlob(key) {
      const r = await get('blob:' + key); if (r && r.blob) return r.blob;
      if (!navigator.onLine) return null;
      try { const g = await api('getblob', { id: key }); if (!g.ok) return null; const b = await g.blob(); await set('blob:' + key, { blob: b, dirty: false }); return b; } catch (e) { return null; }
    },
    syncNow, onStatus(f) { listeners.add(f); f(state); return () => listeners.delete(f); },
    get state() { return state; },

    /* petit indicateur d'état à placer dans l'en-tête */
    badge() {
      const el = document.createElement('span');
      el.style.cssText = 'font-size:12px;color:#77756f;display:inline-flex;align-items:center;gap:5px;cursor:pointer;white-space:nowrap';
      el.title = 'Synchronisation des projets avec le serveur (cliquer pour synchroniser)';
      el.onclick = () => syncNow();
      Sync.onStatus(s => {
        const dot = { ok: '#22a06b', syncing: '#1e88ff', pending: '#e6a700', offline: '#9a978f', error: '#d33', idle: '#9a978f' }[s.state] || '#9a978f';
        const txt = { ok: 'Synchronisé', syncing: 'Synchronisation…', pending: s.pending + ' en attente', offline: 'Hors connexion' + (s.pending ? ' · ' + s.pending + ' en attente' : ''), error: 'Erreur de synchro', idle: '…' }[s.state] || '';
        el.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:' + dot + ';display:inline-block"></span>' + txt;
        if (s.state === 'error') el.title = 'Erreur : ' + s.message + ' — cliquer pour réessayer';
      });
      return el;
    },

    /* fenêtre « Mes projets » commune aux outils */
    openDialog(o) {
      let d = document.getElementById('syncDlg');
      if (!d) {
        d = document.createElement('dialog'); d.id = 'syncDlg';
        d.style.cssText = 'border:1px solid #e3e0d9;border-radius:12px;padding:0;width:min(560px,94vw);max-height:86vh;font:13px/1.4 system-ui,sans-serif;color:#1d1d1f';
        document.body.appendChild(d);
      }
      const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      const fmt = t => new Date(t).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
      const btn = 'font:inherit;border:1px solid #e3e0d9;background:#f7f6f2;border-radius:7px;padding:4px 9px;cursor:pointer';
      async function render() {
        const items = await Sync.list(o.app);
        d.innerHTML = '<div style="padding:12px 16px;border-bottom:1px solid #e3e0d9;font-weight:700;display:flex;align-items:center;gap:8px">' + esc(o.title || 'Mes projets') + '<span style="flex:1"></span></div>' +
          '<div style="padding:8px 16px;max-height:56vh;overflow:auto">' +
          (items.length ? items.map(it => '<div data-id="' + esc(it.id) + '" style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #f0eee9"><div style="flex:1;min-width:0"><div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(it.name) + (it.id === o.current ? ' <span style="color:#ff48b0;font-weight:500">· ouvert</span>' : '') + '</div><div style="color:#77756f;font-size:12px">' + fmt(it.updated) + ' · ' + (it.dirty ? '<span style="color:#b88400">pas encore sur le serveur</span>' : 'sur le serveur') + '</div></div><button data-act="open" style="' + btn + '">Ouvrir</button><button data-act="ren" style="' + btn + '" title="Renommer">✎</button><button data-act="del" style="' + btn + ';color:#b3261e" title="Supprimer">✕</button></div>').join('') : '<div style="color:#77756f;padding:14px 0">Aucun projet enregistré pour l’instant.</div>') +
          '</div><div style="padding:10px 16px;border-top:1px solid #e3e0d9;display:flex;gap:8px;flex-wrap:wrap;align-items:center">' + (o.extra || []).map((x, i) => '<button data-extra="' + i + '" style="' + btn + '">' + esc(x.label) + '</button>').join('') + '<span style="flex:1"></span><button data-act="close" style="' + btn + '">Fermer</button></div>';
      }
      d.onclick = async e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.act === 'close') { d.close(); return; }
        if (b.dataset.extra != null) { d.close(); o.extra[+b.dataset.extra].action(); return; }
        const row = b.closest('[data-id]'); if (!row) return; const id = row.dataset.id;
        if (b.dataset.act === 'open') { const data = await Sync.load(id); const inf = await Sync.info(id); d.close(); if (data) o.onOpen(id, data, inf); return; }
        if (b.dataset.act === 'ren') { const inf = await Sync.info(id); const n = prompt('Nouveau nom :', inf ? inf.name : ''); if (n && n.trim()) { await Sync.rename(id, n.trim()); if (o.onRename) o.onRename(id, n.trim()); render(); } return; }
        if (b.dataset.act === 'del') { const inf = await Sync.info(id); if (!confirm('Supprimer « ' + (inf ? inf.name : id) + ' » sur cet appareil et sur le serveur ?')) return; await Sync.remove(id); if (o.onDelete) o.onDelete(id); render(); return; }
      };
      const refresh = () => { if (d.open) render(); };
      window.addEventListener('atelier-docs', refresh);
      d.addEventListener('close', () => window.removeEventListener('atelier-docs', refresh), { once: true });
      render(); d.showModal(); syncNow();
    }
  };
  window.AtelierSync = Sync;
  window.addEventListener('online', () => syncNow());
  window.addEventListener('offline', () => emit({ state: 'offline' }));
  setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') schedule(300); });
  schedule(800);
})();
