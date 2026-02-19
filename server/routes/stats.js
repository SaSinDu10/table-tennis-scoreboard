// server/routes/stats.js
const express = require('express');
const router = express.Router();
const Match = require('../models/Match');

// GET /api/stats/rankings 
router.get('/rankings', async (req, res) => {
    console.log("--- GET /api/stats/rankings ROUTE HIT ---");
    try {
        const finishedMatches = await Match.find({ status: 'Finished' })
            .populate('player1 player2 player3 player4', 'name category photoUrl _id')
            .populate({
                path: 'team1 team2',
                populate: { path: 'players', select: 'name category photoUrl _id' }
            })
            .lean();

        if (!finishedMatches || finishedMatches.length === 0) {
            return res.json([]);
        }

        console.log(`Processing ${finishedMatches.length} finished matches for ranking...`);
        const playerStats = new Map();

        // Helper to safely add/update player stats
        const updatePlayerStat = (player, pointsScored, isWinner) => {
            if (!player || !player._id) return;
            const playerId = player._id.toString();
            const currentStat = playerStats.get(playerId) || {
                _id: player._id, name: player.name, photoUrl: player.photoUrl,
                category: player.category, points: 0, wins: 0,
            };
            currentStat.points += pointsScored;
            if (isWinner) {
                currentStat.points += 5;
                currentStat.wins += 1;
            }
            playerStats.set(playerId, currentStat);
        };

        // Iterate through each finished match
        for (const match of finishedMatches) {
            if (match.matchType === 'Individual') {
                if (!match.player1 || !match.player2 || !match.winner) continue;

                let team1TotalPoints = 0, team2TotalPoints = 0;
                (match.score?.sets || []).forEach(set => {
                    team1TotalPoints += set[0] || 0;
                    team2TotalPoints += set[1] || 0;
                });

                let winningTeamNum = null;
                // --- Compare as strings because of .lean() ---
                if (match.winner.toString() === match.player1._id.toString()) {
                    winningTeamNum = 1;
                } else if (match.winner.toString() === match.player2._id.toString()) {
                    winningTeamNum = 2;
                }

                updatePlayerStat(match.player1, team1TotalPoints, winningTeamNum === 1);
                updatePlayerStat(match.player2, team2TotalPoints, winningTeamNum === 2);

            } else if (match.matchType === 'Dual') {
                if (!match.player1 || !match.player2 || !match.player3 || !match.player4 || !match.winner) continue;

                let team1TotalPoints = 0, team2TotalPoints = 0;
                (match.score?.sets || []).forEach(set => {
                    team1TotalPoints += set[0] || 0;
                    team2TotalPoints += set[1] || 0;
                });

                const winningTeamNum = match.winner;

                // Apply points to all 4 players
                updatePlayerStat(match.player1, team1TotalPoints, winningTeamNum === 1);
                updatePlayerStat(match.player2, team1TotalPoints, winningTeamNum === 1);
                updatePlayerStat(match.player3, team2TotalPoints, winningTeamNum === 2);
                updatePlayerStat(match.player4, team2TotalPoints, winningTeamNum === 2);

            } else if (match.matchType === 'Team') {
                if (!match.team1 || !match.team2 || !match.winner) continue;

                const team1Players = match.team1.players || [];
                const team2Players = match.team2.players || [];
                const winningTeamNum = match.winner;
                let team1TotalPoints = 0, team2TotalPoints = 0;

                if (match.teamMatchSubType === 'Set') {
                    (match.score?.setDetails || []).forEach(set => {
                        if (set.status === 'Finished') {
                            team1TotalPoints += set.team1Score || 0;
                            team2TotalPoints += set.team2Score || 0;
                        }
                    });
                } else if (match.teamMatchSubType === 'Relay') {
                    team1TotalPoints = match.score?.overallScore?.team1 || 0;
                    team2TotalPoints = match.score?.overallScore?.team2 || 0;
                }

                team1Players.forEach(player => updatePlayerStat(player, team1TotalPoints, winningTeamNum === 1));
                team2Players.forEach(player => updatePlayerStat(player, team2TotalPoints, winningTeamNum === 2));
            }
        }

        // Convert Map to an array and sort
        const rankedPlayers = Array.from(playerStats.values())
            .sort((a, b) => b.points - a.points);

        console.log(`Calculated rankings for ${rankedPlayers.length} players.`);
        res.json(rankedPlayers);

    } catch (err) {
        console.error("!!! ERROR in GET /api/stats/rankings:", err);
        res.status(500).json({ message: 'Server Error calculating rankings', error: err.message });
    }
});

module.exports = router;