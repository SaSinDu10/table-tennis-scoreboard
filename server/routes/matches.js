// server/routes/matches.js
const express = require('express');
const router = express.Router();
const Match = require('../models/Match'); // Ensure path is correct
const Player = require('../models/Player'); // Ensure path is correct
const mongoose = require('mongoose'); // Needed for deep cloning score

// --- Game Logic Constants ---
const POINTS_TO_WIN_GAME = 11;
const POINTS_TO_CHANGE_SERVER = 2;

// --- Function to determine next server ---
const getNextServer = (currentGameScore, currentServer) => {
    const team1Score = currentGameScore?.team1 ?? 0;
    const team2Score = currentGameScore?.team2 ?? 0;
    const totalPoints = team1Score + team2Score;
    // Deuce rule
    if (team1Score >= (POINTS_TO_WIN_GAME - 1) && team2Score >= (POINTS_TO_WIN_GAME - 1)) {
        return currentServer === 1 ? 2 : 1;
    }
    // Normal change rule
    if (totalPoints > 0 && totalPoints % POINTS_TO_CHANGE_SERVER === 0) {
        return currentServer === 1 ? 2 : 1;
    }
    return currentServer; // No change
};

// --- Score update logic (includes history and server update) ---
const updateScoreAndCheckWin = (match, scoringTeam) => {
    if (!match || match.status !== 'Live') { throw new Error('Match is not live or does not exist.'); }
    if (!match.score) match.score = {};
    if (!match.score.currentGame) match.score.currentGame = { team1: 0, team2: 0 };
    if (!match.score.currentSetScore) match.score.currentSetScore = { team1: 0, team2: 0 };
    if (!match.score.sets) match.score.sets = [];
    if (typeof match.score.server !== 'number') match.score.server = 1;
    if (!match.pointHistory) match.pointHistory = [];

    // Create history entry BEFORE updating score
    console.log("Cloning score state using JSON method...");
    const scoreStateBefore = JSON.parse(JSON.stringify({
        sets: match.score.sets || [],
        currentGame: {
            team1: match.score.currentGame.team1 ?? 0,
            team2: match.score.currentGame.team2 ?? 0
        },
        currentSetScore: {
            team1: match.score.currentSetScore.team1 ?? 0,
            team2: match.score.currentSetScore.team2 ?? 0
        },
        server: match.score.server ?? 1
    }));
    console.log("DEBUG: scoreStateBefore for history:", JSON.stringify(scoreStateBefore, null, 2));
    // Optional validation before push
    if (!scoreStateBefore || !scoreStateBefore.currentGame || typeof scoreStateBefore.currentGame.team1 === 'undefined' || typeof scoreStateBefore.currentGame.team2 === 'undefined') {
        console.error("!!! CRITICAL ERROR: Cloned scoreStateBefore is missing required fields !!!", scoreStateBefore);
        throw new Error("Internal error: Failed to create valid score state snapshot for history.");
    }
    match.pointHistory.push({ scoringTeam, scoreStateBefore, timestamp: new Date() });

    // Update scores and server
    const currentScore = match.score.currentGame;
    const setScore = match.score.currentSetScore;
    const setsArray = match.score.sets;
    const setsToWinMatch = match.setsToWin;
    const currentServer = match.score.server;

    if (scoringTeam === 1) currentScore.team1++; else currentScore.team2++;

    let gameWinner = null;
    if (currentScore.team1 >= POINTS_TO_WIN_GAME && currentScore.team1 >= currentScore.team2 + 2) gameWinner = 1;
    else if (currentScore.team2 >= POINTS_TO_WIN_GAME && currentScore.team2 >= currentScore.team1 + 2) gameWinner = 2;

    if (gameWinner) { // Game finished
        if (gameWinner === 1) setScore.team1++; else setScore.team2++;
        setsArray.push([currentScore.team1, currentScore.team2]);
        currentScore.team1 = 0; currentScore.team2 = 0;
        match.score.server = gameWinner === 1 ? 2 : 1; // Next server

        let matchWinner = null; // Check match win
        if (setScore.team1 === setsToWinMatch) matchWinner = 1;
        else if (setScore.team2 === setsToWinMatch) matchWinner = 2;

        if (matchWinner) { // Match finished
            match.status = 'Finished';
            match.endTime = new Date();
            match.winner = match.matchType === 'Individual' ? (matchWinner === 1 ? match.player1 : match.player2) : matchWinner;
            console.log(`Match ${match._id} finished. Winner: Team ${matchWinner}`);
        } else {
            console.log(`Game finished for Match ${match._id}. Winner: Team ${gameWinner}. Set score: ${setScore.team1}-${setScore.team2}`);
        }
    } else { // Game not finished
        match.score.server = getNextServer(currentScore, currentServer);
    }

    match.markModified('score');
    match.markModified('pointHistory');
    return match;
};


