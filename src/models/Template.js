const mongoose = require('mongoose');

// Supports placeholders like {{name}}, {{company}} and defaults: {{name|Hiring Team}}
const templateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    subject: { type: String, required: true },
    html: { type: String, required: true },
    text: { type: String, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Template', templateSchema);
