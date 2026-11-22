/* La Suite — sélection de couleur commune : carré + bande de teintes + barres C M J N (remplace la fenêtre RVB du navigateur).
   Il suffit de charger ce fichier : toute pastille <input type="color"> de la page ouvre ce sélecteur. */
(function(){
if(window.AtelierColor)return;
const st=document.createElement('style');st.textContent=`/* barres C M J N : fines, avec aperçu du résultat sur chaque barre */
.cmx input[type=range]{-webkit-appearance:none;appearance:none;height:9px!important;min-height:0!important;border-radius:5px;background:var(--g,#ddd);margin:0;padding:0;border:1px solid rgba(0,0,0,.18);min-width:0}
.cmx input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:10px;height:12px;border-radius:3px;background:#fff;border:1px solid #555;box-shadow:0 1px 2px rgba(0,0,0,.3)}
.cmx input[type=range]::-moz-range-thumb{width:8px;height:11px;border-radius:4px;background:#fff;border:1px solid #555}
.cmx input[type=range]::-moz-range-track{background:transparent}
.svp{display:flex;flex-direction:column;gap:5px;margin:2px 0 6px}.svp canvas{width:100%;display:block;border-radius:6px;border:1px solid rgba(0,0,0,.18)}.svp .sv{height:84px}.svp .hu{height:12px}
.cmx label{display:flex!important;flex-direction:row!important;align-items:center!important;gap:6px;margin:3px 0!important;line-height:1}
.cmx label b{width:12px;font-size:12px}.cmx label input{flex:1;width:auto}.cmx label span{width:24px;text-align:right;font-size:11px;color:#77756f}
`;document.head.appendChild(st);
function hexToCmyk(h){const n=parseInt(h.slice(1),16),r=(n>>16&255)/255,g=(n>>8&255)/255,b=(n&255)/255,k=1-Math.max(r,g,b);if(k>=1)return[0,0,0,100];return[(1-r-k)/(1-k),(1-g-k)/(1-k),(1-b-k)/(1-k),k].map(v=>Math.round(v*100));}
function cmykToHex(c){const k=1-c[3]/100,f=v=>Math.round(255*(1-c[v]/100)*k).toString(16).padStart(2,'0');return'#'+f(0)+f(1)+f(2);}
/* spectre + carré de couleur (comme l'ancien sélecteur), au-dessus des barres C M J N */
function svPicker(hex,onPick,onEnd){
  const w=document.createElement('div');w.className='svp';w.innerHTML='<canvas class="sv" width="200" height="84"></canvas><canvas class="hu" width="200" height="12"></canvas>';
  const sv=w.querySelector('.sv'),hu=w.querySelector('.hu');let h=0,sa=0,va=1;
  const rgb=x=>{const n=parseInt((x||'#000000').slice(1),16);return[n>>16&255,n>>8&255,n&255];};
  const toHsv=x=>{const[r,g,b]=rgb(x).map(c=>c/255),M=Math.max(r,g,b),m=Math.min(r,g,b),d=M-m;let hh=0;if(d){hh=M===r?((g-b)/d)%6:M===g?(b-r)/d+2:(r-g)/d+4;hh*=60;if(hh<0)hh+=360;}return[hh,M?d/M:0,M];};
  const toHex=(hh,ss,vv)=>{const f=n=>{const k=(n+hh/60)%6;return Math.round(255*(vv-vv*ss*Math.max(0,Math.min(k,4-k,1))));};return'#'+[f(5),f(3),f(1)].map(c=>c.toString(16).padStart(2,'0')).join('');};
  function draw(){
    let g=sv.getContext('2d');g.setTransform(1,0,0,1,0,0);g.fillStyle=toHex(h,1,1);g.fillRect(0,0,200,84);
    let l=g.createLinearGradient(0,0,200,0);l.addColorStop(0,'#fff');l.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=l;g.fillRect(0,0,200,84);
    l=g.createLinearGradient(0,0,0,84);l.addColorStop(0,'rgba(0,0,0,0)');l.addColorStop(1,'#000');g.fillStyle=l;g.fillRect(0,0,200,84);
    g.strokeStyle='#fff';g.lineWidth=2;g.beginPath();g.arc(sa*200,(1-va)*84,5,0,7);g.stroke();g.strokeStyle='#000';g.lineWidth=1;g.beginPath();g.arc(sa*200,(1-va)*84,6.5,0,7);g.stroke();
    g=hu.getContext('2d');g.setTransform(1,0,0,1,0,0);l=g.createLinearGradient(0,0,200,0);for(let i=0;i<=6;i++)l.addColorStop(i/6,toHex(i*60,1,1));g.fillStyle=l;g.fillRect(0,0,200,12);
    g.fillStyle='#fff';g.strokeStyle='#000';g.lineWidth=1;g.fillRect(h/360*200-2,0,4,12);g.strokeRect(h/360*200-2,0,4,12);
  }
  function drag(cv,fn){
    cv.style.touchAction='none';
    cv.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();cv.setPointerCapture(e.pointerId);const mv=ev=>{const r=cv.getBoundingClientRect();fn(Math.max(0,Math.min(1,(ev.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(ev.clientY-r.top)/r.height)));draw();onPick(toHex(h,sa,va));};mv(e);const up=()=>{cv.removeEventListener('pointermove',mv);cv.removeEventListener('pointerup',up);cv.removeEventListener('pointercancel',up);onEnd&&onEnd();};cv.addEventListener('pointermove',mv);cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);});
  }
  drag(sv,(x,y)=>{sa=x;va=1-y;});drag(hu,x=>{h=x*359.9;});
  w.set=x=>{const t=toHsv(x);if(t[1]>0.02&&t[2]>0.02)h=t[0];sa=t[1];va=t[2];draw();};
  w.set(hex);return w;
}
function cmykG(v,i){const a=v.slice(),b=v.slice();a[i]=0;b[i]=100;return 'linear-gradient(to right,'+cmykToHex(a)+','+cmykToHex(b)+')';}
function paintCmykG(box,v){box.querySelectorAll('input[type=range]').forEach((r,i)=>r.style.setProperty('--g',cmykG(v,i)));}

