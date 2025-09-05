/* ===== Config: stessi ID/GID di lineup ===== */
const SHEET_FILE_ID = '1nWG0OBGpiyK-lulP-OKGad4jG7uEVmcy';
const META_GID      = '254048258';   // "Meta" (chiavi: Giornata, Squadra1, Squadra2, ...)
const OPP_GID       = '1284472120';  // "Avversari" (colonne: Squadra, Logo)

/* ===== Helpers Sheet ===== */
const gvizCsvURL=(fileId,gid)=>`https://docs.google.com/spreadsheets/d/${fileId}/gviz/tq?gid=${encodeURIComponent(gid)}&headers=1&tqx=out:csv`;

function parseCSV(text){
  // robust parser minimalista
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

async function fetchCsv(fileId,gid){
  const res = await fetch(gvizCsvURL(fileId,gid), { cache:'no-store' });
  if(!res.ok) throw new Error('fetch CSV failed');
  return parseCSV(await res.text());
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
  if(fromSheet) return fromSheet;             // priorità URL foglio
  return `logos/${slugify(name)}.webp`;       // fallback locale
}

/* ===== Layout: posizioniamo il logo a sinistra del centro (VS al centro immagine) ===== */
function layoutLogoLeftOfCenter(stageEl, imgEl){
  const STAGE_W = stageEl.clientWidth;
  const STAGE_H = stageEl.clientHeight;

  const LOGO_H = STAGE_H * parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--logo-h-ratio')) || STAGE_H * 0.12;
  const GAP    = STAGE_W * parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gap-ratio')) || STAGE_W * 0.02;

  const cx = STAGE_W / 2;
  const cy = STAGE_H / 2;

  const logoW = LOGO_H; // quadrato
  const x = cx - GAP - logoW;
  const y = cy - (LOGO_H/2);

  imgEl.style.width  = `${logoW}px`;
  imgEl.style.height = `${LOGO_H}px`;
  imgEl.style.left   = `${x}px`;
  imgEl.style.top    = `${y}px`;
}

/* ===== Caricamento dati + render ===== */
const $ = sel => document.querySelector(sel);
const stage = $('#stage');
const logo1 = $('#logo1');
const statusEl = $('#status');

async function loadAndRender(){
  try{
    statusEl.textContent = ' (carico dallo sheet...)';
    const [metaRows, oppRows] = await Promise.all([
      fetchCsv(SHEET_FILE_ID, META_GID),
      fetchCsv(SHEET_FILE_ID, OPP_GID),
    ]);
    const meta = normalizeMeta(metaRows);
    const opp  = normalizeOpp(oppRows);

    const squadra1 = (meta.get('squadra1') || 'Petriolese').trim();
    let src = resolveLogoSrc(squadra1, opp);

    // Proviamo a forzare same-origin quando possibile (per export canvas):
    // - se src è assoluto e CORS blocca, fallback su logos/slug.webp
    const fallback = `logos/${slugify(squadra1)}.webp`;

    await new Promise(res=>{
      logo1.onload  = ()=>res();
      logo1.onerror = ()=>{ logo1.onerror = null; logo1.src = fallback; };
      logo1.src = src;
    });

    layoutLogoLeftOfCenter(stage, logo1);
    statusEl.innerHTML = ` <span class="ok">OK</span> — squadra1: <strong>${squadra1}</strong>`;
  }catch(err){
    console.error(err);
    // fallback offline: Petriolese
    logo1.src = 'logos/petriolese.webp';
    layoutLogoLeftOfCenter(stage, logo1);
    statusEl.innerHTML = ` <span class="warn">fallback offline</span>`;
  }
}

function relayout(){ layoutLogoLeftOfCenter(stage, logo1); }

/* ===== Export PNG A3 300dpi ===== */
async function downloadPNG(){
  // Render a 3508x4961 canvas indipendentemente dalla preview size
  const TARGET_W = 3508, TARGET_H = 4961;

  // Creiamo un clone temporaneo con dimensioni esatte
  const clone = stage.cloneNode(true);
  clone.style.width  = TARGET_W + 'px';
  clone.style.height = TARGET_H + 'px';
  clone.style.position = 'fixed';
  clone.style.left = '-99999px';
  clone.style.top  = '-99999px';
  document.body.appendChild(clone);

  // Rilayout logo sul clone in base al nuovo size
  const cloneLogo = clone.querySelector('#logo1');
  layoutLogoLeftOfCenter(clone, cloneLogo);

  const canvas = await html2canvas(clone, {
    backgroundColor: '#0b0c11',
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
  $('#btnRefresh').addEventListener('click', loadAndRender, { passive:true });
  $('#btnDownload').addEventListener('click', downloadPNG, { passive:true });
  // primo caricamento
  loadAndRender();

  // responsivo
  const ro = new ResizeObserver(()=> relayout());
  ro.observe(stage);
});
