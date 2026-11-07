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
  /* l'appli qui lit ce type de fichier */
  function home(f) {
    const e = ext(f), t = f.type || '';
    if (e === 'pdf' || t === 'application/pdf') return 'compil';
    if (['svg', 'ai', 'eps'].includes(e) || t === 'image/svg+xml') return 'vecto';
    if (/^image\//.test(t) || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'heic', 'tif', 'tiff'].includes(e)) return 'photo';
    if (['md', 'markdown', 'txt'].includes(e) || t === 'text/markdown' || t === 'text/plain') return 'dossiers';
    if (e === 'dxf') return 'plan';
    return null;
  }
  /* transmission des fichiers d'une appli à l'autre (même site : base locale partagée) */
  function db() { return new Promise((res, rej) => { const r = indexedDB.open('la-suite-handoff', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
  async function put(files) { const d = await db(); const list = await Promise.all(files.map(async f => ({ name: f.name, type: f.type, data: await f.arrayBuffer() }))); await new Promise((res, rej) => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put({ at: Date.now(), list }, 'files'); t.oncomplete = res; t.onerror = () => rej(t.error); }); }
  async function take() { const d = await db(); const v = await new Promise(res => { const q = d.transaction('kv').objectStore('kv').get('files'); q.onsuccess = () => res(q.result); q.onerror = () => res(null); });
    await new Promise(res => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').delete('files'); t.oncomplete = res; t.onerror = res; });
    if (!v || Date.now() - v.at > 5 * 60 * 1000) return [];
    return v.list.map(x => new File([x.data], x.name, { type: x.type })); }
  function sendTo(app, files) { put(files).then(() => { location.href = '../' + APPS[app].dir + '/?ouvrir=1'; }).catch(e => alert('Transmission impossible : ' + e.message)); }

  /* petit message « déposer pour ouvrir » */
  let ov = null;
  function overlay(on, txt) {
    if (!ov) { ov = document.createElement('div'); ov.style.cssText = 'position:fixed;inset:10px;border:3px dashed #888;border-radius:16px;background:rgba(255,255,255,.55);display:flex;align-items:center;justify-content:center;font:600 18px system-ui,sans-serif;color:#333;z-index:9998;pointer-events:none'; document.body.appendChild(ov); }
    ov.textContent = txt || 'Dépose pour ouvrir'; ov.style.display = on ? 'flex' : 'none';
  }
  const hasFiles = e => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');

  const AtelierDrop = {
    home, sendTo,
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
        const files = [...e.dataTransfer.files]; if (!files.length) return;
        const ok = files.filter(f => o.accept && o.accept(f)), other = files.filter(f => !(o.accept && o.accept(f)));
        if (ok.length) { if (!o.own) { e.preventDefault(); e.stopImmediatePropagation(); Promise.resolve(o.open(ok)).catch(err => alert('Ouverture impossible : ' + (err.message || err))); } if (!other.length) return; }
        e.preventDefault(); e.stopImmediatePropagation();
        // fichiers que cette appli ne lit pas : on propose l'appli qui les lit
        const by = {}; other.forEach(f => { const a = home(f); if (a) (by[a] = by[a] || []).push(f); });
        const apps = Object.keys(by).filter(a => a !== o.app);
        if (!apps.length) { if (!ok.length) alert('Aucune appli de La Suite ne sait ouvrir « ' + other[0].name + ' ».'); return; }
        const a = apps[0], fs = by[a];
        const what = fs.length > 1 ? fs.length + ' fichiers' : '« ' + fs[0].name + ' »';
        if (!o.app || confirm(what + ' s’ouvre avec l’appli ' + APPS[a].name + '.\n\nL’ouvrir dans ' + APPS[a].name + ' ?')) sendTo(a, fs);
      }, true);
      if (!o.own) addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); }, true);
      // fichiers transmis par une autre appli
      if (/[?&]ouvrir=1/.test(location.search) && o.open) {
        history.replaceState(null, '', location.pathname + location.hash);
        const go = () => take().then(fs => { if (fs.length) setTimeout(() => Promise.resolve(o.open(fs)).catch(err => alert('Ouverture impossible : ' + (err.message || err))), o.delay || 800); });
        if (document.readyState === 'complete') go(); else addEventListener('load', go);
      }
    }
  };
  window.AtelierDrop = AtelierDrop;
})();
