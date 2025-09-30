/* ===== Config sheet ===== */
const SHEET_FILE_ID = '1nWG0OBGpiyK-lulP-OKGad4jG7uEVmcy';
const META_GID      = '254048258';   // Meta
const OPP_GID       = '1284472120';  // Avversari
const PUBLISHED_DOC_E_ID = '2PACX-1vSpJqXmoJaIznEo_EGHCfUxyYVWWKJCGULM9FbnI14hLhGpsjt3oMHT5ahJwEmJ4w';

/* ===== Parametri (DEFAULT = slider del tuo screenshot) ===== */
const K = {
  /* Squadre (controlli unificati) */
  TEAM_ANGLE_DEG:    -7.5,
  VS_X_RATIO:         0.50,
  VS_Y_RATIO:         0.57,
  TEAM_ALONG_RATIO:  -0.015, // -1.5% W
  TEAM_OFFSET_RATIO:  0.20,  // 20%
  TEAM_RAIL_Y_RATIO:  0.018, // +1.8% H
  TEAM_SCALE:         1.00,
  TEAM_Y_EXTRA_RATIO: 0.00,

  /* Dimensioni nomi/logo */
  LOGO_H_RATIO:       0.12,
  NAME_GAP_RATIO:     0.018,
  NAME_FONT_RATIO:    0.038,

  /* Info (angolo unico) */
  INFO_ANGLE_DEG:    -9,
  INFO_BASE_X_RATIO:  0.78,
  INFO_BASE_Y_RATIO:  0.24,
  INFO_ALONG_RATIO:   0.00,
  INFO_Y_EXTRA_RATIO: 0.00,
  INFO_FONT_RATIO:    0.032,

  /* Per-riga */
  INFO_DATE_SCALE:  0.78,  INFO_DATE_ALONG:  -0.025, INFO_DATE_Y:  -0.048,
  INFO_TIME_SCALE:  1.00,  INFO_TIME_ALONG:   0.075, INFO_TIME_Y:  -0.012,
  INFO_FIELD_SCALE: 0.60,  INFO_FIELD_ALONG: -0.100, INFO_FIELD_Y:  0.050,
  INFO_PAESE_SCALE: 1.02,  INFO_PAESE_ALONG:  0.075, INFO_PAESE_Y:  0.078,

  /* QR block (senza freccia) */
  QR_X_RATIO:        0.51,
  QR_Y_RATIO:        0.80,
  QR_SCALE:          1.00,
  QR_TEXT_SCALE:     1.00,

  /* Strip sponsor */
  SPONSOR_HEIGHT_RATIO:   0.165,
  SPONSOR_PADDING_RATIO: 0.020,
  SPONSOR_GAP_RATIO:     0.010,
  SPONSOR_ROWS:          1,
};

