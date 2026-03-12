// server/routes/matches.js
const express = require('express');
const router = express.Router();
const Match = require('../models/Match');
const Player = require('../models/Player');
const mongoose = require('mongoose');

// --- Reusable Population Helper ---
const populateMatch = async (match) => {
    if (!match) return null;

    const basePopulation = [
        { path: 'player1' }, { path: 'player2' }, { path: 'player3' }, { path: 'player4' },
        { path: 'initialServerPlayer' },
        { path: 'initialReceiverPlayer' },
        { path: 'score.currentPlayerServer' },
        { path: 'score.currentPlayerReceiver' },
        { path: 'winner' }
    ];

    if (match.matchType === 'Team') {
        return await match.populate([
            ...basePopulation,
            { path: 'team1', populate: { path: 'players', select: 'name photoUrl category _id' } },
            { path: 'team2', populate: { path: 'players', select: 'name photoUrl category _id' } },
            { path: 'score.setDetails.team1Pair', select: 'name photoUrl category _id' },
            { path: 'score.setDetails.team2Pair', select: 'name photoUrl category _id' },
            { path: 'score.relayLegs.team1Players', select: 'name photoUrl category _id' },
            { path: 'score.relayLegs.team2Players', select: 'name photoUrl category _id' }
        ]);
    } else { // Individual or Dual
        return await match.populate(basePopulation);
    }
};

// --- Game Logic Constants ---
const POINTS_TO_WIN_GAME = 11;
const POINTS_TO_CHANGE_SERVER = 2;

// --- Helper Functions ---
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

const getNextDualServerAndReceiver = (match) => {
    const totalPoints = match.teamMatchSubType === 'Relay'
        ? (match.score.overallScore.team1 || 0) + (match.score.overallScore.team2 || 0)
        : (match.score.currentGame.team1 || 0) + (match.score.currentGame.team2 || 0);

    let team1PlayerIds, team2PlayerIds;

    if (match.teamMatchSubType === 'Relay') {
        const liveLeg = match.score.relayLegs.find(l => l.status === 'Live');
        team1PlayerIds = liveLeg.team1Players.map(p => p._id.toString());
        team2PlayerIds = liveLeg.team2Players.map(p => p._id.toString());
    } else if (match.teamMatchSubType === 'Set') {
        const liveSet = match.score.setDetails.find(s => s.status === 'Live');
        team1PlayerIds = liveSet.team1Pair.map(p => p._id.toString());
        team2PlayerIds = liveSet.team2Pair.map(p => p._id.toString());
    } else {
        team1PlayerIds = [match.player1._id.toString(), match.player2._id.toString()];
        team2PlayerIds = [match.player3._id.toString(), match.player4._id.toString()];
    }

    const initialServerId = match.initialServerPlayer._id.toString();
    const initialReceiverId = match.initialReceiverPlayer._id.toString();

    const allPlayerIds = [...team1PlayerIds, ...team2PlayerIds];

    const serverPartnerId = allPlayerIds.find(id =>
        (team1PlayerIds.includes(initialServerId) && team1PlayerIds.includes(id) && id !== initialServerId) ||
        (team2PlayerIds.includes(initialServerId) && team2PlayerIds.includes(id) && id !== initialServerId)
    );

    const receiverPartnerId = allPlayerIds.find(id =>
        (team1PlayerIds.includes(initialReceiverId) && team1PlayerIds.includes(id) && id !== initialReceiverId) ||
        (team2PlayerIds.includes(initialReceiverId) && team2PlayerIds.includes(id) && id !== initialReceiverId)
    );

    const serverRotation = [initialServerId, initialReceiverId, serverPartnerId, receiverPartnerId];
    const receiverRotation = [initialReceiverId, serverPartnerId, receiverPartnerId, initialServerId];

    let changeIndex;
    if (totalPoints >= (POINTS_TO_WIN_GAME - 1) * 2) {
        changeIndex = totalPoints;
    } else {
        changeIndex = Math.floor(totalPoints / POINTS_TO_CHANGE_SERVER);
    }

    const nextServerId = serverRotation[changeIndex % 4];
    const nextReceiverId = receiverRotation[changeIndex % 4];

    return { nextServerId, nextReceiverId };
};


