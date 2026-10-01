const { parseContacts } = require('./csvReader');

// Converts a normal Google Sheets edit URL into its CSV export URL.
// e.g. https://docs.google.com/spreadsheets/d/<ID>/edit?gid=<GID>#gid=<GID>
//   -> https://docs.google.com/spreadsheets/d/<ID>/export?format=csv&gid=<GID>
function toExportUrl(sheetUrl) {
  const idMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) throw new Error(`Not a recognizable Google Sheets URL: ${sheetUrl}`);
  const gidMatch = sheetUrl.match(/[?#&]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : '0';
  return `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv&gid=${gid}`;
}

// Fetches the sheet's current contents and parses it the same way a local
// CSV is parsed. The sheet must be shared as "Anyone with the link: Viewer"
// (or better) — a private sheet returns an HTML sign-in page instead of CSV,
// which is detected and reported clearly rather than silently parsed as junk.
async function readContactsFromSheet(sheetUrl) {
  const exportUrl = toExportUrl(sheetUrl);
  // Without a timeout a stalled request would hang the job (and block every later run via isRunning).
  const res = await fetch(exportUrl, { redirect: 'follow', signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Failed to fetch sheet (HTTP ${res.status}). Is it shared as "Anyone with the link"?`);

  const text = await res.text();
  if (text.trimStart().startsWith('<')) {
    throw new Error('Sheet returned a login page instead of CSV — check it is shared as "Anyone with the link: Viewer".');
  }
  return parseContacts(text);
}

module.exports = { readContactsFromSheet, toExportUrl };
