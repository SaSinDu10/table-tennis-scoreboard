// server/routes/matches.js
const express = require('express');
const router = express.Router();
const Match = require('../models/Match');
const Player = require('../models/Player');
const mongoose = require('mongoose');

// --- Game Logic Constants ---
const POINTS_TO_WIN_GAME = 11;
const POINTS_TO_CHANGE_SERVER = 2;

// --- Function to determine next server ---
const getNextServer = (currentGameScore, currentServer) => {
    const team1Score = currentGameScore?.team1 ?? 0;
    const team2Score = currentGameScore?.team2 ?? 0;
    const totalPoints = team1Score + team2Score;
    if (team1Score >= (POINTS_TO_WIN_GAME - 1) && team2Score >= (POINTS_TO_WIN_GAME - 1)) {
        return currentServer === 1 ? 2 : 1;
    }
    if (totalPoints > 0 && totalPoints % POINTS_TO_CHANGE_SERVER === 0) {
        return currentServer === 1 ? 2 : 1;
    }
    return currentServer;
};

// --- Score update logic (for Individual/Dual and within a TeamSet's set) ---
const updateScoreAndCheckWin = (match, scoringTeam) => {
    if (!match || match.status !== 'Live') { throw new Error('Match is not live or does not exist.'); }
    if (!match.score) match.score = { currentGame: { team1: 0, team2: 0 }, currentSetScore: { team1: 0, team2: 0 }, sets: [], server: 1, setDetails: [] };
    if (!match.score.currentGame) match.score.currentGame = { team1: 0, team2: 0 };
    if (!match.score.currentSetScore) match.score.currentSetScore = { team1: 0, team2: 0 };
    if (!match.score.sets && (match.matchType === 'Individual' || match.matchType === 'Dual')) match.score.sets = [];
    if (typeof match.score.server !== 'number') match.score.server = 1;
    if (!match.pointHistory) match.pointHistory = [];

    console.log("Cloning score state using JSON method for history...");
    const scoreStateBefore = JSON.parse(JSON.stringify({
        sets: match.score.sets || ((match.matchType === 'Individual' || match.matchType === 'Dual') ? [] : undefined),
        setDetails: match.score.setDetails || [],
        currentGame: { team1: match.score.currentGame.team1 ?? 0, team2: match.score.currentGame.team2 ?? 0 },
        currentSetScore: { team1: match.score.currentSetScore.team1 ?? 0, team2: match.score.currentSetScore.team2 ?? 0 },
        server: match.score.server ?? 1
    }));
    console.log("DEBUG: scoreStateBefore for history:", JSON.stringify(scoreStateBefore, null, 2));
    if (!scoreStateBefore || !scoreStateBefore.currentGame || typeof scoreStateBefore.currentGame.team1 === 'undefined' || typeof scoreStateBefore.currentGame.team2 === 'undefined') {
        console.error("!!! CRITICAL ERROR: Cloned scoreStateBefore is missing required fields !!!", scoreStateBefore);
        throw new Error("Internal error: Failed to create valid score state snapshot for history.");
    }
    match.pointHistory.push({ scoringTeam, scoreStateBefore, timestamp: new Date() });

    const currentScore = match.score.currentGame;
    const overallSetScore = match.score.currentSetScore;
    const setsToWinMatch = match.matchType === 'TeamSet' ? Math.ceil((match.numberOfSets || 1) / 2) : match.setsToWin;

    if (scoringTeam === 1) currentScore.team1++; else currentScore.team2++;

    let gameWinner = null;
    if (currentScore.team1 >= POINTS_TO_WIN_GAME && currentScore.team1 >= currentScore.team2 + 2) gameWinner = 1;
    else if (currentScore.team2 >= POINTS_TO_WIN_GAME && currentScore.team2 >= currentScore.team1 + 2) gameWinner = 2;

    if (gameWinner) {
        if (match.matchType === 'Individual' || match.matchType === 'Dual') {
            if (!match.score.sets) match.score.sets = [];
            match.score.sets.push([currentScore.team1, currentScore.team2]);
            if (gameWinner === 1) overallSetScore.team1++; else overallSetScore.team2++;
        } else if (match.matchType === 'TeamSet') {
            if (!match.score.sets) match.score.sets = [];
            match.score.sets.push([currentScore.team1, currentScore.team2]);
        }
        currentScore.team1 = 0; currentScore.team2 = 0;
        match.score.server = gameWinner === 1 ? 2 : 1;

        if (match.matchType === 'Individual' || match.matchType === 'Dual') {
            let matchWinner = null;
            if (overallSetScore.team1 === setsToWinMatch) matchWinner = 1;
            else if (overallSetScore.team2 === setsToWinMatch) matchWinner = 2;
            if (matchWinner) {
                match.status = 'Finished'; match.endTime = new Date();
                match.winner = match.matchType === 'Individual' ? (matchWinner === 1 ? match.player1 : match.player2) : matchWinner;
                console.log(`Ind/Dual Match ${match._id} finished. Winner: Team ${matchWinner}`);
            } else { console.log(`Ind/Dual Game finished for Match ${match._id}. Winner: Team ${gameWinner}. Set score: ${overallSetScore.team1}-${overallSetScore.team2}`); }
        }
    } else { match.score.server = getNextServer(currentScore, match.score.server); }

    match.markModified('score'); match.markModified('pointHistory');
    return match;
};

