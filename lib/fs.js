/* Bouton « plein écran » commun : rond, en haut à droite, au même endroit dans toutes les applis.
   Plein écran = le visuel prend toute la place (en-tête, onglets et panneaux masqués). */
(function(){
  var app=(location.pathname.match(/\/([^\/]+)\/(?:index\.html)?$/)||[])[1]||'';
  var HIDE={
    vecto:'header,#atabs,aside', paysage:'header,#atabs,aside', plan:'header,#atabs,#status',
    riso:'header,#atabs,#tools,aside', photo:'header,#tools,#strip,aside',
    mise:'header', cahier:'header', civco:'header'
  };
  /* volets d'outils (gauche) et de propriétés (droite) : repliés en plein écran, ils apparaissent quand la souris touche le bord */
  var EDGE={vecto:[86,290],paysage:[86,290],plan:[64,270],riso:[86,350],photo:[86,330],mise:[86,300]};
  function edgeCss(){
    var e=EDGE[app]; if(!e)return '';
    var H=(HIDE[app]||'').split(',').filter(function(x){return x!=='aside'&&x!=='#tools';});
    var pan='position:fixed!important;top:0!important;bottom:0!important;z-index:8500!important;overflow-y:auto!important;grid-column:auto!important;grid-row:auto!important;transition:transform .18s ease;';
    return '@media (min-width:901px){'+
      (H.length?'html.fs-on '+H.join(',html.fs-on ')+'{display:none!important}':'')+
      'html.fs-on main{grid-template-columns:minmax(0,1fr)!important}'+
      'html.fs-on main>*:not(#tools):not(aside):not(#strip){grid-column:1!important;grid-row:1!important}'+
      'html.fs-on #strip{display:none!important}'+
      'html.fs-on #tools{'+pan+'left:0!important;width:'+e[0]+'px!important;transform:translateX(-105%);box-shadow:2px 0 14px rgba(0,0,0,.28)}'+
      'html.fs-on aside{'+pan+'right:0!important;width:'+e[1]+'px!important;transform:translateX(105%);box-shadow:-2px 0 14px rgba(0,0,0,.28)}'+
      'html.fs-on.fs-showL #tools,html.fs-on.fs-showR aside{transform:none}'+
      '.fsEdge{display:none;position:fixed;top:0;bottom:0;width:12px;z-index:8400}'+
      'html.fs-on .fsEdge{display:block}#fsEdgeL{left:0}#fsEdgeR{right:0}}';
  }
  if(app==='compil'){ /* le PDF a déjà son plein écran : on déclenche le même */ }
  else if(!HIDE[app])return;
  var css='#fsBtn{position:fixed;top:8px;right:8px;z-index:9000;width:38px;height:38px;border-radius:50%;border:1px solid rgba(0,0,0,.25);background:rgba(255,255,255,.94);color:#222;display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer;box-shadow:0 1px 6px rgba(0,0,0,.25)}'+
    '#fsBtn svg{width:20px;height:20px}#fsBtn:active{background:#e8e8e8}'+
    'body>header{padding-right:54px!important}'+(app==='cahier'?'':'@media (max-width:900px){body>header{flex-wrap:nowrap!important;overflow-x:auto;white-space:nowrap;scrollbar-width:none}body>header::-webkit-scrollbar{display:none}body>header>*{flex:none}}')+'body:has(#crop:not([hidden])) #fsBtn,body:has(#cam:not([hidden])) #fsBtn,body:has(#vec:not([hidden])) #fsBtn{display:none}'+
    (app==='compil'?'#fsView:not([hidden])~#fsBtn,body:has(#fsView:not([hidden])) #fsBtn{display:none}':
     (EDGE[app]?'@media (max-width:900px){':'')+'html.fs-on '+(HIDE[app]||'').split(',').join(',html.fs-on ')+'{display:none!important}'+(EDGE[app]?'}':'')+
     'html.fs-on main{grid-template-rows:minmax(0,1fr)!important}'+edgeCss()+((app==='riso'||app==='photo')?'html.fs-on main{grid-template-columns:minmax(0,1fr)!important}html.fs-on #stageWrap,html.fs-on #center{grid-column:1!important;grid-row:1!important}':'')+'html.fs-on #fsBtn{opacity:.75}'+(app==='mise'?'html.fs-on #tools,html.fs-on #toolBar{padding-right:52px}':''));
  var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
  var b=document.createElement('button');b.id='fsBtn';b.type='button';b.title='Plein écran';b.setAttribute('aria-label','Plein écran');
  var IN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
      OUT='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';
  b.innerHTML=IN;
  function resize(){setTimeout(function(){window.dispatchEvent(new Event('resize'));},60);setTimeout(function(){window.dispatchEvent(new Event('resize'));},350);}
  function set(on){document.documentElement.classList.toggle('fs-on',on);if(!on)document.documentElement.classList.remove('fs-showL','fs-showR');b.innerHTML=on?OUT:IN;b.title=on?'Quitter le plein écran':'Plein écran';resize();}
  b.onclick=function(){
    if(app==='compil'){var f=document.getElementById('bFull');if(f&&!f.disabled)f.click();else alert('Ajoute d’abord des pages au document.');return;}
    var on=!document.documentElement.classList.contains('fs-on');set(on);
    try{var d=document.documentElement;if(on&&d.requestFullscreen&&!document.fullscreenElement)d.requestFullscreen().catch(function(){});else if(!on&&document.fullscreenElement)document.exitFullscreen();}catch(e){}
  };
  var F11=window.matchMedia?matchMedia('(display-mode: fullscreen)'):null;
  function f11(){return !!(F11&&F11.matches)||(!document.fullscreenElement&&innerHeight>=screen.height-1&&innerWidth>=screen.width-1&&screen.width>900);}
  document.addEventListener('fullscreenchange',function(){if(!document.fullscreenElement&&!f11()&&document.documentElement.classList.contains('fs-on'))set(false);});
  /* F11 (plein écran du navigateur) : même effet que le bouton */
  if(app!=='compil'){
    var last=f11(),tm=null;
    function chk(){clearTimeout(tm);tm=setTimeout(function(){var n=f11();if(n!==last){last=n;if(n!==document.documentElement.classList.contains('fs-on'))set(n);}},120);}
    window.addEventListener('resize',chk);if(F11&&F11.addEventListener)F11.addEventListener('change',chk);
    if(last)document.addEventListener('DOMContentLoaded',function(){set(true);});
  }
  /* bords sensibles */
  if(EDGE[app]){
    var root=document.documentElement,hideT=null;
    function mk(id){var d=document.createElement('div');d.id=id;d.className='fsEdge';return d;}
    function show(side){clearTimeout(hideT);root.classList.toggle('fs-showL',side==='L');root.classList.toggle('fs-showR',side==='R');}
    function hide(now){clearTimeout(hideT);hideT=setTimeout(function(){
      var a=document.activeElement,p=(a&&a.closest)?a.closest('#tools,aside'):null;
      if(p&&/^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)&&!now)return;
      root.classList.remove('fs-showL','fs-showR');},now?0:350);}
    function init(){
      var L=mk('fsEdgeL'),R=mk('fsEdgeR');document.body.appendChild(L);document.body.appendChild(R);
      L.addEventListener('mouseenter',function(e){if(!e.buttons)show('L');});R.addEventListener('mouseenter',function(e){if(!e.buttons)show('R');});
      [[L,'#tools'],[R,'aside']].forEach(function(x){
        var pn=document.querySelector(x[1]);
        x[0].addEventListener('mouseleave',function(e){if(!(pn&&pn.contains(e.relatedTarget)))hide();});
        if(!pn)return;
        pn.addEventListener('mouseenter',function(){clearTimeout(hideT);});
        pn.addEventListener('mouseleave',function(){hide();});
        pn.addEventListener('click',function(e){if(!root.classList.contains('fs-on'))return;var t=e.target.closest&&e.target.closest('button,[data-tool],.tool,label,a,summary');if(t&&!t.closest('input,select,textarea'))setTimeout(function(){hide(true);},120);});
        pn.addEventListener('change',function(){if(root.classList.contains('fs-on'))setTimeout(function(){hide(true);},150);});
      });
    }
    if(document.body)init();else document.addEventListener('DOMContentLoaded',init);
  }
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&document.documentElement.classList.contains('fs-on')&&!document.querySelector('dialog[open]'))set(false);});
  if(document.body)document.body.appendChild(b);else document.addEventListener('DOMContentLoaded',function(){document.body.appendChild(b);});
})();
