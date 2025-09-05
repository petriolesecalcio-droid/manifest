/* ===== Config sheet ===== */
const SHEET_FILE_ID = '1nWG0OBGpiyK-lulP-OKGad4jG7uEVmcy';
const META_GID      = '254048258';   // Meta
const OPP_GID       = '1284472120';  // Avversari
const PUBLISHED_DOC_E_ID = '2PACX-1vSpJqXmoJaIznEo_EGHCfUxyYVWWKJCGULM9FbnI14hLhGpsjt3oMHT5ahJwEmJ4w';

/* ===== Parametri (con salvataggio su localStorage) ===== */
const K = {
  ANGLE_DEG: -8,
  VS_X_RATIO: 0.50,
  VS_Y_RATIO: 0.57,
  LEFT_OFFSET_RATIO: 0.25,
  RIGHT_OFFSET_RATIO: 0.25,
  RAIL_Y_SHIFT_RATIO: 0.00,
  SIDE1_Y_EXTRA_RATIO: 0.00,
  SIDE2_Y_EXTRA_RATIO: 0.00,
  LOGO_H_RATIO: 0.12,
  NAME_GAP_RATIO: 0.018,
  NAME_FONT_RATIO: 0.038,
  SCALE1: 1.00,           // scala logo sinistra
  SCALE2: 1.00,           // scala logo destra

  /* ---- Info block (ancorato area "MATCH DAY") ---- */
  INFO_BASE_X_RATIO: 0.78,   // posizione base (x%) – da rifinire via slider
  INFO_BASE_Y_RATIO: 0.24,   // posizione base (y%)
  INFO_ALONG_RATIO:  0.00,   // spostamento lungo la retta (in larghezze pagina, + a destra)
  INFO_Y_EXTRA_RATIO: 0.00,  // spostamento perpendicolare (in altezze pagina, + in giù)
  INFO_FONT_RATIO:   0.032,  // dimensione base font
  INFO_FONT_SCALE:   1.00,   // scala via slider
};

const LS_KEY = 'manifest_tuning_v1';
try {
  const saved = JSON.parse(localStorage.getItem(LS_KEY)||'{}');
  Object.assign(K, saved||{});
} catch {}

/* ===== Helpers sheet ===== */
const gvizCsvURL=(fileId,gid)=>
  `https://docs.google.com/spreadsheets/d/${fileId}/gviz/tq?gid=${encodeURIComponent(gid)}&headers=1&tqx=out:csv`;
const pubCsvFromDocEId=(eId,gid)=>
  `https://docs.google.com/spreadsheets/d/e/${eId}/pub?gid=${encodeURIComponent(gid)}&single=true&output=csv`;
function parseCSV(text){
  let t=String(text||'').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
  const rows=[]; let row=[],cur='',inQ=false;
  const pushCell=()=>{row.push(cur);cur=''}; const pushRow=()=>{rows.push(row);row=[]};
  for(let i=0;i<t.length;i++){
    const c=t[i],n=t[i+1];
    if(inQ){ if(c=='"'&&n=='"'){cur+='"';i++} else if(c=='"'){inQ=false} else cur+=c }
    else{ if(c=='"') inQ=true; else if(c==',') pushCell(); else if(c=='\n'){pushCell();pushRow()} else cur+=c }
  }
  if(cur!==''||row.length){pushCell();pushRow()}
  const header=(rows.shift()||[]).map(h=>String(h||'').trim());
  return rows.map(r=>Object.fromEntries(header.map((h,i)=>[h, r[i]!==undefined?r[i]:'' ])));
}
async function fetchCsvPrefer(fileId,gid,eid){
  try{
    const r = await fetch(gvizCsvURL(fileId,gid), {cache:'no-store'});
    if(r.ok) return parseCSV(await r.text());
  }catch(_){}
  const r2 = await fetch(pubCsvFromDocEId(eid,gid), {cache:'no-store'});
  if(!r2.ok) throw new Error('CSV published fetch failed');
  return parseCSV(await r2.text());
}