// === API Route Handlers ===

// --- GET /api/matches ---
router.get('/', async (req, res) => {
    console.log('--- GET /api/matches ROUTE HIT ---');
    try {
        const filter = {};
        if (req.query.status && ['Upcoming', 'Live', 'Finished', 'Cancelled', 'AwaitingSetPairs', 'AwaitingTiebreakerPairs'].includes(req.query.status)) {
            filter.status = req.query.status;
        }
        if (req.query.matchType) {
            if (Array.isArray(req.query.matchType)) { filter.matchType = { $in: req.query.matchType }; }
            else { filter.matchType = req.query.matchType; }
        }
        console.log(`Filtering matches by: ${JSON.stringify(filter)}`);
        let query = Match.find(filter);
        const matchesForTypeCheck = await Match.find(filter).select('matchType').limit(1).lean();
        if (matchesForTypeCheck.length > 0) {
            if (matchesForTypeCheck[0].matchType === 'TeamSet') {
                query = query.populate([{ path: 'team1', select: 'name' }, { path: 'team2', select: 'name' }]);
            } else {
                query = query.populate('player1 player2 player3 player4', 'name category'); // Added category for Ind/Dual list
            }
        }
        const matches = await query.sort({ createdAt: -1 }).exec();
        console.log(`Found ${matches.length} matches.`);
        res.json(matches);
    } catch (err) {
        console.error("!!! ERROR in GET /api/matches:", err);
        res.status(500).json({ message: 'Server Error fetching matches' });
    }
});

// --- GET /api/matches/:id ---
router.get('/:id', async (req, res) => {
    console.log(`--- GET /api/matches/${req.params.id} ROUTE HIT ---`);
    try {
        let match = await Match.findById(req.params.id);
        if (!match) { return res.status(404).json({ message: 'Match not found' }); }
        if (match.matchType === 'TeamSet') {
            match = await match.populate([
                { path: 'team1', populate: { path: 'players', select: 'name photoUrl category _id' } },
                { path: 'team2', populate: { path: 'players', select: 'name photoUrl category _id' } },
                { path: 'score.setDetails.team1Pair', select: 'name photoUrl category _id' },
                { path: 'score.setDetails.team2Pair', select: 'name photoUrl category _id' }
            ]);
        } else { match = await match.populate('player1 player2 player3 player4'); }
        console.log(`Found match: ${match._id}`);
        res.json(match);
    } catch (err) {
        console.error(`!!! ERROR in GET /api/matches/${req.params.id}:`, err);
        if (err.name === 'CastError') { return res.status(400).json({ message: 'Invalid Match ID format' }); }
        res.status(500).json({ message: 'Server Error fetching match details' });
    }
});

