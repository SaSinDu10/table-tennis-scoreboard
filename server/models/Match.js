// server/models/Match.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// --- Sub-schema for Point History ---
// Defines the structure for each entry in the pointHistory array
const pointHistorySchema = new Schema({
    // Timestamp when the point was recorded (defaults to when the entry is created)
    timestamp: { type: Date, default: Date.now },
    // Which team scored the point (1 for Team 1, 2 for Team 2)
    scoringTeam: { type: Number, required: true, enum: [1, 2] },
    // A snapshot of the score state *before* this point was added.
    // This is crucial for the undo functionality.
    scoreStateBefore: {
        sets: { type: [[Number]], required: true }, // Scores of completed sets
        currentGame: { // Score within the current game
            team1: { type: Number, required: true },
            team2: { type: Number, required: true }
        },
        currentSetScore: { // Sets won by each team
            team1: { type: Number, required: true },
            team2: { type: Number, required: true }
        },
        server: { type: Number, required: true, enum: [1, 2] } // Which team was serving before this point
    }
}, { _id: false }); // Subdocuments don't need their own MongoDB _id
// ----------------------------------------


// --- Main Match Schema ---
const matchSchema = new Schema({
    // Basic match details
    category: {
        type: String,
        enum: ['Super Senior', 'Senior', 'Junior'],
        required: true
    },
    matchType: {
        type: String,
        enum: ['Individual', 'Dual'], // 'Dual' represents Doubles
        required: true
    },

    // Player Information
    // For Individual: player1 = Player 1, player2 = Player 2
    // For Dual: player1 = Team 1 Player 1, player2 = Team 1 Player 2
    //           player3 = Team 2 Player 1, player4 = Team 2 Player 2
    player1: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
    player2: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
    player3: { type: Schema.Types.ObjectId, ref: 'Player' }, // Only required if matchType is 'Dual'
    player4: { type: Schema.Types.ObjectId, ref: 'Player' }, // Only required if matchType is 'Dual'

    // Score Tracking Object
    score: {
        // Array storing scores of completed sets, e.g., [[11, 5], [8, 11], [11, 9]]
        // Index 0 = Team 1's score, Index 1 = Team 2's score for that set
        sets: { type: [[Number]], default: [] },

        // Score within the current ongoing game
        currentGame: {
            team1: { type: Number, default: 0 }, // Points for Player/Team 1
            team2: { type: Number, default: 0 }  // Points for Player/Team 2
        },

        // Sets won by each team/player currently
        currentSetScore: {
            team1: { type: Number, default: 0 }, // Sets won by Player/Team 1
            team2: { type: Number, default: 0 }  // Sets won by Player/Team 2
        },

        // Tracks which team is currently serving (1 or 2)
        server: {
            type: Number,
            enum: [1, 2],
            default: 1 // Default server can be Team 1, or randomized on match start
        }
    },

    // History of points scored for undo functionality
    pointHistory: {
        type: [pointHistorySchema], // An array of point history entries
        default: [] // Starts as an empty array
    },

    // Match Metadata & Status
    status: {
        type: String,
        enum: ['Upcoming', 'Live', 'Finished', 'Cancelled'], // Possible match statuses
        default: 'Upcoming' // Matches start as 'Upcoming'
    },
    // Number of sets a team needs to win the match (1 for Bo1, 2 for Bo3, 3 for Bo5)
    setsToWin: {
        type: Number,
        enum: [1, 2, 3], // Corresponds to Best of 1, 3, 5
        required: true,
        default: 3 // Default to Best of 5 (win 3 sets)
    },

    // Winner Information (set when status becomes 'Finished')
    winner: {
        // For Individual: Stores the ObjectId of the winning Player
        // For Dual: Stores the team number (1 or 2) that won
        type: Schema.Types.Mixed // Allows storing ObjectId or Number
    },

    // Timestamps for match duration
    startTime: { type: Date }, // Set when status changes to 'Live'
    endTime: { type: Date },   // Set when status changes to 'Finished'

    // Optional extra info
    // table: { type: Number } // Which table the match is on

}, {
    // Mongoose options
    timestamps: true // Automatically adds createdAt and updatedAt fields
});

// --- Instance Method Example (Optional Helper) ---
// Helper to get formatted player/team names based on match type
// Requires players to be populated first (e.g., using .populate() in the route)
matchSchema.methods.getPlayerNames = function () {
    // Check if players are populated (simple check)
    if (!this.player1 || typeof this.player1.name === 'undefined') {
        console.warn("Attempted to getPlayerNames without populated players for match:", this._id);
        return { team1: 'Player data missing', team2: 'Player data missing' };
    }

    let team1Name = this.player1.name;
    if (this.matchType === 'Dual' && this.player2) {
        team1Name += ` / ${this.player2.name}`;
    }

    let team2Name;
    if (this.matchType === 'Individual') {
        team2Name = this.player2?.name || 'N/A';
    } else { // Dual
        team2Name = this.player3?.name || 'N/A';
        if (this.player4) {
            team2Name += ` / ${this.player4.name}`;
        }
    }
    return { team1: team1Name, team2: team2Name };
};
// ---------------------------------------------

// Create and export the Mongoose model
module.exports = mongoose.model('Match', matchSchema);