/* ===== Normalizzazioni ===== */
const slugify = s => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
const normKey = k => String(k||'').trim().toLowerCase().replace(/\s+/g,'');
function normalizeMeta(rows){
  const out=new Map();
  rows.forEach(r=>{
    const k=normKey(r.Key||r.KEY||r.key||'');
    const v=(''+(r.Value||r.VALORE||r.value||'')).trim();
    if(k) out.set(k, v);
  });
  return out;
}
/* Avversari: accetta colonne Logo e Paese */
function normalizeOpp(rows){
  const out=new Map();
  rows.forEach(r=>{
    const name=(''+(r.Squadra||r.squadra||'')).trim();
    const logo=(''+(r.Logo||r.logo||'')).trim();
    const paese=(''+(r.Paese||r.paese||'')).trim();
    if(!name) return;
    out.set(name.toLowerCase(), { logo, paese });
  });
  return out;
}
function normalizeLogoUrl(s){
  const v = String(s||'').trim();
  if(!v) return '';
  if(/^https?:\/\//i.test(v) || v.startsWith('data:')) return v;
  if(v.startsWith('logos/') || v.startsWith('./') || v.startsWith('../')) return v;
  return 'logos/' + v.replace(/^\/+/, '');
}
function resolveLogoSrc(teamName, oppMap){
  const key=(teamName||'').trim().toLowerCase();
  const rec = oppMap.get(key);
  if(rec && rec.logo) return normalizeLogoUrl(rec.logo);
  return `logos/${slugify(teamName)}.webp`;
}
function resolvePaese(teamName, oppMap, fallback=''){
  const key=(teamName||'').trim().toLowerCase();
  const rec = oppMap.get(key);
  return (rec && rec.paese) ? rec.paese : fallback;
}

/* Campo: ripulisci parole "campo","stadio","comunale" */
function cleanFieldName(s){
  return String(s||'')
    .replace(/\b(campo|stadio|comunale)\b/gi,'')
    .replace(/[\/,.-]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

/* Font readiness (Oswald) */
async function waitFonts(){
  if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch(_) {} }
}

/* ===== Layout: blocchi loghi ===== */
function layoutSide(stageEl, sideEl, cx, cy, scale=1){
  const H = stageEl.clientHeight;
  const logoH   = H * K.LOGO_H_RATIO * scale;
  const nameGap = H * K.NAME_GAP_RATIO;
  const nameFont= H * K.NAME_FONT_RATIO;

  sideEl.style.left = `${cx}px`;
  sideEl.style.top  = `${cy}px`;
  sideEl.style.setProperty('--angle', `${K.ANGLE_DEG}deg`);
  sideEl.style.setProperty('--logoHpx', `${logoH}px`);
  sideEl.style.setProperty('--logoWpx', `${logoH}px`);
  sideEl.style.setProperty('--nameGapPx', `${nameGap}px`);
  sideEl.style.setProperty('--nameFontPx', `${nameFont}px`);
}
function layoutTeams(stageEl){
  const W = stageEl.clientWidth, H = stageEl.clientHeight;
  const vsX = W * K.VS_X_RATIO;
  const vsY = H * (K.VS_Y_RATIO + K.RAIL_Y_SHIFT_RATIO);

  const theta = K.ANGLE_DEG * Math.PI/180, dx = Math.cos(theta), dy = Math.sin(theta);
  const L = W * K.LEFT_OFFSET_RATIO, R = W * K.RIGHT_OFFSET_RATIO;

  let leftX  = vsX - dx * L, leftY  = vsY - dy * L;
  let rightX = vsX + dx * R, rightY = vsY + dy * R;

  leftY  += H * K.SIDE1_Y_EXTRA_RATIO;
  rightY += H * K.SIDE2_Y_EXTRA_RATIO;

  layoutSide(stageEl, document.getElementById('side1'), leftX,  leftY, K.SCALE1);
  layoutSide(stageEl, document.getElementById('side2'), rightX, rightY, K.SCALE2);
}

/* ===== Layout: blocco info a destra del MATCH DAY ===== */
function layoutInfo(stageEl){
  const W = stageEl.clientWidth, H = stageEl.clientHeight;
  // punto base (vicino al banner MATCH DAY)
  const baseX = W * K.INFO_BASE_X_RATIO;
  const baseY = H * K.INFO_BASE_Y_RATIO;

  const theta = K.ANGLE_DEG * Math.PI/180;
  const dx = Math.cos(theta), dy = Math.sin(theta);

  // spostamento lungo la retta (in % larghezza)
  const along = W * K.INFO_ALONG_RATIO;

  // spostamento perpendicolare (in % altezza) -> vettore n = (-sin, cos)
  const perp = H * K.INFO_Y_EXTRA_RATIO;
  const nx = -Math.sin(theta), ny = Math.cos(theta);

  const cx = baseX + dx*along + nx*perp;
  const cy = baseY + dy*along + ny*perp;

  const info = document.getElementById('info');
  const fontPx = H * K.INFO_FONT_RATIO * K.INFO_FONT_SCALE;

  info.style.left = `${cx}px`;
  info.style.top  = `${cy}px`;
  info.style.setProperty('--angle', `${K.ANGLE_DEG}deg`);
  info.style.setProperty('--infoFontPx', `${fontPx}px`);
}

/* ===== DOM ===== */
const $ = s=>document.querySelector(s);
const stage  = $('#stage');
const bg     = $('#bg');
const side1  = $('#side1');
const side2  = $('#side2');
const logo1  = $('#logo1');
const logo2  = $('#logo2');
const name1  = $('#name1');
const name2  = $('#name2');
const infoText = $('#infoText');
const statusEl = $('#status');

/* ===== UI (manopole) ===== */
function bindKnob(id, key, fmt=(v)=>v){
  const el = document.getElementById(id);
  const out = document.getElementById('val_'+id.split('_')[1]);
  el.value = K[key];
  out.textContent = fmt(K[key]);
  el.addEventListener('input', ()=>{
    const t = Number(el.value);
    K[key] = t;
    localStorage.setItem(LS_KEY, JSON.stringify(K));
    out.textContent = fmt(t);
    layoutAll();
  });
}
function initKnobs(){
  bindKnob('k_angle','ANGLE_DEG', v=>`${v}°`);
  bindKnob('k_rail','RAIL_Y_SHIFT_RATIO', v=> (v>0?'+':'') + (v*100).toFixed(1)+'%');
  bindKnob('k_left','LEFT_OFFSET_RATIO', v=>(v*100).toFixed(1)+'%');
  bindKnob('k_scale1','SCALE1', v=>`${v.toFixed(2)}×`);
  bindKnob('k_y1','SIDE1_Y_EXTRA_RATIO', v=> (v>0?'+':'') + (v*100).toFixed(1)+'%');
  bindKnob('k_right','RIGHT_OFFSET_RATIO', v=>(v*100).toFixed(1)+'%');
  bindKnob('k_scale2','SCALE2', v=>`${v.toFixed(2)}×`);
  bindKnob('k_y2','SIDE2_Y_EXTRA_RATIO', v=> (v>0?'+':'') + (v*100).toFixed(1)+'%');
  bindKnob('k_info_scale','INFO_FONT_SCALE', v=>`${v.toFixed(2)}×`);
  bindKnob('k_info_along','INFO_ALONG_RATIO', v=> (v>0?'+':'') + (v*100).toFixed(1)+'% W');
  bindKnob('k_info_y','INFO_Y_EXTRA_RATIO', v=> (v>0?'+':'') + (v*100).toFixed(1)+'% H');
}

/* ===== Load + Render ===== */
async function loadAndRender(){
  try{
    statusEl.textContent = ' (carico dallo sheet...)';
    const [metaRows, oppRows] = await Promise.all([
      fetchCsvPrefer(SHEET_FILE_ID, META_GID, PUBLISHED_DOC_E_ID),
      fetchCsvPrefer(SHEET_FILE_ID, OPP_GID,  PUBLISHED_DOC_E_ID),
    ]);
    const meta = normalizeMeta(metaRows);
    const opp  = normalizeOpp(oppRows);

    if (!bg.complete) await new Promise(r => { bg.onload = r; bg.onerror = r; });

    // squadre
    const squadra1 = (meta.get('squadra1') || 'Petriolese').trim();
    const squadra2 = (meta.get('squadra2') || 'Avversari').trim();
    name1.textContent = squadra1;
    name2.textContent = squadra2;

    await waitFonts();

    // loghi
    const [src1, src2] = [resolveLogoSrc(squadra1, opp), resolveLogoSrc(squadra2, opp)];
    const fb1  = `logos/${slugify(squadra1)}.webp`;
    const fb2  = `logos/${slugify(squadra2)}.webp`;
    await Promise.all([
      new Promise(res=>{ logo1.onload=()=>res(); logo1.onerror=()=>{logo1.onerror=null; logo1.src=fb1; res();}; logo1.src=src1; }),
      new Promise(res=>{ logo2.onload=()=>res(); logo2.onerror=()=>{logo2.onerror=null; logo2.src=fb2; res();}; logo2.src=src2; })
    ]);

    // info text: DATA / ORA / CAMPO SQUADRA1 (ripulito) / PAESE
    const data = meta.get('data') || meta.get('giorno') || meta.get('date') || '';
    const ora  = meta.get('ora')  || meta.get('orario')|| meta.get('time') || '';
    const campoRaw = meta.get('campo') || meta.get('campo1') || meta.get('impianto') || '';
    const campo = cleanFieldName(campoRaw);
    const paese = resolvePaese(squadra1, opp, '');  // paese associato alla squadra1 in Avversari

    const lines = [data, ora, campo, paese].filter(Boolean);
    infoText.textContent = lines.join('\n'); // white-space:pre in CSS

    layoutAll();
    statusEl.innerHTML = ` <span style="color:#8ff59a">OK</span> — <strong>${squadra1}</strong> vs <strong>${squadra2}</strong>`;
  }catch(err){
    console.error(err);
    infoText.textContent = '';
    layoutAll();
    statusEl.innerHTML = ` <span style="color:#ffd36d">fallback</span> — controlla permessi o pubblicazione`;
  }
}

function layoutAll(){
  layoutTeams(stage);
  layoutInfo(stage);
}

/* ===== Export PNG ===== */
async function downloadPNG(){
  const TARGET_W = 3508, TARGET_H = 4961;

  const clone = stage.cloneNode(true);
  clone.style.width  = TARGET_W + 'px';
  clone.style.height = TARGET_H + 'px';
  clone.style.boxShadow='none'; clone.style.borderRadius='0';
  clone.style.position='fixed'; clone.style.left='-99999px'; clone.style.top='-99999px';
  document.body.appendChild(clone);
  const cBg = clone.querySelector('#bg');
  if (!cBg.complete) await new Promise(r=>{ cBg.onload=r; cBg.onerror=r; });

  // applica gli stessi layout sul clone
  (function applyClone(){
    const W = clone.clientWidth, H = clone.clientHeight;
    // team blocks
    const vsX = W*K.VS_X_RATIO, vsY = H*(K.VS_Y_RATIO+K.RAIL_Y_SHIFT_RATIO);
    const th = K.ANGLE_DEG*Math.PI/180, dx=Math.cos(th), dy=Math.sin(th);
    const L=W*K.LEFT_OFFSET_RATIO, R=W*K.RIGHT_OFFSET_RATIO;
    let lX=vsX-dx*L, lY=vsY-dy*L, rX=vsX+dx*R, rY=vsY+dy*R;
    lY += H*K.SIDE1_Y_EXTRA_RATIO; rY += H*K.SIDE2_Y_EXTRA_RATIO;

    const placeSide=(sel,cx,cy,scale)=>{
      const el = clone.querySelector(sel);
      const logoH=H*K.LOGO_H_RATIO*scale, nameGap=H*K.NAME_GAP_RATIO, nameFont=H*K.NAME_FONT_RATIO;
      el.style.left=`${cx}px`; el.style.top=`${cy}px`;
      el.style.setProperty('--angle', `${K.ANGLE_DEG}deg`);
      el.style.setProperty('--logoHpx', `${logoH}px`);
      el.style.setProperty('--logoWpx', `${logoH}px`);
      el.style.setProperty('--nameGapPx', `${nameGap}px`);
      el.style.setProperty('--nameFontPx', `${nameFont}px`);
    };
    placeSide('#side1', lX, lY, K.SCALE1);
    placeSide('#side2', rX, rY, K.SCALE2);

    // info block
    const baseX=W*K.INFO_BASE_X_RATIO, baseY=H*K.INFO_BASE_Y_RATIO;
    const along=W*K.INFO_ALONG_RATIO, perp=H*K.INFO_Y_EXTRA_RATIO;
    const nx=-Math.sin(th), ny=Math.cos(th);
    const iX = baseX + dx*along + nx*perp;
    const iY = baseY + dy*along + ny*perp;
    const info = clone.querySelector('#info');
    const infoFontPx = H*K.INFO_FONT_RATIO*K.INFO_FONT_SCALE;
    info.style.left=`${iX}px`; info.style.top=`${iY}px`;
    info.style.setProperty('--angle', `${K.ANGLE_DEG}deg`);
    info.style.setProperty('--infoFontPx', `${infoFontPx}px`);
  })();

  await waitFonts();
  const canvas = await html2canvas(clone, {
    backgroundColor: null,
    useCORS: true,
    scale: 1,
    width: TARGET_W, height: TARGET_H
  });
  document.body.removeChild(clone);

  const blob = await new Promise(res=> canvas.toBlob(b=>res(b), 'image/png', 0.98));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `cover_${new Date().toISOString().slice(0,10)}.png`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/* ===== Wireup ===== */
window.addEventListener('DOMContentLoaded', ()=>{
  document.querySelector('#btnRefresh').addEventListener('click', loadAndRender, { passive:true });
  document.querySelector('#btnDownload').addEventListener('click', downloadPNG, { passive:true });
  initKnobs();
  loadAndRender();
  const ro = new ResizeObserver(()=> layoutAll());
  ro.observe(stage);
});