// --- POST /api/matches --- (Create new match)
router.post('/', async (req, res) => {
    console.log('--- POST /api/matches ROUTE HIT ---');
    console.log('Request Body:', req.body);
    const {
        category, // This will be sent for Ind/Dual, but not for TeamSet
        matchType,
        player1Id, player2Id, player3Id, player4Id, bestOf,
        team1Id, team2Id, teamMatchSubType, teamMatchEncounterFormat, numberOfSets, maxSetsPerPlayer
    } = req.body;

    try {
        let newMatchData = {
            matchType,
            status: 'Upcoming',
            score: { setDetails: [], currentGame: { team1: 0, team2: 0 }, currentSetScore: { team1: 0, team2: 0 }, server: 1 },
            pointHistory: []
        };

        if (matchType === 'TeamSet') {
            console.log('Creating TeamSet Match...');
            // --- VALIDATION WITHOUT CATEGORY ---
            if (!team1Id || !team2Id || !teamMatchSubType || !teamMatchEncounterFormat) {
                return res.status(400).json({ message: 'Team IDs, sub-type, and encounter format are required for TeamSet.' });
            }
            // ------------------------------------
            if (team1Id === team2Id) { return res.status(400).json({ message: 'Team 1 and Team 2 must be different.' }); }

            newMatchData.team1 = team1Id;
            newMatchData.team2 = team2Id;
            newMatchData.teamMatchSubType = teamMatchSubType;
            newMatchData.teamMatchEncounterFormat = teamMatchEncounterFormat;
            if (teamMatchSubType === 'Set') {
                if (!numberOfSets || parseInt(numberOfSets, 10) < 1) { return res.status(400).json({ message: 'Number of sets is required.' }); }
                newMatchData.numberOfSets = parseInt(numberOfSets, 10);
            }
            newMatchData.maxSetsPerPlayer = maxSetsPerPlayer || 2;
            // NOTE: 'category' is NOT assigned to newMatchData here.

        } else { // Individual or Dual
            console.log('Creating Individual/Dual Match...');
            // Category IS required for Individual/Dual
            if (!category || !player1Id || !player2Id || !bestOf) {
                return res.status(400).json({ message: 'Missing required fields: category, players, and bestOf are required for Ind/Dual.' });
            }
            newMatchData.category = category; // Assign category
            if (matchType === 'Dual' && (!player3Id || !player4Id)) { return res.status(400).json({ message: 'Player 3/4 IDs required for Dual.' }); }
            let setsToWinValue;
            switch (parseInt(bestOf, 10)) {
                case 1: setsToWinValue = 1; break;
                case 3: setsToWinValue = 2; break;
                case 5: setsToWinValue = 3; break;
                default: return res.status(400).json({ message: 'Invalid bestOf value.' });
            }
            newMatchData.player1 = player1Id;
            newMatchData.player2 = player2Id;
            newMatchData.player3 = matchType === 'Dual' ? player3Id : null;
            newMatchData.player4 = matchType === 'Dual' ? player4Id : null;
            newMatchData.setsToWin = setsToWinValue;
        }

        const newMatch = new Match(newMatchData);
        const savedMatch = await newMatch.save(); // Pre-save hook will run and clear category for TeamSet
        console.log(`Match saved successfully: ${savedMatch._id}`);

        let populatedMatch = await Match.findById(savedMatch._id);
        if (populatedMatch.matchType === 'TeamSet') {
            populatedMatch = await populatedMatch.populate([
                { path: 'team1', populate: { path: 'players', select: 'name photoUrl category _id' } },
                { path: 'team2', populate: { path: 'players', select: 'name photoUrl category _id' } }
            ]);
        } else {
            populatedMatch = await populatedMatch.populate('player1 player2 player3 player4');
        }
        res.status(201).json(populatedMatch);

    } catch (err) {
        console.error("!!! ERROR in POST /api/matches:", err);
        if (err.name === 'ValidationError') { return res.status(400).json({ message: err.message }); }
        res.status(500).json({ message: 'Server Error creating match', error: err.message });
    }
});

// --- PUT /api/matches/:id/length --- (For Ind/Dual matches)
router.put('/:id/length', async (req, res) => {
    console.log(`--- PUT /api/matches/${req.params.id}/length ROUTE HIT ---`);
    const { setsToWin } = req.body;
    console.log('Request Body:', req.body);
    if (setsToWin !== 1 && setsToWin !== 2 && setsToWin !== 3) { return res.status(400).json({ message: 'Invalid setsToWin value.' }); }
    try {
        const match = await Match.findById(req.params.id);
        if (!match) { return res.status(404).json({ message: 'Match not found' }); }
        if (match.matchType === 'TeamSet') { return res.status(400).json({ message: 'Match length for TeamSet is numberOfSets, not updatable here.' }); }
        if (match.status !== 'Upcoming') { return res.status(400).json({ message: `Cannot change length for ${match.status} match.` }); }
        match.setsToWin = setsToWin;
        const updatedMatch = await match.save();
        await updatedMatch.populate('player1 player2 player3 player4');
        res.json(updatedMatch);
    } catch (err) {
        console.error(`!!! ERROR in PUT /api/matches/${req.params.id}/length:`, err);
        res.status(500).json({ message: 'Server Error updating match length', error: err.message });
    }
});

