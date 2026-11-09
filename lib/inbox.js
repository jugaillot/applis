/* La Suite — photos reçues du portable (page « Envoyer un dessin », /envoyer/).
   AtelierInbox.init({ docId: () => id du document ouvert (ou null), open: async file => {} })
   Vérifie la boîte du document toutes les quelques secondes ; un bandeau propose d'ouvrir chaque photo reçue. */
(function () {
  'use strict';
  const API = '/api.php';
  let O = null, items = [], ban = null, timer = null, hiddenFor = '', busy = false;
  function banner() {
    if (!ban) {
      ban = document.createElement('div');
      ban.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:60;display:flex;gap:10px;align-items:center;background:#1d1d1f;color:#fff;border-radius:12px;padding:9px 10px 9px 14px;box-shadow:0 6px 24px rgba(0,0,0,.28);font:13px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;max-width:94vw';
      ban.innerHTML = '<span class="t"></span><button type="button" class="o" style="font:inherit;font-weight:600;border:0;border-radius:8px;background:#ff48b0;color:#fff;padding:6px 12px;cursor:pointer">Ouvrir</button><button type="button" class="x" title="Plus tard" style="font:inherit;border:0;background:none;color:#bbb;cursor:pointer;font-size:16px;padding:2px 6px">✕</button>';
      ban.querySelector('.o').onclick = openNext;
      ban.querySelector('.x').onclick = () => { hiddenFor = items.map(i => i.f).join(','); show(); };
      document.body.appendChild(ban);
    }
    return ban;
  }
  function show() {
    const key = items.map(i => i.f).join(',');
    const on = items.length > 0 && key !== hiddenFor;
    if (!on) { if (ban) ban.hidden = true; return; }
    const b = banner(); b.hidden = false;
    const vx = items[0] && items[0].vx;
    b.querySelector('.t').textContent = '📷 ' + (items.length > 1 ? items.length + ' envois reçus' : (vx ? '1 dessin vectorisé reçu' : '1 photo reçue')) + ' du portable';
    b.querySelector('.o').textContent = vx ? (items.length > 1 ? 'Placer le premier' : 'Placer') : (items.length > 1 ? 'Ouvrir la première' : 'Ouvrir');
  }
  async function poll() {
    clearTimeout(timer); timer = setTimeout(poll, document.hidden ? 20000 : 5000);
    const id = O.docId(); if (!id || busy) { if (!id) { items = []; show(); } return; }
    try {
      const r = await fetch(API + '?a=inbox_list&id=' + encodeURIComponent(id), { credentials: 'same-origin', cache: 'no-store' });
      if (!r.ok) return; const j = await r.json();
      items = (j.items || []).sort((a, b) => a.at - b.at); items.id = id; show();
    } catch (e) { /* hors ligne : on réessaiera */ }
  }
  async function openNext() {
    const it = items[0], id = items.id; if (!it || busy) return; busy = true;
    try {
      const r = await fetch(API + '?a=inbox_get&id=' + encodeURIComponent(id) + '&f=' + encodeURIComponent(it.f), { credentials: 'same-origin', cache: 'no-store' });
      if (!r.ok) throw new Error('photo introuvable (' + r.status + ')');
      const blob = await r.blob();
      const file = new File([blob], (it.name || 'photo-portable') + '.' + (/png$/.test(it.f) ? 'png' : 'jpg'), { type: blob.type || 'image/jpeg' });
      await fetch(API + '?a=inbox_del&id=' + encodeURIComponent(id) + '&f=' + encodeURIComponent(it.f), { method: 'POST', credentials: 'same-origin' });
      items = items.filter(x => x !== it); items.id = id; show();
      await O.open(file, it.vx || null);
    } catch (e) { alert('Ouverture impossible : ' + (e.message || e)); }
    busy = false;
  }
  window.AtelierInbox = {
    init(o) { O = o; setTimeout(poll, 1500); document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); }); },
    check: () => O && poll()
  };
})();
