// server/routes/stats.js
const express = require('express');
const router = express.Router();
const Match = require('../models/Match'); // Adjust path if needed
const Player = require('../models/Player'); // Adjust path if needed

// GET /api/stats/rankings - Calculate and return player rankings
router.get('/rankings', async (req, res) => {
    console.log("--- GET /api/stats/rankings ROUTE HIT ---");
    try {
        // 1. Fetch all finished matches, populating necessary player data
        const finishedMatches = await Match.find({ status: 'Finished' })
            .populate('player1', 'name category photoUrl') // Select only needed fields
            .populate('player2', 'name category photoUrl')
            .populate('player3', 'name category photoUrl')
            .populate('player4', 'name category photoUrl')
            .lean(); 

        if (!finishedMatches || finishedMatches.length === 0) {
            return res.json([]); // Return empty array if no finished matches
        }

        console.log(`Processing ${finishedMatches.length} finished matches...`);

        // 2. Use a Map to accumulate points per player ID
        // Map<playerId (string), { points: number, wins: number, name: string, photoUrl: string, category: string }>
        const playerStats = new Map();

        // Helper to add/update player stats in the map
        const updatePlayerStat = (player, pointsScored, isWinner) => {
            if (!player || !player._id) return; // Skip if player data is missing

            const playerId = player._id.toString();
            const currentStat = playerStats.get(playerId) || {
                points: 0,
                wins: 0,
                name: player.name, // Store name, photo, category once
                photoUrl: player.photoUrl,
                category: player.category,
                _id: player._id // Include ID for frontend key prop
            };

            currentStat.points += pointsScored; // Add points played by the team
            if (isWinner) {
                currentStat.points += 5; // Add win bonus
                currentStat.wins += 1; // Track wins (optional, but useful)
            }
            playerStats.set(playerId, currentStat);
        };


        // 3. Iterate through each finished match
        for (const match of finishedMatches) {
            if (!match.score || !match.score.sets || match.score.sets.length === 0) {
                console.warn(`Skipping match ${match._id}: No sets data found.`);
                continue; // Skip matches with no set scores
            }

            // Calculate total points scored by each team in this match
            let team1TotalPoints = 0;
            let team2TotalPoints = 0;
            for (const set of match.score.sets) {
                team1TotalPoints += set[0] || 0; // Points for team 1 in this set
                team2TotalPoints += set[1] || 0; // Points for team 2 in this set
            }

            // Determine the winner
            let winningTeamNum = null;
            if (match.matchType === 'Individual') {
                // Winner field stores the player ObjectId
                if (match.winner && match.player1 && match.winner.equals(match.player1._id)) {
                    winningTeamNum = 1;
                } else if (match.winner && match.player2 && match.winner.equals(match.player2._id)) {
                    winningTeamNum = 2;
                }
            } else { // Dual
                // Winner field stores the team number (1 or 2)
                winningTeamNum = match.winner;
            }

            // Update stats for players on Team 1
            updatePlayerStat(match.player1, team1TotalPoints, winningTeamNum === 1);
            if (match.matchType === 'Dual' && match.player2) {
                updatePlayerStat(match.player2, team1TotalPoints, winningTeamNum === 1);
            }

            // Update stats for players on Team 2
            if (match.matchType === 'Individual' && match.player2) { // P2 is T2 in singles
                updatePlayerStat(match.player2, team2TotalPoints, winningTeamNum === 2);
            } else if (match.matchType === 'Dual') { // P3/P4 are T2 in doubles
                if (match.player3) updatePlayerStat(match.player3, team2TotalPoints, winningTeamNum === 2);
                if (match.player4) updatePlayerStat(match.player4, team2TotalPoints, winningTeamNum === 2);
            }
        }

        // 4. Convert Map values to an array and sort by points descending
        const rankedPlayers = Array.from(playerStats.values())
            .sort((a, b) => b.points - a.points); // Sort descending

        console.log(`Calculated rankings for ${rankedPlayers.length} players.`);
        res.json(rankedPlayers); // Send sorted array

    } catch (err) {
        console.error("!!! ERROR in GET /api/stats/rankings:", err);
        res.status(500).json({ message: 'Server Error calculating rankings', error: err.message });
    }
});

// Add other stats routes here later if needed

module.exports = router;