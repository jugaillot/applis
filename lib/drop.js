/* La Suite — glisser-déposer des fichiers depuis l'ordinateur, commun à toutes les applis.
   - si l'appli ouverte sait lire le fichier, elle l'ouvre (comme nouveau document quand c'est possible) ;
   - sinon, elle propose de l'ouvrir dans l'appli qui le lit (le fichier y est transmis).
   AtelierDrop.init({app:'vecto', accept:file=>bool, open:async files=>{}, own:true})
     own : l'appli gère déjà elle-même le dépôt des fichiers qu'elle accepte (on ne s'en mêle pas). */
(function () {
  'use strict';
  const APPS = {
    compil: { dir: 'compil', name: 'PDF' }, vecto: { dir: 'vecto', name: 'Vecto' }, photo: { dir: 'photo', name: 'Photo' },
    dossiers: { dir: 'dossiers', name: 'Dossiers' }, plan: { dir: 'plan', name: 'CAD' }, mise: { dir: 'mise', name: 'Mise en page' },
    riso: { dir: 'riso', name: 'Riso' }, paysage: { dir: 'paysage', name: 'Paysage' }
  };
  const ext = f => ((f.name || '').split('.').pop() || '').toLowerCase();
  /* les applis qui savent lire ce type de fichier (la première est la plus courante) */
  const WHAT = {
    compil: 'assembler, annoter, signer, imprimer', vecto: 'modifier le dessin vectoriel', photo: 'retoucher en image', paysage: 'composer un paysage',
    riso: 'préparer une impression riso', mise: 'retravailler la mise en page', dossiers: 'reprendre le texte dans un dossier', plan: 'ouvrir le plan'
  };
  function appsFor(f) {
    const e = ext(f), t = f.type || '';
    if (e === 'pdf' || t === 'application/pdf') return ['compil', 'mise', 'vecto', 'photo', 'riso', 'paysage'];
    if (e === 'pptx' || /presentationml/.test(t)) return ['mise', 'compil', 'photo', 'dossiers'];
    if (e === 'ai') return ['vecto', 'paysage', 'riso'];
    if (e === 'eps') return ['vecto'];
    if (e === 'svg' || t === 'image/svg+xml') return ['vecto', 'mise', 'riso', 'paysage'];
    if (/^image\//.test(t) || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'heic', 'tif', 'tiff'].includes(e)) return ['photo', 'mise', 'compil', 'riso', 'vecto', 'paysage'];
    if (['md', 'markdown', 'txt'].includes(e) || t === 'text/markdown' || t === 'text/plain') return ['dossiers'];
    if (e === 'dxf') return ['plan'];
    return [];
  }
  const home = f => appsFor(f)[0] || null;
  /* fenêtre « Ouvrir avec quelle appli ? » */
  function choose(files, apps, title) {
    return new Promise(res => {
      const d = document.createElement('dialog');
      d.style.cssText = 'border:1px solid #e3e0d9;border-radius:14px;padding:0;width:min(460px,94vw);font:13px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1d1d1f';
      const what = files.length > 1 ? files.length + ' fichiers' : '« ' + files[0].name + ' »';
      d.innerHTML = '<div style="padding:12px 16px;border-bottom:1px solid #e3e0d9;font-weight:700">' + (title || 'Ouvrir avec quelle appli ?') + '</div><div style="padding:12px 16px 6px;color:#77756f"></div><div class="ch" style="padding:6px 12px 12px;display:flex;flex-direction:column;gap:6px"></div><div style="display:flex;justify-content:flex-end;padding:10px 16px;border-top:1px solid #e3e0d9"><button type="button" class="x" style="font:inherit;border:1px solid #e3e0d9;background:#f7f6f2;border-radius:7px;padding:5px 10px;cursor:pointer">Annuler</button></div>';
      d.children[1].textContent = what;
      const ch = d.querySelector('.ch');
      apps.forEach((a, i) => { const b = document.createElement('button'); b.type = 'button';
        b.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;font:inherit;border:1px solid ' + (i ? '#e3e0d9' : '#1d1d1f') + ';background:#fff;border-radius:9px;padding:8px 12px;cursor:pointer';
        b.innerHTML = '<b style="font-size:14px"></b><span style="color:#77756f;font-size:12px"></span>'; b.firstChild.textContent = APPS[a].name; b.lastChild.textContent = WHAT[a] || '';
        b.onmouseenter = () => b.style.background = '#f7f6f2'; b.onmouseleave = () => b.style.background = '#fff';
        b.onclick = () => { d.close(); res(a); }; ch.appendChild(b); });
      d.querySelector('.x').onclick = () => { d.close(); res(null); };
      d.addEventListener('close', () => { setTimeout(() => d.remove(), 50); res(null); });
      document.body.appendChild(d); d.showModal();
    });
  }
  /* envoie des fichiers vers la bonne appli, en demandant laquelle s'il y en a plusieurs */
  async function route(files, here, direct) {
    let common = null; files.forEach(f => { const a = appsFor(f); common = common ? common.filter(x => a.includes(x)) : a; });
    let list = files;
    if (!common || !common.length) { const a0 = appsFor(files[0]); list = files.filter(f => appsFor(f)[0] === a0[0]); common = a0; }
    common = common.filter(a => a !== here);
    if (!common.length) { alert('Aucune appli de La Suite ne sait ouvrir « ' + files[0].name + ' ».'); return; }
    const a = (common.length === 1 || direct) && !here ? common[0] : await choose(list, common, here ? 'Ce fichier ne s’ouvre pas ici — l’ouvrir avec :' : null);
    if (a) sendTo(a, list);
  }
  /* transmission des fichiers d'une appli à l'autre (même site : base locale partagée) */
  function db() { return new Promise((res, rej) => { const r = indexedDB.open('la-suite-handoff', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
  async function put(files) { const d = await db(); const list = await Promise.all(files.map(async f => ({ name: f.name, type: f.type, data: await f.arrayBuffer() }))); await new Promise((res, rej) => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put({ at: Date.now(), list }, 'files'); t.oncomplete = res; t.onerror = () => rej(t.error); }); }
  async function take() { const d = await db(); const v = await new Promise(res => { const q = d.transaction('kv').objectStore('kv').get('files'); q.onsuccess = () => res(q.result); q.onerror = () => res(null); });
    await new Promise(res => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').delete('files'); t.oncomplete = res; t.onerror = res; });
    if (!v || Date.now() - v.at > 5 * 60 * 1000) return [];
    return v.list.map(x => new File([x.data], x.name, { type: x.type })); }
  function sendTo(app, files) { put(files).then(() => { window.__laSuiteLeaving = 1; location.href = '../' + APPS[app].dir + '/?ouvrir=1'; }).catch(e => alert('Transmission impossible : ' + e.message)); }

  /* « Transférer vers… » : envoie le document en cours (fabriqué par make) vers une autre appli, ouverte dans un nouvel onglet */
  async function transfer(here, name, type, make) {
    const stub = new File([], name, { type });
    const apps = appsFor(stub).filter(a => a !== here);
    if (!apps.length) { alert('Aucune autre appli ne sait ouvrir ce format.'); return; }
    const a = await choose([stub], apps, 'Transférer vers quelle appli ?');
    if (!a) return;
    const w = window.open('about:blank', '_blank');
    try {
      const f = await make(); if (!f) { if (w) w.close(); return; }
      await put([f]);
      const url = '../' + APPS[a].dir + '/?ouvrir=1';
      if (w) w.location.href = url; else { window.__laSuiteLeaving = 1; location.href = url; }
    } catch (e) { if (w) w.close(); alert('Transfert impossible : ' + (e.message || e)); }
  }
  /* petit message « déposer pour ouvrir » */
  let ov = null;
  function overlay(on, txt) {
    if (!ov) { ov = document.createElement('div'); ov.style.cssText = 'position:fixed;inset:10px;border:3px dashed #888;border-radius:16px;background:rgba(255,255,255,.55);display:flex;align-items:center;justify-content:center;font:600 18px system-ui,sans-serif;color:#333;z-index:9998;pointer-events:none'; document.body.appendChild(ov); }
    ov.textContent = txt || 'Dépose pour ouvrir'; ov.style.display = on ? 'flex' : 'none';
  }
  const hasFiles = e => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');

  const AtelierDrop = {
    home, appsFor, sendTo, choose, route,
    init(o) {
      o = o || {};
      let depth = 0;
      if (!o.own) {
        addEventListener('dragenter', e => { if (!hasFiles(e)) return; depth++; overlay(true, o.app ? 'Dépose pour ouvrir dans ' + (APPS[o.app] ? APPS[o.app].name : '') : 'Dépose pour ouvrir dans la bonne appli'); });
        addEventListener('dragleave', e => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) overlay(false); });
        addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
      }
      addEventListener('drop', e => {
        if (!hasFiles(e)) return; depth = 0; overlay(false);
        const files = [...e.dataTransfer.files]; if (!files.length) return; window.__laSuiteBusy = 1;
        const ok = files.filter(f => o.accept && o.accept(f)), other = files.filter(f => !(o.accept && o.accept(f)));
        if (ok.length) {
          // l'appli gère elle-même ses fichiers, sauf ceux que l'on convertit ici (présentations…)
          const mine = o.own ? ok.filter(f => o.take && o.take(f)) : ok;
          if (mine.length) { e.preventDefault(); e.stopImmediatePropagation(); Promise.resolve(o.open(mine)).catch(err => alert('Ouverture impossible : ' + (err.message || err))); }
          if (!other.length) return;
        }
        e.preventDefault(); e.stopImmediatePropagation();
        if (ok.length) return;
        // fichiers que cette appli ne lit pas : on propose les applis qui les lisent
        route(other, o.app || null);
      }, true);
      if (!o.own) addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); }, true);
      // fichiers transmis par une autre appli
      if (/[?&]ouvrir=1/.test(location.search) && o.open) {
        history.replaceState(null, '', location.pathname + location.hash);
        window.__laSuiteBusy = 1;
        const go = () => take().then(fs => { if (fs.length && window.AtelierRecent) AtelierRecent.addFiles(o.app, fs); if (fs.length) setTimeout(() => Promise.resolve(o.open(fs)).catch(err => alert('Ouverture impossible : ' + (err.message || err))), o.delay || 800); });
        if (document.readyState === 'complete') go(); else addEventListener('load', go);
      }
    }
  };
  AtelierDrop.transfer = transfer;
  window.AtelierDrop = AtelierDrop;
})();
