const mongoose = require('mongoose');

const gameStateSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true }, // e.g., 'main'
  status: { type: String, default: 'waiting' }, // waiting, round1_active, round1_ended, etc.
  currentRound: { type: Number, default: 0 },
  roundStartTime: { type: Date, default: null },
  roundEndTime: { type: Date, default: null },
  isPaused: { type: Boolean, default: false },
  pausedAt: { type: Date, default: null },
  timeRemainingAtPause: { type: Number, default: null }, // ms
  roundDurations: {
    round1: { type: Number, default: 1200 },
    round2: { type: Number, default: 1200 },
    round3: { type: Number, default: 1500 },
  },
  started: { type: Boolean, default: false },
  phase: { type: String, default: 'lobby' },
  timers: {
    round1: { type: Number, default: 300 },
    round2: { type: Number, default: 300 },
    round3: { type: Number, default: 300 },
    discussion: { type: Number, default: 120 },
    swap: { type: Number, default: 60 }
  },
  forbiddenWords: { type: [String], default: ['dragon', 'ancient', 'fire'] }
});

module.exports = mongoose.model('GameState', gameStateSchema);