/* nuova chiave LS per applicare SUBITO i default */
const LS_KEY = 'manifest_tuning_v6';
try { Object.assign(K, JSON.parse(localStorage.getItem(LS_KEY)||'{}')||{}); } catch {}
if(typeof K.SPONSOR_HEIGHT_RATIO !== 'number' && typeof K.SPONSOR_LOGO_RATIO === 'number'){
  K.SPONSOR_HEIGHT_RATIO = K.SPONSOR_LOGO_RATIO;
}
if(typeof K.SPONSOR_ROWS !== 'number' || !Number.isFinite(K.SPONSOR_ROWS) || K.SPONSOR_ROWS <= 0){
  K.SPONSOR_ROWS = 1;
}

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
function normalizeOpp(rows){
  const out=new Map();
  rows.forEach(r=>{
    const name=(''+(r.Squadra||r.squadra||'')).trim();
    const logo=(''+(r.Logo||r.logo||'')).trim();
    const paese=(''+(r.Paese||r.paese||'')).trim();
    const campo=(''+(r.Campo||r.campo||'')).trim();
    if(name) out.set(name.toLowerCase(), { logo, paese, campo });
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
const resolvePaese = (teamName, oppMap, fb='') => (oppMap.get((teamName||'').toLowerCase())?.paese || fb);
const resolveCampo = (teamName, oppMap, fb='') => (oppMap.get((teamName||'').toLowerCase())?.campo || fb);

/* ===== DATA/ORA ===== */
function parseDateSmart(s){
  const v=String(s||'').trim(); if(!v) return null;
  let m;
  if((m=v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/))) return new Date(+m[3], +m[2]-1, +m[1]);
  if((m=v.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/))) return new Date(+m[1], +m[2]-1, +m[3]);
  const t=Date.parse(v); return Number.isNaN(t)?null:new Date(t);
}
function formatDateIT(d){ try{ return new Intl.DateTimeFormat('it-IT',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(d);}catch{return ''} }
function normalizeTime(s){
  let v=String(s||'').trim(); if(!v) return '';
  v=v.replace('.',':'); if(/^\d{4}$/.test(v)) v=v.slice(0,2)+':'+v.slice(2);
  const m=v.match(/(\d{1,2})[:.]?(\d{2})/); return m ? `${m[1].padStart(2,'0')}:${m[2]}` : v;
}

/* Font readiness */
async function waitFonts(){ if(document.fonts && document.fonts.ready){ try{ await document.fonts.ready; }catch{} } }

/* ===== Layout squadre ===== */
function computeStageMetrics(stageEl){
  const W = stageEl?.clientWidth ?? 0;
  const H = stageEl?.clientHeight ?? 0;
  const teamAngleRad = K.TEAM_ANGLE_DEG * Math.PI / 180;
  const infoAngleRad = K.INFO_ANGLE_DEG * Math.PI / 180;
  return {
    W,
    H,
    teamAngleRad,
    teamAngleDeg: K.TEAM_ANGLE_DEG,
    teamCos: Math.cos(teamAngleRad),
    teamSin: Math.sin(teamAngleRad),
    infoAngleRad,
    infoAngleDeg: K.INFO_ANGLE_DEG,
    infoCos: Math.cos(infoAngleRad),
    infoSin: Math.sin(infoAngleRad),
  };
}

function layoutSide(sideEl, metrics, cx, cy, scale=1){
  if(!sideEl) return;
  const { H, teamAngleDeg } = metrics;
  const logoH   = H * K.LOGO_H_RATIO * scale;
  const nameGap = H * K.NAME_GAP_RATIO;
  const nameFont= H * K.NAME_FONT_RATIO;
  sideEl.style.left = `${cx}px`;
  sideEl.style.top  = `${cy}px`;
  sideEl.style.setProperty('--angle', `${teamAngleDeg}deg`);
  sideEl.style.setProperty('--logoHpx', `${logoH}px`);
  sideEl.style.setProperty('--logoWpx', `${logoH}px`);
  sideEl.style.setProperty('--nameGapPx', `${nameGap}px`);
  sideEl.style.setProperty('--nameFontPx', `${nameFont}px`);
}

function layoutTeams(metrics, scope){
  const { W, H, teamCos:dx, teamSin:dy } = metrics;

  // VS “ancora” spostata lungo la retta e verticalmente
  let vsX = W * K.VS_X_RATIO + dx * (W * K.TEAM_ALONG_RATIO);
  let vsY = H * (K.VS_Y_RATIO + K.TEAM_RAIL_Y_RATIO) + dy * (W * K.TEAM_ALONG_RATIO);

  const D = W * K.TEAM_OFFSET_RATIO;
  let lX=vsX-dx*D, lY=vsY-dy*D, rX=vsX+dx*D, rY=vsY+dy*D;

  const yExtra = H * K.TEAM_Y_EXTRA_RATIO;
  lY += yExtra;
  rY += yExtra;

  layoutSide(scope?.querySelector?.('#side1'), metrics, lX, lY, K.TEAM_SCALE);
  layoutSide(scope?.querySelector?.('#side2'), metrics, rX, rY, K.TEAM_SCALE);
}

/* ===== Layout info (4 righe) ===== */
function placeInfoLine(metrics, el, alongRatio, yRatio, scale){
  if(!el) return;
  const { W, H, infoAngleDeg, infoCos:dx, infoSin:dy } = metrics;
  const baseX=W*K.INFO_BASE_X_RATIO, baseY=H*K.INFO_BASE_Y_RATIO;
  const nx=-dy, ny=dx;
  const alongG=W*K.INFO_ALONG_RATIO, yG=H*K.INFO_Y_EXTRA_RATIO;
  const cx = baseX + dx*(alongG + W*alongRatio) + nx*(yG + H*yRatio);
  const cy = baseY + dy*(alongG + W*alongRatio) + ny*(yG + H*yRatio);
  const fontPx = H * K.INFO_FONT_RATIO * scale;
  el.style.left = `${cx}px`;
  el.style.top = `${cy}px`;
  el.style.setProperty('--angle', `${infoAngleDeg}deg`);
  el.style.setProperty('--fontPx', `${fontPx}px`);
}

function layoutInfo(metrics, scope){
  placeInfoLine(metrics, scope?.querySelector?.('#infoDate'),  K.INFO_DATE_ALONG,  K.INFO_DATE_Y,  K.INFO_DATE_SCALE);
  placeInfoLine(metrics, scope?.querySelector?.('#infoTime'),  K.INFO_TIME_ALONG,  K.INFO_TIME_Y,  K.INFO_TIME_SCALE);
  placeInfoLine(metrics, scope?.querySelector?.('#infoField'), K.INFO_FIELD_ALONG, K.INFO_FIELD_Y, K.INFO_FIELD_SCALE);
  placeInfoLine(metrics, scope?.querySelector?.('#infoPaese'), K.INFO_PAESE_ALONG, K.INFO_PAESE_Y, K.INFO_PAESE_SCALE);
}

/* ===== Layout QR (solo immagine + testo) ===== */
function layoutQR(metrics, scope){
  const { W, H } = metrics;
  const qr = scope?.querySelector?.('#qrBlock');
  if(!qr) return;
  const size = Math.round(H * 0.08 * K.QR_SCALE);
  const textPx = Math.round(H * 0.016 * K.QR_TEXT_SCALE);
  qr.style.left = (W*K.QR_X_RATIO)+'px';
  qr.style.top  = (H*K.QR_Y_RATIO)+'px';
  qr.style.setProperty('--qrSizePx', `${size}px`);
  qr.style.setProperty('--qrTextPx', `${textPx}px`);
}

function layoutSponsors(metrics, scope){
  const strip = scope?.querySelector?.('#sponsorStrip');
  if(!strip) return;
  const { H } = metrics;
  const desiredHeight = H * K.SPONSOR_HEIGHT_RATIO;
  const rows = Math.max(1, Math.round(K.SPONSOR_ROWS));
  const logosCount = strip.querySelectorAll('.sponsor-logo').length;
  const cols = Math.max(1, logosCount ? Math.ceil(logosCount / rows) : 1);

  let qrBottom = H;
  let clearance = H * 0.02; // margine base (~2% dell'altezza)
  const qrBlock = scope?.querySelector?.('#qrBlock');
  if(qrBlock){
    const qrSize = H * 0.08 * K.QR_SCALE;
    let gapPx = 8;
    let labelHeight = H * 0.016 * K.QR_TEXT_SCALE;
    try{
      const blockStyle = getComputedStyle(qrBlock);
      const rowGap = parseFloat(blockStyle.rowGap);
      if(!Number.isNaN(rowGap)) gapPx = rowGap;
      const labelEl = qrBlock.querySelector('#qrLabel');
      if(labelEl){
        const labelStyle = getComputedStyle(labelEl);
        const lineHeight = parseFloat(labelStyle.lineHeight);
        if(!Number.isNaN(lineHeight)) labelHeight = lineHeight;
      }
    }catch{}
    const blockHeight = qrSize + labelHeight + gapPx;
    qrBottom = H * K.QR_Y_RATIO + blockHeight / 2;
    clearance = Math.max(clearance, gapPx * 1.5);
  }else{
    const qrHeight = H * 0.08 * K.QR_SCALE;
    qrBottom = H * K.QR_Y_RATIO + qrHeight / 2;
  }

  const maxHeight = Math.max(0, H - (qrBottom + clearance));
  const height = Math.min(desiredHeight, maxHeight);
  const padding = Math.min(H * K.SPONSOR_PADDING_RATIO, height / 2);
  strip.style.setProperty('--sponsorHeightPx', `${height}px`);
  strip.style.setProperty('--sponsorPaddingPx', `${padding}px`);
  strip.style.setProperty('--sponsorGapPx', `${H * K.SPONSOR_GAP_RATIO}px`);
  strip.style.setProperty('--sponsorLogoMaxPx', `${Math.max(0, height - padding * 2)}px`);
  strip.style.setProperty('--sponsorCols', `${cols}`);
}

/* ===== DOM ===== */
const $ = s=>document.querySelector(s);
const stage=$('#stage'), bg=$('#bg');
const logo1=$('#logo1'), logo2=$('#logo2');
const name1=$('#name1'), name2=$('#name2');
const sponsorStrip=$('#sponsorStrip');

const HTML_ESCAPE_MAP = { "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;" };
const HTML_ESCAPE_RE = /[&<>"']/g;
const escapeHtml = value => String(value).replace(HTML_ESCAPE_RE, ch=>HTML_ESCAPE_MAP[ch]);

function formatTeamName(name){
  const trimmed = String(name ?? '').trim();
  if(!trimmed) return '';
  return trimmed.split(/\s+/).map(part=>escapeHtml(part)).join('<br>');
}

const infoDate=$('#infoDate'), infoTime=$('#infoTime'), infoField=$('#infoField'), infoPaese=$('#infoPaese');
const statusEl=$('#status');

function renderSponsors(meta){
  if(!sponsorStrip) return;
  sponsorStrip.replaceChildren();
  const raw = meta?.get?.('sponsor_logos') || '';
  const parts = String(raw).split(/[\n;]+/);
  const logos = [];
  for(const part of parts){
    const trimmed = part.trim();
    if(!trimmed) continue;
    const normalized = normalizeLogoUrl(trimmed);
    if(!normalized) continue;
    logos.push(normalized);
  }

  logos.forEach((src, idx)=>{
    const img=document.createElement('img');
    img.className='sponsor-logo';
    img.src=src;
    img.alt=`Logo sponsor ${idx+1}`;
    img.decoding='async';
    img.loading='lazy';
    sponsorStrip.appendChild(img);
  });

  sponsorStrip.hidden = logos.length === 0;
}

function setStatusMessage(label, color, extraNodes=[]){
  const nodes=[document.createTextNode(' ')];
  const badge=document.createElement('span');
  badge.style.color=color;
  badge.textContent=label;
  nodes.push(badge, ...extraNodes);
  statusEl.replaceChildren(...nodes);
}

const createStrongText = text => {
  const el=document.createElement('strong');
  el.textContent=text;
  return el;
};

/* ===== UI (manopole) ===== */
function bindKnob(id, key, fmt=(v)=>v){
  const el = document.getElementById(id); if(!el) return;
  const out = el.nextElementSibling;
  el.value = K[key];
  if(out) out.textContent = fmt(K[key]);
  el.addEventListener('input', ()=>{
    const t = Number(el.value);
    K[key] = t;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(K));
    } catch (err) {
      // Ignore storage errors (e.g. disabled storage)
    }
    if(out) out.textContent = fmt(t);
    layoutAll();
  });
}
function initKnobs(){
  const pct = v=>(v*100).toFixed(1)+'%';
  const pctW=v=>(v>0?'+':'')+(v*100).toFixed(1)+'% W';
  const pctH=v=>(v>0?'+':'')+(v*100).toFixed(1)+'% H';

  // Squadre
  bindKnob('k_team_angle','TEAM_ANGLE_DEG', v=>`${v}°`);
  bindKnob('k_team_rail','TEAM_RAIL_Y_RATIO', v=> (v>0?'+':'')+pct(v/1));
  bindKnob('k_team_along','TEAM_ALONG_RATIO', pctW);
  bindKnob('k_team_dist','TEAM_OFFSET_RATIO', pct);
  bindKnob('k_team_scale','TEAM_SCALE', v=>`${v.toFixed(2)}×`);
  bindKnob('k_team_y','TEAM_Y_EXTRA_RATIO', pctH);

  // Info (ancora + angolo unico)
  bindKnob('k_info_angle','INFO_ANGLE_DEG', v=>`${v}°`);
  bindKnob('k_info_along','INFO_ALONG_RATIO', pctW);
  bindKnob('k_info_y','INFO_Y_EXTRA_RATIO', pctH);

  // Per-riga
  bindKnob('k_date_scale','INFO_DATE_SCALE', v=>`${v.toFixed(2)}×`);
  bindKnob('k_date_along','INFO_DATE_ALONG', pctW);
  bindKnob('k_date_y','INFO_DATE_Y', pctH);

  bindKnob('k_time_scale','INFO_TIME_SCALE', v=>`${v.toFixed(2)}×`);
  bindKnob('k_time_along','INFO_TIME_ALONG', pctW);
  bindKnob('k_time_y','INFO_TIME_Y', pctH);

  bindKnob('k_field_scale','INFO_FIELD_SCALE', v=>`${v.toFixed(2)}×`);
  bindKnob('k_field_along','INFO_FIELD_ALONG', pctW);
  bindKnob('k_field_y','INFO_FIELD_Y', pctH);

  bindKnob('k_paese_scale','INFO_PAESE_SCALE', v=>`${v.toFixed(2)}×`);
  bindKnob('k_paese_along','INFO_PAESE_ALONG', pctW);
  bindKnob('k_paese_y','INFO_PAESE_Y', pctH);

  // QR
  bindKnob('k_qr_x','QR_X_RATIO', pct);
  bindKnob('k_qr_y','QR_Y_RATIO', pct);
  bindKnob('k_qr_scale','QR_SCALE', v=>`${v.toFixed(2)}×`);
  bindKnob('k_qr_text','QR_TEXT_SCALE', v=>`${v.toFixed(2)}×`);

  // Sponsor strip
  bindKnob('k_sponsor_scale','SPONSOR_HEIGHT_RATIO', pctH);
  bindKnob('k_sponsor_pad','SPONSOR_PADDING_RATIO', pctH);
  bindKnob('k_sponsor_rows','SPONSOR_ROWS', v=>`${v} riga${v===1?'':'e'}`);
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

    const squadra1 = (meta.get('squadra1') || 'Petriolese').trim();
    const squadra2 = (meta.get('squadra2') || 'Avversari').trim();
    name1.innerHTML = formatTeamName(squadra1); name2.innerHTML = formatTeamName(squadra2);

    await waitFonts();

    const [src1, src2] = [resolveLogoSrc(squadra1, opp), resolveLogoSrc(squadra2, opp)];
    const fb1  = `logos/${slugify(squadra1)}.webp`;
    const fb2  = `logos/${slugify(squadra2)}.webp`;
    await Promise.all([
      new Promise(res=>{ logo1.onload=()=>res(); logo1.onerror=()=>{logo1.onerror=null; logo1.src=fb1; res();}; logo1.src=src1; }),
      new Promise(res=>{ logo2.onload=()=>res(); logo2.onerror=()=>{logo2.onerror=null; logo2.src=fb2; res();}; logo2.src=src2; })
    ]);

    // INFO TEXT
    const d = parseDateSmart(meta.get('data') || meta.get('giorno') || meta.get('date') || '');
    infoDate.textContent = d ? formatDateIT(d) : '';
    const oraRaw = meta.get('ora') || meta.get('orario') || meta.get('time') || '';
    const oraNorm = normalizeTime(oraRaw);
    infoTime.textContent = oraNorm ? `ORE ${oraNorm}` : '';
    infoField.textContent = resolveCampo(squadra1, opp, '');
    infoPaese.textContent = resolvePaese(squadra1, opp, '');
    renderSponsors(meta);

    layoutAll();
    setStatusMessage('OK', '#8ff59a', [
      document.createTextNode(' — '),
      createStrongText(squadra1),
      document.createTextNode(' vs '),
      createStrongText(squadra2),
    ]);
  }catch(err){
    console.error(err);
    infoDate.textContent=''; infoTime.textContent=''; infoField.textContent=''; infoPaese.textContent='';
    renderSponsors(new Map());
    layoutAll();
    setStatusMessage('fallback', '#ffd36d', [
      document.createTextNode(' — controlla permessi o pubblicazione'),
    ]);
  }
}

function layoutAll(stageEl=stage, scope=stageEl){
  if(!stageEl) return;
  const metrics = computeStageMetrics(stageEl);
  const targetScope = scope || stageEl;
  layoutTeams(metrics, targetScope);
  layoutInfo(metrics, targetScope);
  layoutQR(metrics, targetScope);
  layoutSponsors(metrics, targetScope);
}

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

  layoutAll(clone, clone);

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
  initKnobs();
  loadAndRender();
  const ro = new ResizeObserver(()=> layoutAll());
  ro.observe(stage);
});