// === API Route Handlers ===

// --- GET /api/matches --- (Fetch multiple matches, filter by status)
router.get('/', async (req, res) => {
    console.log('--- GET /api/matches ROUTE HIT ---');
    try {
        const filter = {};
        if (req.query.status && ['Upcoming', 'Live', 'Finished', 'Cancelled'].includes(req.query.status)) {
            filter.status = req.query.status;
            console.log(`Filtering matches by status: ${filter.status}`);
        }
        const matches = await Match.find(filter)
            .populate('player1 player2 player3 player4')
            .sort({ createdAt: -1 });
        console.log(`Found ${matches.length} matches for status '${req.query.status || 'any'}'.`);
        res.json(matches);
    } catch (err) {
        console.error("!!! ERROR in GET /api/matches:", err);
        res.status(500).json({ message: 'Server Error fetching matches' });
    }
});

// --- GET /api/matches/:id --- (Fetch a single match by ID)
router.get('/:id', async (req, res) => {
    console.log(`--- GET /api/matches/${req.params.id} ROUTE HIT ---`);
    try {
        const match = await Match.findById(req.params.id)
            .populate('player1 player2 player3 player4');
        if (!match) {
            console.log(`Match not found: ${req.params.id}`);
            return res.status(404).json({ message: 'Match not found' });
        }
        console.log(`Found match: ${match._id}`);
        res.json(match);
    } catch (err) {
        console.error(`!!! ERROR in GET /api/matches/${req.params.id}:`, err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid Match ID format' });
        }
        res.status(500).json({ message: 'Server Error fetching match details' });
    }
});

// --- POST /api/matches --- (Create a new match)
router.post('/', async (req, res) => {
    console.log('--- POST /api/matches ROUTE HIT ---');
    console.log('Request Body:', req.body);
    const { category, matchType, player1Id, player2Id, player3Id, player4Id, bestOf } = req.body;
    try {
        console.log('Validating input...');
        if (!category || !matchType || !player1Id || !player2Id || !bestOf) { return res.status(400).json({ message: 'Missing required fields.' }); }
        if (matchType === 'Dual' && (!player3Id || !player4Id)) { return res.status(400).json({ message: 'Player 3/4 IDs required for Dual.' }); }

        let setsToWinValue;
        switch (parseInt(bestOf, 10)) {
            case 1: setsToWinValue = 1; break;
            case 3: setsToWinValue = 2; break;
            case 5: setsToWinValue = 3; break;
            default: return res.status(400).json({ message: 'Invalid bestOf value.' });
        }
        console.log(`Calculated setsToWin: ${setsToWinValue}`);

        const newMatch = new Match({
            category, matchType, player1: player1Id, player2: player2Id,
            player3: matchType === 'Dual' ? player3Id : null,
            player4: matchType === 'Dual' ? player4Id : null,
            setsToWin: setsToWinValue, status: 'Upcoming'
        });

        console.log('Attempting to save new match...');
        const savedMatch = await newMatch.save();
        console.log(`Match saved successfully: ${savedMatch._id}`);
        await savedMatch.populate('player1 player2 player3 player4');
        console.log('Players populated for response.');
        res.status(201).json(savedMatch);

    } catch (err) {
        console.error("!!! ERROR in POST /api/matches:", err);
        if (err.name === 'ValidationError') { return res.status(400).json({ message: 'Validation failed', error: err.message }); }
        res.status(500).json({ message: 'Server Error creating match', error: err.message });
    }
});