// --- DELETE /api/matches/:id ---
router.delete('/:id', async (req, res) => {
    console.log(`--- DELETE /api/matches/${req.params.id} ROUTE HIT ---`);
    try {
        const match = await Match.findById(req.params.id);
        if (!match) { return res.status(404).json({ message: 'Match not found' }); }
        if (match.status !== 'Upcoming') { return res.status(400).json({ message: `Cannot delete match with status '${match.status}'.` }); }
        await Match.findByIdAndDelete(req.params.id);
        console.log(`Match ${req.params.id} deleted successfully.`);
        res.status(200).json({ message: 'Match deleted successfully', deletedMatchId: req.params.id });
    } catch (err) {
        console.error(`!!! ERROR in DELETE /api/matches/${req.params.id}:`, err);
        res.status(500).json({ message: 'Server Error deleting match', error: err.message });
    }
});

// --- PUT /api/matches/:id/start --- (For Individual/Dual)
router.put('/:id/start', async (req, res) => {
    console.log(`--- PUT /api/matches/${req.params.id}/start ROUTE HIT ---`);
    const { initialServer } = req.body;
    console.log('Request Body:', req.body);
    if (initialServer !== 1 && initialServer !== 2) { return res.status(400).json({ message: 'Invalid initialServer value.' }); }
    try {
        const match = await Match.findById(req.params.id);
        if (!match) { return res.status(404).json({ message: 'Match not found' }); }
        if (match.matchType === 'TeamSet') { return res.status(400).json({ message: 'TeamSet matches started via /setup_set.' }); }
        if (match.status !== 'Upcoming') { return res.status(400).json({ message: `Match status: ${match.status}` }); }
        match.status = 'Live'; match.startTime = new Date();
        if (!match.score) match.score = {};
        match.score.server = initialServer;
        match.score.currentGame = { team1: 0, team2: 0 };
        match.score.currentSetScore = { team1: 0, team2: 0 };
        if (match.matchType === 'Individual' || match.matchType === 'Dual') match.score.sets = [];
        match.pointHistory = [];
        match.markModified('score'); match.markModified('pointHistory');
        const updatedMatch = await match.save();
        await updatedMatch.populate('player1 player2 player3 player4');
        res.json(updatedMatch);
    } catch (err) {
        console.error(`!!! ERROR in PUT /api/matches/${req.params.id}/start:`, err);
        res.status(500).json({ message: 'Server Error starting match', error: err.message });
    }
});

