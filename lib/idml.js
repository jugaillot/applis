/* Export IDML (InDesign) : AtelierIDML.build(doc, {chain, getImage}) → Blob
   - doc : document de « Mise en page » (pages, stories, styles, page)
   - chain(story) : cadres d'un même texte, dans l'ordre
   - getImage(key) : Promise → {bytes:Uint8Array, w, h} (taille d'origine en pixels) */
(function(){
  'use strict';
  const NS='xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="8.0"';
  const HEAD='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const PT=72/25.4, pt=mm=>Math.round(mm*PT*1000)/1000;
  /* ---- zip sans compression ---- */
  const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
  const crc32=b=>{let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=CRC[(c^b[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;};
  function zip(files){
    const enc=new TextEncoder(),parts=[],cen=[];let off=0;
    const d=new Date(),dt=((d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1)),dd=(((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate());
    for(const f of files){
      const name=enc.encode(f.name),data=typeof f.data==='string'?enc.encode(f.data):f.data,crc=crc32(data);
      const lh=new DataView(new ArrayBuffer(30));lh.setUint32(0,0x04034b50,true);lh.setUint16(4,20,true);lh.setUint16(6,0x0800,true);lh.setUint16(8,0,true);lh.setUint16(10,dt,true);lh.setUint16(12,dd,true);lh.setUint32(14,crc,true);lh.setUint32(18,data.length,true);lh.setUint32(22,data.length,true);lh.setUint16(26,name.length,true);lh.setUint16(28,0,true);
      parts.push(new Uint8Array(lh.buffer),name,data);
      const ch=new DataView(new ArrayBuffer(46));ch.setUint32(0,0x02014b50,true);ch.setUint16(4,20,true);ch.setUint16(6,20,true);ch.setUint16(8,0x0800,true);ch.setUint16(10,0,true);ch.setUint16(12,dt,true);ch.setUint16(14,dd,true);ch.setUint32(16,crc,true);ch.setUint32(20,data.length,true);ch.setUint32(24,data.length,true);ch.setUint16(28,name.length,true);ch.setUint32(42,off,true);
      cen.push(new Uint8Array(ch.buffer),name);off+=30+name.length+data.length;
    }
    let cs=0;cen.forEach(c=>cs+=c.length);
    const end=new DataView(new ArrayBuffer(22));end.setUint32(0,0x06054b50,true);end.setUint16(8,files.length,true);end.setUint16(10,files.length,true);end.setUint32(12,cs,true);end.setUint32(16,off,true);
    return new Blob([...parts,...cen,new Uint8Array(end.buffer)],{type:'application/vnd.adobe.indesign-idml-package+zip'});
  }
  const b64=u8=>{let s='';for(let i=0;i<u8.length;i+=0x8000)s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));return btoa(s).replace(/(.{76})/g,'$1\n');};
  /* ---- couleurs ---- */
  function hex(c){if(!c||c==='none'||c==='transparent')return null;c=String(c).trim();
    let m=c.match(/^#([0-9a-f]{3})$/i);if(m)return m[1].split('').map(x=>x+x).join('').toLowerCase();
    m=c.match(/^#([0-9a-f]{6})/i);if(m)return m[1].toLowerCase();
    m=c.match(/^rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/i);if(m)return [m[1],m[2],m[3]].map(n=>(+n).toString(16).padStart(2,'0')).join('');
    return null;}
  async function build(doc,o){
    const P=doc.page,W=pt(P.w),H=pt(P.h),X=doc.exp||{};let n=0;const id=()=>'u'+(++n).toString(36);
    const colors=new Map();const cref=c=>{const h=hex(c);if(!h)return 'Swatch/None';colors.set(h,1);return 'Color/c_'+h;};
    const layer=id(),master=id();
    /* styles de paragraphe */
    const ALIGN={left:'LeftAlign',center:'CenterAlign',right:'RightAlign',justify:'LeftJustified'};
    const fstyle=(b,i)=>b&&i?'Bold Italic':b?'Bold':i?'Italic':'Regular';
    const styles=doc.styles||{};
    let psx='<ParagraphStyle Self="ParagraphStyle/$ID/[No paragraph style]" Name="$ID/[No paragraph style]" Imported="false" NextStyle="ParagraphStyle/$ID/[No paragraph style]" KeyboardShortcut="0 0"/>';
    for(const k in styles){const s=styles[k];
      psx+=`<ParagraphStyle Self="ParagraphStyle/${esc(k)}" Name="${esc(k)}" Imported="false" KeyboardShortcut="0 0" FillColor="${cref(s.color||'#000')}" FontStyle="${fstyle(s.bold,s.italic)}" PointSize="${s.size||11}" Justification="${ALIGN[s.align]||'LeftAlign'}" Capitalization="${s.upper?'AllCaps':'Normal'}" SpaceAfter="${pt(s.after||0)}"><Properties><BasedOn type="string">$ID/[No paragraph style]</BasedOn><AppliedFont type="string">${esc(s.font||'Arial')}</AppliedFont><Leading type="unit">${Math.round((s.size||11)*(s.lead||120)/100*100)/100}</Leading></Properties></ParagraphStyle>`;}
    /* histoires (texte) */
    const storyOf={},storyXml={};const stories=doc.stories||{};
    const runsOf=html=>{const dom=new DOMParser().parseFromString('<body>'+(html||'')+'</body>','text/html').body;const paras=[];
      const walk=(node,st,out)=>{node.childNodes.forEach(c=>{
        if(c.nodeType===3){if(c.data)out.push({t:c.data,st});return;}
        if(c.nodeType!==1)return;const tag=c.tagName.toLowerCase();if(tag==='br'){out.push({br:1});return;}
        const s=Object.assign({},st);
        if(tag==='b'||tag==='strong')s.b=true;if(tag==='i'||tag==='em')s.i=true;if(tag==='u')s.u=true;
        const cs=c.style;if(cs){if(cs.color)s.col=cs.color;if(cs.fontWeight&&(cs.fontWeight==='bold'||+cs.fontWeight>=600))s.b=true;if(cs.fontStyle==='italic')s.i=true;
          if(cs.fontSize){const m=cs.fontSize.match(/([\d.]+)(pt|px)/);if(m)s.size=m[2]==='pt'?+m[1]:+m[1]*0.75;}
          if(cs.fontFamily)s.font=cs.fontFamily.split(',')[0].replace(/["']/g,'').trim();}
        walk(c,s,out);});};
      [...dom.children].forEach(p=>{const out=[];walk(p,{},out);const m=(p.className||'').match(/st-([\w-]+)/);paras.push({style:m&&styles[m[1]]?m[1]:(styles.texte?'texte':null),runs:out,align:p.style&&p.style.textAlign});});
      if(!paras.length)paras.push({style:styles.texte?'texte':null,runs:[]});return paras;};
    const storyBody=html=>runsOf(html).map((p,pi,arr)=>{
      let x=`<ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/${p.style?esc(p.style):'$ID/[No paragraph style]'}"${p.align&&ALIGN[p.align]?` Justification="${ALIGN[p.align]}"`:''}>`;
      const rs=p.runs.length?p.runs:[];
      rs.forEach(r=>{
        if(r.br){x+='<CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]"><Content>&#x2028;</Content></CharacterStyleRange>';return;}
        const s=r.st,a=[];if(s.col)a.push(`FillColor="${cref(s.col)}"`);if(s.size)a.push(`PointSize="${Math.round(s.size*100)/100}"`);
        if(s.b||s.i)a.push(`FontStyle="${fstyle(s.b,s.i)}"`);if(s.u)a.push('Underline="true"');
        x+=`<CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]" ${a.join(' ')}>${s.font?`<Properties><AppliedFont type="string">${esc(s.font)}</AppliedFont></Properties>`:''}<Content>${esc(r.t)}</Content></CharacterStyleRange>`;});
      if(!rs.length)x+='<CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]"><Content></Content></CharacterStyleRange>';
      if(pi<arr.length-1)x+='<Br/>';
      return x+'</ParagraphStyleRange>';}).join('');
    const frames={};// id de cadre → {story, prev, next}
    const seen=new Set();
    doc.pages.forEach(pg=>pg.items.forEach(it=>{if(it.type!=='text'||seen.has(it.story))return;seen.add(it.story);
      const ch=o.chain(it.story),sid=id();storyOf[it.story]=sid;
      ch.forEach((f,i)=>{frames[f.id]={story:sid,prev:i?'~'+ch[i-1].id:null,next:i<ch.length-1?'~'+ch[i+1].id:null};});
      storyXml[sid]=HEAD+`<idPkg:Story ${NS}><Story Self="${sid}" AppliedTOCStyle="n" TrackChanges="false" StoryTitle="$ID/" AppliedNamedGrid="n"><StoryPreference OpticalMarginAlignment="false" OpticalMarginSize="12" FrameType="TextFrameType" StoryOrientation="Horizontal" StoryDirection="LeftToRightDirection"/>${storyBody(stories[it.story])}</Story></idPkg:Story>`;}));
    /* pages */
    const frameIds={};// id d'élément → Self IDML
    doc.pages.forEach(pg=>pg.items.forEach(it=>{frameIds[it.id]=id();}));
    const KAPPA=0.5522847498;
    const pathRect=(w,h)=>{const a=w/2,b=h/2;return [[-a,-b],[-a,b],[a,b],[a,-b]].map(([x,y])=>`<PathPointType Anchor="${x} ${y}" LeftDirection="${x} ${y}" RightDirection="${x} ${y}"/>`).join('');};
    const pathOval=(w,h)=>{const a=w/2,b=h/2,k=KAPPA;const P=[[0,-b,-a*k,0,a*k,0],[a,0,0,-b*k,0,b*k],[0,b,a*k,0,-a*k,0],[-a,0,0,b*k,0,-b*k]];
      return P.map(([x,y,lx,ly,rx,ry])=>`<PathPointType Anchor="${x} ${y}" LeftDirection="${x+lx} ${y+ly}" RightDirection="${x+rx} ${y+ry}"/>`).join('');};
    const geom=(pts,open)=>`<Properties><PathGeometry><GeometryPathType PathOpen="${open?'true':'false'}"><PathPointArray>${pts}</PathPointArray></GeometryPathType></PathGeometry></Properties>`;
    const xform=(it)=>{const w=pt(it.w),h=pt(it.h),cx=pt(it.x+it.w/2)-W/2,cy=pt(it.y+it.h/2)-H/2,r=(it.rot||0)*Math.PI/180,c=Math.cos(r),s=Math.sin(r);return `${c} ${s} ${-s} ${c} ${cx} ${cy}`;};
    const look=it=>{const f=it.fill&&it.fill!=='none'?cref(it.fill):'Swatch/None',sw=it.sw&&it.stroke&&it.stroke!=='none'?pt(it.sw):0,sc=sw?cref(it.stroke):'Swatch/None';
      return `FillColor="${f}" StrokeColor="${sc}" StrokeWeight="${sw}"`;};
    const opac=it=>it.op!=null&&it.op<100?`<TransparencySetting><BlendingSetting Opacity="${it.op}"/></TransparencySetting>`:'';
    const spreads=[];
    for(let pi=0;pi<doc.pages.length;pi++){
      const pg=doc.pages[pi];let items='';
      const bg=hex(P.bg);if(bg&&bg!=='ffffff')items+=`<Rectangle Self="${id()}" ItemLayer="${layer}" FillColor="${cref(P.bg)}" StrokeColor="Swatch/None" StrokeWeight="0" ItemTransform="1 0 0 1 0 0">${geom(`<PathPointType Anchor="${-W/2} ${-H/2}" LeftDirection="${-W/2} ${-H/2}" RightDirection="${-W/2} ${-H/2}"/><PathPointType Anchor="${-W/2} ${H/2}" LeftDirection="${-W/2} ${H/2}" RightDirection="${-W/2} ${H/2}"/><PathPointType Anchor="${W/2} ${H/2}" LeftDirection="${W/2} ${H/2}" RightDirection="${W/2} ${H/2}"/><PathPointType Anchor="${W/2} ${-H/2}" LeftDirection="${W/2} ${-H/2}" RightDirection="${W/2} ${-H/2}"/>`)}</Rectangle>`;
      for(const it of pg.items){
        const self=frameIds[it.id],w=pt(it.w),h=pt(it.h),T=xform(it);
        if(it.type==='text'){const fr=frames[it.id]||{story:storyOf[it.story]};
          const va=it.va==='ctr'?'CenterAlign':it.va==='b'?'BottomAlign':'TopAlign',pd=pt(it.pad||0);
          items+=`<TextFrame Self="${self}" ParentStory="${fr.story}" PreviousTextFrame="${fr.prev?frameIds[fr.prev.slice(1)]:'n'}" NextTextFrame="${fr.next?frameIds[fr.next.slice(1)]:'n'}" ContentType="TextType" ItemLayer="${layer}" ${look(it)} ItemTransform="${T}">${geom(pathRect(w,h))}<TextFramePreference TextColumnCount="1" VerticalJustification="${va}"><Properties><InsetSpacing type="list"><ListItem type="unit">${pd}</ListItem><ListItem type="unit">${pd}</ListItem><ListItem type="unit">${pd}</ListItem><ListItem type="unit">${pd}</ListItem></InsetSpacing></Properties></TextFramePreference>${opac(it)}</TextFrame>`;}
        else if(it.type==='rect'||(it.type==='image'&&!it.key)){
          const rad=it.rad?pt(it.rad):0,rc=rad?['TopLeft','TopRight','BottomLeft','BottomRight'].map(c=>`${c}CornerOption="RoundedCorner" ${c}CornerRadius="${rad}"`).join(' '):'';
          items+=`<Rectangle Self="${self}" ContentType="${it.type==='image'?'GraphicType':'Unassigned'}" ItemLayer="${layer}" ${look(it)} ${rc} ItemTransform="${T}">${geom(pathRect(w,h))}${opac(it)}</Rectangle>`;}
        else if(it.type==='ellipse')items+=`<Oval Self="${self}" ContentType="Unassigned" ItemLayer="${layer}" ${look(it)} ItemTransform="${T}">${geom(pathOval(w,h))}${opac(it)}</Oval>`;
        else if(it.type==='line'){const x1=-w/2,x2=w/2,y1=it.dir?h/2:-h/2,y2=it.dir?-h/2:h/2,sw=pt(it.sw||.5);
          items+=`<GraphicLine Self="${self}" ItemLayer="${layer}" FillColor="Swatch/None" StrokeColor="${cref(it.stroke||'#000')}" StrokeWeight="${sw}" ItemTransform="${T}">${geom(`<PathPointType Anchor="${x1} ${y1}" LeftDirection="${x1} ${y1}" RightDirection="${x1} ${y1}"/><PathPointType Anchor="${x2} ${y2}" LeftDirection="${x2} ${y2}" RightDirection="${x2} ${y2}"/>`,true)}${opac(it)}</GraphicLine>`;}
        else if(it.type==='image'||it.type==='svg'){
          let im=null;try{im=await o.getImage(it.key);}catch(e){}
          if(!im){items+=`<Rectangle Self="${self}" ContentType="GraphicType" ItemLayer="${layer}" FillColor="Swatch/None" StrokeColor="Swatch/None" StrokeWeight="0" ItemTransform="${T}">${geom(pathRect(w,h))}</Rectangle>`;continue;}
          const g=it.type==='svg'?{x:0,y:0,w:it.w,h:it.h}:o.geom(it,im),sx=pt(g.w)/im.w,sy=pt(g.h)/im.h,tx=pt(g.x)-w/2,ty=pt(g.y)-h/2;
          items+=`<Rectangle Self="${self}" ContentType="GraphicType" ItemLayer="${layer}" FillColor="Swatch/None" StrokeColor="Swatch/None" StrokeWeight="0" ItemTransform="${T}">${geom(pathRect(w,h))}${opac(it)}<${im.svg?'SVG':(im.png?'PNG':'Image')} Self="${id()}" ItemTransform="${sx} 0 0 ${sy} ${tx} ${ty}" ActualPpi="72 72" EffectivePpi="72 72"><Properties><Profile type="string">$ID/Embedded</Profile><GraphicBounds Left="0" Top="0" Right="${im.w}" Bottom="${im.h}"/></Properties><Link Self="${id()}" LinkResourceURI="${esc(im.name||'image')}" StoredState="Embedded"/><Contents><![CDATA[${b64(im.bytes)}]]></Contents></${im.svg?'SVG':(im.png?'PNG':'Image')}></Rectangle>`;}
      }
      const sp=id(),page=id();
      spreads.push({id:sp,xml:HEAD+`<idPkg:Spread ${NS}><Spread Self="${sp}" PageCount="1" BindingLocation="0" AllowPageShuffle="true" ShowMasterItems="true" ItemTransform="1 0 0 1 0 0" AppliedMaster="MasterSpread/${master}"><Page Self="${page}" GeometricBounds="0 0 ${H} ${W}" ItemTransform="1 0 0 1 ${-W/2} ${-H/2}" Name="${pi+1}" AppliedMaster="MasterSpread/${master}" OverrideList="" TabDirection="LeftToRight" MasterPageTransform="1 0 0 1 0 0"><MarginPreference ColumnCount="${P.cols||1}" ColumnGutter="${pt(P.gut||0)}" Top="${pt(P.m[0])}" Bottom="${pt(P.m[2])}" Left="${pt(P.m[3])}" Right="${pt(P.m[1])}" ColumnDirection="Horizontal"/></Page>${items}</Spread></idPkg:Spread>`});
    }
    const mp=id();
    const masterXml=HEAD+`<idPkg:MasterSpread ${NS}><MasterSpread Self="${master}" Name="A-Master" NamePrefix="A" BaseName="Master" ShowMasterItems="true" PageCount="1" ItemTransform="1 0 0 1 0 0"><Page Self="${mp}" GeometricBounds="0 0 ${H} ${W}" ItemTransform="1 0 0 1 ${-W/2} ${-H/2}" Name="A" AppliedMaster="n" OverrideList="" TabDirection="LeftToRight" MasterPageTransform="1 0 0 1 0 0"/></MasterSpread></idPkg:MasterSpread>`;
    let cx='<Color Self="Color/Black" Model="Process" Space="CMYK" ColorValue="0 0 0 100" ColorOverride="Specialblack" Name="Black" Visible="true"/><Color Self="Color/Paper" Model="Process" Space="CMYK" ColorValue="0 0 0 0" ColorOverride="Specialpaper" Name="Paper" Visible="true"/><Swatch Self="Swatch/None" Name="None" ColorEditable="false" ColorRemovable="false" Visible="true"/>';
    colors.forEach((_,h)=>{cx+=`<Color Self="Color/c_${h}" Model="Process" Space="RGB" ColorValue="${parseInt(h.slice(0,2),16)} ${parseInt(h.slice(2,4),16)} ${parseInt(h.slice(4,6),16)}" Name="R=${parseInt(h.slice(0,2),16)} G=${parseInt(h.slice(2,4),16)} B=${parseInt(h.slice(4,6),16)}" Visible="true"/>`;});
    const bl=pt(X.bleed?3:0);
    const files=[
      {name:'mimetype',data:'application/vnd.adobe.indesign-idml-package+zip'},
      {name:'META-INF/container.xml',data:HEAD+'<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="designmap.xml" media-type="text/xml"/></rootfiles></container>'},
      {name:'Resources/Graphic.xml',data:HEAD+`<idPkg:Graphic ${NS}>${cx}</idPkg:Graphic>`},
      {name:'Resources/Fonts.xml',data:HEAD+`<idPkg:Fonts ${NS}/>`},
      {name:'Resources/Styles.xml',data:HEAD+`<idPkg:Styles ${NS}><RootCharacterStyleGroup Self="u_rcs"><CharacterStyle Self="CharacterStyle/$ID/[No character style]" Imported="false" KeyboardShortcut="0 0" Name="$ID/[No character style]"/></RootCharacterStyleGroup><RootParagraphStyleGroup Self="u_rps">${psx}</RootParagraphStyleGroup><RootObjectStyleGroup Self="u_ros"><ObjectStyle Self="ObjectStyle/$ID/[None]" Name="$ID/[None]" KeyboardShortcut="0 0"/></RootObjectStyleGroup></idPkg:Styles>`},
      {name:'Resources/Preferences.xml',data:HEAD+`<idPkg:Preferences ${NS}><DocumentPreference PageHeight="${H}" PageWidth="${W}" PagesPerDocument="${doc.pages.length}" FacingPages="false" DocumentBleedTopOffset="${bl}" DocumentBleedBottomOffset="${bl}" DocumentBleedInsideOrLeftOffset="${bl}" DocumentBleedOutsideOrRightOffset="${bl}" PageBinding="LeftToRight" StartPageNumber="1"/><MarginPreference ColumnCount="${P.cols||1}" ColumnGutter="${pt(P.gut||0)}" Top="${pt(P.m[0])}" Bottom="${pt(P.m[2])}" Left="${pt(P.m[3])}" Right="${pt(P.m[1])}"/></idPkg:Preferences>`},
      {name:`MasterSpreads/MasterSpread_${master}.xml`,data:masterXml}
    ];
    spreads.forEach(s=>files.push({name:`Spreads/Spread_${s.id}.xml`,data:s.xml}));
    Object.keys(storyXml).forEach(k=>files.push({name:`Stories/Story_${k}.xml`,data:storyXml[k]}));
    const dm=HEAD+'<?aid style="50" type="document" readerVersion="6.0" featureSet="257" product="8.0(370)" ?>\n'+`<Document xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="8.0" Self="d" StoryList="${Object.keys(storyXml).join(' ')}" Name="${esc(o.name||'Mise en page')}" ZeroPoint="0 0" ActiveLayer="${layer}" CMYKProfile="U.S. Web Coated (SWOP) v2" RGBProfile="sRGB IEC61966-2.1"><Language Self="Language/$ID/French" Name="$ID/French" SingleQuotes="‘’" DoubleQuotes="«»" PrimaryLanguageName="$ID/French" SublanguageName="$ID/" Id="269" HyphenationVendor="$ID/Proximity" SpellingVendor="$ID/Proximity"/><Layer Self="${layer}" Name="Calque 1" Visible="true" Locked="false" IgnoreWrap="false" ShowGuides="true" LockGuides="false" UI="true" Expendable="true" Printable="true"/><idPkg:Graphic src="Resources/Graphic.xml"/><idPkg:Fonts src="Resources/Fonts.xml"/><idPkg:Styles src="Resources/Styles.xml"/><idPkg:Preferences src="Resources/Preferences.xml"/><idPkg:MasterSpread src="MasterSpreads/MasterSpread_${master}.xml"/>${spreads.map(s=>`<idPkg:Spread src="Spreads/Spread_${s.id}.xml"/>`).join('')}${Object.keys(storyXml).map(k=>`<idPkg:Story src="Stories/Story_${k}.xml"/>`).join('')}</Document>`;
    files.splice(2,0,{name:'designmap.xml',data:dm});
    return zip(files);
  }
  window.AtelierIDML={build,zip};
})();
