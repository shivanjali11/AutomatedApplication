const Template = require('../models/Template');

async function getTemplate(name) {
  const tpl = await Template.findOne({ name, active: true }).lean();
  if (!tpl) throw new Error(`No active template "${name}" in MongoDB. Run: npm run seed`);
  return tpl;
}

// Replaces {{key}} or {{key|fallback}} with values from data
function render(str, data) {
  return str.replace(/\{\{\s*(\w+)\s*(?:\|([^}]*))?\}\}/g, (_, key, fallback) => {
    const value = data[key];
    return value ? String(value) : (fallback ?? '').trim();
  });
}

module.exports = { getTemplate, render };
