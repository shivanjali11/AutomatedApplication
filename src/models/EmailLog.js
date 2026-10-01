const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: String,
    company: String,
    status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending', index: true },
    attempts: { type: Number, default: 0 },
    lastError: String,
    messageId: String,
    sentAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('EmailLog', emailLogSchema);
