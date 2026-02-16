// server/routes/teams.js
const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const Player = require('../models/Player');
const { uploadTeamLogo } = require('../middleware/upload');

// POST /api/teams - Create a new team
router.post('/', (req, res) => {
    // Use the upload middleware first
    uploadTeamLogo(req, res, async (err) => {
        if (err) {
            console.error("Team Logo Multer Error:", err);
            return res.status(400).json({ message: err.message || "File upload error" });
        }

        // 'req.file' contains the logo info, 'req.body' contains text fields
        console.log('--- POST /api/teams ROUTE HIT ---');
        console.log('Request Body:', req.body);

        // Player IDs might come as a single string if only one is selected,
        // or an array. Always convert to array.
        let playerIds = req.body.playerIds;
        if (playerIds && !Array.isArray(playerIds)) {
            playerIds = [playerIds];
        }

        const { name } = req.body;

        if (!name || !playerIds || playerIds.length === 0) {
            return res.status(400).json({ message: 'Name and a non-empty array of playerIds are required.' });
        }

        try {
            const newTeam = new Team({
                name,
                players: playerIds,
                // --- Add the logoUrl from the uploaded file ---
                logoUrl: req.file ? `/uploads/teams/${req.file.filename}` : null
                // ---------------------------------------------
            });

            const savedTeam = await newTeam.save();
            // Populate players for the response
            await savedTeam.populate({
                path: 'players',
                select: 'name photoUrl category' // Select fields you want from Player
            });
            console.log(`Team '${savedTeam.name}' created successfully.`);
            res.status(201).json(savedTeam);

        } catch (err) {
            console.error("!!! ERROR in POST /api/teams:", err);
            if (err.code === 11000) { // Duplicate key error for team name
                return res.status(400).json({ message: `Team name '${name}' already exists.` });
            }
            if (err.name === 'ValidationError') {
                return res.status(400).json({ message: err.message });
            }
            res.status(500).json({ message: 'Server Error creating team', error: err.message });
        }

    });
});

// GET /api/teams - Get all teams
router.get('/', async (req, res) => {
    console.log('--- GET /api/teams ROUTE HIT ---');
    try {
        const teams = await Team.find()
            .populate({
                path: 'players',
                select: 'name photoUrl category'
            })
            .sort({ name: 1 });
        console.log(`Found ${teams.length} teams.`);
        res.json(teams);
    } catch (err) {
        console.error("!!! ERROR in GET /api/teams:", err);
        res.status(500).json({ message: 'Server Error fetching teams' });
    }
});

// GET /api/teams/:id (Optional - For editing/viewing single team)
router.get('/:id', async (req, res) => {
    // Implement if needed
    res.status(501).json({ message: 'Not Implemented Yet' });
});

// PUT /api/teams/:id (Optional - For editing team)
router.put('/:id', async (req, res) => {
    // Implement if needed
    res.status(501).json({ message: 'Not Implemented Yet' });
});

// DELETE /api/teams/:id (Optional - For deleting team, consider impact on matches)
router.delete('/:id', async (req, res) => {
    // Implement if needed, be careful if teams are referenced in existing matches
    res.status(501).json({ message: 'Not Implemented Yet' });
});

module.exports = router;