/* ===== Config: stessi ID/GID di lineup ===== */
const SHEET_FILE_ID = '1nWG0OBGpiyK-lulP-OKGad4jG7uEVmcy';
const META_GID      = '254048258';   // "Meta"
const OPP_GID       = '1284472120';  // "Avversari"

/* INCOLLA QUI i link ottenuti da "File → Pubblica sul web" (uno per scheda) */
const PUBLISHED_META_URL = ''; // es: 'https://docs.google.com/spreadsheets/d/e/XXXXX/pubhtml?gid=254048258&single=true'
const PUBLISHED_OPP_URL  = ''; // es: 'https://docs.google.com/spreadsheets/d/e/XXXXX/pubhtml?gid=1284472120&single=true'

/* ===== Helpers Sheet ===== */
const gvizCsvURL=(fileId,gid)=>`https://docs.google.com/spreadsheets/d/${fileId}/gviz/tq?gid=${encodeURIComponent(gid)}&headers=1&tqx=out:csv`;

function pubCsvURL(pubhtmlUrl){
  if(!pubhtmlUrl) return '';
  const u = new URL(pubhtmlUrl);
  const parts = u.pathname.split('/');
  const idIdx = parts.findIndex(p=>p==='e')+1;
  const id    = parts[idIdx]||'';
  const root  = `${u.protocol}//${u.host}${parts.slice(0,idIdx).join('/')}/${id}`;
  const gid   = u.searchParams.get('gid') || '0';
  return `${root}/pub?gid=${encodeURIComponent(gid)}&single=true&output=csv`;
}

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

/* Tenta gviz; se fallisce, usa "pub?output=csv" della scheda pubblicata */
async function fetchCsvPrefer(fileId, gid, publishedUrl){
  // 1) gviz CSV (funziona se sheet è pubblico o link-anyone)
  try{
    const res = await fetch(gvizCsvURL(fileId,gid), { cache:'no-store' });
    if(res.ok){
      return parseCSV(await res.text());
    }
    // se 302/403/401 → cade nel fallback
  }catch(e){ /* ignora e tenta fallback */ }

  // 2) Fallback: published CSV
  if(publishedUrl){
    const url = pubCsvURL(publishedUrl);
    const res = await fetch(url, { cache:'no-store' });
    if(!res.ok) throw new Error('fetch published CSV failed');
    return parseCSV(await res.text());
  }

  throw new Error('Impossibile leggere lo Sheet (pubblica la scheda o apri i permessi).');
}

/* ===== Normalizzazioni come lineup ===== */
const slugify = s => String(s||'')
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/&/g,'and')
  .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');

function normalizeMeta(rows){
  const out=new Map();
  rows.forEach(r=>{
    const k=(''+(r.Key||r.KEY||'')).trim().toLowerCase();
    const v=(''+(r.Value||r.VALORE||'')).trim();
    if(k) out.set(k, v);
  });
  return out;
}
function normalizeOpp(rows){
  const out=new Map();
  rows.forEach(r=>{
    const name=(''+(r.Squadra||r.squadra||'')).trim();
    const url =(''+(r.Logo||r.logo||'')).trim();
    if(name) out.set(name.toLowerCase(), url);
  });
  return out;
}
function resolveLogoSrc(teamName, oppMap){
  const name=(teamName||'').trim(); if(!name) return '';
  const fromSheet=oppMap.get(name.toLowerCase())||'';
  if(fromSheet) return fromSheet;             // 1) URL da “Avversari”
  return `logos/${slugify(name)}.webp`;       // 2) fallback locale
}

/* ===== Layout (logo a sinistra del centro / VS) ===== */
function layoutLogoLeftOfCenter(stageEl, imgEl){
  const STAGE_W = stageEl.clientWidth;
  const STAGE_H = stageEl.clientHeight;

  const LOGO_H = STAGE_H * parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--logo-h-ratio')) || STAGE_H * 0.12;
  const GAP    = STAGE_W * parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gap-ratio')) || STAGE_W * 0.02;

  const cx = STAGE_W / 2;
  const cy = STAGE_H / 2;

  const logoW = LOGO_H;
  const x = cx - GAP - logoW;
  const y = cy - (LOGO_H/2);

  imgEl.style.width  = `${logoW}px`;
  imgEl.style.height = `${LOGO_H}px`;
  imgEl.style.left   = `${x}px`;
  imgEl.style.top    = `${y}px`;
}

/* ===== DOM & Render ===== */
const $ = s=>document.querySelector(s);
const stage = $('#stage'), logo1 = $('#logo1'), statusEl = $('#status');

async function loadAndRender(){
  try{
    statusEl.textContent = ' (carico dallo sheet...)';
    const [metaRows, oppRows] = await Promise.all([
      fetchCsvPrefer(SHEET_FILE_ID, META_GID, PUBLISHED_META_URL),
      fetchCsvPrefer(SHEET_FILE_ID, OPP_GID,  PUBLISHED_OPP_URL),
    ]);
    const meta = normalizeMeta(metaRows);
    const opp  = normalizeOpp(oppRows);

    const squadra1 = (meta.get('squadra1') || 'Petriolese').trim();
    let src = resolveLogoSrc(squadra1, opp);
    const fallback = `logos/${slugify(squadra1)}.webp`;

    await new Promise(res=>{
      logo1.onload  = ()=>res();
      logo1.onerror = ()=>{ logo1.onerror = null; logo1.src = fallback; };
      logo1.src = src;
    });

    layoutLogoLeftOfCenter(stage, logo1);
    statusEl.innerHTML = ` <span style="color:#8ff59a">OK</span> — squadra1: <strong>${squadra1}</strong>`;
  }catch(err){
    console.error(err);
    logo1.src = 'logos/petriolese.webp';
    layoutLogoLeftOfCenter(stage, logo1);
    statusEl.innerHTML = ` <span style="color:#ffd36d">fallback</span> — pubblica le schede o apri i permessi`;
  }
}

function relayout(){ layoutLogoLeftOfCenter(stage, logo1); }

/* ===== Export PNG ===== */
async function downloadPNG(){
  const TARGET_W = 3508, TARGET_H = 4961;
  const clone = stage.cloneNode(true);
  clone.style.width  = TARGET_W + 'px';
  clone.style.height = TARGET_H + 'px';
  clone.style.position = 'fixed'; clone.style.left = '-99999px'; clone.style.top = '-99999px';
  document.body.appendChild(clone);
  const cloneLogo = clone.querySelector('#logo1');
  layoutLogoLeftOfCenter(clone, cloneLogo);

  const canvas = await html2canvas(clone, { backgroundColor: '#0b0c11', useCORS: true, scale: 1, width: TARGET_W, height: TARGET_H });
  document.body.removeChild(clone);

  const blob = await new Promise(res=> canvas.toBlob(b=>res(b), 'image/png', 0.98));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `cover_${new Date().toISOString().slice(0,10)}.png`; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/* ===== Wireup ===== */
window.addEventListener('DOMContentLoaded', ()=>{
  $('#btnRefresh').addEventListener('click', loadAndRender, { passive:true });
  $('#btnDownload').addEventListener('click', downloadPNG, { passive:true });
  loadAndRender();
  const ro = new ResizeObserver(()=> relayout());
  ro.observe(stage);
});
