/* « Fichiers récents » : les 5 derniers fichiers ouverts / documents de chaque appli, dans la barre du haut.
   AtelierRecent.init({app, openDocs: ()=>…, openDoc: (id)=>…})
   - fichiers importés : copie gardée dans le navigateur (IndexedDB), rouverte comme un glisser-déposer
   - documents enregistrés (Sync) : rouverts par openDocs() après AtelierSync.pendingOpen = id */
(function(){
  'use strict';
  const MAX=5, MAXBYTES=80*1024*1024, EXCL=['phFile','vxFile','sgFile','cLogo'];
  let APP=null, CFG={};
  const db=()=>new Promise((res,rej)=>{const r=indexedDB.open('la-suite-recent',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
  async function get(k){try{const d=await db();return await new Promise(r=>{const q=d.transaction('kv').objectStore('kv').get(k);q.onsuccess=()=>r(q.result||[]);q.onerror=()=>r([]);});}catch(e){return [];}}
  async function set(k,v){try{const d=await db();await new Promise(r=>{const t=d.transaction('kv','readwrite');t.objectStore('kv').put(v,k);t.oncomplete=()=>r();t.onerror=()=>r();});}catch(e){}}
  let chain=Promise.resolve();const queue=fn=>{chain=chain.then(fn).catch(()=>{});return chain;};
  const same=(a,b)=>a.k===b.k&&(a.k==='doc'?a.id===b.id:(a.name===b.name&&a.size===b.size));
  function push(app,item){return queue(async()=>{let l=await get(app);l=l.filter(x=>!same(x,item));l.unshift(item);l=l.slice(0,MAX);await set(app,l);});}
  async function addFiles(app,files){app=app||APP;if(!app)return;
    for(const f of files){if(!f||!f.name||f.size>MAXBYTES)continue;
      try{const data=await f.arrayBuffer();await push(app,{k:'file',name:f.name,type:f.type||'',size:f.size,data,at:Date.now()});}catch(e){}}}
  async function addHandles(app,hs){const fs=[];for(const h of hs||[]){try{fs.push(await h.getFile());}catch(e){}}return addFiles(app,fs);}
  const lastDoc={};
  function addDoc(app,id,name){app=app||APP;if(!app||!id)return;if(lastDoc[app]===id)return;lastDoc[app]=id;return push(app,{k:'doc',id,name:name||'Document',at:Date.now()});}
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const ago=t=>{const m=Math.round((Date.now()-t)/60000);if(m<1)return 'à l’instant';if(m<60)return 'il y a '+m+' min';const h=Math.round(m/60);if(h<24)return 'il y a '+h+' h';return 'il y a '+Math.round(h/24)+' j';};
  async function reopen(it){
    if(it.k==='doc'){if(CFG.openDoc){CFG.openDoc(it.id);return;}
      if(window.AtelierSync&&CFG.openDocs){AtelierSync.pendingOpen=it.id;CFG.openDocs();}return;}
    const f=new File([it.data],it.name,{type:it.type});
    const dt=new DataTransfer();dt.items.add(f);
    const ev=new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true});ev.__recent=1;document.body.dispatchEvent(ev);
  }
  function menu(btn){
    let m=document.getElementById('recentMenu');if(m){m.remove();return;}
    m=document.createElement('div');m.id='recentMenu';
    m.style.cssText='position:fixed;z-index:99999;min-width:260px;max-width:min(420px,94vw);background:#fff;border:1px solid #e3e0d9;border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.18);padding:6px;font:13px/1.35 system-ui,"Segoe UI",sans-serif;color:#1d1d1f';
    const r=btn.getBoundingClientRect();m.style.top=(r.bottom+4)+'px';m.style.left=Math.max(6,Math.min(r.left,innerWidth-270))+'px';
    document.body.appendChild(m);
    const close=()=>{m.remove();document.removeEventListener('mousedown',out,true);document.removeEventListener('keydown',esk,true);};
    const out=e=>{if(!m.contains(e.target)&&e.target!==btn)close();};const esk=e=>{if(e.key==='Escape')close();};
    document.addEventListener('mousedown',out,true);document.addEventListener('keydown',esk,true);
    get(APP).then(l=>{
      if(!l.length){m.innerHTML='<div style="padding:10px 12px;color:#77756f">Aucun fichier récent pour l’instant.</div>';return;}
      m.innerHTML=l.map((it,i)=>'<button type="button" data-i="'+i+'" style="display:flex;flex-direction:column;align-items:flex-start;gap:1px;width:100%;text-align:left;font:inherit;border:0;background:#fff;border-radius:7px;padding:7px 10px;cursor:pointer"><b style="font-weight:600;word-break:break-all">'+(it.k==='doc'?'🗂 ':'📄 ')+esc(it.name)+'</b><span style="color:#77756f;font-size:12px">'+(it.k==='doc'?'Document enregistré':'Fichier importé')+' · '+ago(it.at)+'</span></button>').join('')+
        '<div style="border-top:1px solid #f0eee9;margin-top:4px;padding-top:4px"><button type="button" data-clear="1" style="font:inherit;border:0;background:#fff;color:#77756f;padding:6px 10px;cursor:pointer;border-radius:7px">Effacer la liste</button></div>';
      m.querySelectorAll('button').forEach(b=>{b.onmouseenter=()=>b.style.background='#f7f6f2';b.onmouseleave=()=>b.style.background='#fff';});
      m.onclick=async e=>{const b=e.target.closest('button');if(!b)return;
        if(b.dataset.clear){await set(APP,[]);close();return;}
        const it=l[+b.dataset.i];close();if(it)reopen(it);};
    });
  }
  function init(cfg){
    APP=cfg.app;CFG=cfg;
    const h1=document.querySelector('header h1');if(!h1||document.getElementById('bRecent'))return;
    const b=document.createElement('button');b.type='button';b.className='btn';b.id='bRecent';b.textContent='Fichiers récents ▾';b.title='Les 5 derniers fichiers ouverts dans cette appli';
    b.onclick=()=>menu(b);h1.insertAdjacentElement('afterend',b);
    /* fichiers choisis par « Ajouter / Importer / Ouvrir… » */
    document.addEventListener('change',e=>{const t=e.target;if(!t||t.type!=='file'||!t.files||!t.files.length||EXCL.includes(t.id)||t.hasAttribute('data-norecent'))return;addFiles(APP,[...t.files]);},true);
    /* fichiers déposés dans la fenêtre */
    window.addEventListener('drop',e=>{if(e.__recent)return;const fs=e.dataTransfer&&[...e.dataTransfer.files];if(fs&&fs.length)addFiles(APP,fs);},true);
  }
  window.AtelierRecent={init,addFiles,addHandles,addDoc,reopen};
})();
