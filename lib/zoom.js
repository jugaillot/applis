/* La Suite — loupe (outil Zoom) et molette, communs à toutes les applis.
   AtelierZoom.init({
     area: élément de la zone de travail (ou fonction qui le rend),
     tools: palette d'outils où ajouter le bouton (sélecteur ou élément), before: bouton avant lequel l'insérer,
     zoomBy(f, clientX, clientY) : agrandir de f autour d'un point de l'écran,
     panBy(dx, dy) : déplacer le contenu de dx, dy pixels écran,
     fit() : ajuster à la fenêtre, actual() : 100 %, pct() : zoom actuel en %,
     wheel: true (la loupe pose elle-même la règle de la molette sur la zone),
     ok: () => bool (la touche Z est-elle permise maintenant)
   })
   Molette : zoom · Maj + molette : horizontal · Ctrl + molette : vertical (le pincement du pavé tactile zoome).
   Loupe (Z) : tracer un cadre = zoomer dessus · clic = zoom avant · Alt + clic = zoom arrière. */
(function () {
  'use strict';
  let O = null, on = false, ov = null, btn = null, bar = null, saved = null, ctrlHeld = false, altHeld = false;
  const area = () => typeof O.area === 'function' ? O.area() : (typeof O.area === 'string' ? document.querySelector(O.area) : O.area);
  const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5M8 10.5h5M10.5 8v5"/></svg>';

  addEventListener('keydown', e => { if (e.key === 'Control' || e.key === 'Meta') ctrlHeld = true; if (e.key === 'Alt') { altHeld = true; cursor(); } }, true);
  addEventListener('keyup', e => { if (e.key === 'Control' || e.key === 'Meta') ctrlHeld = false; if (e.key === 'Alt') { altHeld = false; cursor(); } }, true);
  addEventListener('blur', () => { ctrlHeld = altHeld = false; cursor(); });

  /* règle commune de la molette */
  function wheel(e) {
    if (!O) return;
    const d0 = e.deltaY || e.deltaX, d = e.deltaMode === 1 ? d0 * 16 : d0;
    e.preventDefault();
    if (e.shiftKey) { O.panBy(-(e.deltaMode === 1 ? (e.deltaX || e.deltaY) * 16 : (e.deltaX || e.deltaY)), 0); }
    else if ((e.ctrlKey || e.metaKey) && ctrlHeld) { O.panBy(0, -d); }
    else { O.zoomBy(Math.pow(1.1, -Math.max(-300, Math.min(300, d)) / 60), e.clientX, e.clientY); }
    info();
  }

  function zoomRect(x0, y0, x1, y1) {
    const r = area().getBoundingClientRect();
    const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const f = Math.min(r.width / w, r.height / h) * 0.95;
    if (O.zoomTo) O.zoomTo(f, cx, cy, r.left + r.width / 2, r.top + r.height / 2);
    else { O.zoomBy(f, cx, cy); O.panBy(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy); }
    info();
  }

  function cursor() { if (ov) ov.style.cursor = altHeld ? 'zoom-out' : 'zoom-in'; }
  function place() { if (!ov || !on) return; const r = area().getBoundingClientRect(); const t = O.clipTop ? Math.max(r.top, O.clipTop()) : r.top; Object.assign(ov.style, { left: r.left + 'px', top: t + 'px', width: r.width + 'px', height: Math.max(0, r.bottom - t) + 'px' }); }
  function info() { if (O && O.later) return setTimeout(info0, 120); info0(); }
  function info0() { if (bar && O.pct) { const s = bar.querySelector('[data-z=pct]'); if (s) s.textContent = Math.round(O.pct()) + ' %'; } }

  function makeOverlay() {
    ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;z-index:50;background:transparent;touch-action:none';
    const rect = document.createElement('div');
    rect.style.cssText = 'position:fixed;border:1px dashed #1d1d1f;background:rgba(30,136,255,.12);box-shadow:0 0 0 1px rgba(255,255,255,.7);pointer-events:none;display:none;z-index:51';
    document.body.append(ov, rect);
    let st = null;
    ov.addEventListener('pointerdown', e => {
      if (e.button !== 0) return; e.preventDefault(); ov.setPointerCapture(e.pointerId);
      st = { x: e.clientX, y: e.clientY, alt: e.altKey };
    });
    ov.addEventListener('pointermove', e => {
      if (!st) return; const x0 = Math.min(st.x, e.clientX), y0 = Math.min(st.y, e.clientY);
      const w = Math.abs(e.clientX - st.x), h = Math.abs(e.clientY - st.y);
      if (w + h > 6) Object.assign(rect.style, { display: 'block', left: x0 + 'px', top: y0 + 'px', width: w + 'px', height: h + 'px' });
    });
    ov.addEventListener('pointerup', e => {
      if (!st) return; const s = st; st = null; rect.style.display = 'none';
      const w = Math.abs(e.clientX - s.x), h = Math.abs(e.clientY - s.y);
      if (w > 8 && h > 8 && !s.alt) zoomRect(s.x, s.y, e.clientX, e.clientY);
      else { O.zoomBy(s.alt || e.altKey ? 0.5 : 2, e.clientX, e.clientY); info(); }
    });
    ov.addEventListener('pointercancel', () => { st = null; rect.style.display = 'none'; });
    ov.addEventListener('wheel', wheel, { passive: false });
    ov.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('resize', place); addEventListener('scroll', place, true);
  }

  function makeBar() {
    bar = document.createElement('div');
    bar.className = 'azBar';
    bar.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12px';
    bar.innerHTML = '<b>Loupe</b><span style="color:#77756f">cadre : zoomer sur la zone · clic : zoom avant · Alt + clic : zoom arrière</span>' +
      '<span style="display:flex;gap:4px;align-items:center"><button type="button" class="btn sm" data-z="out" title="Zoom arrière">−</button><span data-z="pct" style="min-width:48px;text-align:center;font-variant-numeric:tabular-nums"></span><button type="button" class="btn sm" data-z="in" title="Zoom avant">+</button></span>' +
      '<button type="button" class="btn sm" data-z="fit" title="Voir tout (Ctrl + 0)">Ajuster à la fenêtre</button><button type="button" class="btn sm" data-z="one" title="Taille réelle">100 %</button>';
    bar.addEventListener('click', e => {
      const b = e.target.closest('[data-z]'); if (!b) return;
      const r = area().getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const k = b.dataset.z;
      if (k === 'in') O.zoomBy(1.25, cx, cy); else if (k === 'out') O.zoomBy(0.8, cx, cy);
      else if (k === 'fit') O.fit(); else if (k === 'one') O.actual();
      setTimeout(info, 30);
    });
  }

  function showBar() {
    const tb = document.getElementById('toolBar');
    if (tb && !O.floatBar) {
      saved = { tb, hidden: tb.hidden, kids: [...tb.children].map(c => [c, c.style.display]) };
      saved.kids.forEach(([c]) => c.style.display = 'none');
      tb.appendChild(bar); tb.hidden = false;
    } else {
      saved = null; const r = area().getBoundingClientRect();
      bar.style.cssText += ';position:fixed;z-index:52;background:#fff;border:1px solid #e3e0d9;border-radius:8px;padding:5px 10px;box-shadow:0 2px 8px rgba(0,0,0,.12)';
      bar.style.left = (r.left + 10) + 'px'; bar.style.top = (r.top + 8) + 'px';
      document.body.appendChild(bar);
    }
    info();
  }
  function hideBar() {
    if (saved) { const { tb, hidden, kids } = saved; if (bar.parentNode === tb) { bar.remove(); kids.forEach(([c, d]) => { if (c.parentNode === tb) c.style.display = d; }); tb.hidden = hidden; } saved = null; }
    else bar.remove();
  }

  function set(v) {
    v = !!v; if (v === on || !O) return; on = v;
    if (btn) btn.classList.toggle('on', on);
    if (on) { if (O.onStart) O.onStart(); place(); ov.style.display = 'block'; cursor(); showBar(); }
    else { ov.style.display = 'none'; hideBar(); if (O.onEnd) O.onEnd(); }
  }

  const AtelierZoom = {
    init(o) {
      O = o; makeOverlay(); ov.style.display = 'none'; makeBar();
      const a = area();
      if (o.wheel && a) a.addEventListener('wheel', wheel, { passive: false });
      if (a && window.ResizeObserver) new ResizeObserver(() => requestAnimationFrame(place)).observe(a);
      const pal = typeof o.tools === 'string' ? document.querySelector(o.tools) : o.tools;
      if (pal) {
        const ref = pal.querySelector('[data-tool], button');
        btn = document.createElement('button'); btn.type = 'button';
        btn.className = (o.btnClass || (ref ? ref.className : '')).replace(/\bon\b/, '').trim();
        btn.title = 'Loupe — zoomer sur une zone (Z)'; btn.innerHTML = o.btnHTML ? o.btnHTML(ICON) : ICON; btn.dataset.loupe = '1';
        const before = typeof o.before === 'string' ? pal.querySelector(o.before) : o.before;
        if (before && before.parentNode) before.parentNode.insertBefore(btn, before); else pal.appendChild(btn);
        btn.addEventListener('click', () => set(!on));
        // choisir un autre outil quitte la loupe
        pal.addEventListener('click', e => { const b = e.target.closest('button'); if (on && b && b !== btn) set(false); }, true);
      }
      document.addEventListener('keydown', e => {
        const t = document.activeElement;
        if (t && (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable)) return;
        const ctrl = e.ctrlKey || e.metaKey;
        if (!ctrl && !e.altKey && (e.key === 'z' || e.key === 'Z') && !(o.ok && !o.ok())) { e.preventDefault(); set(!on); return; }
        if (on && !ctrl && !e.altKey && /^[a-y]$/i.test(e.key) && !(o.ok && !o.ok())) set(false); // raccourci d'un autre outil
        if (on && e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); set(false); return; }
        if (ctrl && e.key === '0') { e.preventDefault(); o.fit(); setTimeout(info, 30); }
      }, true);
    },
    set, off: () => set(false), get on() { return on; }, wheel, info
  };
  window.AtelierZoom = AtelierZoom;
})();
