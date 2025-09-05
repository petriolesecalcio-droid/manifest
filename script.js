/* ===== Config sheet ===== */
const SHEET_FILE_ID = '1nWG0OBGpiyK-lulP-OKGad4jG7uEVmcy';
const META_GID      = '254048258';   // Meta
const OPP_GID       = '1284472120';  // Avversari
const PUBLISHED_DOC_E_ID = '2PACX-1vSpJqXmoJaIznEo_EGHCfUxyYVWWKJCGULM9FbnI14hLhGpsjt3oMHT5ahJwEmJ4w';

/* ===== Parametri (+ localStorage) ===== */
const K = {
  // Geometria globale
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
  SCALE1: 1.00,
  SCALE2: 1.00,

  // Info – ancora di riferimento (vicino “MATCH DAY”)
  INFO_BASE_X_RATIO: 0.78,
  INFO_BASE_Y_RATIO: 0.24,
  INFO_ALONG_RATIO:  0.00,   // sposta TUTTE le righe lungo la retta
  INFO_Y_EXTRA_RATIO: 0.00,  // sposta TUTTE le righe perpendicolare

  // Per-riga: DATA / ORA / CAMPO / PAESE
  INFO_DATE_SCALE: 1.00,  INFO_DATE_ALONG: 0.00,  INFO_DATE_Y: 0.00,
  INFO_TIME_SCALE: 1.00,  INFO_TIME_ALONG: 0.00,  INFO_TIME_Y: 0.045,
  INFO_FIELD_SCALE:1.00,  INFO_FIELD_ALONG:0.00,  INFO_FIELD_Y:0.090,
  INFO_PAESE_SCALE:1.00,  INFO_PAESE_ALONG:0.00,  INFO_PAESE_Y:0.135,

  // dimensione base carattere info
  INFO_FONT_RATIO: 0.032,
};
const LS_KEY = 'manifest_tuning_v2';
try { Object.assign(K, JSON.parse(localStorage.getItem(LS_KEY)||'{}')||{}); } catch {}

/* ===== Helpers sheet ===== */
const gvizCsvURL=(fileId,gid)=>`https://docs.google.com/spreadsheets/d/${fileId}/gviz/tq?gid=${encodeURIComponent(gid)}&headers=1&tqx=out:csv`;
const pubCsvFromDocEId=(eId,gid)=>`https://docs.google.com/spreadsheets/d/e/${eId}/pub?gid=${encodeURIComponent(gid)}&single=true&output=csv`;
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
  try{ const r=await fetch(gvizCsvURL(fileId,gid),{cache:'no-store'}); if(r.ok) return parseCSV(await r.text()); }catch{}
  const r2=await fetch(pubCsvFromDocEId(eid,gid),{cache:'no-store'}); if(!r2.ok) throw new Error('CSV published fetch failed');
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
/* Avversari: Logo + Paese */
function normalizeOpp(rows){
  const out=new Map();
  rows.forEach(r=>{
    const name=(''+(r.Squadra||r.squadra||'')).trim();
    const logo=(''+(r.Logo||r.logo||'')).trim();
    const paese=(''+(r.Paese||r.paese||'')).trim();
    if(name) out.set(name.toLowerCase(), { logo, paese });
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

/* ===== DATA/ORA ===== */
function parseDateSmart(s){
  const v=String(s||'').trim();
  if(!v) return null;
  let m;
  if((m=v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/))) { return new Date(+m[3], +m[2]-1, +m[1]); }
  if((m=v.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/))) { return new Date(+m[1], +m[2]-1, +m[3]); }
  const t=Date.parse(v); if(!Number.isNaN(t)) return new Date(t);
  return null;
}
function formatDateIT(d){
  try{
    return new Intl.DateTimeFormat('it-IT', { weekday:'long', day:'numeric', month:'long', year:'numeric' }).format(d);
  }catch{ return ''; }
}
function normalizeTime(s){
  let v=String(s||'').trim();
  if(!v) return '';
  v=v.replace('.',':');
  if(/^\d{4}$/.test(v)) v=v.slice(0,2)+':'+v.slice(2);
  const m=v.match(/(\d{1,2})[:.]?(\d{2})/);
  return m ? `${m[1].padStart(2,'0')}:${m[2]}` : v;
}

/* Font readiness (Oswald) */
async function waitFonts(){ if(document.fonts && document.fonts.ready){ try{ await document.fonts.ready; }catch{} } }

/* ===== Layout squadre ===== */
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
  const th = K.ANGLE_DEG * Math.PI/180, dx=Math.cos(th), dy=Math.sin(th);
  const L = W*K.LEFT_OFFSET_RATIO, R=W*K.RIGHT_OFFSET_RATIO;
  let lX=vsX-dx*L, lY=vsY-dy*L, rX=vsX+dx*R, rY=vsY+dy*R;
  lY += H*K.SIDE1_Y_EXTRA_RATIO; rY += H*K.SIDE2_Y_EXTRA_RATIO;
  layoutSide(stageEl, document.getElementById('side1'), lX, lY, K.SCALE1);
  layoutSide(stageEl, document.getElementById('side2'), rX, rY, K.SCALE2);
}

