/* Bouton « plein écran » commun : rond, en haut à droite, au même endroit dans toutes les applis.
   Plein écran = le visuel prend toute la place (en-tête, onglets et panneaux masqués). */
(function(){
  var app=(location.pathname.match(/\/([^\/]+)\/(?:index\.html)?$/)||[])[1]||'';
  var HIDE={
    vecto:'header,#atabs,aside', paysage:'header,#atabs,aside', plan:'header,#atabs,#status',
    riso:'header,#atabs,#tools,aside', photo:'header,#tools,#strip,aside',
    mise:'header', cahier:'header', civco:'header'
  };
  if(app==='compil'){ /* le PDF a déjà son plein écran : on déclenche le même */ }
  else if(!HIDE[app])return;
  var css='#fsBtn{position:fixed;top:8px;right:8px;z-index:9000;width:38px;height:38px;border-radius:50%;border:1px solid rgba(0,0,0,.25);background:rgba(255,255,255,.94);color:#222;display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer;box-shadow:0 1px 6px rgba(0,0,0,.25)}'+
    '#fsBtn svg{width:20px;height:20px}#fsBtn:active{background:#e8e8e8}'+
    'body>header{padding-right:54px!important}body:has(#crop:not([hidden])) #fsBtn,body:has(#cam:not([hidden])) #fsBtn,body:has(#vec:not([hidden])) #fsBtn{display:none}'+
    (app==='compil'?'#fsView:not([hidden])~#fsBtn,body:has(#fsView:not([hidden])) #fsBtn{display:none}':
     'html.fs-on '+(HIDE[app]||'').split(',').join(',html.fs-on ')+'{display:none!important}'+
     'html.fs-on main{grid-template-rows:minmax(0,1fr)!important}html.fs-on #fsBtn{opacity:.75}'+(app==='mise'?'html.fs-on #tools,html.fs-on #toolBar{padding-right:52px}':''));
  var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
  var b=document.createElement('button');b.id='fsBtn';b.type='button';b.title='Plein écran';b.setAttribute('aria-label','Plein écran');
  var IN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
      OUT='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';
  b.innerHTML=IN;
  function resize(){setTimeout(function(){window.dispatchEvent(new Event('resize'));},60);setTimeout(function(){window.dispatchEvent(new Event('resize'));},350);}
  function set(on){document.documentElement.classList.toggle('fs-on',on);b.innerHTML=on?OUT:IN;b.title=on?'Quitter le plein écran':'Plein écran';resize();}
  b.onclick=function(){
    if(app==='compil'){var f=document.getElementById('bFull');if(f&&!f.disabled)f.click();else alert('Ajoute d’abord des pages au document.');return;}
    var on=!document.documentElement.classList.contains('fs-on');set(on);
    try{var d=document.documentElement;if(on&&d.requestFullscreen&&!document.fullscreenElement)d.requestFullscreen().catch(function(){});else if(!on&&document.fullscreenElement)document.exitFullscreen();}catch(e){}
  };
  document.addEventListener('fullscreenchange',function(){if(!document.fullscreenElement&&document.documentElement.classList.contains('fs-on'))set(false);});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&document.documentElement.classList.contains('fs-on')&&!document.querySelector('dialog[open]'))set(false);});
  if(document.body)document.body.appendChild(b);else document.addEventListener('DOMContentLoaded',function(){document.body.appendChild(b);});
})();
