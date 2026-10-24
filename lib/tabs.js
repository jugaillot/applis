/* Atelier — onglets des fichiers ouverts (Vecto, Paysage, CAD, Riso).
   Chaque appli fournit : get() → {id,name,data}, set(tab), blank(), isEmpty().
   Les onglets (et le contenu de chacun) sont gardés sur l'appareil. */
window.AtelierTabs = (function () {
  let A = null, st = null, bar = null, busy = false;
  const uid = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  /* petite base locale, à part des données de l'appli */
  let dbp = null;
  function db() {
    if (!dbp) dbp = new Promise((res, rej) => { const r = indexedDB.open('atelier-onglets', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    return dbp;
  }
  async function kget(k) { try { const d = await db(); return await new Promise((res) => { const q = d.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); } catch (e) { return null; } }
  async function kset(k, v) { try { const d = await db(); await new Promise((res) => { const t = d.transaction('kv', 'readwrite'); v === undefined ? t.objectStore('kv').delete(k) : t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = res; }); } catch (e) {} }
  const K = () => A.app + '.onglets', KD = key => A.app + '.onglet.' + key;
  function saveIndex() { kset(K(), { active: st.active, tabs: st.tabs.map(t => ({ key: t.key, id: t.id || null, name: t.name || '', has: t.has !== false })) }); }
  const cur = () => st.tabs[st.active];
  function capture() { const c = cur(); if (!c) return; try { const g = A.get(); c.id = g.id || null; c.name = g.name || ''; kset(KD(c.key), g.data); c.has = !A.isEmpty(); } catch (e) { console.error(e); } }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function render() {
    if (!bar) return;
    bar.innerHTML = st.tabs.map((t, i) => `<div class="atab${i === st.active ? ' on' : ''}" data-i="${i}" title="${esc(t.name || 'Sans titre')}${t.id ? '' : ' (pas encore enregistré)'}"><span class="atab-t">${esc(t.name || 'Sans titre')}${t.id ? '' : ' •'}</span><button class="atab-x" data-x="${i}" title="Fermer">×</button></div>`).join('') + `<button class="atab-add" title="Nouveau document">+</button>`;
    const on = bar.querySelector('.atab.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  async function guard(fn) { if (busy) return; busy = true; try { await fn(); } catch (e) { console.error(e); alert('Onglet : ' + (e.message || e)); } finally { busy = false; render(); saveIndex(); } }
  async function load(t) { const data = await kget(KD(t.key)); if (data) await A.set({ id: t.id, name: t.name, data }); else await A.blank(); }
  function activate(i) { return guard(async () => { if (i === st.active || !st.tabs[i]) return; capture(); st.active = i; await load(cur()); }); }
  function newTab() { return guard(async () => { capture(); st.tabs.push({ key: uid(), id: null, name: '', has: false }); st.active = st.tabs.length - 1; await A.blank(); }); }
  /* ouvrir un document (« Mes dessins… ») : dans son onglet s'il est déjà ouvert, sinon dans un nouvel onglet
     (ou dans l'onglet actif s'il est vide et jamais enregistré) */
  function open(id, name, data) {
    return guard(async () => {
      const i = id ? st.tabs.findIndex(t => t.id === id) : -1;
      capture();
      if (i >= 0) { st.active = i; await A.set({ id, name, data }); cur().name = name; return; }
      const c = cur();
      if (!(c && !c.id && A.isEmpty())) { st.tabs.push({ key: uid(), id: null, name: '' }); st.active = st.tabs.length - 1; }
      Object.assign(cur(), { id, name });
      await A.set({ id, name, data });
      kset(KD(cur().key), data);
    });
  }
  function close(i) {
    return guard(async () => {
      const t = st.tabs[i]; if (!t) return;
      if (i === st.active) capture();
      const has = i === st.active ? !A.isEmpty() : t.has !== false;
      if (!t.id && has && !confirm('Fermer « ' + (t.name || 'Sans titre') + ' » ?\nCe document n’a pas été enregistré dans tes fichiers : il sera perdu.')) return;
      st.tabs.splice(i, 1); kset(KD(t.key), undefined);
      if (!st.tabs.length) { st.tabs.push({ key: uid(), id: null, name: '', has: false }); st.active = 0; await A.blank(); return; }
      if (i < st.active) st.active--;
      else if (i === st.active) { st.active = Math.min(i, st.tabs.length - 1); await load(cur()); }
    });
  }
  /* appelé par l'enregistrement automatique de l'appli */
  function update(g) { const c = st && cur(); if (!c || busy) return; const changed = c.id !== (g.id || null) || c.name !== (g.name || ''); c.id = g.id || null; c.name = g.name || ''; c.has = !A.isEmpty(); if (g.data !== undefined) kset(KD(c.key), g.data); if (changed) { render(); saveIndex(); } }
  function refresh() { if (!st || busy) return; const c = cur(); try { const g = A.get(true); if (c.id !== (g.id || null) || c.name !== (g.name || '')) { c.id = g.id || null; c.name = g.name || ''; render(); saveIndex(); } } catch (e) {} }
  async function init(cfg) {
    A = cfg;
    const css = document.createElement('style');
    css.textContent = `#atabs{display:flex;align-items:flex-end;gap:2px;padding:4px 8px 0;background:var(--bg,#f4f2ee);border-bottom:1px solid var(--line,#ddd);overflow-x:auto;scrollbar-width:thin;flex-shrink:0;min-height:31px}
#atabs .atab{display:flex;align-items:center;gap:4px;max-width:200px;padding:4px 4px 4px 10px;border:1px solid var(--line,#ddd);border-bottom:0;border-radius:7px 7px 0 0;background:var(--soft,#eceae5);font-size:12px;cursor:pointer;white-space:nowrap;color:var(--mute,#777)}
#atabs .atab.on{background:var(--panel,#fff);color:var(--ink,#1d1d1f);font-weight:600;margin-bottom:-1px;padding-bottom:5px}
#atabs .atab-t{overflow:hidden;text-overflow:ellipsis}
#atabs .atab-x{border:0;background:none;cursor:pointer;width:18px;height:18px;border-radius:4px;font-size:14px;line-height:1;color:inherit;padding:0;flex-shrink:0}
#atabs .atab-x:hover{background:rgba(0,0,0,.08)}
#atabs .atab-add{border:0;background:none;cursor:pointer;font-size:17px;width:26px;height:26px;border-radius:6px;color:var(--mute,#777);flex-shrink:0}
#atabs .atab-add:hover{background:rgba(0,0,0,.06)}`;
    document.head.appendChild(css);
    bar = document.createElement('div'); bar.id = 'atabs';
    const h = document.querySelector('header'); if (h) h.after(bar); else document.body.prepend(bar);
    bar.addEventListener('click', e => {
      const x = e.target.closest('[data-x]'); if (x) { e.stopPropagation(); close(+x.dataset.x); return; }
      if (e.target.closest('.atab-add')) { newTab(); return; }
      const t = e.target.closest('.atab'); if (t) activate(+t.dataset.i);
    });
    bar.addEventListener('auxclick', e => { const t = e.target.closest('.atab'); if (t && e.button === 1) close(+t.dataset.i); });
    const saved = await kget(K());
    if (saved && saved.tabs && saved.tabs.length) {
      st = { active: Math.min(saved.active || 0, saved.tabs.length - 1), tabs: saved.tabs.map(t => Object.assign({}, t)) };
      if (A.restore) { await load(cur()); } else { const g = A.get(); cur().id = g.id || cur().id || null; cur().name = g.name || cur().name || ''; }
    } else {
      const g = A.get(); st = { active: 0, tabs: [{ key: uid(), id: g.id || null, name: g.name || '' }] };
    }
    render(); saveIndex();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && !busy) { capture(); saveIndex(); } });
  }
  return { init, newTab, open, update, refresh, activate, close };
})();
