/* La Suite — proposer d'enregistrer avant de fermer un document modifié.
   AtelierUnsaved.ask(nom, {verb:'Enregistrer…', text}) → 'save' | 'discard' | null (annuler)
   AtelierUnsaved.watch(() => bool) : le navigateur prévient à la fermeture de la fenêtre s'il reste quelque chose de non enregistré. */
(function () {
  'use strict';
  const watchers = [];
  addEventListener('beforeunload', e => {
    if (window.__laSuiteLeaving) return;
    if (watchers.some(f => { try { return f(); } catch (err) { return false; } })) { e.preventDefault(); e.returnValue = ''; return ''; }
  });
  function ask(name, o) {
    o = o || {};
    return new Promise(res => {
      const d = document.createElement('dialog');
      d.style.cssText = 'border:1px solid #e3e0d9;border-radius:14px;padding:0;width:min(440px,94vw);font:13px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1d1d1f';
      const b = 'font:inherit;border:1px solid #e3e0d9;background:#f7f6f2;border-radius:7px;padding:6px 12px;cursor:pointer';
      d.innerHTML = '<div style="padding:14px 16px 4px;font-weight:700;font-size:14px"></div><div style="padding:4px 16px 14px;color:#55534e"></div>' +
        '<div style="display:flex;gap:8px;justify-content:flex-end;padding:10px 16px;border-top:1px solid #e3e0d9;flex-wrap:wrap">' +
        '<button type="button" data-r="" style="' + b + ';margin-right:auto">Annuler</button>' +
        '<button type="button" data-r="discard" style="' + b + '">Ne pas enregistrer</button>' +
        '<button type="button" data-r="save" style="' + b + ';background:#1d1d1f;color:#fff;border-color:#1d1d1f;font-weight:600"></button></div>';
      d.children[0].textContent = o.title || ('Enregistrer « ' + (name || 'Sans titre') + ' » ?');
      d.children[1].textContent = o.text || 'Ce document a été modifié et n’est pas encore enregistré dans tes fichiers. Sans enregistrement, les modifications seront perdues.';
      d.querySelector('[data-r=save]').textContent = o.verb || 'Enregistrer…';
      let done = false; const end = r => { if (done) return; done = true; d.close(); setTimeout(() => d.remove(), 50); res(r); };
      d.addEventListener('click', e => { const x = e.target.closest('[data-r]'); if (x) end(x.dataset.r || null); });
      d.addEventListener('cancel', e => { e.preventDefault(); end(null); });
      document.body.appendChild(d); d.showModal(); d.querySelector('[data-r=save]').focus();
    });
  }
  window.AtelierUnsaved = { ask, watch: f => watchers.push(f) };
})();
