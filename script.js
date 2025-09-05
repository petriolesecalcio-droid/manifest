/* ===== Config (stessi ID/GID di lineup) ===== */
const SHEET_FILE_ID = '1nWG0OBGpiyK-lulP-OKGad4jG7uEVmcy';
const META_GID      = '254048258';   // linguetta "Meta"
const OPP_GID       = '1284472120';  // linguetta "Avversari"

/* Unico E-ID del documento pubblicato (File → Pubblica sul web) */
const PUBLISHED_DOC_E_ID = '2PACX-1vSpJqXmoJaIznEo_EGHCfUxyYVWWKJCGULM9FbnI14hLhGpsjt3oMHT5ahJwEmJ4w';

/* ===== Punti di ancoraggio relativi al “VS” nello sfondo =====
   Regola questi tre valori per allineare perfettamente al tuo template */
const VS_X_RATIO        = 0.50; // X del VS ~ 50% larghezza
const VS_Y_RATIO        = 0.57; // Y del VS (0.55–0.60 tipico)
const LEFT_OFFSET_RATIO = 0.32; // quanto a sinistra del VS posizionare il CENTRO del logo (0.18 = poco; 0.32 = molto più a sinistra)
const LOGO_H_RATIO      = 0.12; // altezza logo = 12% dell’altezza pagina

/* ===== Helpers Sheet ===== */
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

/* Tenta gviz (se il file è condiviso “chiunque con link”) → fallback CSV pubblicato (unico E-ID) */
async function fetchCsvPrefer(fileId, gid, eId){
  try{
    const r = await fetch(gvizCsvURL(fileId,gid), { cache:'no-store' });
    if(r.ok) return parseCSV(await r.text());
  }catch(_){}
  const r2 = await fetch(pubCsvFromDocEId(eId,gid), { cache:'no-store' });
  if(!r2.ok) throw new Error('Impossibile leggere CSV pubblicato.');
  return parseCSV(await r2.text());
}

/* ===== Normalizzazioni identiche a lineup ===== */
const slugify = s => String(s||'')
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/&/g,'and')
  .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');

// Se nello sheet metti solo "petriolese.webp", prefissa "logos/"
function normalizeLogoUrl(s){
  const v = String(s||'').trim();
  if(!v) return '';
  if(/^https?:\/\//i.test(v) || v.startsWith('data:')) return v;         // URL assoluta o data URL
  if(v.startsWith('logos/') || v.startsWith('./') || v.startsWith('../')) return v; // già relativo
  return 'logos/' + v.replace(/^\/+/, '');
}

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
  if(fromSheet) return normalizeLogoUrl(fromSheet); // 1) URL da Avversari (normalizzato)
  return `logos/${slugify(name)}.webp`;              // 2) fallback locale
}

/* ===== Layout: posiziona il logo a sinistra del "VS" ===== */
function layoutLogoNearVS(stageEl, imgEl){
  const STAGE_W = stageEl.clientWidth;
  const STAGE_H = stageEl.clientHeight;

  const vsX = STAGE_W * VS_X_RATIO;
  const vsY = STAGE_H * VS_Y_RATIO;

  const logoH = STAGE_H * LOGO_H_RATIO;
  const logoW = logoH; // quadrato

  const centerX = vsX - (STAGE_W * LEFT_OFFSET_RATIO); // centro logo spostato a sinistra del VS
  const centerY = vsY;

  imgEl.style.width  = `${logoW}px`;
  imgEl.style.height = `${logoH}px`;
  imgEl.style.left   = `${(centerX - logoW/2)}px`;
  imgEl.style.top    = `${(centerY - logoH/2)}px`;
}

/* ===== DOM & Render ===== */
const $ = s=>document.querySelector(s);
const stage  = $('#stage');
const bg     = $('#bg');
const logo1  = $('#logo1');
const statusEl = $('#status');

async function loadAndRender(){
  try{
    statusEl.textContent = ' (carico dallo sheet...)';

    const [metaRows, oppRows] = await Promise.all([
      fetchCsvPrefer(SHEET_FILE_ID, META_GID, PUBLISHED_DOC_E_ID),
      fetchCsvPrefer(SHEET_FILE_ID, OPP_GID,  PUBLISHED_DOC_E_ID),
    ]);
    const meta = normalizeMeta(metaRows);
    const opp  = normalizeOpp(oppRows);

    // assicuriamoci che lo sfondo sia carico (anche per l’export)
    if (!bg.complete) await new Promise(r => { bg.onload = r; bg.onerror = r; });

    const squadra1 = (meta.get('squadra1') || 'Petriolese').trim();
    const src = resolveLogoSrc(squadra1, opp);
    const fallback = `logos/${slugify(squadra1)}.webp`;

    await new Promise(res=>{
      logo1.onload  = ()=>res();
      logo1.onerror = ()=>{ logo1.onerror = null; logo1.src = fallback; };
      logo1.src = src;
    });

    layoutLogoNearVS(stage, logo1);
    statusEl.innerHTML = ` <span style="color:#8ff59a">OK</span> — squadra1: <strong>${squadra1}</strong>`;
  }catch(err){
    console.error(err);
    // fallback offline
    if (!bg.complete) await new Promise(r => { bg.onload = r; bg.onerror = r; });
    logo1.src = 'logos/petriolese.webp';
    layoutLogoNearVS(stage, logo1);
    statusEl.innerHTML = ` <span style="color:#ffd36d">fallback</span> — controlla permessi o pubblicazione`;
  }
}

function relayout(){ layoutLogoNearVS(stage, logo1); }

/* ===== Export PNG A3 300dpi (senza scurimenti) ===== */
async function downloadPNG(){
  const TARGET_W = 3508, TARGET_H = 4961;

  const clone = stage.cloneNode(true);
  // dimensioni esatte
  clone.style.width  = TARGET_W + 'px';
  clone.style.height = TARGET_H + 'px';
  // togli effetti
  clone.style.boxShadow   = 'none';
  clone.style.borderRadius= '0';

  // posiziona fuori schermo
  clone.style.position = 'fixed';
  clone.style.left = '-99999px';
  clone.style.top  = '-99999px';
  document.body.appendChild(clone);

  // rilayout sul clone
  const cloneLogo = clone.querySelector('#logo1');
  const cloneBg   = clone.querySelector('#bg');
  if (!cloneBg.complete) await new Promise(r => { cloneBg.onload = r; cloneBg.onerror = r; });
  layoutLogoNearVS(clone, cloneLogo);

  // niente overlay di background
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
  $('#btnRefresh').addEventListener('click', loadAndRender, { passive:true });
  $('#btnDownload').addEventListener('click', downloadPNG, { passive:true });
  loadAndRender();
  const ro = new ResizeObserver(()=> relayout());
  ro.observe(stage);
});
