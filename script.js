/* ===== Config (stessi ID/GID di lineup) ===== */
const SHEET_FILE_ID = '1nWG0OBGpiyK-lulP-OKGad4jG7uEVmcy';
const META_GID      = '254048258';   // linguetta "Meta"
const OPP_GID       = '1284472120';  // linguetta "Avversari"

/* Unico E-ID del documento pubblicato (File → Pubblica sul web) */
const PUBLISHED_DOC_E_ID = '2PACX-1vSpJqXmoJaIznEo_EGHCfUxyYVWWKJCGULM9FbnI14hLhGpsjt3oMHT5ahJwEmJ4w';

/* ===== Anchor del “VS” nello sfondo (percentuali pagina) =====
   Regola questi valori per seguire perfettamente il tuo template */
const VS_X_RATIO         = 0.50;  // X del VS
const VS_Y_RATIO         = 0.57;  // Y del VS
const LEFT_OFFSET_RATIO  = 0.32;  // distanza del centro logo1 a sinistra del VS
const RIGHT_OFFSET_RATIO = 0.32;  // distanza del centro logo2 a destra del VS
const LOGO_H_RATIO       = 0.12;  // altezza loghi (in % dell'altezza pagina)
const NAME_GAP_RATIO     = 0.018; // gap verticale tra logo e nome (in % dell'altezza pagina)
const NAME_FONT_RATIO    = 0.038; // font-size nome (in % dell'altezza pagina)

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
async function fetchCsvPrefer(fileId, gid, eId){
  try{
    const r = await fetch(gvizCsvURL(fileId,gid), { cache:'no-store' });
    if(r.ok) return parseCSV(await r.text());
  }catch(_){}
  const r2 = await fetch(pubCsvFromDocEId(eId,gid), { cache:'no-store' });
  if(!r2.ok) throw new Error('Impossibile leggere CSV pubblicato.');
  return parseCSV(await r2.text());
}

/* ===== Normalizzazioni come lineup ===== */
const slugify = s => String(s||'')
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/&/g,'and')
  .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');

// normalizza chiavi: minuscolo, senza spazi
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
    const url =(''+(r.Logo||r.logo||'')).trim();
    if(name) out.set(name.toLowerCase(), url);
  });
  return out;
}

