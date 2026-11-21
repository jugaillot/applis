/* Panneau de propriétés sur mobile : colonne d'icônes à droite (une icône par rubrique, bouton en haut pour ouvrir/replier),
   le détail s'ouvre en dessous, défile verticalement. Même principe que Cahier.
   AtelierMPanel.init({ bp:900, rows:true })  — bp : largeur sous laquelle le mode mobile s'applique ;
   rows : l'appli réserve une 2e ligne de grille pour le panneau du bas (à libérer). */
(function () {
  const IC = {
    page: '<path d="M6 3.5h8l4 4V20.5H6z"/><path d="M14 3.5v4h4"/>',
    layers: '<path d="M12 4l8 4.5-8 4.5-8-4.5z"/><path d="M4 12.5l8 4.5 8-4.5M4 16.5l8 4.5 8-4.5"/>',
    move: '<path d="M12 3.5v17M3.5 12h17M12 3.5l-2.5 2.5M12 3.5l2.5 2.5M12 20.5l-2.5-2.5M12 20.5l2.5-2.5M3.5 12L6 9.5M3.5 12L6 14.5M20.5 12L18 9.5M20.5 12L18 14.5"/>',
    drop: '<path d="M12 3.5c3.5 4.2 6 7 6 10a6 6 0 0 1-12 0c0-3 2.5-5.8 6-10z"/>',
    crop: '<path d="M7 3.5v13.5h13.5M3.5 7H17v13.5"/>',
    sliders: '<path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17" r="2"/>',
    sun: '<circle cx="12" cy="12" r="3.8"/><path d="M12 3.5v2.3M12 18.2v2.3M3.5 12h2.3M18.2 12h2.3M6 6l1.6 1.6M16.4 16.4L18 18M18 6l-1.6 1.6M7.6 16.4L6 18"/>',
    bars: '<path d="M6 19.5v-7M10.5 19.5v-12M15 19.5v-9M19 19.5v-5"/>',
    spark: '<path d="M12 4l1.8 5.2L19 11l-5.2 1.8L12 18l-1.8-5.2L5 11l5.2-1.8zM18.5 3.5v3M17 5h3"/>',
    search: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>',
    brush: '<path d="M4 20c3 0 4.5-1 4.5-3 0-1.6 1.2-2.5 2.5-2.5s2.5 1 2.5 2.5C13.5 19 11 20 4 20z"/><path d="M13.5 14.5L20 4"/>',
    down: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14"/>',
    type: '<path d="M5 7V5h14v2M12 5v14M9 19h6"/>',
    images: '<rect x="4" y="5" width="12" height="12" rx="1.5"/><path d="M8 19.5h10.5a1.5 1.5 0 0 0 1.5-1.5V8M4 14l3.5-3.5L12 15"/>',
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1"/>',
    list: '<path d="M8.5 6.5H20M8.5 12H20M8.5 17.5H20M4 6.5h1M4 12h1M4 17.5h1"/>',
    pen: '<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z"/><path d="M14.5 6.5l3 3"/>',
    panel: '<rect x="4" y="4.5" width="16" height="15" rx="2"/><path d="M14.5 4.5v15"/>'
  };
  const MAP = [
    [/export|taille et/i, 'down'], [/calque|layer/i, 'layers'], [/transf|sélection|objet|élément choisi|selec/i, 'move'],
    [/remplis|contour|couleur|encre|ink/i, 'drop'], [/rogn|géom/i, 'crop'], [/zone/i, 'crop'], [/lumi/i, 'sun'], [/niveau/i, 'bars'],
    [/effet/i, 'spark'], [/filtre|propri/i, 'sliders'], [/détail/i, 'search'], [/retouche/i, 'brush'], [/style/i, 'type'],
    [/import|groupe/i, 'images'], [/par feuille|placement|pages$/i, 'grid'], [/résumé/i, 'list'], [/texte ajout|annot/i, 'pen'],
    [/doc|papier|feuille|page/i, 'page']
  ];
  const svg = d => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
  function iconFor(t, key) {
    for (const [re, n] of MAP) if (re.test(t) || re.test(key || '')) return svg(IC[n]);
    return '<b style="font-size:15px">' + (t[0] || '•').toUpperCase() + '</b>';
  }
  function titleOf(sec) {
    const h = sec.querySelector(':scope > h2, :scope > summary, :scope h2, :scope summary'); if (!h) return '';
    const c = (h.querySelector('.ttl') || h).cloneNode(true);
    c.querySelectorAll('button,.muted,.tw,.grip,i,.row,input,select').forEach(e => e.remove());
    return c.textContent.replace(/\s+/g, ' ').trim();
  }

  const CSS = `
body.mp{--mpw:54px;--mph:46vh}
body.mp main{margin-right:var(--mpw)}
body.mp.mpo main{margin-bottom:var(--mph)}
body.mp #mini,body.mp #asideTop{display:none!important}
body.mp aside{position:fixed!important;left:0;right:var(--mpw);bottom:0;top:auto!important;width:auto!important;height:var(--mph);max-height:none!important;
  display:block!important;overflow-y:auto!important;overflow-x:hidden;-webkit-overflow-scrolling:touch;z-index:40;background:var(--panel,#fff);
  border:0!important;border-top:1px solid var(--line,#ddd)!important;box-shadow:0 -6px 18px rgba(0,0,0,.12);padding:0 12px 70px!important;grid-column:auto!important;grid-row:auto!important;
  visibility:hidden;pointer-events:none}
body.mp.mpo aside{visibility:visible;pointer-events:auto}
#mrail{display:none}
body.mp #mrail{display:flex;position:fixed;right:0;bottom:0;width:var(--mpw);flex-direction:column;align-items:center;gap:4px;padding:6px 0;
  background:var(--panel,#fff);border-left:1px solid var(--line,#ddd);z-index:41;overflow-y:auto;scrollbar-width:none}
#mrail::-webkit-scrollbar{display:none}
#mrail button{flex:none;width:48px;min-height:46px;border:1px solid transparent;border-radius:10px;background:none;color:var(--mute,#666);cursor:pointer;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:3px 0;font:inherit;font-size:9px;line-height:1.05}
#mrail button svg{width:22px;height:22px}
#mrail button span{max-width:46px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#mrail button.on{background:var(--ink,#1d1d1f);color:#fff}
#mrail #mrT{min-height:42px;color:var(--ink,#1d1d1f);border-color:var(--line,#ddd);margin-bottom:2px}
#mrail #mrT svg{width:24px;height:24px}
#mrail #mrT.on{color:#fff}
`;

  function init(o) {
    o = o || {};
    const bp = o.bp || 900, aside = document.querySelector('aside'); if (!aside) return;
    const st = document.createElement('style'); st.textContent = CSS + (o.rows ? '@media (max-width:' + bp + 'px){body.mp main{grid-template-rows:minmax(0,1fr)!important}}' : ''); document.head.appendChild(st);
    const mq = matchMedia('(max-width:' + bp + 'px)'), rail = document.createElement('div'); rail.id = 'mrail'; document.body.appendChild(rail);
    let sig = '', cur = null;
    const main = document.querySelector('main');
    const resize = () => setTimeout(() => window.dispatchEvent(new Event('resize')), 60);
    const secs = () => [...aside.children].filter(e => /^(SECTION|DETAILS)$/.test(e.tagName) && !e.hidden && e.style.display !== 'none' && (e.offsetHeight > 0 || e.getClientRects().length) && titleOf(e));
    function place() { if (!main) return; const t = Math.max(0, Math.round(main.getBoundingClientRect().top)); rail.style.top = t + 'px'; }
    function openSec(s) {
      document.body.classList.add('mpo'); cur = s || cur;
      if (s) { if (s.tagName === 'DETAILS') s.open = true; aside.scrollTop = Math.max(0, s.offsetTop - aside.offsetTop - 4); }
      paint(); resize();
    }
    function closeP() { document.body.classList.remove('mpo'); paint(); resize(); }
    function paint() {
      const open = document.body.classList.contains('mpo');
      rail.querySelectorAll('button').forEach(b => { if (b.id === 'mrT') b.classList.toggle('on', open); else b.classList.toggle('on', open && b._s === cur); });
    }
    function build() {
      if (!mq.matches) return;
      const l = secs(), s2 = l.map(e => titleOf(e)).join('|');
      if (s2 === sig && rail.firstChild) { place(); return; }
      sig = s2; rail.innerHTML = '';
      const t = document.createElement('button'); t.id = 'mrT'; t.type = 'button'; t.title = 'Ouvrir / replier le panneau'; t.innerHTML = svg(IC.panel);
      t.onclick = () => { if (document.body.classList.contains('mpo')) closeP(); else openSec(cur && l.includes(cur) ? cur : l[0]); };
      rail.appendChild(t);
      l.forEach(e => {
        const tt = titleOf(e), b = document.createElement('button'); b.type = 'button'; b.title = tt; b._s = e;
        b.innerHTML = iconFor(tt, e.dataset.sec) + '<span>' + tt + '</span>';
        b.onclick = () => { if (document.body.classList.contains('mpo') && cur === e) closeP(); else openSec(e); };
        rail.appendChild(b);
      });
      place(); paint();
    }
    function apply() {
      const on = mq.matches;
      document.body.classList.toggle('mp', on);
      if (on) { document.body.classList.remove('amini'); document.body.classList.remove('mpo'); build(); }
      else { document.body.classList.remove('mpo'); }
      resize();
    }
    mq.addEventListener ? mq.addEventListener('change', apply) : mq.addListener(apply);
    addEventListener('resize', () => { if (mq.matches) place(); });
    let tm = 0;
    new MutationObserver(() => { clearTimeout(tm); tm = setTimeout(build, 200); })
      .observe(aside, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'style', 'class'] });
    apply(); setTimeout(build, 600); setTimeout(build, 2000);
  }
  window.AtelierMPanel = { init };
})();
