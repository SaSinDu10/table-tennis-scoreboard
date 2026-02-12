// server/models/Match.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Sub-schema for Set Details
const setDetailSchema = new Schema({
    setIndex: { type: Number, required: true },
    team1Pair: [{ type: Schema.Types.ObjectId, ref: 'Player' }],
    team2Pair: [{ type: Schema.Types.ObjectId, ref: 'Player' }],
    team1Score: { type: Number, default: null },
    team2Score: { type: Number, default: null },
    status: { type: String, enum: ['Pending', 'Live', 'Finished'], default: 'Pending' }
}, { _id: false });

// Sub-schema for Point History
const pointHistorySchema = new Schema({
    timestamp: { type: Date, default: Date.now },
    scoringTeam: { type: Number, required: true, enum: [1, 2] },
    scoreStateBefore: {
        sets: { type: [[Number]], default: [] },
        // Now that setDetailSchema is defined above, this reference is valid
        setDetails: [setDetailSchema],
        currentGame: {
            team1: { type: Number, required: true },
            team2: { type: Number, required: true }
        },
        currentSetScore: {
            team1: { type: Number, required: true },
            team2: { type: Number, required: true }
        },
        server: { type: Number, required: true, enum: [1, 2] }
    }
}, { _id: false });

// Main Match Schema
const matchSchema = new Schema({
    category: {
        type: String,
        enum: ['Super Senior', 'Senior', 'Junior']
    },
    matchType: {
        type: String,
        enum: ['Individual', 'Dual', 'TeamSet'],
        required: true
    },
    teamMatchSubType: {
        type: String,
        enum: ['Set', 'Relay'],
    },
    teamMatchEncounterFormat: {
        type: String,
        enum: ['Singles', 'Doubles'],
    },

    // Fields for Individual/Dual Matches
    player1: { type: Schema.Types.ObjectId, ref: 'Player' },
    player2: { type: Schema.Types.ObjectId, ref: 'Player' },
    player3: { type: Schema.Types.ObjectId, ref: 'Player' },
    player4: { type: Schema.Types.ObjectId, ref: 'Player' },
    setsToWin: { type: Number },

    // Fields for TeamSet Matches
    team1: { type: Schema.Types.ObjectId, ref: 'Team' },
    team2: { type: Schema.Types.ObjectId, ref: 'Team' },
    numberOfSets: { type: Number },
    maxSetsPerPlayer: {
        type: Number,
        default: 2
    },

    // --- Score Object ---
    score: {
        sets: { type: [[Number]], default: [] },
        setDetails: [setDetailSchema],
        currentGame: { team1: { type: Number, default: 0 }, team2: { type: Number, default: 0 } },
        currentSetScore: { team1: { type: Number, default: 0 }, team2: { type: Number, default: 0 } },
        server: { type: Number, enum: [1, 2], default: 1 }
    },

    pointHistory: { type: [pointHistorySchema], default: [] },
    status: {
        type: String,
        enum: ['Upcoming', 'Live', 'Finished', 'Cancelled', 'AwaitingSetPairs', 'AwaitingTiebreakerPairs'],
        default: 'Upcoming'
    },
    winner: { type: Schema.Types.Mixed },
    startTime: { type: Date },
    endTime: { type: Date }
}, { timestamps: true });

// Pre-save Hook for Validation and Field Cleanup
matchSchema.pre('save', function (next) {
    if (this.matchType === 'TeamSet') {
        if (!this.team1 || !this.team2 || !this.teamMatchSubType || !this.teamMatchEncounterFormat) {
            return next(new Error('For TeamSet: Team IDs, sub-type, and encounter format are required.'));
        }
        if (this.teamMatchSubType === 'Set' && (!this.numberOfSets || this.numberOfSets < 1)) {
            return next(new Error('For TeamSet (Set type): Number of sets is required.'));
        }
        if (typeof this.maxSetsPerPlayer !== 'number' || this.maxSetsPerPlayer < 1) {
            this.maxSetsPerPlayer = 2;
        }

        this.player1 = undefined; this.player2 = undefined; this.player3 = undefined; this.player4 = undefined;
        this.setsToWin = undefined;
        this.category = undefined; // Category is not for TeamSet matches
    } else if (this.matchType === 'Individual' || this.matchType === 'Dual') {
        if (!this.category) { // Category IS required for Ind/Dual
            return next(new Error('Category is required for Individual/Dual matches.'));
        }
        if (!this.player1 || !this.player2) {
            return next(new Error('Player 1 and Player 2 are required for Individual/Dual matches.'));
        }
        if (this.matchType === 'Dual' && (!this.player3 || !this.player4)) {
            return next(new Error('Player 3 and Player 4 are required for Dual matches.'));
        }
        if (typeof this.setsToWin !== 'number' || ![1, 2, 3].includes(this.setsToWin)) {
            this.setsToWin = 3;
        }

        this.team1 = undefined; this.team2 = undefined;
        this.teamMatchSubType = undefined; this.teamMatchEncounterFormat = undefined;
        this.numberOfSets = undefined;
        this.score.setDetails = [];
    } else {
        return next(new Error(`Unknown matchType: ${this.matchType}`));
    }
    next();
});

module.exports = mongoose.model('Match', matchSchema);