/* Enregistrement d'un fichier exporté : fenêtre « Enregistrer sous » (emplacement + nom) quand le navigateur sait la montrer,
   sinon téléchargement habituel. AtelierSave.save(blob, nom) */
(function(){
  'use strict';
  const TYPES={pdf:['application/pdf','PDF'],svg:['image/svg+xml','SVG'],png:['image/png','Image PNG'],jpg:['image/jpeg','Image JPEG'],jpeg:['image/jpeg','Image JPEG'],
    json:['application/json','Projet (.json)'],zip:['application/zip','Archive ZIP'],dxf:['application/dxf','DXF'],idml:['application/vnd.adobe.indesign-idml-package+zip','IDML (InDesign)'],
    docx:['application/vnd.openxmlformats-officedocument.wordprocessingml.document','Word'],md:['text/markdown','Markdown'],txt:['text/plain','Texte']};
  function plain(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),8000);return true;}
  async function picker(blob,name){
    const e=(name.split('.').pop()||'').toLowerCase(),t=TYPES[e];
    const h=await showSaveFilePicker({suggestedName:name,types:t?[{description:t[1],accept:{[t[0]]:['.'+e]}}]:undefined});
    let w=null;
    try{w=await h.createWritable();await w.write(await blob.arrayBuffer());await w.close();}
    catch(err){// l'écriture a échoué après le choix de l'emplacement : on nettoie le fichier vide et on le dit
      try{if(w)await w.abort();}catch(x){}try{if(h.remove)await h.remove();}catch(x){}
      err.afterHandle=true;throw err;}
    return true;
  }
  /* le navigateur n'autorise la fenêtre qu'juste après un clic : si l'export a pris du temps, on redemande un clic */
  function again(blob,name){return new Promise(res=>{
    const d=document.createElement('dialog');d.style.cssText='border:1px solid #e3e0d9;border-radius:14px;padding:0;width:min(400px,94vw);font:13px/1.35 system-ui,"Segoe UI",sans-serif;color:#1d1d1f';
    d.innerHTML='<div style="padding:12px 16px;border-bottom:1px solid #e3e0d9;font-weight:700">Fichier prêt</div><div class="n" style="padding:12px 16px;color:#77756f"></div><div style="padding:0 12px 12px;display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap"><button type="button" class="d">Télécharger directement</button><button type="button" class="o" style="background:#1d1d1f;color:#fff">Choisir l’emplacement…</button><button type="button" class="x">Annuler</button></div>';
    d.querySelector('.n').textContent='« '+name+' »';
    d.querySelectorAll('button').forEach(b=>b.style.cssText+='font:inherit;border:1px solid #1d1d1f;border-radius:8px;padding:6px 12px;cursor:pointer;'+(b.className==='o'?'':'background:#fff;color:#1d1d1f'));
    d.querySelector('.o').onclick=async()=>{try{await picker(blob,name);d.close();res(true);}catch(e){if(e&&e.name==='AbortError')return;d.close();if(e&&e.afterHandle)alert('L’enregistrement à cet emplacement a échoué ('+(e.name||'erreur')+' : '+(e.message||'')+'). Le fichier est téléchargé à la place.');plain(blob,name);res(true);}};
    d.querySelector('.d').onclick=()=>{d.close();plain(blob,name);res(true);};d.querySelector('.x').onclick=()=>{d.close();res(false);};
    d.addEventListener('close',()=>setTimeout(()=>d.remove(),50));document.body.appendChild(d);d.showModal();});}
  async function save(blob,name){
    if(!(blob instanceof Blob))blob=new Blob([blob]);
    if(!window.showSaveFilePicker)return plain(blob,name);
    try{return await picker(blob,name);}
    catch(e){if(e&&e.name==='AbortError')return false;
      if(e&&e.afterHandle){console.error(e);alert('L’enregistrement à cet emplacement a échoué ('+(e.name||'erreur')+' : '+(e.message||'')+').\nLe fichier est téléchargé dans ton dossier de téléchargements à la place ; supprime le fichier vide éventuel à l’emplacement choisi.');return plain(blob,name);}
      if(e&&(e.name==='SecurityError'||e.name==='NotAllowedError'))return again(blob,name);
      return plain(blob,name);}
  }
  window.AtelierSave={save};
})();