// === API Route Handlers ===

// --- GET /api/matches --- (Fetch multiple matches)
router.get('/', async (req, res) => {
    //console.log('--- GET /api/matches ROUTE HIT ---');
    try {
        const filter = {};
        if (req.query.status) { filter.status = req.query.status; }
        if (req.query.matchTypeFilter) {
            if (req.query.matchTypeFilter === 'Ind/Dual') {
                filter.matchType = { $in: ['Individual', 'Dual'] };
            } else {
                filter.matchType = req.query.matchTypeFilter;
            }
        }
        const matches = await Match.find(filter)
            .populate('player1 player2 player3 player4', 'name category photoUrl')
            .populate('team1 team2', 'name logoUrl')
            .sort({ createdAt: -1 });
        res.json(matches);
    } catch (err) {
        console.error("!!! ERROR in GET /api/matches:", err);
        res.status(500).json({ message: 'Server Error fetching matches' });
    }
});

// --- GET /api/matches/:id --- (Fetch single match)
router.get('/:id', async (req, res) => {
    //console.log(`--- GET /api/matches/${req.params.id} ROUTE HIT ---`);
    try {
        let match = await Match.findById(req.params.id);
        if (!match) { return res.status(404).json({ message: 'Match not found' }); }
        match = await populateMatch(match);
        res.json(match);
    } catch (err) {
        console.error(`!!! ERROR in GET /api/matches/${req.params.id}:`, err);
        res.status(500).json({ message: 'Server Error fetching match details' });
    }
});

// --- POST /api/matches --- (Create new match)
router.post('/', async (req, res) => {
    //console.log('--- POST /api/matches ROUTE HIT ---');
    //console.log('Request Body:', req.body);
    const {
        category, matchType, player1Id, player2Id, player3Id, player4Id, bestOf,
        team1Id, team2Id, teamMatchSubType, teamMatchEncounterFormat, numberOfSets, maxSetsPerPlayer, setPointTarget
    } = req.body;

    try {
        let newMatchData = { matchType, status: 'Upcoming', score: { currentGame: { team1: 0, team2: 0 }, currentSetScore: { team1: 0, team2: 0 }, server: 1 }, pointHistory: [] };

        if (matchType === 'Team') {
            if (!team1Id || !team2Id || !teamMatchSubType || !teamMatchEncounterFormat) {
                return res.status(400).json({ message: 'Team IDs, sub-type, and encounter format are required.' });
            }
            if (team1Id === team2Id) { return res.status(400).json({ message: 'Teams must be different.' }); }
            newMatchData = { ...newMatchData, team1: team1Id, team2: team2Id, teamMatchSubType, teamMatchEncounterFormat };
            if (teamMatchSubType === 'Set') {
                if (!numberOfSets || !maxSetsPerPlayer) { return res.status(400).json({ message: 'Number of sets and max sets per player are required.' }); }
                newMatchData.numberOfSets = parseInt(numberOfSets, 10);
                newMatchData.maxSetsPerPlayer = parseInt(maxSetsPerPlayer, 10);
                newMatchData.score.setDetails = [];
            } else if (teamMatchSubType === 'Relay') {
                if (!numberOfSets || !setPointTarget) { return res.status(400).json({ message: 'Number of legs and points per leg are required.' }); }
                newMatchData.numberOfSets = parseInt(numberOfSets, 10);
                newMatchData.maxSetsPerPlayer = parseInt(maxSetsPerPlayer, 10) || 2;
                newMatchData.setPointTarget = parseInt(setPointTarget, 10);
                newMatchData.score.relayLegs = [];
                newMatchData.score.overallScore = { team1: 0, team2: 0 };
            }
        } else {
            if (!category || !player1Id || !player2Id || !bestOf) { return res.status(400).json({ message: 'Missing required fields for Ind/Dual.' }); }
            newMatchData.category = category;
            let setsToWinValue;
            switch (parseInt(bestOf, 10)) {
                case 1: setsToWinValue = 1; break; case 3: setsToWinValue = 2; break; case 5: setsToWinValue = 3; break;
                default: return res.status(400).json({ message: 'Invalid bestOf value.' });
            }
            newMatchData.player1 = player1Id; newMatchData.player2 = player2Id;
            if (matchType === 'Dual') {
                if (!player3Id || !player4Id) { return res.status(400).json({ message: 'Player 3/4 IDs required.' }); }
                newMatchData.player3 = player3Id; newMatchData.player4 = player4Id;
            }
            newMatchData.setsToWin = setsToWinValue;
        }

        const newMatch = new Match(newMatchData);
        const savedMatch = await newMatch.save();
        let populatedMatch = await populateMatch(savedMatch);
        res.status(201).json(populatedMatch);

    } catch (err) {
        console.error("!!! ERROR in POST /api/matches:", err);
        if (err.name === 'ValidationError') { return res.status(400).json({ message: err.message }); }
        res.status(500).json({ message: 'Server Error creating match', error: err.message });
    }
});

