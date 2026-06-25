const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
  finalImageUrl: { type: String, required: true },
  similarityScore: { type: Number, default: 0 },
  breakdown: {
    clip: { type: Number, default: 0 },
    ssim: { type: Number, default: 0 }
  },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Submission', submissionSchema);
