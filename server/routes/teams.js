// server/routes/teams.js
const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const Player = require('../models/Player'); // To validate player IDs if needed

// POST /api/teams - Create a new team
router.post('/', async (req, res) => {
    console.log('--- POST /api/teams ROUTE HIT ---');
    console.log('Request Body:', req.body);
    const { name, playerIds } = req.body;

    if (!name || !playerIds || !Array.isArray(playerIds) || playerIds.length === 0) {
        return res.status(400).json({ message: 'Name and a non-empty array of playerIds are required.' });
    }

    // Optional: Further validation for playerIds (e.g., check if they are valid Player ObjectIds)
    // For now, schema validation handles length based on the model.

    try {
        const newTeam = new Team({
            name,
            players: playerIds
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

// GET /api/teams - Get all teams
router.get('/', async (req, res) => {
    console.log('--- GET /api/teams ROUTE HIT ---');
    try {
        const teams = await Team.find()
            .populate({
                path: 'players',
                select: 'name photoUrl category' // We still want to see player categories
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