// --- PUT /api/matches/:id/setup_set --- (For TeamSet Matches)
router.put('/:id/setup_set', async (req, res) => {
    const { setIndex, team1PairIds, team2PairIds, initialServer } = req.body;
    const matchId = req.params.id;
    console.log(`--- PUT /api/matches/${matchId}/setup_set (Set ${setIndex + 1}) ROUTE HIT ---`);
    console.log('Request Body:', req.body);

    if (typeof setIndex !== 'number' || setIndex < 0 || !team1PairIds || !team2PairIds || team1PairIds.length === 0 || team2PairIds.length === 0 || (initialServer !== 1 && initialServer !== 2)) {
        return res.status(400).json({ message: 'Invalid input: requires setIndex, valid player pairs, and initialServer.' });
    }

    try {
        const match = await Match.findById(matchId)
            .populate({ path: 'team1', populate: { path: 'players', select: 'name _id category' } })
            .populate({ path: 'team2', populate: { path: 'players', select: 'name _id category' } });

        if (!match) { return res.status(404).json({ message: 'Match not found.' }); }
        if (match.matchType !== 'TeamSet') { return res.status(400).json({ message: 'This operation is only for TeamSet matches.' }); }

        const expectedPairSize = match.teamMatchEncounterFormat === 'Singles' ? 1 : 2;
        if (team1PairIds.length !== expectedPairSize || team2PairIds.length !== expectedPairSize) {
            return res.status(400).json({ message: `Each pair must have ${expectedPairSize} player(s) for ${match.teamMatchEncounterFormat} format.` });
        }

        const finishedSetsCount = match.score.setDetails?.filter(s => s.status === 'Finished').length || 0;
        const expectedStatus = (finishedSetsCount === 0 && setIndex === 0 && match.status === 'Upcoming') ? 'Upcoming' : 'AwaitingSetPairs';
        const isTiebreakerSetup = match.status === 'AwaitingTiebreakerPairs' && setIndex === match.numberOfSets;

        if (match.status !== expectedStatus && !isTiebreakerSetup) {
            return res.status(400).json({ message: `Cannot setup set. Match status: '${match.status}'. Expected '${expectedStatus}' or AwaitingTiebreakerPairs for tiebreaker.` });
        }
        if (!isTiebreakerSetup && setIndex >= match.numberOfSets) {
            return res.status(400).json({ message: `Invalid set index ${setIndex}. Match has ${match.numberOfSets} regular sets.` });
        }
        // Player Usage Validation (Simplified, needs robust partner check for doubles)
        const playerSetCounts = new Map();
        (match.score?.setDetails || []).forEach(detail => {
            if (detail.status === 'Finished') {
                [...(detail.team1Pair || []), ...(detail.team2Pair || [])].forEach(pIdObj => {
                    if (pIdObj) playerSetCounts.set(pIdObj.toString(), (playerSetCounts.get(pIdObj.toString()) || 0) + 1);
                });
            }
        });
        for (const playerId of [...team1PairIds, ...team2PairIds]) {
            const currentCount = playerSetCounts.get(playerId.toString()) || 0;
            // --- Use the dynamic maxSetsPerPlayer from the match document ---
            if (currentCount >= match.maxSetsPerPlayer && !isTiebreakerSetup) {
                const pDoc = await Player.findById(playerId).select('name').lean();
                return res.status(400).json({ message: `Player ${pDoc?.name || playerId} has already played the maximum of ${match.maxSetsPerPlayer} sets.` });
            }
            /////////////////

            // TODO: Add robust partner validation if teamMatchEncounterFormat is 'Doubles'
            const playerOnTeam1 = match.team1.players.some(p => p._id.equals(playerId));
            const playerOnTeam2 = match.team2.players.some(p => p._id.equals(playerId));
            if (team1PairIds.includes(playerId) && !playerOnTeam1) { const pDoc = await Player.findById(playerId).lean(); return res.status(400).json({ message: `Player ${pDoc?.name || playerId} not on ${match.team1.name}.` }); }
            if (team2PairIds.includes(playerId) && !playerOnTeam2) { const pDoc = await Player.findById(playerId).lean(); return res.status(400).json({ message: `Player ${pDoc?.name || playerId} not on ${match.team2.name}.` }); }
        }


        if (!match.score.setDetails) match.score.setDetails = [];
        while (match.score.setDetails.length <= setIndex) {
            match.score.setDetails.push({ setIndex: match.score.setDetails.length, status: 'Pending', team1Pair: [], team2Pair: [] });
        }
        match.score.setDetails[setIndex] = {
            setIndex: setIndex,
            team1Pair: team1PairIds.map(id => new mongoose.Types.ObjectId(id)),
            team2Pair: team2PairIds.map(id => new mongoose.Types.ObjectId(id)),
            team1Score: null, team2Score: null, status: 'Live'
        };
        match.score.currentGame = { team1: 0, team2: 0 };
        match.score.server = initialServer;
        match.status = 'Live';
        match.markModified('score');

        const updatedMatch = await match.save();
        console.log(`Match ${updatedMatch._id} Set ${setIndex + 1} ready, server: ${initialServer}.`);
        await updatedMatch.populate([
            { path: 'team1', populate: { path: 'players', select: 'name photoUrl category _id' } },
            { path: 'team2', populate: { path: 'players', select: 'name photoUrl category _id' } },
            { path: 'score.setDetails.team1Pair', select: 'name photoUrl category _id' },
            { path: 'score.setDetails.team2Pair', select: 'name photoUrl category _id' }
        ]);
        res.json(updatedMatch);
    } catch (err) {
        console.error(`!!! ERROR in PUT /api/matches/${matchId}/setup_set:`, err);
        res.status(500).json({ message: err.message || 'Server Error setting up set' });
    }
});

