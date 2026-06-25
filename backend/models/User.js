const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true },
  role: { type: String, enum: ['player', 'admin'], default: 'player' },
});

module.exports = mongoose.model('User', userSchema);