/* toute pastille de couleur (papier, tracé de l'aquarelle…) : petites barres C M J N à la place de la fenêtre RVB */
(function(){
  let pop=null,cur=null,vals=[0,0,0,0];
  function close(){if(pop){pop.remove();pop=null;cur=null;}}
  function apply(fin){if(!cur)return;cur.value=cmykToHex(vals);cur.dispatchEvent(new Event('input',{bubbles:true}));if(fin)cur.dispatchEvent(new Event('change',{bubbles:true}));}
  function open(inp){
    close();cur=inp;vals=hexToCmyk(inp.value||'#000000');
    pop=document.createElement('div');pop.className='cmx';pop.style.cssText='position:fixed;z-index:99999;background:#fff;border:1px solid #cfcbc2;border-radius:10px;padding:6px 10px;box-shadow:0 6px 24px rgba(0,0,0,.25);width:220px;touch-action:manipulation;font:12px system-ui,sans-serif';
    pop.innerHTML=[['C','#00a6d6'],['M','#e6007e'],['J','#f2c200'],['N','#333']].map(([l,c],i)=>`<label><b style="color:${c}">${l}</b><input type="range" min="0" max="100" value="${vals[i]}" data-i="${i}"><span>${vals[i]}</span></label>`).join('');
    const sp=svPicker(cmykToHex(vals),hx=>{vals=hexToCmyk(hx);pop.querySelectorAll('input[type=range]').forEach((r,i)=>{r.value=vals[i];r.nextElementSibling.textContent=vals[i];});paintCmykG(pop,vals);apply(false);},()=>apply(true));
    pop.insertBefore(sp,pop.firstChild);pop._sp=sp;
    document.body.appendChild(pop);paintCmykG(pop,vals);
    let r=inp.getBoundingClientRect();if(!r.width&&!r.height)r={left:innerWidth/2-20,bottom:innerHeight/3,top:innerHeight/3};pop.style.left=Math.max(8,Math.min(innerWidth-236,r.left-100))+'px';pop.style.top=Math.max(8,Math.min(innerHeight-pop.offsetHeight-8,r.bottom+6))+'px';
    pop.addEventListener('input',e=>{const i=+e.target.dataset.i;vals[i]=+e.target.value;e.target.nextElementSibling.textContent=vals[i];paintCmykG(pop,vals);pop._sp.set(cmykToHex(vals));apply(false);});
    pop.addEventListener('change',()=>apply(true));
  }
  document.addEventListener('click',e=>{
    const c=e.target.closest&&e.target.closest('input[type=color]');
    if(c&&c.dataset.la!=='col'){e.preventDefault();e.stopPropagation();pop&&cur===c?close():open(c);return;}
    if(pop&&!pop.contains(e.target))close();
  },true);
  addEventListener('keydown',e=>{if(e.key==='Escape')close();},true);
})();

window.AtelierColor={svPicker,hexToCmyk,cmykToHex};
})();
