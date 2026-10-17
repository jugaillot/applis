/* Atelier — couleur de chaque appli + roue crantée « raccourcis et réglages ». */
(function () {
  'use strict';
  const THEMES = {
    riso:   { bg: '#ffe3ef', acc: '#f0679f', name: 'Riso' },
    vecto:  { bg: '#dcf6ea', acc: '#2fae80', name: 'Vecto' },
    compil: { bg: '#e8e3ff', acc: '#7c6cf0', name: 'Compil' },
    plan:   { bg: '#dcefff', acc: '#3d8fdc', name: 'Plan' },
    photo:  { bg: '#ffe6d3', acc: '#f08a4b', name: 'Photo' },
    home:   { bg: '#fff3d6', acc: '#e89a2c', name: 'Atelier' }
  };
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function kbd(s) { return String(s).split(' + ').map(k => '<kbd>' + esc(k) + '</kbd>').join(' + '); }

  window.AtelierHelp = {
    THEMES,
    init(o) {
      const t = THEMES[o.app] || THEMES.home;
      const root = document.documentElement;
      root.style.setProperty('--acc', t.acc);
      root.style.setProperty('--app-bg', t.bg);
      const css = document.createElement('style');
      css.textContent = `
header{background:var(--app-bg)!important;border-bottom-color:color-mix(in srgb,var(--acc) 30%,transparent)!important}
header h1 span{color:var(--acc)!important}
.btn.accent{background:var(--acc)!important;border-color:var(--acc)!important;color:#fff!important}
#helpBtn{border:0;background:rgba(255,255,255,.7);width:32px;height:32px;border-radius:50%;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;color:#1d1d1f;margin-left:2px;flex:none}
#helpBtn:hover{background:#fff}
#helpBtn svg{width:19px;height:19px}
#helpPanel{position:fixed;top:0;right:0;bottom:0;width:min(440px,96vw);background:#fff;box-shadow:-8px 0 30px rgba(0,0,0,.18);z-index:80;display:flex;flex-direction:column;transform:translateX(105%);transition:transform .2s ease;font:13px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1d1d1f}
#helpPanel.open{transform:none}
#helpPanel .hh{display:flex;align-items:center;gap:8px;padding:14px 16px;background:var(--app-bg);border-bottom:1px solid rgba(0,0,0,.06)}
#helpPanel .hh b{font-size:15px}
#helpPanel .hh i{width:12px;height:12px;border-radius:50%;background:var(--acc);display:inline-block}
#helpPanel .hh button{margin-left:auto;border:0;background:rgba(255,255,255,.7);border-radius:50%;width:28px;height:28px;cursor:pointer;font-size:15px}
#helpPanel .hb{overflow:auto;padding:4px 16px 30px}
#helpPanel h3{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--acc);margin:16px 0 6px}
#helpPanel table{width:100%;border-collapse:collapse}
#helpPanel td{padding:4px 0;vertical-align:top;border-bottom:1px solid #f1efea}
#helpPanel td:first-child{white-space:nowrap;padding-right:10px;width:1%}
#helpPanel kbd{font:11.5px ui-monospace,Menlo,Consolas,monospace;background:#f7f6f2;border:1px solid #e3e0d9;border-bottom-width:2px;border-radius:5px;padding:1px 5px;color:#1d1d1f}
#helpPanel p{margin:6px 0;color:#55534e}
#helpPanel dl{margin:0}#helpPanel dt{font-weight:600;margin-top:8px}#helpPanel dd{margin:2px 0 0 0;color:#55534e}`;
      document.head.appendChild(css);
      // bouton roue crantée, en haut à droite
      const header = document.querySelector('header');
      const btn = document.createElement('button');
      btn.id = 'helpBtn'; btn.title = 'Raccourcis clavier et réglages';
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
      if (header) header.appendChild(btn);
      // panneau
      const panel = document.createElement('div');
      panel.id = 'helpPanel';
      let h = `<div class="hh"><i></i><b>${esc(o.title || t.name)} — raccourcis et réglages</b><button title="Fermer">✕</button></div><div class="hb">`;
      for (const s of o.sections || []) {
        h += `<h3>${esc(s.title)}</h3>`;
        if (s.text) h += `<p>${esc(s.text)}</p>`;
        if (s.keys) h += '<table>' + s.keys.map(([k, d]) => `<tr><td>${kbd(k)}</td><td>${esc(d)}</td></tr>`).join('') + '</table>';
        if (s.params) h += '<dl>' + s.params.map(([k, d]) => `<dt>${esc(k)}</dt><dd>${esc(d)}</dd>`).join('') + '</dl>';
      }
      h += '</div>';
      panel.innerHTML = h;
      document.body.appendChild(panel);
      const close = () => panel.classList.remove('open');
      btn.onclick = e => { e.stopPropagation(); panel.classList.toggle('open'); };
      panel.querySelector('.hh button').onclick = close;
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && panel.classList.contains('open')) { close(); e.stopImmediatePropagation(); } }, true);
      document.addEventListener('mousedown', e => { if (panel.classList.contains('open') && !panel.contains(e.target) && e.target !== btn && !btn.contains(e.target)) close(); });
    }
  };
})();
