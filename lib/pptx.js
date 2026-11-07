/* La Suite — lecture des présentations PowerPoint (.pptx), sans dépendance.
   AtelierPPTX.read(file) → { w, h (mm), slides:[{ bg, items:[…] }] }
     item : { type:'text'|'image'|'rect'|'ellipse'|'line'|'table', x,y,w,h (mm), rot (°), fill, stroke, sw (mm), rad (mm),
              paras:[{ lvl, algn, bullet, marL, indent (mm), lnSpc, spcAft (pt), runs:[{ t, sz (pt), b, i, u, col, font }] }],
              inset:{l,t,r,b} (mm), anchor:'t'|'ctr'|'b', blob (image), rows (tableau) }
   AtelierPPTX.render(deck, n, pxPerMm) → canvas de la diapo n (0…) */
(function () {
  'use strict';
  const EMU = 36000;// par mm
  /* ---------- zip (lecture seule, décompression native du navigateur) ---------- */
  async function unzip(buf) {
    const u8 = new Uint8Array(buf), dv = new DataView(buf);
    let e = u8.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error('ce fichier n’est pas une présentation .pptx');
    const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const files = new Map();
    for (let i = 0; i < n; i++) {
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl));
      files.set(name, { method, csize, off }); p += 46 + nl + xl + cl;
    }
    const get = async name => {
      const f = files.get(name); if (!f) return null;
      const ln = dv.getUint16(f.off + 26, true), lx = dv.getUint16(f.off + 28, true); const data = u8.subarray(f.off + 30 + ln + lx, f.off + 30 + ln + lx + f.csize);
      if (f.method === 0) return data.slice();
      const ds = new DecompressionStream('deflate-raw'); const out = new Response(new Blob([data]).stream().pipeThrough(ds)); return new Uint8Array(await out.arrayBuffer());
    };
    return { files, get, text: async name => { const d = await get(name); return d ? new TextDecoder().decode(d) : null; } };
  }
  const parse = t => t ? new DOMParser().parseFromString(t, 'application/xml') : null;
  const kids = (el, ln) => el ? [...el.children].filter(c => c.localName === ln) : [];
  const kid = (el, ln) => kids(el, ln)[0] || null;
  const path = (el, ...ls) => { for (const l of ls) { el = kid(el, l); if (!el) return null; } return el; };
  const resolve = (base, target) => { if (target.startsWith('/')) return target.slice(1); const parts = base.split('/'); parts.pop(); for (const s of target.split('/')) { if (s === '..') parts.pop(); else if (s !== '.') parts.push(s); } return parts.join('/'); };
  async function rels(z, part) {
    const p = part.replace(/([^/]+)$/, '_rels/$1.rels'); const x = parse(await z.text(p)); const m = {};
    if (x) for (const r of x.documentElement.children) m[r.getAttribute('Id')] = { target: r.getAttribute('TargetMode') === 'External' ? null : resolve(part, r.getAttribute('Target')), type: r.getAttribute('Type') || '' };
    return m;
  }
  /* ---------- couleurs ---------- */
  function hsl(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; } return [h, s, l]; }
  function rgb(h, s, l) { if (!s) return [l * 255, l * 255, l * 255]; const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255]; }
  const hex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  function color(el, ctx) {// el : élément qui contient srgbClr / schemeClr / sysClr / prstClr
    if (!el) return null; let c = null, base = null;
    for (const k of el.children) { if (['srgbClr', 'schemeClr', 'sysClr', 'prstClr', 'scrgbClr'].includes(k.localName)) { c = k; break; } }
    if (!c) return null;
    if (c.localName === 'srgbClr') base = '#' + c.getAttribute('val');
    else if (c.localName === 'sysClr') base = '#' + (c.getAttribute('lastClr') || '000000');
    else if (c.localName === 'prstClr') base = ({ black: '#000000', white: '#ffffff', red: '#ff0000', blue: '#0000ff', green: '#008000', yellow: '#ffff00', gray: '#808080' })[c.getAttribute('val')] || '#000000';
    else if (c.localName === 'scrgbClr') base = hex(['r', 'g', 'b'].map(k => +c.getAttribute(k) / 100000 * 255));
    else { let v = c.getAttribute('val'); if (v === 'phClr') base = ctx.phClr || '#000000'; else { v = (ctx.map && ctx.map[v]) || v; base = ctx.theme.colors[v] || '#000000'; } }
    let [r, g, b] = [1, 3, 5].map(i => parseInt(base.slice(i, i + 2), 16)); let alpha = 1;
    for (const m of c.children) {
      const v = +m.getAttribute('val') / 100000;
      if (m.localName === 'lumMod' || m.localName === 'lumOff') { const [h, s, l] = hsl(r, g, b); const nl = m.localName === 'lumMod' ? l * v : l + v;[r, g, b] = rgb(h, s, Math.max(0, Math.min(1, nl))); }
      else if (m.localName === 'shade') { r *= v; g *= v; b *= v; }
      else if (m.localName === 'tint') { r = 255 - (255 - r) * v; g = 255 - (255 - g) * v; b = 255 - (255 - b) * v; }
      else if (m.localName === 'alpha') alpha = v;
    }
    return alpha < 1 ? `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${alpha.toFixed(2)})` : hex([r, g, b]);
  }
  function fillOf(spPr, ctx, style) {
    if (spPr) {
      if (kid(spPr, 'noFill')) return 'none';
      const sf = kid(spPr, 'solidFill'); if (sf) return color(sf, ctx);
      const gf = kid(spPr, 'gradFill'); if (gf) { const gs = path(gf, 'gsLst'); const st = gs && kids(gs, 'gs'); if (st && st.length) return color(st[Math.floor(st.length / 2)], ctx); }
      if (kid(spPr, 'blipFill')) return 'blip';
    }
    if (style) { const fr = kid(style, 'fillRef'); if (fr && +fr.getAttribute('idx') > 0) return color(fr, ctx); }
    return null;
  }
  function lineOf(spPr, ctx, style) {
    const ln = spPr && kid(spPr, 'ln');
    if (ln) { if (kid(ln, 'noFill')) return null; const w = ln.getAttribute('w'); const sf = kid(ln, 'solidFill'); const col = sf ? color(sf, ctx) : null;
      if (col) return { col, w: w ? +w / EMU : 0.26 }; }
    if (style) { const lr = kid(style, 'lnRef'); if (lr && +lr.getAttribute('idx') > 0) { const col = color(lr, ctx); if (col) return { col, w: ln && ln.getAttribute('w') ? +ln.getAttribute('w') / EMU : 0.26 }; } }
    return null;
  }
  /* ---------- texte : styles hérités (masque → disposition → diapo) ---------- */
  function lvlProps(lst, lvl) {// propriétés d'un niveau d'une liste de styles (lstStyle / titleStyle…)
    if (!lst) return null; return kid(lst, 'lvl' + (lvl + 1) + 'pPr');
  }
  function readPPr(p, ctx, o) {// fusionne un pPr dans o
    if (!p) return o; o = Object.assign({}, o);
    const a = p.getAttribute('algn'); if (a) o.algn = a;
    if (p.getAttribute('marL') != null) o.marL = +p.getAttribute('marL') / EMU;
    if (p.getAttribute('indent') != null) o.indent = +p.getAttribute('indent') / EMU;
    if (kid(p, 'buNone')) o.bullet = null; const bc = kid(p, 'buChar'); if (bc) o.bullet = bc.getAttribute('char'); const ba = kid(p, 'buAutoNum'); if (ba) o.bullet = '#';
    const ls = path(p, 'lnSpc', 'spcPct'); if (ls) o.lnSpc = +ls.getAttribute('val') / 100000;
    const sa = path(p, 'spcAft', 'spcPts'); if (sa) o.spcAft = +sa.getAttribute('val') / 100;
    const sb = path(p, 'spcBef', 'spcPts'); if (sb) o.spcBef = +sb.getAttribute('val') / 100;
    const d = kid(p, 'defRPr'); if (d) o.r = readRPr(d, ctx, o.r);
    return o;
  }
  function readRPr(r, ctx, o) {
    o = Object.assign({}, o || {}); if (!r) return o;
    if (r.getAttribute('sz')) o.sz = +r.getAttribute('sz') / 100;
    if (r.getAttribute('b') != null) o.b = r.getAttribute('b') === '1' || r.getAttribute('b') === 'true';
    if (r.getAttribute('i') != null) o.i = r.getAttribute('i') === '1' || r.getAttribute('i') === 'true';
    if (r.getAttribute('u') != null) o.u = r.getAttribute('u') !== 'none';
    if (r.getAttribute('cap') === 'all') o.cap = true;
    const sf = kid(r, 'solidFill'); if (sf) o.col = color(sf, ctx);
    const lt = kid(r, 'latin'); if (lt && lt.getAttribute('typeface')) { let f = lt.getAttribute('typeface'); if (f === '+mj-lt') f = ctx.theme.major; if (f === '+mn-lt') f = ctx.theme.minor; o.font = f; }
    return o;
  }
  function phKey(sp) { const ph = path(sp, 'nvSpPr', 'nvPr', 'ph') || path(sp, 'nvPicPr', 'nvPr', 'ph'); if (!ph) return null; return { type: ph.getAttribute('type') || 'body', idx: ph.getAttribute('idx') }; }
  function findPh(tree, key) {// forme du même espace réservé dans une disposition / un masque
    if (!tree || !key) return null; let byType = null;
    for (const sp of tree.querySelectorAll('*')) { if (sp.localName !== 'sp') continue; const k = phKey(sp); if (!k) continue;
      if (key.idx != null && k.idx === key.idx) return sp; if (!byType && (k.type === key.type || (key.type === 'ctrTitle' && k.type === 'title') || (key.type === 'subTitle' && k.type === 'body'))) byType = sp; }
    return byType;
  }
  /* ---------- lecture d'une forme ---------- */
  function xfrmOf(el) { const x = el && (path(el, 'spPr', 'xfrm') || path(el, 'grpSpPr', 'xfrm') || path(el, 'xfrm')); if (!x) return null; const off = kid(x, 'off'), ext = kid(x, 'ext'); if (!off || !ext) return null;
    return { x: +off.getAttribute('x') / EMU, y: +off.getAttribute('y') / EMU, w: +ext.getAttribute('cx') / EMU, h: +ext.getAttribute('cy') / EMU, rot: (+x.getAttribute('rot') || 0) / 60000, flipH: x.getAttribute('flipH') === '1', flipV: x.getAttribute('flipV') === '1', x0: x }; }
  async function readTree(tree, ctx, z, partRels, partName, isMaster) {
    const out = []; if (!tree) return out;
    const walk = async (parent, T) => {
      for (const el of parent.children) {
        const ln = el.localName;
        if (ln === 'grpSp') { const x = xfrmOf(el); let T2 = T; if (x) { const co = path(x.x0, 'chOff'), ce = path(x.x0, 'chExt');
            const cx = co ? +co.getAttribute('x') / EMU : x.x, cy = co ? +co.getAttribute('y') / EMU : x.y, cw = ce ? +ce.getAttribute('cx') / EMU || x.w : x.w, ch = ce ? +ce.getAttribute('cy') / EMU || x.h : x.h;
            const sx = cw ? x.w / cw : 1, sy = ch ? x.h / ch : 1; T2 = p => { const q = { x: x.x + (p.x - cx) * sx, y: x.y + (p.y - cy) * sy, w: p.w * sx, h: p.h * sy, rot: p.rot }; return T(q); }; }
          await walk(el, T2); continue; }
        if (ln === 'sp' || ln === 'cxnSp') { const it = readShape(el, ctx, isMaster); if (!it) continue; const g = T(it); Object.assign(it, g); out.push(it); continue; }
        if (ln === 'pic') { const it = await readPic(el, ctx, z, partRels); if (!it) continue; Object.assign(it, T(it)); out.push(it); continue; }
        if (ln === 'graphicFrame') { const it = readTable(el, ctx); if (it) { Object.assign(it, T(it)); out.push(it); } continue; }
        if (ln === 'AlternateContent') { const ch = kid(el, 'Choice') || kid(el, 'Fallback'); if (ch) await walk(ch, T); }
      }
    };
    await walk(tree, p => ({ x: p.x, y: p.y, w: p.w, h: p.h, rot: p.rot }));
    return out;
  }
  function readShape(sp, ctx, isMaster) {
    const key = phKey(sp);
    if (isMaster && key) return null;// les espaces réservés du masque / de la disposition ne s'affichent pas
    let x = xfrmOf(sp);
    const lay = key && findPh(ctx.layoutTree, key), mas = key && findPh(ctx.masterTree, key);
    if (!x && lay) x = xfrmOf(lay); if (!x && mas) x = xfrmOf(mas);
    if (!x) return null;
    const spPr = kid(sp, 'spPr'), style = kid(sp, 'style');
    const geom = path(spPr, 'prstGeom'); const prst = geom ? geom.getAttribute('prst') : (path(spPr, 'custGeom') ? 'cust' : 'rect');
    let fill = fillOf(spPr, ctx, style); if (fill === 'blip') fill = '#dddddd';
    const line = lineOf(spPr, ctx, style);
    const it = { x: x.x, y: x.y, w: x.w, h: x.h, rot: x.rot, fill: fill && fill !== 'none' ? fill : null, stroke: line ? line.col : null, sw: line ? line.w : 0 };
    if (sp.localName === 'cxnSp' || /line|Connector/i.test(prst)) { it.type = 'line'; it.dir = x.flipV !== x.flipH ? 1 : 0; it.stroke = it.stroke || '#000000'; it.sw = it.sw || 0.26; return it; }
    it.type = prst === 'ellipse' ? 'ellipse' : 'rect';
    if (prst === 'roundRect') { const gd = geom && geom.querySelector('gd'); const adj = gd ? +String(gd.getAttribute('fmla')).replace(/\D/g, '') / 100000 : 0.16667; it.rad = Math.min(x.w, x.h) * adj; }
    if (!['rect', 'roundRect', 'ellipse', 'cust'].includes(prst)) it.shape = prst;
    // texte
    const tx = kid(sp, 'txBody');
    if (tx) { const t = readText(tx, key, ctx, lay, mas, style); if (t.paras.some(p => p.runs.some(r => r.t.trim()))) { Object.assign(it, t); it.ph = key ? key.type : null; it.type = it.type === 'ellipse' ? 'ellipse' : 'text'; if (it.type === 'ellipse') it.textIn = true; } }
    if (it.type !== 'text' && !it.fill && !it.stroke) return null;
    return it;
  }
  function readText(tx, key, ctx, lay, mas, style) {
    const bp = kid(tx, 'bodyPr'); const lbp = lay && path(lay, 'txBody', 'bodyPr'), mbp = mas && path(mas, 'txBody', 'bodyPr');
    const attr = n => (bp && bp.getAttribute(n)) ?? (lbp && lbp.getAttribute(n)) ?? (mbp && mbp.getAttribute(n));
    const inset = { l: attr('lIns') != null ? +attr('lIns') / EMU : 2.54, r: attr('rIns') != null ? +attr('rIns') / EMU : 2.54, t: attr('tIns') != null ? +attr('tIns') / EMU : 1.27, b: attr('bIns') != null ? +attr('bIns') / EMU : 1.27 };
    const anchor = attr('anchor') || 't';
    const af = bp && kid(bp, 'normAutofit'); const scale = af && af.getAttribute('fontScale') ? +af.getAttribute('fontScale') / 100000 : 1;
    const tStyle = key ? ((key.type === 'title' || key.type === 'ctrTitle') ? ctx.txStyles.title : ctx.txStyles.body) : ctx.txStyles.other;
    const lists = [tStyle, mas && path(mas, 'txBody', 'lstStyle'), lay && path(lay, 'txBody', 'lstStyle'), kid(tx, 'lstStyle')];
    let fontRefCol = null; if (style) { const fr = kid(style, 'fontRef'); if (fr) fontRefCol = color(fr, ctx); }
    const paras = [];
    for (const p of kids(tx, 'p')) {
      const pPr = kid(p, 'pPr'); const lvl = pPr && pPr.getAttribute('lvl') ? +pPr.getAttribute('lvl') : 0;
      let o = { algn: 'l', marL: 0, indent: 0, bullet: null, lnSpc: 1, spcAft: 0, spcBef: 0, r: { sz: 18, col: fontRefCol || ctx.theme.colors.dk1 || '#000000', font: ctx.theme.minor } };
      if (key && (key.type === 'title' || key.type === 'ctrTitle')) o.r.font = ctx.theme.major;
      for (const L of lists) o = readPPr(lvlProps(L, lvl), ctx, o);
      if (fontRefCol && !key) o.r = Object.assign({}, o.r, { col: fontRefCol });
      o = readPPr(pPr, ctx, o);
      const runs = [];
      for (const r of p.children) {
        if (r.localName === 'r' || r.localName === 'fld') { const t = kid(r, 't'); const rp = readRPr(kid(r, 'rPr'), ctx, o.r); let s = t ? t.textContent : ''; if (rp.cap) s = s.toUpperCase(); runs.push({ t: s, sz: (rp.sz || 18) * scale, b: !!rp.b, i: !!rp.i, u: !!rp.u, col: rp.col || '#000000', font: rp.font || ctx.theme.minor }); }
        else if (r.localName === 'br') runs.push({ t: '\n', sz: (o.r.sz || 18) * scale, col: o.r.col, font: o.r.font });
      }
      if (!runs.length) { const ep = readRPr(kid(p, 'endParaRPr'), ctx, o.r); runs.push({ t: '', sz: (ep.sz || o.r.sz || 18) * scale, col: ep.col, font: ep.font }); }
      paras.push({ lvl, algn: o.algn, bullet: runs.some(r => r.t.trim()) ? o.bullet : null, marL: o.marL, indent: o.indent, lnSpc: o.lnSpc || 1, spcAft: o.spcAft || 0, spcBef: o.spcBef || 0, runs });
    }
    // numérotation automatique
    let n = 0; paras.forEach(p => { if (p.bullet === '#') { n++; p.bullet = n + '.'; } else if (p.lvl === 0) n = 0; });
    return { paras, inset, anchor };
  }
  async function readPic(pic, ctx, z, partRels) {
    const x = xfrmOf(pic); if (!x) return null; const blip = pic.querySelector('blipFill > blip, blip');
    const id = blip && (blip.getAttribute('r:embed') || blip.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed'));
    const rel = id && partRels[id]; if (!rel || !rel.target) return null;
    const data = await z.get(rel.target); if (!data) return null;
    const ext = rel.target.split('.').pop().toLowerCase(); const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml', webp: 'image/webp' }[ext];
    if (!mime) return null;// emf / wmf : non lisibles par le navigateur
    let blob = new Blob([data], { type: mime });
    const sr = pic.querySelector('srcRect'); if (sr) { const c = k => (+sr.getAttribute(k) || 0) / 100000; const L = c('l'), T = c('t'), R = c('r'), B = c('b'); if (L || T || R || B) blob = await cropBlob(blob, L, T, R, B); }
    return { type: 'image', x: x.x, y: x.y, w: x.w, h: x.h, rot: x.rot, blob };
  }
  async function cropBlob(blob, L, T, R, B) { try { const bm = await createImageBitmap(blob); const sx = bm.width * L, sy = bm.height * T, sw = bm.width * (1 - L - R), sh = bm.height * (1 - T - B); if (sw < 1 || sh < 1) return blob;
    const c = document.createElement('canvas'); c.width = Math.round(sw); c.height = Math.round(sh); c.getContext('2d').drawImage(bm, sx, sy, sw, sh, 0, 0, c.width, c.height); return await new Promise(r => c.toBlob(r, 'image/png')); } catch (e) { return blob; } }
  function readTable(gf, ctx) {
    const tbl = gf.querySelector('tbl'); const x = xfrmOf(gf); if (!tbl || !x) return null;
    const cols = [...tbl.querySelectorAll('tblGrid > gridCol')].map(c => +c.getAttribute('w') / EMU);
    const rows = [...tbl.children].filter(c => c.localName === 'tr').map(tr => ({ h: +tr.getAttribute('h') / EMU, cells: kids(tr, 'tc').map(tc => { const t = kid(tc, 'txBody'); const tcPr = kid(tc, 'tcPr');
      return { text: t ? readText(t, null, ctx, null, null, null) : { paras: [] }, fill: tcPr ? fillOf(tcPr, ctx, null) : null, span: +tc.getAttribute('gridSpan') || 1 }; }) }));
    return { type: 'table', x: x.x, y: x.y, w: x.w, h: x.h, rot: 0, cols, rows };
  }
  function bgOf(cSld, ctx) {
    const bg = cSld && kid(cSld, 'bg'); if (!bg) return null;
    const pr = kid(bg, 'bgPr'); if (pr) { const f = fillOf(pr, ctx); if (f && f !== 'blip' && f !== 'none') return { col: f }; if (f === 'blip') return { blipEl: kid(pr, 'blipFill') }; }
    const ref = kid(bg, 'bgRef'); if (ref) { const c = color(ref, ctx); if (c) return { col: c }; }
    return null;
  }
  async function read(file) {
    const z = await unzip(await file.arrayBuffer());
    const pres = parse(await z.text('ppt/presentation.xml')); if (!pres) throw new Error('présentation illisible');
    const sz = pres.querySelector('sldSz'); const W = +sz.getAttribute('cx') / EMU, H = +sz.getAttribute('cy') / EMU;
    const prel = await rels(z, 'ppt/presentation.xml');
    const ids = [...pres.querySelectorAll('sldIdLst > sldId')].map(s => s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'));
    const cache = new Map();
    const loadPart = async name => { if (cache.has(name)) return cache.get(name); const v = { name, xml: parse(await z.text(name)), rels: await rels(z, name) }; cache.set(name, v); return v; };
    const slides = [];
    for (const id of ids) {
      const r = prel[id]; if (!r || !r.target) continue; const sl = await loadPart(r.target); if (!sl.xml) continue;
      const layName = Object.values(sl.rels).find(x => /slideLayout/.test(x.type)); const lay = layName && layName.target ? await loadPart(layName.target) : null;
      const masName = lay && Object.values(lay.rels).find(x => /slideMaster/.test(x.type)); const mas = masName && masName.target ? await loadPart(masName.target) : null;
      const thName = mas && Object.values(mas.rels).find(x => /theme/.test(x.type)); const th = thName && thName.target ? await loadPart(thName.target) : null;
      // thème
      const theme = { colors: {}, major: 'Calibri', minor: 'Calibri' };
      if (th && th.xml) { const cs = th.xml.querySelector('clrScheme'); if (cs) for (const c of cs.children) { const v = c.firstElementChild; if (!v) continue; theme.colors[c.localName] = '#' + (v.getAttribute('val') && v.localName === 'srgbClr' ? v.getAttribute('val') : (v.getAttribute('lastClr') || '000000')); }
        const mj = th.xml.querySelector('majorFont > latin'), mn = th.xml.querySelector('minorFont > latin'); if (mj) theme.major = mj.getAttribute('typeface') || theme.major; if (mn) theme.minor = mn.getAttribute('typeface') || theme.minor; }
      const cm = mas && mas.xml && mas.xml.querySelector('clrMap'); const map = {};
      if (cm) for (const a of cm.attributes) map[a.name] = a.value; else Object.assign(map, { bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2' });
      const ctx = { theme, map, txStyles: {} };
      const ts = mas && mas.xml && mas.xml.querySelector('txStyles'); if (ts) { ctx.txStyles.title = kid(ts, 'titleStyle'); ctx.txStyles.body = kid(ts, 'bodyStyle'); ctx.txStyles.other = kid(ts, 'otherStyle'); }
      const tree = x => x && x.xml ? x.xml.querySelector('cSld > spTree') : null;
      ctx.layoutTree = tree(lay); ctx.masterTree = tree(mas);
      // fond
      let bg = bgOf(sl.xml.querySelector('cSld'), ctx) || (lay && lay.xml && bgOf(lay.xml.querySelector('cSld'), ctx)) || (mas && mas.xml && bgOf(mas.xml.querySelector('cSld'), ctx)) || { col: '#ffffff' };
      if (bg.blipEl) { const id2 = bg.blipEl.querySelector('blip'); const rid = id2 && (id2.getAttribute('r:embed') || id2.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed'));
        const owner = [sl, lay, mas].find(p => p && p.rels[rid]); const rel = owner && owner.rels[rid]; const data = rel && rel.target ? await z.get(rel.target) : null; bg = data ? { col: '#ffffff', blob: new Blob([data]) } : { col: '#ffffff' }; }
      // formes : masque et disposition (décors), puis la diapo
      const items = [];
      const showMas = sl.xml.documentElement.getAttribute('showMasterSp') !== '0';
      if (showMas && mas && lay && lay.xml.documentElement.getAttribute('showMasterSp') !== '0') items.push(...await readTree(tree(mas), ctx, z, mas.rels, mas.name, true));
      if (showMas && lay) items.push(...await readTree(tree(lay), ctx, z, lay.rels, lay.name, true));
      items.push(...await readTree(tree(sl), ctx, z, sl.rels, sl.name, false));
      slides.push({ bg, items });
    }
    return { w: W, h: H, slides, name: (file.name || 'presentation').replace(/\.pptx$/i, '') };
  }
  /* ---------- dessin d'une diapo (pour PDF et Photo) ---------- */
  const fam = f => `"${f || 'Calibri'}", "Carlito", "Helvetica Neue", Arial, sans-serif`;
  function layoutText(x, it, W, k) {// découpe en lignes ; renvoie [{runs:[{t,font,col,u,w}],w,h,asc,algn,x0}]
    const lines = []; let y = 0;
    for (const p of it.paras) {
      const left = (p.marL + (p.indent < 0 ? p.indent : 0)) * k, first = p.indent * k;
      const maxW = W - p.marL * k;
      let cur = null; const sz0 = (p.runs[0] && p.runs[0].sz) || 18;
      const newLine = () => { cur = { runs: [], w: 0, sz: sz0, algn: p.algn, x0: p.marL * k, bullet: null }; lines.push(cur); };
      newLine(); if (p.bullet) { cur.bullet = { t: p.bullet, x: (p.marL + p.indent) * k }; }
      if (p.spcBef && lines.length > 1) cur.before = p.spcBef / 72 * 25.4 * k;
      for (const r of p.runs) {
        const font = (r.i ? 'italic ' : '') + (r.b ? 'bold ' : '') + (r.sz * 25.4 / 72 * k) + 'px ' + fam(r.font); x.font = font;
        const parts = r.t.split(/(\s+|\n)/);
        for (const w of parts) { if (!w) continue; if (w === '\n') { newLine(); continue; }
          const ww = x.measureText(w).width;
          if (cur.w + ww > maxW && cur.w > 0 && /\S/.test(w)) { newLine(); }
          if (!cur.w && !/\S/.test(w)) continue;
          cur.runs.push({ t: w, font, col: r.col, u: r.u, w: ww }); cur.w += ww; cur.sz = Math.max(cur.sz, r.sz); }
      }
      lines.forEach(l => { if (l.h == null) { l.h = l.sz * 25.4 / 72 * k * 1.2 * p.lnSpc; l.asc = l.sz * 25.4 / 72 * k * 0.95; } });
      lines[lines.length - 1].after = p.spcAft / 72 * 25.4 * k;
    }
    return lines;
  }
  function drawText(x, it, X, Y, W, H, k) {
    const ins = it.inset || { l: 2.54, r: 2.54, t: 1.27, b: 1.27 };
    const bx = X + ins.l * k, by = Y + ins.t * k, bw = Math.max(1, W - (ins.l + ins.r) * k), bh = H - (ins.t + ins.b) * k;
    const lines = layoutText(x, it, bw, k); const total = lines.reduce((s, l) => s + (l.before || 0) + l.h + (l.after || 0), 0);
    let y = by + (it.anchor === 'ctr' ? (bh - total) / 2 : it.anchor === 'b' ? bh - total : 0);
    x.textBaseline = 'alphabetic';
    for (const l of lines) { y += l.before || 0; const base = y + l.asc;
      let lx = bx + l.x0; const avail = bw - l.x0; if (l.algn === 'ctr') lx += (avail - l.w) / 2; else if (l.algn === 'r') lx += avail - l.w;
      if (l.bullet) { const r0 = l.runs[0]; x.font = r0 ? r0.font : x.font; x.fillStyle = r0 ? r0.col : '#000'; x.fillText(l.bullet.t === '#' ? '•' : l.bullet.t, bx + l.bullet.x, base); }
      for (const r of l.runs) { x.font = r.font; x.fillStyle = r.col || '#000'; x.fillText(r.t, lx, base); if (r.u) x.fillRect(lx, base + 2, r.w, Math.max(1, k * 0.2)); lx += r.w; }
      y += l.h + (l.after || 0); }
  }
  async function render(deck, n, k) {
    const s = deck.slides[n]; const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(deck.w * k)); c.height = Math.max(1, Math.round(deck.h * k)); const x = c.getContext('2d');
    x.fillStyle = (s.bg && s.bg.col) || '#fff'; x.fillRect(0, 0, c.width, c.height);
    if (s.bg && s.bg.blob) { try { const bm = await createImageBitmap(s.bg.blob); x.drawImage(bm, 0, 0, c.width, c.height); } catch (e) { } }
    for (const it of s.items) {
      x.save(); const X = it.x * k, Y = it.y * k, W = it.w * k, H = it.h * k;
      if (it.rot) { x.translate(X + W / 2, Y + H / 2); x.rotate(it.rot * Math.PI / 180); x.translate(-(X + W / 2), -(Y + H / 2)); }
      if (it.type === 'image') { try { const bm = await createImageBitmap(it.blob); x.drawImage(bm, X, Y, W, H); } catch (e) { } }
      else if (it.type === 'line') { x.strokeStyle = it.stroke || '#000'; x.lineWidth = Math.max(1, (it.sw || .26) * k); x.beginPath(); if (it.dir) { x.moveTo(X, Y + H); x.lineTo(X + W, Y); } else { x.moveTo(X, Y); x.lineTo(X + W, Y + H); } x.stroke(); }
      else if (it.type === 'table') { let yy = Y; for (const row of it.rows) { let xx = X, ci = 0; const rh = row.h * k; for (const cell of row.cells) { let cw = 0; for (let q = 0; q < cell.span; q++)cw += (it.cols[ci + q] || 0) * k; ci += cell.span;
            if (cell.fill && cell.fill !== 'none' && cell.fill !== 'blip') { x.fillStyle = cell.fill; x.fillRect(xx, yy, cw, rh); } x.strokeStyle = '#999'; x.lineWidth = Math.max(1, k * .15); x.strokeRect(xx, yy, cw, rh);
            drawText(x, Object.assign({ inset: { l: 2.54, r: 2.54, t: 1.27, b: 1.27 }, anchor: 't' }, cell.text), xx, yy, cw, rh, k); xx += cw; } yy += rh; } }
      else {
        const ell = it.type === 'ellipse';
        const shapePath = () => { x.beginPath(); if (ell) x.ellipse(X + W / 2, Y + H / 2, W / 2, H / 2, 0, 0, Math.PI * 2); else if (it.rad && x.roundRect) x.roundRect(X, Y, W, H, it.rad * k); else x.rect(X, Y, W, H); };
        if (it.fill) { x.fillStyle = it.fill; shapePath(); x.fill(); }
        if (it.stroke && it.sw) { x.strokeStyle = it.stroke; x.lineWidth = Math.max(1, it.sw * k); shapePath(); x.stroke(); }
        if (it.paras) drawText(x, it, X, Y, W, H, k);
      }
      x.restore();
    }
    return c;
  }
  /* texte brut / markdown d'une présentation (pour Dossiers) */
  function toMarkdown(deck) {
    const out = [];
    deck.slides.forEach((s, i) => {
      const texts = s.items.filter(it => it.paras && it.type !== 'table');
      const title = texts.find(it => it.ph === 'title' || it.ph === 'ctrTitle') || null;
      const tt = title ? title.paras.map(p => p.runs.map(r => r.t).join('')).join(' ').trim() : '';
      out.push('## ' + (tt || 'Diapo ' + (i + 1)));
      for (const it of texts) { if (it === title) continue;
        for (const p of it.paras) { const t = p.runs.map(r => (r.b && r.t.trim() ? r.t.replace(/^(\s*)([\s\S]*?)(\s*)$/, '$1**$2**$3') : r.t)).join('').replace(/\s+/g, ' ').trim(); if (!t) continue;
          out.push(p.bullet ? '  '.repeat(p.lvl) + (/^\d+\.$/.test(p.bullet) ? p.bullet + ' ' : '- ') + t : t); }
        out.push(''); }
      for (const it of s.items.filter(q => q.type === 'table')) { const rows = it.rows.map(r => '| ' + r.cells.map(c => c.text.paras.map(p => p.runs.map(x => x.t).join('')).join(' ').trim()).join(' | ') + ' |');
        if (rows.length) { const n = it.rows[0].cells.length; rows.splice(1, 0, '|' + ' --- |'.repeat(n)); out.push(...rows, ''); } }
      out.push('');
    });
    return out.join('\n').replace(/\n{3,}/g, '\n\n');
  }
  window.AtelierPPTX = { read, render, toMarkdown, isPPTX: f => /\.pptx$/i.test(f.name || '') || f.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
})();