/* ===== Layout righe INFO (4 righe indipendenti) ===== */
function placeInfoLine(stageEl, el, alongRatio, yRatio, scale){
  const W = stageEl.clientWidth, H = stageEl.clientHeight;
  const baseX=W*K.INFO_BASE_X_RATIO, baseY=H*K.INFO_BASE_Y_RATIO;
  const th=K.ANGLE_DEG*Math.PI/180, dx=Math.cos(th), dy=Math.sin(th);
  const nx=-Math.sin(th), ny=Math.cos(th);

  // gruppo (ancora globale)
  const alongG = W*K.INFO_ALONG_RATIO;
  const yG     = H*K.INFO_Y_EXTRA_RATIO;

  // per-riga
  const along  = W*alongRatio;
  const y      = H*yRatio;

  const cx = baseX + dx*(alongG + along) + nx*(yG + y);
  const cy = baseY + dy*(alongG + along) + ny*(yG + y);

  const fontPx = H * K.INFO_FONT_RATIO * scale;

  el.style.left = `${cx}px`;
  el.style.top  = `${cy}px`;
  el.style.setProperty('--angle', `${K.ANGLE_DEG}deg`);
  el.style.setProperty('--fontPx', `${fontPx}px`);
}
function layoutInfo(stageEl){
  placeInfoLine(stageEl, document.getElementById('infoDate'),  K.INFO_DATE_ALONG,  K.INFO_DATE_Y,  K.INFO_DATE_SCALE);
  placeInfoLine(stageEl, document.getElementById('infoTime'),  K.INFO_TIME_ALONG,  K.INFO_TIME_Y,  K.INFO_TIME_SCALE);
  placeInfoLine(stageEl, document.getElementById('infoField'), K.INFO_FIELD_ALONG, K.INFO_FIELD_Y, K.INFO_FIELD_SCALE);
  placeInfoLine(stageEl, document.getElementById('infoPaese'), K.INFO_PAESE_ALONG, K.INFO_PAESE_Y, K.INFO_PAESE_SCALE);
}

/* ===== DOM ===== */
const $ = s=>document.querySelector(s);
const stage=$('#stage'), bg=$('#bg');
const logo1=$('#logo1'), logo2=$('#logo2');
const name1=$('#name1'), name2=$('#name2');
const infoDate=$('#infoDate'), infoTime=$('#infoTime'), infoField=$('#infoField'), infoPaese=$('#infoPaese');
const statusEl=$('#status');

