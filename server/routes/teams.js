// server/routes/teams.js
const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const Match = require('../models/Match');
const { uploadTeamLogo } = require('../middleware/upload');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

// POST /api/teams - Create a new team
router.post('/', (req, res) => {
    uploadTeamLogo(req, res, async (err) => {
        if (err) {
            console.error("Team Logo Multer Error:", err);
            return res.status(400).json({ message: err.message || "File upload error" });
        }

        //console.log('--- POST /api/teams ROUTE HIT ---');
        //console.log('Request Body:', req.body);

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
                logoUrl: req.file ? `/uploads/teams/${req.file.filename}` : null
            });

            const savedTeam = await newTeam.save();
            await savedTeam.populate({
                path: 'players',
                select: 'name photoUrl category'
            });
            //console.log(`Team '${savedTeam.name}' created successfully.`);
            res.status(201).json(savedTeam);

        } catch (err) {
            console.error("!!! ERROR in POST /api/teams:", err);
            if (err.code === 11000) {
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
    //console.log('--- GET /api/teams ROUTE HIT ---');
    try {
        const teams = await Team.find()
            .populate({
                path: 'players',
                select: 'name photoUrl category'
            })
            .sort({ name: 1 });
        //console.log(`Found ${teams.length} teams.`);
        res.json(teams);
    } catch (err) {
        console.error("!!! ERROR in GET /api/teams:", err);
        res.status(500).json({ message: 'Server Error fetching teams' });
    }
});

// GET /api/teams/:id 
router.get('/:id', async (req, res) => {
    // Implement if needed
    res.status(501).json({ message: 'Not Implemented Yet' });
});

// PUT /api/teams/:id (Optional - For editing team)
router.put('/:id', (req, res) => {
    //console.log(`--- PUT /api/teams/${req.params.id} ROUTE HIT ---`);
    uploadTeamLogo(req, res, async (err) => { // Use multer to handle potential logo change
        if (err) { return res.status(400).json({ message: err.message || "File upload error" }); }

        const { name, playerIds } = req.body;
        // Convert playerIds to array if it's a single string
        const playersArray = playerIds ? (Array.isArray(playerIds) ? playerIds : [playerIds]) : [];

        if (!name || playersArray.length === 0) {
            return res.status(400).json({ message: 'Team name and at least one player are required.' });
        }

        try {
            const team = await Team.findById(req.params.id);
            if (!team) {
                if (req.file) { fs.unlink(req.file.path, e => e && console.error(e)); } // Clean up new file
                return res.status(404).json({ message: 'Team not found' });
            }

            // Check for duplicate name if name is being changed
            if (name !== team.name) {
                const existingTeam = await Team.findOne({ name: name });
                if (existingTeam) {
                    if (req.file) { fs.unlink(req.file.path, e => e && console.error(e)); }
                    return res.status(400).json({ message: `Team name '${name}' already exists.` });
                }
            }

            const oldLogoPath = team.logoUrl;

            // Update fields
            team.name = name;
            team.players = playersArray;
            if (req.file) { // If a new logo was uploaded
                team.logoUrl = `/uploads/teams/${req.file.filename}`;
            }

            const updatedTeam = await team.save();
            await updatedTeam.populate({ path: 'players', select: 'name photoUrl category _id' });

            // If update successful and new logo uploaded, delete old one
            if (req.file && oldLogoPath) {
                const fullOldPath = path.join(__dirname, '..', oldLogoPath);
                fs.unlink(fullOldPath, (unlinkErr) => {
                    if (unlinkErr && unlinkErr.code !== 'ENOENT') {
                        console.error("Error deleting old team logo:", unlinkErr);
                    }
                });
            }

            res.json(updatedTeam);

        } catch (dbErr) {
            if (req.file) { fs.unlink(req.file.path, e => e && console.error(e)); }
            res.status(500).json({ message: 'Server error updating team', error: dbErr.message });
        }
    });
});

// DELETE /api/teams/:id (Optional - For deleting team, consider impact on matches)
router.delete('/:id', async (req, res) => {
    //console.log(`--- DELETE /api/teams/${req.params.id} ROUTE HIT ---`);
    try {
        const teamId = req.params.id;

        // --- Safety Check: Ensure team is not in any matches ---
        const matchesWithTeam = await Match.find({
            $or: [{ team1: teamId }, { team2: teamId }]
        }).limit(1);

        if (matchesWithTeam.length > 0) {
            return res.status(400).json({ message: 'Cannot delete team. It is part of one or more existing matches.' });
        }
        // ----------------------------------------------------

        const team = await Team.findById(teamId);
        if (!team) {
            return res.status(404).json({ message: 'Team not found' });
        }

        const logoPath = team.logoUrl;
        await Team.findByIdAndDelete(teamId);

        // Delete logo file if it exists
        if (logoPath) {
            const fullPath = path.join(__dirname, '..', logoPath);
            fs.unlink(fullPath, (unlinkErr) => {
                if (unlinkErr && unlinkErr.code !== 'ENOENT') {
                    console.error("Error deleting team logo:", unlinkErr);
                }
            });
        }

        res.status(200).json({ message: 'Team deleted successfully' });

    } catch (err) {
        console.error(`!!! ERROR in DELETE /api/teams/${req.params.id}:`, err);
        res.status(500).json({ message: 'Server Error deleting team', error: err.message });
    }
});

module.exports = router;