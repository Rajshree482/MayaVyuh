const mongoose = require('mongoose');

const imageBankSchema = new mongoose.Schema({
  url: { type: String, required: true },
  teamNumber: { type: Number },
  filename: { type: String },
  assignedTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  used: { type: Boolean, default: false }
});

module.exports = mongoose.model('ImageBank', imageBankSchema);
