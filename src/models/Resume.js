const mongoose = require('mongoose');

// The resume attached to every application email. Stored in MongoDB (not read
// from disk) so it can be replaced with `npm run resume:upload` and every
// sender picks up the new one on its next send, with no restart needed.
const resumeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, default: 'default' },
    filename: { type: String, required: true },
    contentType: { type: String, default: 'application/pdf' },
    data: { type: Buffer, required: true },
    size: Number,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Resume', resumeSchema);
