const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const playerSchema = new Schema({
    name: { type: String, required: true, unique: true },
    category: { type: String, enum: ['Super Senior', 'Senior', 'Junior'], required: true },
    photoUrl: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Player', playerSchema);