// --- PUT /api/matches/:id/score --- (Handles all match types)
router.put('/:id/score', async (req, res) => {
    console.log(`--- PUT /api/matches/${req.params.id}/score ROUTE HIT ---`);
    const { scoringTeam } = req.body;
    console.log('Request Body:', req.body);
    if (!scoringTeam || (scoringTeam !== 1 && scoringTeam !== 2)) { return res.status(400).json({ message: 'Invalid scoring team.' }); }
    try {
        let match = await Match.findById(req.params.id);
        if (!match) { return res.status(404).json({ message: 'Match not found' }); }
        if (match.status !== 'Live') { return res.status(400).json({ message: `Match status: ${match.status}` }); }
        if (match.status === 'Finished') { return res.status(400).json({ message: 'Match is already finished.' }); }

        try { match = updateScoreAndCheckWin(match, scoringTeam); }
        catch (updateError) { console.error("!!! ERROR during score update logic:", updateError); return res.status(500).json({ message: updateError.message }); }

        if (match.matchType === 'TeamSet') {
            const currentSetIndex = match.score.setDetails.findIndex(s => s.status === 'Live');
            const gameJustFinishedWithinSet = match.score.currentGame.team1 === 0 && match.score.currentGame.team2 === 0 &&
                currentSetIndex !== -1 && match.score.setDetails[currentSetIndex].status === 'Live';
            if (gameJustFinishedWithinSet) {
                const lastGameScore = match.score.sets.pop();
                match.score.setDetails[currentSetIndex].team1Score = lastGameScore[0];
                match.score.setDetails[currentSetIndex].team2Score = lastGameScore[1];
                match.score.setDetails[currentSetIndex].status = 'Finished';
                if (lastGameScore[0] > lastGameScore[1]) { match.score.currentSetScore.team1 = (match.score.currentSetScore.team1 || 0) + 1; }
                else { match.score.currentSetScore.team2 = (match.score.currentSetScore.team2 || 0) + 1; }

                const team1SetsWon = match.score.currentSetScore.team1;
                const team2SetsWon = match.score.currentSetScore.team2;
                const totalSetsPlayed = match.score.setDetails.filter(s => s.status === 'Finished').length;
                console.log(`TeamSet: Set ${currentSetIndex + 1} finished. Overall Sets: ${team1SetsWon}-${team2SetsWon}. Total Played: ${totalSetsPlayed}`);

                if (match.status !== 'Finished') {
                    const setsNeededToWinMatch = Math.ceil((match.numberOfSets || 1) / 2);
                    if (team1SetsWon >= setsNeededToWinMatch || team2SetsWon >= setsNeededToWinMatch) {
                        match.status = 'Finished'; match.winner = team1SetsWon > team2SetsWon ? 1 : 2; match.endTime = new Date();
                        console.log(`TeamSet Match ${match._id} finished by sets. Winner: Team ${match.winner}`);
                    } else if (totalSetsPlayed >= match.numberOfSets) {
                        if (team1SetsWon === team2SetsWon && match.numberOfSets % 2 === 0 && match.numberOfSets > 0) {
                            match.status = 'AwaitingTiebreakerPairs'; console.log(`TeamSet Match ${match._id} requires tie-breaker.`);
                        } else {
                            match.status = 'Finished'; match.winner = team1SetsWon > team2SetsWon ? 1 : 2; match.endTime = new Date();
                            console.log(`TeamSet Match ${match._id} finished after ${match.numberOfSets} sets. Winner: Team ${match.winner}`);
                        }
                    } else { match.status = 'AwaitingSetPairs'; console.log(`TeamSet Match ${match._id} awaiting pairs for set ${totalSetsPlayed + 1}.`); }
                }
                match.markModified('score.setDetails');
            }
        }
        const updatedMatch = await match.save();
        if (updatedMatch.matchType === 'TeamSet') { await updatedMatch.populate([{ path: 'team1', populate: { path: 'players', select: 'name photoUrl category _id' } }, { path: 'team2', populate: { path: 'players', select: 'name photoUrl category _id' } }, { path: 'score.setDetails.team1Pair', select: 'name photoUrl category _id' }, { path: 'score.setDetails.team2Pair', select: 'name photoUrl category _id' }]); }
        else { await updatedMatch.populate('player1 player2 player3 player4'); }
        res.json(updatedMatch);
    } catch (err) {
        console.error(`!!! ERROR in PUT /api/matches/${req.params.id}/score:`, err);
        if (err.name === 'ValidationError') { return res.status(400).json({ message: err.message }); }
        res.status(500).json({ message: err.message || 'Server Error updating score' });
    }
});