// --- PUT /api/matches/:id/length --- (Update match length)
router.put('/:id/length', async (req, res) => {
    //console.log(`--- PUT /api/matches/${req.params.id}/length ROUTE HIT ---`);
    const { setsToWin } = req.body;
    //console.log('Request Body:', req.body);
    if (setsToWin !== 1 && setsToWin !== 2 && setsToWin !== 3) { return res.status(400).json({ message: 'Invalid setsToWin value.' }); }
    try {
        //console.log(`Finding match ${req.params.id} to update length...`);
        const match = await Match.findById(req.params.id);
        if (!match) { return res.status(404).json({ message: 'Match not found' }); }
        if (match.status !== 'Upcoming') { return res.status(400).json({ message: `Cannot change length for ${match.status} match.` }); }

        match.setsToWin = setsToWin;
        //console.log(`Updating setsToWin to ${setsToWin}...`);
        const updatedMatch = await match.save();
        //console.log(`Match ${updatedMatch._id} length updated successfully.`);
        await updatedMatch.populate('player1 player2 player3 player4');
        //console.log('Players populated for response.');
        res.json(updatedMatch);

    } catch (err) {
        console.error(`!!! ERROR in PUT /api/matches/${req.params.id}/length:`, err);
        res.status(500).json({ message: 'Server Error updating match length', error: err.message });
    }
});

// --- DELETE /api/matches/:id --- (Delete an upcoming match)
router.delete('/:id', async (req, res) => {
    //console.log(`--- DELETE /api/matches/${req.params.id} ROUTE HIT ---`);
    try {
        //console.log(`Finding match ${req.params.id} to delete...`);
        const match = await Match.findById(req.params.id);
        if (!match) { return res.status(404).json({ message: 'Match not found' }); }
        if (match.status !== 'Upcoming') { return res.status(400).json({ message: `Cannot delete ${match.status} match.` }); }

        //console.log(`Deleting match ${req.params.id}...`);
        await Match.findByIdAndDelete(req.params.id);
        //console.log(`Match ${req.params.id} deleted successfully.`);
        res.status(200).json({ message: 'Match deleted successfully', deletedMatchId: req.params.id });

    } catch (err) {
        console.error(`!!! ERROR in DELETE /api/matches/${req.params.id}:`, err);
        res.status(500).json({ message: 'Server Error deleting match', error: err.message });
    }
});

// --- PUT /api/matches/:id/start --- (Start match and set initial server) --- NEW ROUTE ---
router.put('/:id/start', async (req, res) => {
    //console.log(`--- PUT /api/matches/${req.params.id}/start ROUTE HIT ---`);
    const { initialServer } = req.body; // Expecting { initialServer: 1 } or { initialServer: 2 }
    //console.log('Request Body:', req.body);

    if (initialServer !== 1 && initialServer !== 2) {
        return res.status(400).json({ message: 'Invalid initialServer value. Must be 1 or 2.' });
    }
    try {
        //console.log(`Finding match ${req.params.id} to start...`);
        const match = await Match.findById(req.params.id);
        if (!match) { return res.status(404).json({ message: 'Match not found' }); }
        if (match.status !== 'Upcoming') { return res.status(400).json({ message: `Match cannot be started. Status: ${match.status}` }); }

        // Update match: set status, start time, server, reset scores/history
        match.status = 'Live';
        match.startTime = new Date();
        if (!match.score) match.score = {}; // Initialize score object if missing
        match.score.server = initialServer;
        match.score.currentGame = { team1: 0, team2: 0 };
        match.score.currentSetScore = { team1: 0, team2: 0 };
        match.score.sets = [];
        match.pointHistory = []; // Clear history on start

        match.markModified('score'); // Mark nested object as modified
        match.markModified('pointHistory');
        //console.log(`Starting match ${match._id} with Team ${initialServer} serving...`);
        const updatedMatch = await match.save();
        //console.log(`Match ${updatedMatch._id} started successfully.`);

        await updatedMatch.populate('player1 player2 player3 player4');
        //console.log('Players populated for response.');
        res.json(updatedMatch); // Send back the started match data

    } catch (err) {
        console.error(`!!! ERROR in PUT /api/matches/${req.params.id}/start:`, err);
        res.status(500).json({ message: 'Server Error starting match', error: err.message });
    }
});
// --------------------------------------------------------------------------------