// --- PUT /api/matches/:id/length --- (For Ind/Dual matches)
router.put('/:id/length', async (req, res) => {
    const { setsToWin } = req.body;
    if (![1, 2, 3].includes(setsToWin)) { return res.status(400).json({ message: 'Invalid setsToWin value.' }); }
    try {
        const match = await Match.findById(req.params.id);
        if (!match) { return res.status(404).json({ message: 'Match not found' }); }
        if (match.matchType === 'Team') { return res.status(400).json({ message: 'Cannot update length for Team match this way.' }); }
        if (match.status !== 'Upcoming') { return res.status(400).json({ message: `Cannot change length for ${match.status} match.` }); }
        match.setsToWin = setsToWin;
        let updatedMatch = await match.save();
        updatedMatch = await populateMatch(updatedMatch);
        res.json(updatedMatch);
    } catch (err) {
        console.error(`!!! ERROR in PUT /length:`, err);
        res.status(500).json({ message: 'Server Error updating match length', error: err.message });
    }
});

// --- DELETE /api/matches/:id ---
router.delete('/:id', async (req, res) => {
    try {
        const match = await Match.findById(req.params.id);
        if (!match) { return res.status(404).json({ message: 'Match not found' }); }
        if (match.status !== 'Upcoming') { return res.status(400).json({ message: `Cannot delete a ${match.status} match.` }); }
        await Match.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: 'Match deleted successfully', deletedMatchId: req.params.id });
    } catch (err) {
        console.error(`!!! ERROR in DELETE /:id:`, err);
        res.status(500).json({ message: 'Server Error deleting match', error: err.message });
    }
});

// --- PUT /api/matches/:id/start --- (For Individual/Dual)
router.put('/:id/start', async (req, res) => {
    const { initialServer, initialServerPlayerId, initialReceiverPlayerId } = req.body;

    try {
        const match = await Match.findById(req.params.id);
        if (!match) { return res.status(404).json({ message: 'Match not found' }); }
        if (match.status !== 'Upcoming') { return res.status(400).json({ message: `Match status: ${match.status}` }); }

        match.status = 'Live';
        match.startTime = new Date();

        match.score = {
            currentGame: { team1: 0, team2: 0 },
            currentSetScore: { team1: 0, team2: 0 },
            sets: [],
            server: initialServer,
        };
        match.pointHistory = [];

        if (match.matchType === 'Dual') {
            if (!initialServerPlayerId || !initialReceiverPlayerId) {
                return res.status(400).json({ message: 'Server and Receiver players are required for a Dual match.' });
            }
            // ---Save these to the root of the match document ---
            match.initialServerPlayer = initialServerPlayerId;
            match.initialReceiverPlayer = initialReceiverPlayerId;

            // ---These are saved inside the score object ---
            match.score.currentPlayerServer = initialServerPlayerId;
            match.score.currentPlayerReceiver = initialReceiverPlayerId;
        }

        match.markModified('score');
        let updatedMatch = await match.save();

        updatedMatch = await populateMatch(updatedMatch);

        res.json(updatedMatch);
    } catch (err) {
        console.error(`!!! ERROR in PUT /start:`, err);
        res.status(500).json({ message: 'Server Error starting match', error: err.message });
    }
});

