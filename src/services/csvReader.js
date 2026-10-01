const fs = require('fs');
const { parse } = require('csv-parse/sync');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Parses CSV text (from a file or a fetched sheet) into unique, valid
// contacts: [{ email, name, company }]. Shared by csvReader and sheetReader
// so both sources behave identically.
function parseContacts(csvText) {
  const rows = parse(csvText, {
    columns: (header) => header.map((h) => h.trim().toLowerCase()),
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });

  const seen = new Set();
  const contacts = [];
  for (const row of rows) {
    const email = (row.email || '').toLowerCase();
    if (!EMAIL_RE.test(email)) {
      if (email) console.warn(`[csv] skipping invalid email: ${email}`);
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);
    const name = row.name || row['hr name'] || row['hr_name'] || undefined;
    contacts.push({ email, name, company: row.company || undefined });
  }
  return contacts;
}

// Reads a local CSV file and returns unique, valid contacts.
function readContacts(csvPath) {
  if (!fs.existsSync(csvPath)) throw new Error(`CSV not found at ${csvPath}`);
  return parseContacts(fs.readFileSync(csvPath));
}

module.exports = { readContacts, parseContacts, EMAIL_RE };