// --- PUT /api/matches/:id/score --- (Update score - **MODIFIED: Does NOT auto-start**) ---
router.put('/:id/score', async (req, res) => {
    //console.log(`--- PUT /api/matches/${req.params.id}/score ROUTE HIT ---`);
    const { scoringTeam } = req.body;
    //console.log('Request Body:', req.body);

    if (!scoringTeam || (scoringTeam !== 1 && scoringTeam !== 2)) { return res.status(400).json({ message: 'Invalid scoring team (must be 1 or 2).' }); }
    try {
        //console.log(`Finding match ${req.params.id} to update score...`);
        let match = await Match.findById(req.params.id);
        if (!match) { return res.status(404).json({ message: 'Match not found' }); }

        // --- CHECK IF LIVE ---
        if (match.status !== 'Live') {
            return res.status(400).json({ message: `Match must be 'Live' to update score. Status: ${match.status}` });
        }
        // --- REMOVED AUTO-START ---
        if (match.status === 'Finished') { return res.status(400).json({ message: 'Match is already finished.' }); }

        //console.log(`Applying score update for Team ${scoringTeam}...`);
        try {
            match = updateScoreAndCheckWin(match, scoringTeam); // Call update logic
        } catch (updateError) {
            //console.error("!!! ERROR during score update logic:", updateError);
            return res.status(500).json({ message: updateError.message || 'Error processing score.' });
        }

        //console.log(`Score logic applied. Saving match ${match._id}...`);
        const updatedMatch = await match.save();
        //console.log(`Match ${updatedMatch._id} score updated and saved.`);
        await updatedMatch.populate('player1 player2 player3 player4');
        //console.log('Players populated for response.');
        res.json(updatedMatch);

    } catch (err) {
        //console.error(`!!! ERROR in PUT /api/matches/${req.params.id}/score:`, err);
        if (err.name === 'ValidationError') { return res.status(400).json({ message: 'Validation error', error: err.message }); }
        res.status(500).json({ message: err.message || 'Server Error updating score' });
    }
});
// --------------------------------------------------------------------------------------

// --- PUT /api/matches/:id/undo --- (Undo last point)
router.put('/:id/undo', async (req, res) => {
    //console.log(`--- PUT /api/matches/${req.params.id}/undo ROUTE HIT ---`);
    try {
        //console.log(`Finding match ${req.params.id} to undo point...`);
        const match = await Match.findById(req.params.id);
        if (!match) { return res.status(404).json({ message: 'Match not found' }); }
        if (match.status !== 'Live') { return res.status(400).json({ message: `Cannot undo point for status: ${match.status}` }); }
        if (!match.pointHistory || match.pointHistory.length === 0) { return res.status(400).json({ message: 'No points to undo.' }); }

        //console.log(`Reverting last point for match ${match._id}...`);
        const lastPoint = match.pointHistory.pop();

        // Restore score state
        match.score.sets = lastPoint.scoreStateBefore.sets ?? [];
        match.score.currentGame = { ...(lastPoint.scoreStateBefore.currentGame ?? { team1: 0, team2: 0 }) };
        match.score.currentSetScore = { ...(lastPoint.scoreStateBefore.currentSetScore ?? { team1: 0, team2: 0 }) };
        match.score.server = lastPoint.scoreStateBefore.server ?? 1;

        match.markModified('score'); match.markModified('pointHistory');
        //console.log(`Saving reverted state for match ${match._id}...`);
        const updatedMatch = await match.save();
        //console.log(`Match ${updatedMatch._id} state reverted successfully.`);
        await updatedMatch.populate('player1 player2 player3 player4');
        //console.log('Players populated for response.');
        res.json(updatedMatch);

    } catch (err) {
        //console.error(`!!! ERROR in PUT /api/matches/${req.params.id}/undo:`, err);
        res.status(500).json({ message: err.message || 'Server Error undoing point' });
    }
});

// Export the router
module.exports = router;