// se nello sheet metti solo "petriolese.webp", prefissa "logos/"
function normalizeLogoUrl(s){
  const v = String(s||'').trim();
  if(!v) return '';
  if(/^https?:\/\//i.test(v) || v.startsWith('data:')) return v;         // URL assoluta o data URL
  if(v.startsWith('logos/') || v.startsWith('./') || v.startsWith('../')) return v; // relativo già ok
  return 'logos/' + v.replace(/^\/+/, '');
}
function resolveLogoSrc(teamName, oppMap){
  const name=(teamName||'').trim(); if(!name) return '';
  const fromSheet=oppMap.get(name.toLowerCase())||'';
  if(fromSheet) return normalizeLogoUrl(fromSheet);
  return `logos/${slugify(name)}.webp`;
}

/* ===== Layout ===== */
function layoutSide(stageEl, centerX, centerY, logoEl, nameEl){
  const STAGE_W = stageEl.clientWidth;
  const STAGE_H = stageEl.clientHeight;

  const logoH = STAGE_H * LOGO_H_RATIO;
  const logoW = logoH;
  const nameGap  = STAGE_H * NAME_GAP_RATIO;
  const nameFont = STAGE_H * NAME_FONT_RATIO;

  // logo
  logoEl.style.width  = `${logoW}px`;
  logoEl.style.height = `${logoH}px`;
  logoEl.style.left   = `${(centerX - logoW/2)}px`;
  logoEl.style.top    = `${(centerY - logoH/2)}px`;

  // nome (centrato sotto il logo)
  nameEl.style.fontSize = `${nameFont}px`;
  nameEl.style.left     = `${centerX}px`;
  nameEl.style.top      = `${(centerY + logoH/2 + nameGap)}px`;
}

function layoutBoth(stageEl, logo1, name1, logo2, name2){
  const STAGE_W = stageEl.clientWidth;
  const STAGE_H = stageEl.clientHeight;
  const vsX = STAGE_W * VS_X_RATIO;
  const vsY = STAGE_H * VS_Y_RATIO;

  const leftCenterX  = vsX - (STAGE_W * LEFT_OFFSET_RATIO);
  const rightCenterX = vsX + (STAGE_W * RIGHT_OFFSET_RATIO);

  layoutSide(stageEl, leftCenterX,  vsY, logo1, name1);
  layoutSide(stageEl, rightCenterX, vsY, logo2, name2);
}

/* ===== DOM & Render ===== */
const $ = s=>document.querySelector(s);
const stage  = $('#stage');
const bg     = $('#bg');
const logo1  = $('#logo1');
const logo2  = $('#logo2');
const name1  = $('#name1');
const name2  = $('#name2');
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

    if (!bg.complete) await new Promise(r => { bg.onload = r; bg.onerror = r; });

    // meta keys robusti (accettiamo "squadra1" o "squadra 1")
    const squadra1 = (meta.get('squadra1') || meta.get('squadra1') || meta.get('squadra 1') || 'Petriolese').trim();
    const squadra2 = (meta.get('squadra2') || meta.get('squadra2') || meta.get('squadra 2') || 'Avversari').trim();

    name1.textContent = squadra1;
    name2.textContent = squadra2;

    // carica logo1 con fallback
    const src1 = resolveLogoSrc(squadra1, opp);
    const fb1  = `logos/${slugify(squadra1)}.webp`;
    await new Promise(res=>{
      logo1.onload  = ()=>res();
      logo1.onerror = ()=>{ logo1.onerror = null; logo1.src = fb1; };
      logo1.src = src1;
    });

    // carica logo2 con fallback
    const src2 = resolveLogoSrc(squadra2, opp);
    const fb2  = `logos/${slugify(squadra2)}.webp`;
    await new Promise(res=>{
      logo2.onload  = ()=>res();
      logo2.onerror = ()=>{ logo2.onerror = null; logo2.src = fb2; };
      logo2.src = src2;
    });

    layoutBoth(stage, logo1, name1, logo2, name2);
    statusEl.innerHTML = ` <span style="color:#8ff59a">OK</span> — <strong>${squadra1}</strong> vs <strong>${squadra2}</strong>`;
  }catch(err){
    console.error(err);
    if (!bg.complete) await new Promise(r => { bg.onload = r; bg.onerror = r; });
    name1.textContent = 'Petriolese';
    name2.textContent = 'Avversari';
    logo1.src = 'logos/petriolese.webp';
    logo2.src = 'logos/moglianese.webp'; // placeholder secondario, se vuoi sostituisci
    layoutBoth(stage, logo1, name1, logo2, name2);
    statusEl.innerHTML = ` <span style="color:#ffd36d">fallback</span> — controlla permessi o pubblicazione`;
  }
}

function relayout(){ layoutBoth(stage, logo1, name1, logo2, name2); }

/* ===== Export PNG A3 300dpi ===== */
async function downloadPNG(){
  const TARGET_W = 3508, TARGET_H = 4961;

  const clone = stage.cloneNode(true);
  clone.style.width  = TARGET_W + 'px';
  clone.style.height = TARGET_H + 'px';
  clone.style.boxShadow   = 'none';
  clone.style.borderRadius= '0';
  clone.style.position = 'fixed';
  clone.style.left = '-99999px';
  clone.style.top  = '-99999px';
  document.body.appendChild(clone);

  const cLogo1 = clone.querySelector('#logo1');
  const cLogo2 = clone.querySelector('#logo2');
  const cName1 = clone.querySelector('#name1');
  const cName2 = clone.querySelector('#name2');
  const cBg    = clone.querySelector('#bg');

  if (!cBg.complete) await new Promise(r => { cBg.onload = r; cBg.onerror = r; });
  layoutBoth(clone, cLogo1, cName1, cLogo2, cName2);

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
  loadAndRender();
  const ro = new ResizeObserver(()=> relayout());
  ro.observe(stage);
});