// --- PUT /api/matches/:id/setup_set OR setup_relay_leg ---
const setupEncounter = async (req, res) => {
    const {
        setIndex, team1PairIds, team2PairIds, initialServer,
        initialServerPlayerId, initialReceiverPlayerId
    } = req.body;

    const matchId = req.params.id;
    const isRelay = req.path.includes('setup_relay_leg');
    const encounterType = isRelay ? 'Relay' : 'Set';

    try {
        let match = await Match.findById(matchId);
        if (!match) { return res.status(404).json({ message: 'Match not found.' }); }
        if (match.matchType !== 'Team') { return res.status(400).json({ message: 'Operation only for Team matches.' }); }
        if (match.teamMatchSubType !== encounterType) { return res.status(400).json({ message: `Invalid setup call. This is a ${match.teamMatchSubType} match.` }); }

        const expectedPairSize = match.teamMatchEncounterFormat === 'Individual' ? 1 : 2;
        if (team1PairIds.length !== expectedPairSize || team2PairIds.length !== expectedPairSize) {
            return res.status(400).json({ message: `Each pair must have ${expectedPairSize} player(s) for ${match.teamMatchEncounterFormat} format.` });
        }

        const encounterArray = isRelay ? match.score.relayLegs : match.score.setDetails;
        if (!encounterArray) {
            if (isRelay) match.score.relayLegs = [];
            else match.score.setDetails = [];
        }
        while (encounterArray.length <= setIndex) {
            const newEncounter = isRelay ? { legNumber: encounterArray.length + 1, status: 'Pending' } : { setIndex: encounterArray.length, status: 'Pending' };
            encounterArray.push(newEncounter);
        }

        if (isRelay) {
            encounterArray[setIndex].team1Players = team1PairIds.map(id => new mongoose.Types.ObjectId(id));
            encounterArray[setIndex].team2Players = team2PairIds.map(id => new mongoose.Types.ObjectId(id));
            encounterArray[setIndex].status = 'Live';
        } else { // 'Set' type
            encounterArray[setIndex].team1Pair = team1PairIds.map(id => new mongoose.Types.ObjectId(id));
            encounterArray[setIndex].team2Pair = team2PairIds.map(id => new mongoose.Types.ObjectId(id));
            encounterArray[setIndex].status = 'Live';
        }

        match.score.currentGame = { team1: 0, team2: 0 };
        match.score.server = initialServer;

        if (match.teamMatchEncounterFormat === 'Dual') {
            if (!initialServerPlayerId || !initialReceiverPlayerId) {
                return res.status(400).json({ message: 'Server and Receiver players are required for a Dual encounter.' });
            }
            match.initialServerPlayer = initialServerPlayerId;
            match.initialReceiverPlayer = initialReceiverPlayerId;

            match.score.currentPlayerServer = initialServerPlayerId;
            match.score.currentPlayerReceiver = initialReceiverPlayerId;
        }

        match.status = 'Live';
        match.markModified('score');

        let updatedMatch = await match.save();
        updatedMatch = await populateMatch(updatedMatch);
        res.json(updatedMatch);

    } catch (err) {
        console.error(`!!! ERROR in PUT /setup_${encounterType.toLowerCase()}:`, err);
        res.status(500).json({ message: err.message || 'Server Error setting up encounter' });
    }
}
router.put('/:id/setup_set', setupEncounter);
router.put('/:id/setup_relay_leg', setupEncounter);

// --- PUT /api/matches/:id/next-set-server ---
router.put('/:id/next-set-server', async (req, res) => {
    const { initialServer, initialServerPlayerId, initialReceiverPlayerId } = req.body;

    try {
        let match = await Match.findById(req.params.id);
        if (!match) { return res.status(404).json({ message: 'Match not found' }); }
        if (match.status !== 'AwaitingSubMatchSetup') {
            return res.status(400).json({ message: 'Match is not awaiting next set setup.' });
        }

        if (match.matchType === 'Individual') {
            if (!initialServer) {
                return res.status(400).json({ message: 'Serving team is required for the next set.' });
            }
            match.score.server = initialServer;

        } else if (match.matchType === 'Dual') {
            if (!initialServerPlayerId || !initialReceiverPlayerId) {
                return res.status(400).json({ message: 'Server and Receiver players are required for the next set.' });
            }
            match.score.currentPlayerServer = initialServerPlayerId;
            match.score.currentPlayerReceiver = initialReceiverPlayerId;

            const team1Players = [match.player1?._id.toString(), match.player2?._id.toString()];
            match.score.server = team1Players.includes(initialServerPlayerId) ? 1 : 2;
        }

        match.status = 'Live';
        match.score.currentGame = { team1: 0, team2: 0 };
        match.markModified('score');

        let updatedMatch = await match.save();
        updatedMatch = await populateMatch(updatedMatch);
        res.json(updatedMatch);

    } catch (err) {
        console.error("Error setting next set server:", err);
        res.status(500).json({ message: 'Server error setting next set server' });
    }
});

