const mongoose = require('mongoose');

const roundDataSchema = new mongoose.Schema({
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  roundNumber: { type: Number, required: true }, // 1, 2, or 3
  generatedImages: [{ type: String }],
  finalSelectedImage: { type: String, default: null },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RoundData', roundDataSchema);
