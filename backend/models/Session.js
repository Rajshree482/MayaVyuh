const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  startTime: { type: Date, default: Date.now },
  status: { 
    type: String, 
    enum: ['lobby', 'round1', 'interval1', 'round2', 'interval2', 'round3', 'submission', 'ended'], 
    default: 'lobby' 
  },
  active: { type: Boolean, default: true }
});

module.exports = mongoose.model('Session', sessionSchema);
