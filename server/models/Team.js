// server/models/Team.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const teamSchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    players: [{
        type: Schema.Types.ObjectId,
        ref: 'Player',
        required: true
    }],
    logoUrl: {
        type: String
    }
    
    // Add a tournamentId or leagueId if teams are specific to events later
}, { timestamps: true });

// Optional: Validate player array length (e.g., must be 6)
teamSchema.path('players').validate(function (value) {
    // return value.length === 6; // Example: Enforce exactly 6 players
    return value.length > 0 && value.length <= 10; // Example: Between 1 and 10 players
}, 'Team must have the specified number of players (e.g., between 1 and 10).');


module.exports = mongoose.model('Team', teamSchema);