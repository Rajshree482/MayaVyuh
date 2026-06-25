const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  observer: String,
  creator: String,
  round: { type: Number, default: 0 },
  score: { type: Number, default: 0 },
  status: { type: String, default: 'pending' }, // pending, approved, active, penalized, banned
  sessionId: { type: String, default: null },
  timeLeft: Number,
  totalTime: Number,
  observerText: String,
  creatorText: String,
  tabSwitchCount: { type: Number, default: 0 },
  fullscreenExits: { type: Number, default: 0 },
  warnings: { type: Number, default: 0 }
});

module.exports = mongoose.model('Team', teamSchema);
