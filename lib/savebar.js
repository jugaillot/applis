/* La Suite — boutons « Enregistrer » et « Exporter… » communs à toutes les applis.
   AtelierSaveBar.init({
     app, save:'#bSave', exp:'#bPdf',
     key:()=>objet propre au document ouvert (la préférence est oubliée quand on en change),
     serverId:()=>id du document sur le serveur (ou null),
     saveServer:async()=>…,            enregistre sur le serveur (demande le nom la première fois)
     file:()=>({name,overwrite:async()=>…})|null,   fichier d'origine qu'on peut écraser
     copy:async()=>…,                  télécharge une copie (.json)
     pdf:async()=>octets du PDF,       permet aussi l'export en images JPG
     pages:()=>({n,W,H}),              nombre de feuilles et taille en mm (pour estimer le poids des JPG)
     formats:[{id,label,hint,run:async(ctx)=>…}]   formats d'export propres à l'appli
   })
   - document venu du serveur : « Enregistrer » enregistre sur le serveur ;
   - sinon : la 1re fois, choix « écraser le fichier » / « enregistrer sur le serveur », puis on s'en souvient
     jusqu'à la fermeture du document ;
   - « Exporter… » : format (PDF, JPG, …) + dossier. */
(function(){
  'use strict';
  if(window.AtelierSaveBar)return;
  const PREF=new WeakMap();
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const stamp=()=>new Date().toISOString().slice(0,10);
  function toast(t){
    let d=document.getElementById('sbToast');if(!d){d=document.createElement('div');d.id='sbToast';d.style.cssText='position:fixed;left:50%;bottom:80px;transform:translateX(-50%);background:#1d1d1f;color:#fff;padding:8px 14px;border-radius:10px;font:13px system-ui,sans-serif;z-index:99999;opacity:0;transition:opacity .2s;pointer-events:none';document.body.appendChild(d);}
    d.textContent=t;d.style.opacity='1';clearTimeout(d._t);d._t=setTimeout(()=>d.style.opacity='0',2600);
  }
  /* petite fenêtre à boutons : renvoie la valeur du bouton choisi (ou null) */
  function ask(title,text,buttons){
    return new Promise(res=>{
      const d=document.createElement('dialog');d.style.cssText='width:min(400px,94vw);border:1px solid #e3e0d9;border-radius:12px;padding:16px;font:13px/1.4 system-ui,"Segoe UI",sans-serif;color:#1d1d1f';
      d.innerHTML='<div style="font-weight:700;font-size:14px;margin-bottom:6px">'+esc(title)+'</div>'+(text?'<div style="color:#77756f;margin-bottom:12px">'+text+'</div>':'')+
        '<div style="display:flex;flex-direction:column;gap:8px">'+buttons.map((b,i)=>'<button data-i="'+i+'" style="font:inherit;border:1px solid #1d1d1f;border-radius:8px;padding:8px 12px;cursor:pointer;text-align:left;'+(b.main?'background:#1d1d1f;color:#fff':'background:#fff;color:#1d1d1f')+'">'+esc(b.label)+(b.hint?'<div style="font-size:12px;opacity:.7;font-weight:400">'+esc(b.hint)+'</div>':'')+'</button>').join('')+
        '<button data-i="-1" style="font:inherit;border:0;background:none;color:#77756f;cursor:pointer;padding:4px">Annuler</button></div>';
      let r=null;d.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('button');if(!b)return;const i=+b.dataset.i;r=i>=0?buttons[i].value:null;d.close();});
      d.addEventListener('close',()=>{d.remove();res(r);});document.body.appendChild(d);d.showModal();
    });
  }

  /* ---------- zip sans compression ---------- */
  function zipStore(files){
    const T=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;T[n]=c>>>0;}
    const crc=d=>{let c=0xFFFFFFFF;for(let i=0;i<d.length;i++)c=T[(c^d[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0;};
    const enc=new TextEncoder(),parts=[],cen=[];let off=0;
    for(const f of files){const nm=enc.encode(f.name),d=f.data,cr=crc(d);
      const h=new DataView(new ArrayBuffer(30));h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint32(14,cr,true);h.setUint32(18,d.length,true);h.setUint32(22,d.length,true);h.setUint16(26,nm.length,true);
      parts.push(new Uint8Array(h.buffer),nm,d);
      const c=new DataView(new ArrayBuffer(46));c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint32(16,cr,true);c.setUint32(20,d.length,true);c.setUint32(24,d.length,true);c.setUint16(28,nm.length,true);c.setUint32(42,off,true);
      cen.push(new Uint8Array(c.buffer),nm);off+=30+nm.length+d.length;}
    const cl=cen.reduce((n,x)=>n+x.length,0),e=new DataView(new ArrayBuffer(22));e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,cl,true);e.setUint32(16,off,true);
    return new Blob([...parts,...cen,new Uint8Array(e.buffer)],{type:'application/zip'});
  }

  /* ---------- PDF → images JPG (pdf.js, chargé à la demande) ---------- */
  function loadPdfjs(){
    if(window.pdfjsLib)return Promise.resolve();
    return new Promise((ok,ko)=>{const s=document.createElement('script');s.src=new URL('../lib/pdf.min.js',document.currentScript?document.currentScript.src:location.href).href;
      s.onload=()=>{try{pdfjsLib.GlobalWorkerOptions.workerSrc=new URL('../lib/pdf.worker.min.js',s.src).href;}catch(e){}ok();};s.onerror=()=>ko(new Error('pdf.js introuvable'));document.head.appendChild(s);});
  }
  async function rasterize(bytes,dpi,progress){
    await loadPdfjs();
    const pdf=await pdfjsLib.getDocument({data:bytes.slice?bytes.slice(0):bytes,isEvalSupported:false}).promise;
    const files=[],w=Math.max(3,String(pdf.numPages).length);
    for(let n=1;n<=pdf.numPages;n++){
      if(progress)await progress('Création des images… '+n+' / '+pdf.numPages);
      const pg=await pdf.getPage(n),v1=pg.getViewport({scale:1}),k=Math.min(dpi/72,12000/Math.max(v1.width,v1.height)),vp=pg.getViewport({scale:k});
      const c=document.createElement('canvas');c.width=Math.round(vp.width);c.height=Math.round(vp.height);const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);
      await pg.render({canvasContext:x,viewport:vp}).promise;
      const b=await new Promise(r=>c.toBlob(r,'image/jpeg',0.92));c.width=c.height=1;
      files.push({name:'page-'+String(n).padStart(w,'0')+'.jpg',data:new Uint8Array(await b.arrayBuffer())});
    }
    return files;
  }
  function estimate(dpi,info){
    const n=(info&&info.n)||1,W=(info&&info.W)||210,H=(info&&info.H)||297;
    const one=(W/25.4*dpi)*(H/25.4*dpi)*0.4,mo=b=>{const m=b/1048576;return m<10?m.toFixed(1).replace('.',','):Math.round(m);};
    return'≈ '+mo(one)+' Mo par image'+(n>1?' · ≈ '+mo(one*n)+' Mo en tout':'');
  }

  /* ---------- livraison des fichiers (dossier choisi, ZIP, ou téléchargement) ---------- */
  let DIR=null;
  async function writeIn(dir,name,blob){const h=await dir.getFileHandle(name,{create:true});const w=await h.createWritable();await w.write(blob);await w.close();}
  async function deliver(files,base){
    if(files.length===1){const f=files[0],b=f.data instanceof Blob?f.data:new Blob([f.data],{type:'image/jpeg'});
      if(DIR){await writeIn(DIR,base+(files[0].keep?'':'')+'.jpg',b);toast('Enregistré dans « '+DIR.name+' ».');return true;}
      await window.AtelierSave.save(b,base+'.jpg');return true;}
    let how='zip';
    if(DIR)how='files';
    else{how=await ask(files.length+' images prêtes','Comment les recevoir ?',[{label:'Un seul fichier ZIP',value:'zip',main:true},{label:'Un fichier JPG par page',value:'files'}]);}
    if(!how)return false;
    if(how==='zip'){const z=zipStore(files);if(DIR){await writeIn(DIR,base+'-images.zip',z);toast('Enregistré dans « '+DIR.name+' ».');}else await window.AtelierSave.save(z,base+'-images.zip');return true;}
    for(const f of files){const b=new Blob([f.data],{type:'image/jpeg'}),nm=base+'-'+f.name;
      if(DIR)await writeIn(DIR,nm,b);else{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=nm;document.body.appendChild(a);a.click();a.remove();await new Promise(r=>setTimeout(r,350));}}
    if(DIR)toast(files.length+' images enregistrées dans « '+DIR.name+' ».');
    return true;
  }

  /* ---------- Exporter… ---------- */
  function exportDialog(cfg){
    let d=document.getElementById('sbExp');if(d)d.remove();
    const fm=(cfg.formats||[]).slice();
    if(cfg.pdf&&!fm.some(f=>f.id==='pdf'))fm.unshift({id:'pdf',label:'PDF',run:async()=>{const b=await cfg.pdf();await window.AtelierSave.save(b instanceof Blob?b:new Blob([b],{type:'application/pdf'}),(cfg.name?cfg.name():cfg.app)+'-'+stamp()+'.pdf');}});
    if(cfg.pdf&&!fm.some(f=>f.id==='jpg'))fm.push({id:'jpg',label:'Images JPG',hint:'une image par page',jpg:true});
    if(!fm.length)return;
    d=document.createElement('dialog');d.id='sbExp';d.style.cssText='width:min(420px,94vw);border:1px solid #e3e0d9;border-radius:12px;padding:16px;font:13px/1.4 system-ui,"Segoe UI",sans-serif;color:#1d1d1f';
    const info=cfg.pages?cfg.pages():null;
    d.innerHTML='<div style="font-weight:700;font-size:14px;margin-bottom:8px">Exporter</div>'+
      fm.map((f,i)=>'<label style="display:flex;flex-direction:row;align-items:center;gap:8px;margin:6px 0;color:inherit"><input type="radio" name="sbF" value="'+i+'"'+(i===0?' checked':'')+'> '+esc(f.label)+(f.hint?' <span style="color:#77756f;font-size:12px">('+esc(f.hint)+')</span>':'')+'</label>').join('')+
      '<div id="sbQ" style="display:none;margin:2px 0 4px 26px">Définition : <select id="sbDpi" style="font:inherit;max-width:100%">'+[[100,'Légère'],[150,'Écran'],[200,'Bonne'],[300,'Impression']].map(([v,l])=>'<option value="'+v+'"'+(v===200?' selected':'')+'>'+l+' — '+v+' dpi, '+estimate(v,info)+'</option>').join('')+'</select></div>'+
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button id="sbNo" style="font:inherit;border:1px solid #1d1d1f;border-radius:8px;padding:6px 14px;background:#fff;cursor:pointer">Annuler</button><button id="sbOk" style="font:inherit;border:1px solid #1d1d1f;border-radius:8px;padding:6px 14px;background:#1d1d1f;color:#fff;cursor:pointer">Exporter</button></div>';
    document.body.appendChild(d);
    const cur=()=>fm[+d.querySelector('input[name=sbF]:checked').value];
    const sync=()=>{d.querySelector('#sbQ').style.display=cur().jpg?'block':'none';};
    d.addEventListener('change',sync);sync();
    const db=d.querySelector('#sbDir');if(db)db.onclick=async()=>{try{DIR=await showDirectoryPicker({mode:'readwrite'});d.querySelector('#sbDirN').textContent=DIR.name;}catch(e){}};
    d.querySelector('#sbNo').onclick=()=>d.close();d.addEventListener('close',()=>d.remove());
    d.querySelector('#sbOk').onclick=async()=>{
      const f=cur(),dpi=+d.querySelector('#sbDpi').value;
      let pre=false;
      if(window.AtelierSave&&window.AtelierSave.prepare&&!f.jpg&&(f.pre&&f.pre())){
        const ok=await window.AtelierSave.prepare((cfg.name?cfg.name():cfg.app)+'-'+stamp()+'.'+(f.ext||f.id));pre=true;
        if(!ok){d.close();return;}}
      d.close();
      const busy=cfg.busy||(async()=>{});
      try{
        if(window.AtelierSave&&window.AtelierSave.setDir)window.AtelierSave.setDir(DIR);
        if(f.jpg){const bytes=await cfg.pdf(true);const files=await rasterize(bytes,dpi,busy);await busy();await deliver(files,(cfg.name?cfg.name():cfg.app)+'-'+stamp());}
        else await f.run({dir:DIR,dpi});
        if(cfg.done)cfg.done();
      }catch(e){if(!e||e.message!=='annulé'){console.error(e);alert('Export impossible : '+(e.message||e));}}
      finally{if(pre&&window.AtelierSave.discard)await window.AtelierSave.discard();if(window.AtelierSave&&window.AtelierSave.setDir)window.AtelierSave.setDir(null);try{await busy();}catch(e){}}
    };
    d.showModal();
  }

  /* ---------- Enregistrer ---------- */
  async function saveClick(cfg){
    try{
      const id=cfg.serverId&&cfg.serverId();
      if(id){await cfg.saveServer();toast('Enregistré sur le serveur.');return;}
      const key=cfg.key?cfg.key():cfg;let p=PREF.get(key||cfg);
      const f=cfg.file&&cfg.file();
      if(!p){
        const opts=[];
        if(f)opts.push({label:'Écraser le fichier « '+f.name+' »',hint:'remplace le fichier d’origine sur l’ordinateur',value:'file',main:true});
        opts.push({label:'Enregistrer sur le serveur',hint:'à retrouver sur un autre ordinateur, dans « Mes … »',value:'server',main:!f});
        if(!f&&cfg.copy)opts.push({label:'Télécharger un fichier sur l’ordinateur',value:'copy'});
        if(opts.length===1)p=opts[0].value;else
        p=await ask('Enregistrer',f?'Ce document vient d’un fichier de l’ordinateur. Le choix est gardé jusqu’à la fermeture du document.':'Où enregistrer ? Le choix est gardé jusqu’à la fermeture du document.',opts);
        if(!p)return;
      }
      if(p==='file'&&f){await f.overwrite();toast('« '+f.name+' » enregistré.');}
      else if(p==='copy'&&cfg.copy){await cfg.copy();}
      else{await cfg.saveServer();if(cfg.serverId&&!cfg.serverId())return;toast('Enregistré sur le serveur.');}
      PREF.set(key||cfg,p);
    }catch(e){console.error(e);alert('Enregistrement impossible : '+(e.message||e));}
  }
  function init(cfg){
    const sb=cfg.save&&document.querySelector(cfg.save),eb=cfg.exp&&document.querySelector(cfg.exp);
    if(sb){sb.textContent='Enregistrer';sb.title='Enregistrer (Ctrl+S) : sur le serveur si le document y est déjà ; sinon choix, gardé jusqu’à la fermeture du document';sb.onclick=()=>saveClick(cfg);}
    if(eb){eb.textContent='Exporter…';eb.title='Exporter : PDF, images JPG…, dans le dossier de ton choix';eb.onclick=()=>exportDialog(cfg);}
    if(!cfg.noKeys)addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&!e.altKey&&String(e.key).toLowerCase()==='s'){e.preventDefault();e.stopImmediatePropagation();saveClick(cfg);}},true);
    return{save:()=>saveClick(cfg),export:()=>exportDialog(cfg)};
  }
  window.AtelierSaveBar={init,saveClick,exportDialog,rasterize,zipStore,deliver,ask,toast,estimate};
})();