// --- PUT /api/matches/:id/undo --- (Handles all match types, with TeamSet complexity note)
router.put('/:id/undo', async (req, res) => {
    console.log(`--- PUT /api/matches/${req.params.id}/undo ROUTE HIT ---`);
    try {
        const match = await Match.findById(req.params.id);
        if (!match) { return res.status(404).json({ message: 'Match not found' }); }
        if (match.status !== 'Live') { return res.status(400).json({ message: `Cannot undo point for status: ${match.status}` }); }
        if (!match.pointHistory || match.pointHistory.length === 0) { return res.status(400).json({ message: 'No points to undo.' }); }

        console.log(`Reverting last point for match ${match._id}...`);
        const lastPoint = match.pointHistory.pop();

        // Restore score state from the history snapshot
        match.score.sets = lastPoint.scoreStateBefore.sets ?? ((match.matchType === 'Individual' || match.matchType === 'Dual') ? [] : undefined);
        match.score.setDetails = lastPoint.scoreStateBefore.setDetails ?? [];
        match.score.currentGame = { ...(lastPoint.scoreStateBefore.currentGame ?? { team1: 0, team2: 0 }) };
        match.score.currentSetScore = { ...(lastPoint.scoreStateBefore.currentSetScore ?? { team1: 0, team2: 0 }) };
        match.score.server = lastPoint.scoreStateBefore.server ?? 1;

        // Simple status revert if the undone point finished the match
        if (match.status === 'Finished') {
            match.status = 'Live';
            match.winner = undefined;
            match.endTime = undefined;
        }
        console.warn("UNDO for TeamSet: Set status within setDetails might need manual review if a set-ending point was undone.");


        match.markModified('score');
        match.markModified('pointHistory');
        const updatedMatch = await match.save();
        console.log(`Match ${updatedMatch._id} state reverted and saved successfully.`);

        console.log("--- DEBUG: Match object AFTER save, BEFORE populate ---");
        if (updatedMatch.matchType === 'TeamSet' && updatedMatch.score.setDetails[0]) {
            console.log("setDetails[0].team1Pair (before populate):", updatedMatch.score.setDetails[0].team1Pair);
            console.log("setDetails[0].team2Pair (before populate):", updatedMatch.score.setDetails[0].team2Pair);
        }

        // Add full population before sending the response
        if (updatedMatch.matchType === 'TeamSet') {
            console.log("Attempting to populate TeamSet match for undo response...");
            await updatedMatch.populate([
                { path: 'team1', populate: { path: 'players', select: 'name photoUrl category _id' } },
                { path: 'team2', populate: { path: 'players', select: 'name photoUrl category _id' } },
                { path: 'score.setDetails.team1Pair', select: 'name photoUrl category _id' },
                { path: 'score.setDetails.team2Pair', select: 'name photoUrl category _id' }
            ]);
        } else {
            console.log("Attempting to populate Ind/Dual match for undo response...");
            await updatedMatch.populate('player1 player2 player3 player4');
        }
        console.log('Players populated for undo response.');

        console.log("--- DEBUG: Match object AFTER populate ---");
        if (updatedMatch.matchType === 'TeamSet' && updatedMatch.score.setDetails[0]) {
            console.log("setDetails[0].team1Pair (after populate):", updatedMatch.score.setDetails[0].team1Pair);
            console.log("setDetails[0].team2Pair (after populate):", updatedMatch.score.setDetails[0].team2Pair);
        }
        res.json(updatedMatch);

    } catch (err) {
        console.error(`!!! ERROR in PUT /api/matches/${req.params.id}/undo:`, err);
        res.status(500).json({ message: err.message || 'Server Error undoing point' });
    }
});

module.exports = router;