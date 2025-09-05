const SHEET_FILE_ID = '1nWG0OBGpiyK-lulP-OKGad4jG7uEVmcy';
const META_GID      = '254048258';    // linguetta Meta
const OPP_GID       = '1284472120';   // linguetta Avversari

// 👇 incolla l’E-ID qui
const PUBLISHED_DOC_E_ID = '2PACX-1vSpJqXmoJaIznEo_EGHCfUxyYVWWKJCGULM9FbnI14hLhGpsjt3oMHT5ahJwEmJ4w';

// helper CSV pubblicato
const pubCsvFromDocEId = (eId, gid) =>
  `https://docs.google.com/spreadsheets/d/e/${eId}/pub?gid=${encodeURIComponent(gid)}&single=true&output=csv`;

async function fetchCsvPrefer(fileId, gid, eId){
  // 1) gviz (funziona se “chiunque con link”)
  try {
    const url = `https://docs.google.com/spreadsheets/d/${fileId}/gviz/tq?gid=${encodeURIComponent(gid)}&headers=1&tqx=out:csv`;
    const r = await fetch(url, {cache:'no-store'});
    if (r.ok) return parseCSV(await r.text());
  } catch {}
  // 2) fallback CSV pubblicato (funziona se “Pubblica sul web” attivo)
  const urlPub = pubCsvFromDocEId(eId, gid);
  const r2 = await fetch(urlPub, {cache:'no-store'});
  if (!r2.ok) throw new Error('fallback published CSV failed');
  return parseCSV(await r2.text());
}

// quando carichi:
const [metaRows, oppRows] = await Promise.all([
  fetchCsvPrefer(SHEET_FILE_ID, META_GID, PUBLISHED_DOC_E_ID),
  fetchCsvPrefer(SHEET_FILE_ID, OPP_GID,  PUBLISHED_DOC_E_ID),
]);
