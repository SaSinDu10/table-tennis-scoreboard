// server/models/Match.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// --- Sub-schema for Point History (for Undo) ---
const pointHistorySchema = new Schema({
    timestamp: { type: Date, default: Date.now },
    scoringTeam: { type: Number, required: true, enum: [1, 2] },
    scoreStateBefore: {
    }
}, { _id: false });

// --- Sub-schema for 'Set Match' Details ---
const setDetailSchema = new Schema({
    setIndex: { type: Number, required: true },
    team1Pair: [{ type: Schema.Types.ObjectId, ref: 'Player' }],
    team2Pair: [{ type: Schema.Types.ObjectId, ref: 'Player' }],
    team1Score: { type: Number, default: null },
    team2Score: { type: Number, default: null },
    status: { type: String, enum: ['Pending', 'Live', 'Finished'], default: 'Pending' }
}, { _id: false });

// --- NEW: Sub-schema for 'Relay Match' Legs ---
const relayLegSchema = new Schema({
    legNumber: { type: Number, required: true },
    team1Players: [{ type: Schema.Types.ObjectId, ref: 'Player' }],
    team2Players: [{ type: Schema.Types.ObjectId, ref: 'Player' }],
    endScoreTeam1: { type: Number },
    endScoreTeam2: { type: Number },
    status: { type: String, enum: ['Pending', 'Live', 'Finished'], default: 'Pending' }
}, { _id: false });

// --- Main Match Schema ---
const matchSchema = new Schema({
    matchType: {
        type: String,
        enum: ['Individual', 'Dual', 'Team'],
        required: true
    },
    teamMatchSubType: {
        type: String,
        enum: ['Set', 'Relay'],
    },
    teamMatchEncounterFormat: {
        type: String,
        enum: ['Individual', 'Dual'],
    },
    
    setPointTarget: { // Only for Relay Matches
        type: Number
    },

    category: { 
        type: String, 
        enum: ['Super Senior', 'Senior', 'Junior'] 
    },

    // --- Fields for Individual/Dual Matches ---
    player1: { type: Schema.Types.ObjectId, ref: 'Player' },
    player2: { type: Schema.Types.ObjectId, ref: 'Player' },
    player3: { type: Schema.Types.ObjectId, ref: 'Player' },
    player4: { type: Schema.Types.ObjectId, ref: 'Player' },
    setsToWin: { type: Number },

    // --- Fields for Team Matches ---
    team1: { type: Schema.Types.ObjectId, ref: 'Team' },
    team2: { type: Schema.Types.ObjectId, ref: 'Team' },
    numberOfSets: { type: Number },
    maxSetsPerPlayer: { type: Number, default: 2 },

    score: {
        // For Ind/Dual
        sets: { type: [[Number]], default: [] },

        // For 'Set' sub-type Team Matches
        setDetails: [setDetailSchema],

        // For 'Relay' sub-type Team Matches
        relayLegs: [relayLegSchema],
        overallScore: {
            team1: { type: Number, default: 0 },
            team2: { type: Number, default: 0 }
        },

        // Score within the *current live game*
        currentGame: { team1: { type: Number, default: 0 }, team2: { type: Number, default: 0 } },

        // For Team 'Set' Matches
        currentSetScore: { team1: { type: Number, default: 0 }, team2: { type: Number, default: 0 } },

        // Server for the current live game
        server: { type: Number, enum: [1, 2], default: 1 }
    },

    pointHistory: [pointHistorySchema],
    status: {
        type: String,
        enum: ['Upcoming', 'Live', 'Finished', 'Cancelled', 'AwaitingSubMatchSetup', 'AwaitingTiebreakerPairs'],
        default: 'Upcoming'
    },
    winner: { type: Schema.Types.Mixed },
    startTime: { type: Date },
    endTime: { type: Date }
}, { timestamps: true });

// --- Pre-save hook needs to be updated for 'Team' type ---
matchSchema.pre('save', function(next) {
    if (this.matchType === 'Team') {
        if (!this.team1 || !this.team2 || !this.teamMatchSubType || !this.teamMatchEncounterFormat) {
            return next(new Error('Teams, sub-type, and encounter format are required for Team matches.'));
        }
        if (this.teamMatchSubType === 'Set' && (!this.numberOfSets || this.numberOfSets < 1)) {
            return next(new Error('Number of sets is required for "Set" type team matches.'));
        }
        if (this.teamMatchSubType === 'Relay' && (!this.numberOfSets || this.numberOfSets < 1 || !this.setPointTarget || this.setPointTarget < 1)) {
            return next(new Error('Number of sets/legs and points per set/leg are required for "Relay" type team matches.'));
        }
        // Clear incompatible fields
        this.player1 = this.player2 = this.player3 = this.player4 = this.setsToWin = undefined;
    } else { // Individual/Dual
        if (!this.player1 || !this.player2 || !this.category) {
            return next(new Error('Category and players are required for Individual/Dual matches.'));
        }
        // Clear incompatible fields
        this.team1 = this.team2 = this.teamMatchSubType = this.teamMatchEncounterFormat = this.numberOfSets = this.setPointTarget = undefined;
        this.score.relayLegs = undefined;
        this.score.overallScore = undefined;
        this.score.setDetails = undefined;
    }
    next();
});

module.exports = mongoose.model('Match', matchSchema);