// --- PUT /api/matches/:id/score --- 
router.put('/:id/score', async (req, res) => {
    const { scoringTeam } = req.body;
    if (![1, 2].includes(scoringTeam)) { return res.status(400).json({ message: 'Invalid scoring team.' }); }

    try {
        let match = await Match.findById(req.params.id).populate(
            'player1 player2 player3 player4 initialServerPlayer initialReceiverPlayer winner score.setDetails.team1Pair score.setDetails.team2Pair score.relayLegs.team1Players score.relayLegs.team2Players'
        );
        if (!match) { return res.status(404).json({ message: 'Match not found' }); }
        if (match.status !== 'Live') { return res.status(400).json({ message: `Match status is ${match.status}, not Live.` }); }

        const scoreStateBefore = JSON.parse(JSON.stringify(match.score));
        if (!match.pointHistory) match.pointHistory = [];
        match.pointHistory.push({ scoringTeam, scoreStateBefore, timestamp: new Date() });

        if (match.matchType === 'Team' && match.teamMatchSubType === 'Relay') {
            // ---RELAY SCORING LOGIC ---
            if (scoringTeam === 1) match.score.overallScore.team1++; else match.score.overallScore.team2++;

            const liveLegIndex = match.score.relayLegs.findIndex(l => l.status === 'Live');
            if (liveLegIndex === -1) throw new Error("No live relay leg found.");

            const liveLeg = match.score.relayLegs[liveLegIndex];
            const team1Total = match.score.overallScore.team1;
            const team2Total = match.score.overallScore.team2;
            const legTarget = match.setPointTarget * liveLeg.legNumber;
            const finalTarget = match.setPointTarget * match.numberOfSets;

            // Check if the leg or match is finished FIRST
            if (team1Total >= legTarget || team2Total >= legTarget) {
                liveLeg.status = 'Finished';
                liveLeg.endScoreTeam1 = team1Total;
                liveLeg.endScoreTeam2 = team2Total;
                if (team1Total >= finalTarget || team2Total >= finalTarget) {
                    match.status = 'Finished';
                    match.winner = team1Total > team2Total ? 1 : 2;
                    match.endTime = new Date();
                } else {
                    match.status = 'AwaitingSubMatchSetup';
                }
            } else {
                //If the leg is NOT finished, THEN calculate the next server
                if (match.teamMatchEncounterFormat === 'Dual') {
                    const { nextServerId, nextReceiverId } = getNextDualServerAndReceiver(match);
                    match.score.currentPlayerServer = nextServerId;
                    match.score.currentPlayerReceiver = nextReceiverId;

                    const team1PlayersIds = liveLeg.team1Players.map(p => p._id.toString());
                    match.score.server = team1PlayersIds.includes(nextServerId) ? 1 : 2;
                } else {
                    const legStartPoints = liveLegIndex > 0 ? (match.score.relayLegs[liveLegIndex - 1].endScoreTeam1 + match.score.relayLegs[liveLegIndex - 1].endScoreTeam2) : 0;
                    if ((team1Total + team2Total - legStartPoints) % 2 === 0) {
                        match.score.server = match.score.server === 1 ? 2 : 1;
                    }
                }
            }
        } else {
            // LOGIC FOR IND/DUAL & TEAM SET MATCHES 
            const { currentGame, server } = match.score;
            const setsToWin = match.setsToWin || Math.ceil(match.numberOfSets / 2);
            if (scoringTeam === 1) currentGame.team1++; else currentGame.team2++;

            let gameWinner = null;
            if (currentGame.team1 >= POINTS_TO_WIN_GAME && currentGame.team1 >= currentGame.team2 + 2) gameWinner = 1;
            else if (currentGame.team2 >= POINTS_TO_WIN_GAME && currentGame.team2 >= currentGame.team1 + 2) gameWinner = 2;

            if (gameWinner) {
                const finalGameScore = [currentGame.team1, currentGame.team2];
                if (gameWinner === 1) match.score.currentSetScore.team1++; else match.score.currentSetScore.team2++;

                currentGame.team1 = 0;
                currentGame.team2 = 0;

                if (match.matchType === 'Team') {
                    const liveSetIndex = match.score.setDetails.findIndex(s => s.status === 'Live');
                    if (liveSetIndex > -1) {
                        match.score.setDetails[liveSetIndex].status = 'Finished';
                        match.score.setDetails[liveSetIndex].team1Score = finalGameScore[0];
                        match.score.setDetails[liveSetIndex].team2Score = finalGameScore[1];
                    }
                } else { if (!match.score.sets) match.score.sets = []; match.score.sets.push(finalGameScore); }

                let matchWinnerNum = null;
                if (match.score.currentSetScore.team1 >= setsToWin) matchWinnerNum = 1;
                else if (match.score.currentSetScore.team2 >= setsToWin) matchWinnerNum = 2;

                if (matchWinnerNum) {
                    match.status = 'Finished';
                    match.endTime = new Date();
                    if (match.matchType === 'Individual') {
                        match.winner = (matchWinnerNum === 1) ? match.player1 : match.player2;
                    } else {
                        match.winner = matchWinnerNum;
                    }
                } else {
                    match.status = 'AwaitingSubMatchSetup';
                }
            } else {
                const isDualMatch = match.matchType === 'Dual' || (match.matchType === 'Team' && match.teamMatchEncounterFormat === 'Dual');

                if (isDualMatch) {
                    const { nextServerId, nextReceiverId } = getNextDualServerAndReceiver(match);
                    match.score.currentPlayerServer = nextServerId;
                    match.score.currentPlayerReceiver = nextReceiverId;

                    const team1PlayersIds = (match.matchType === 'Team')
                        ? match.score.setDetails.find(s => s.status === 'Live').team1Pair.map(p => p._id.toString())
                        : [match.player1?._id.toString(), match.player2?._id.toString()];
                    match.score.server = team1PlayersIds.includes(nextServerId) ? 1 : 2;
                } else { match.score.server = getNextServer(currentGame, server); }
            }
        }

        match.markModified('score');
        let updatedMatch = await match.save();
        updatedMatch = await populateMatch(updatedMatch);
        res.json(updatedMatch);
    } catch (err) {
        console.error(`!!! ERROR in PUT /api/matches/${req.params.id}/score:`, err);
        res.status(500).json({ message: err.message || 'Server Error updating score' });
    }
});

// --- PUT /api/matches/:id/undo --- 
router.put('/:id/undo', async (req, res) => {
    try {
        const match = await Match.findById(req.params.id);
        if (!match) { return res.status(404).json({ message: 'Match not found' }); }
        if (match.status !== 'Live') { return res.status(400).json({ message: `Cannot undo point for status: ${match.status}` }); }
        if (!match.pointHistory || match.pointHistory.length === 0) { return res.status(400).json({ message: 'No points to undo.' }); }

        const lastPoint = match.pointHistory.pop();
        match.score = lastPoint.scoreStateBefore;

        if (match.status === 'Finished') {
            match.status = 'Live';
            match.winner = undefined;
            match.endTime = undefined;
        }

        match.markModified('score');
        match.markModified('pointHistory');

        let updatedMatch = await match.save();
        updatedMatch = await populateMatch(updatedMatch);
        res.json(updatedMatch);

    } catch (err) {
        console.error(`!!! ERROR in PUT /api/matches/${req.params.id}/undo:`, err);
        res.status(500).json({ message: err.message || 'Server Error undoing point' });
    }
});

module.exports = router;