/* ===== UI (manopole) ===== */
function bindKnob(id, key, fmt=(v)=>v){
  const el = document.getElementById(id);
  if(!el) return;
  const out = el.nextElementSibling; // lo span accanto
  el.value = K[key];
  if(out) out.textContent = fmt(K[key]);
  el.addEventListener('input', ()=>{
    const t = Number(el.value);
    K[key] = t;
    localStorage.setItem(LS_KEY, JSON.stringify(K));
    if(out) out.textContent = fmt(t);
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

  bindKnob('k_info_along','INFO_ALONG_RATIO', v=> (v>0?'+':'') + (v*100).toFixed(1)+'% W');
  bindKnob('k_info_y','INFO_Y_EXTRA_RATIO', v=> (v>0?'+':'') + (v*100).toFixed(1)+'% H');

  // per-riga
  bindKnob('k_date_scale','INFO_DATE_SCALE', v=>`${v.toFixed(2)}×`);
  bindKnob('k_date_along','INFO_DATE_ALONG', v=> (v>0?'+':'') + (v*100).toFixed(1)+'% W');
  bindKnob('k_date_y','INFO_DATE_Y', v=> (v>0?'+':'') + (v*100).toFixed(1)+'% H');

  bindKnob('k_time_scale','INFO_TIME_SCALE', v=>`${v.toFixed(2)}×`);
  bindKnob('k_time_along','INFO_TIME_ALONG', v=> (v>0?'+':'') + (v*100).toFixed(1)+'% W');
  bindKnob('k_time_y','INFO_TIME_Y', v=> (v>0?'+':'') + (v*100).toFixed(1)+'% H');

  bindKnob('k_field_scale','INFO_FIELD_SCALE', v=>`${v.toFixed(2)}×`);
  bindKnob('k_field_along','INFO_FIELD_ALONG', v=> (v>0?'+':'') + (v*100).toFixed(1)+'% W');
  bindKnob('k_field_y','INFO_FIELD_Y', v=> (v>0?'+':'') + (v*100).toFixed(1)+'% H');

  bindKnob('k_paese_scale','INFO_PAESE_SCALE', v=>`${v.toFixed(2)}×`);
  bindKnob('k_paese_along','INFO_PAESE_ALONG', v=> (v>0?'+':'') + (v*100).toFixed(1)+'% W');
  bindKnob('k_paese_y','INFO_PAESE_Y', v=> (v>0?'+':'') + (v*100).toFixed(1)+'% H');
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

    if (!bg.complete) await new Promise(r => { bg.onload=r; bg.onerror=r; });

    // squadre
    const squadra1 = (meta.get('squadra1') || 'Petriolese').trim();
    const squadra2 = (meta.get('squadra2') || 'Avversari').trim();
    name1.textContent = squadra1; name2.textContent = squadra2;

    await waitFonts();

    // loghi
    const [src1, src2] = [resolveLogoSrc(squadra1, opp), resolveLogoSrc(squadra2, opp)];
    const fb1  = `logos/${slugify(squadra1)}.webp`;
    const fb2  = `logos/${slugify(squadra2)}.webp`;
    await Promise.all([
      new Promise(res=>{ logo1.onload=()=>res(); logo1.onerror=()=>{logo1.onerror=null; logo1.src=fb1; res();}; logo1.src=src1; }),
      new Promise(res=>{ logo2.onload=()=>res(); logo2.onerror=()=>{logo2.onerror=null; logo2.src=fb2; res();}; logo2.src=src2; })
    ]);

    /* ===== INFO TEXT ===== */
    // DATA in stile “sabato 6 settembre 2025”
    const d = parseDateSmart(meta.get('data') || meta.get('giorno') || meta.get('date') || '');
    infoDate.textContent = d ? formatDateIT(d) : '';

    // ORA con “ORE”
    const oraRaw = meta.get('ora') || meta.get('orario') || meta.get('time') || '';
    const oraNorm = normalizeTime(oraRaw);
    infoTime.textContent = oraNorm ? `ORE ${oraNorm}` : '';

    // CAMPO squadra1 — NESSUN FILTRO, testo grezzo
    const campo = (()=>{
      const candidates = [
        'campo','campo1','campo_squadra1','camposquadra1','campo squadra1','campo squadra 1',
        'campo casa','campo_base','impianto','impiantodigioco','impianto di gioco','stadio'
      ];
      for(const k of candidates){ const v = meta.get(k); if(v) return v; }
      for(const [k,v] of meta){ if(/campo|impianto|stadio/i.test(k) && v) return v; }
      return '';
    })();
    infoField.textContent = campo || '';

    // PAESE da Avversari (per squadra1)
    const paese = resolvePaese(squadra1, opp, '');
    infoPaese.textContent = paese || '';

    layoutAll();
    statusEl.innerHTML = ` <span style="color:#8ff59a">OK</span> — <strong>${squadra1}</strong> vs <strong>${squadra2}</strong>`;
  }catch(err){
    console.error(err);
    infoDate.textContent=''; infoTime.textContent=''; infoField.textContent=''; infoPaese.textContent='';
    layoutAll();
    statusEl.innerHTML = ` <span style="color:#ffd36d">fallback</span> — controlla permessi o pubblicazione`;
  }
}

function layoutAll(){ layoutTeams(stage); layoutInfo(stage); }

/* ===== Export PNG ===== */
async function downloadPNG(){
  const TARGET_W = 3508, TARGET_H = 4961;
  const clone = stage.cloneNode(true);
  clone.style.width  = TARGET_W+'px'; clone.style.height = TARGET_H+'px';
  clone.style.boxShadow='none'; clone.style.borderRadius='0';
  clone.style.position='fixed'; clone.style.left='-99999px'; clone.style.top='-99999px';
  document.body.appendChild(clone);
  const cBg = clone.querySelector('#bg');
  if (!cBg.complete) await new Promise(r=>{ cBg.onload=r; cBg.onerror=r; });

  // applica layout anche sul clone
  (function applyClone(){
    const W=clone.clientWidth, H=clone.clientHeight;
    // squadre
    const vsX=W*K.VS_X_RATIO, vsY=H*(K.VS_Y_RATIO+K.RAIL_Y_SHIFT_RATIO);
    const th=K.ANGLE_DEG*Math.PI/180, dx=Math.cos(th), dy=Math.sin(th);
    const L=W*K.LEFT_OFFSET_RATIO, R=W*K.RIGHT_OFFSET_RATIO;
    let lX=vsX-dx*L, lY=vsY-dy*L, rX=vsX+dx*R, rY=vsY+dy*R;
    lY+=H*K.SIDE1_Y_EXTRA_RATIO; rY+=H*K.SIDE2_Y_EXTRA_RATIO;

    const placeSide=(sel,cx,cy,scale)=>{
      const el=clone.querySelector(sel);
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

    // righe info
    const baseX=W*K.INFO_BASE_X_RATIO, baseY=H*K.INFO_BASE_Y_RATIO;
    const nx=-Math.sin(th), ny=Math.cos(th);
    const alongG=W*K.INFO_ALONG_RATIO, yG=H*K.INFO_Y_EXTRA_RATIO;

    const placeLine=(sel,along,y,scale)=>{
      const el=clone.querySelector(sel);
      const cx = baseX + dx*(alongG + W*along) + nx*(yG + H*y);
      const cy = baseY + dy*(alongG + W*along) + ny*(yG + H*y);
      const fontPx = H*K.INFO_FONT_RATIO*scale;
      el.style.left=`${cx}px`; el.style.top=`${cy}px`;
      el.style.setProperty('--angle', `${K.ANGLE_DEG}deg`);
      el.style.setProperty('--fontPx', `${fontPx}px`);
    };
    placeLine('#infoDate',  K.INFO_DATE_ALONG,  K.INFO_DATE_Y,  K.INFO_DATE_SCALE);
    placeLine('#infoTime',  K.INFO_TIME_ALONG,  K.INFO_TIME_Y,  K.INFO_TIME_SCALE);
    placeLine('#infoField', K.INFO_FIELD_ALONG, K.INFO_FIELD_Y, K.INFO_FIELD_SCALE);
    placeLine('#infoPaese', K.INFO_PAESE_ALONG, K.INFO_PAESE_Y, K.INFO_PAESE_SCALE);
  })();

  await waitFonts();
  const canvas = await html2canvas(clone, { backgroundColor:null, useCORS:true, scale:1, width:TARGET_W, height:TARGET_H });
  document.body.removeChild(clone);

  const blob = await new Promise(res=> canvas.toBlob(b=>res(b), 'image/png', 0.98));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=`cover_${new Date().toISOString().slice(0,10)}.png`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

/* ===== Wireup ===== */
window.addEventListener('DOMContentLoaded', ()=>{
  document.querySelector('#btnRefresh').addEventListener('click', loadAndRender, { passive:true });
  document.querySelector('#btnDownload').addEventListener('click', downloadPNG, { passive:true });

  // manopole
  (function init(){
    const fmtPctW = v=> (v>0?'+':'') + (v*100).toFixed(1)+'% W';
    const fmtPctH = v=> (v>0?'+':'') + (v*100).toFixed(1)+'% H';

    const bind = (id,key,fmt)=> bindKnob(id,key,fmt);

    bind('k_angle','ANGLE_DEG', v=>`${v}°`);
    bind('k_rail','RAIL_Y_SHIFT_RATIO', v=> (v>0?'+':'') + (v*100).toFixed(1)+'%');

    bind('k_left','LEFT_OFFSET_RATIO', v=>(v*100).toFixed(1)+'%');
    bind('k_scale1','SCALE1', v=>`${v.toFixed(2)}×`);
    bind('k_y1','SIDE1_Y_EXTRA_RATIO', fmtPctH);

    bind('k_right','RIGHT_OFFSET_RATIO', v=>(v*100).toFixed(1)+'%');
    bind('k_scale2','SCALE2', v=>`${v.toFixed(2)}×`);
    bind('k_y2','SIDE2_Y_EXTRA_RATIO', fmtPctH);

    bind('k_info_along','INFO_ALONG_RATIO', fmtPctW);
    bind('k_info_y','INFO_Y_EXTRA_RATIO', fmtPctH);

    // per-riga
    bind('k_date_scale','INFO_DATE_SCALE', v=>`${v.toFixed(2)}×`);
    bind('k_date_along','INFO_DATE_ALONG', fmtPctW);
    bind('k_date_y','INFO_DATE_Y', fmtPctH);

    bind('k_time_scale','INFO_TIME_SCALE', v=>`${v.toFixed(2)}×`);
    bind('k_time_along','INFO_TIME_ALONG', fmtPctW);
    bind('k_time_y','INFO_TIME_Y', fmtPctH);

    bind('k_field_scale','INFO_FIELD_SCALE', v=>`${v.toFixed(2)}×`);
    bind('k_field_along','INFO_FIELD_ALONG', fmtPctW);
    bind('k_field_y','INFO_FIELD_Y', fmtPctH);

    bind('k_paese_scale','INFO_PAESE_SCALE', v=>`${v.toFixed(2)}×`);
    bind('k_paese_along','INFO_PAESE_ALONG', fmtPctW);
    bind('k_paese_y','INFO_PAESE_Y', fmtPctH);
  })();

  loadAndRender();
  const ro = new ResizeObserver(()=> layoutAll());
  ro.observe(stage);
});
