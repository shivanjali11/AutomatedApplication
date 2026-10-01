const Template = require('../models/Template');

async function getTemplate(name) {
  const tpl = await Template.findOne({ name, active: true }).lean();
  if (!tpl) throw new Error(`No active template "${name}" in MongoDB. Run: npm run seed`);
  return tpl;
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);

// Replaces {{key}} or {{key|fallback}} with values from data. Pass { html: true }
// for HTML bodies so contact data from the sheet/CSV can't inject markup.
function render(str, data, { html = false } = {}) {
  return str.replace(/\{\{\s*(\w+)\s*(?:\|([^}]*))?\}\}/g, (_, key, fallback) => {
    const value = data[key];
    const out = value ? String(value) : (fallback ?? '').trim();
    return html ? escapeHtml(out) : out;
  });
}

module.exports = { getTemplate, render };
