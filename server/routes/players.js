// server/routes/players.js
const express = require('express');
const router = express.Router();
const Player = require('../models/Player');
const upload = require('../middleware/upload');
const Match = require('../models/Match');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const { uploadPlayerImage } = require('../middleware/upload');

// --- GET all players ---
router.get('/', async (req, res) => {
    //console.log('--- GET /api/players ROUTE HIT ---');
    try {
        const players = await Player.find().sort({ name: 1 });
        //console.log(`Found ${players.length} players.`);
        res.json(players);
    } catch (err) {
        console.error("!!! ERROR in GET /api/players:", err);
        res.status(500).json({ message: 'Server Error fetching players' });
    }
});

// --- GET a single player by ID ---
router.get('/:id', async (req, res) => {
    //console.log(`--- GET /api/players/${req.params.id} ROUTE HIT ---`);
    try {
        const player = await Player.findById(req.params.id);
        if (!player) {
            return res.status(404).json({ message: 'Player not found' });
        }
        res.json(player);
    } catch (err) {
        if (err.name === 'CastError') { return res.status(400).json({ message: 'Invalid Player ID format' }); }
        res.status(500).json({ message: 'Server Error fetching player' });
    }
});

// --- POST create a new player (Handles file upload) ---
router.post('/', (req, res) => {
    //console.log('--- POST /api/players ROUTE HIT ---');
    uploadPlayerImage(req, res, async (err) => {
        // Handle potential Multer errors
        if (err) {
            console.error("Player Photo Multer Error:", err);
            if (err instanceof multer.MulterError) {
                return res.status(400).json({ message: `File upload error: ${err.code}` });
            }
            return res.status(400).json({ message: err.message || "File upload error" });
        }

        //console.log('Multer processed file (if any). Req file:', req.file);
        //console.log('Request Body:', req.body);
        const { name, category } = req.body;


        if (!name || !category) {
            console.warn("Validation failed: Name or category missing.");
            if (req.file) {
                fs.unlink(req.file.path, (unlinkErr) => {
                    if (unlinkErr) console.error("Error deleting orphaned file:", unlinkErr);
                });
            }
            return res.status(400).json({ message: 'Player name and category are required.' });
        }

        const newPlayer = new Player({
            name: name,
            category: category,
            photoUrl: req.file ? `/uploads/players/${req.file.filename}` : null
        });

        // Save to Database
        try {
            //console.log('Attempting to save new player...');
            const savedPlayer = await newPlayer.save();
            //console.log(`Player saved successfully: ${savedPlayer._id}`);
            res.status(201).json(savedPlayer);
        } catch (dbErr) {
            console.error("!!! Database Error saving player:", dbErr);
            if (req.file) {
                fs.unlink(req.file.path, (unlinkErr) => {
                    if (unlinkErr) console.error("Error deleting orphaned file after DB error:", unlinkErr);
                });
            }
            if (dbErr.code === 11000) {
                return res.status(400).json({ message: `Player name '${name}' already exists.` });
            }
            res.status(500).json({ message: 'Server error saving player', error: dbErr.message });
        }
    });
});

// --- Placeholder for other routes ---

// PUT /api/players/:id
router.put('/:id', (req, res) => {
    console.log(`--- PUT /api/players/${req.params.id} ROUTE HIT ---`);
    // Use upload middleware to handle potential new photo upload
    uploadPlayerImage(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ message: err.message || "File upload error" });
        }

        const { name, category } = req.body;
        if (!name || !category) {
            return res.status(400).json({ message: 'Player name and category are required.' });
        }

        try {
            const player = await Player.findById(req.params.id);
            if (!player) {
                // If a new file was uploaded for a non-existent player, delete it
                if (req.file) { fs.unlink(req.file.path, e => e && console.error(e)); }
                return res.status(404).json({ message: 'Player not found' });
            }

            // Check for duplicate name (if name is being changed)
            if (name !== player.name) {
                const existingPlayer = await Player.findOne({ name: name });
                if (existingPlayer) {
                    if (req.file) { fs.unlink(req.file.path, e => e && console.error(e)); }
                    return res.status(400).json({ message: `Player name '${name}' already exists.` });
                }
            }

            const oldPhotoPath = player.photoUrl;

            // Update player fields
            player.name = name;
            player.category = category;
            if (req.file) { // If a new photo was uploaded
                player.photoUrl = `/uploads/players/${req.file.filename}`;
            }

            const updatedPlayer = await player.save();

            // If update was successful and a new photo was uploaded, delete the old one
            if (req.file && oldPhotoPath) {
                const fullOldPath = path.join(__dirname, '..', oldPhotoPath);
                fs.unlink(fullOldPath, (unlinkErr) => {
                    if (unlinkErr && unlinkErr.code !== 'ENOENT') { // Ignore if file already doesn't exist
                        console.error("Error deleting old player photo:", unlinkErr);
                    }
                });
            }

            res.json(updatedPlayer);

        } catch (dbErr) {
            if (req.file) { fs.unlink(req.file.path, e => e && console.error(e)); } // Clean up new file on any error
            res.status(500).json({ message: 'Server error updating player', error: dbErr.message });
        }
    });
});

// DELETE /api/players/:id 
router.delete('/:id', async (req, res) => {
    //console.log(`--- DELETE /api/players/${req.params.id} ROUTE HIT ---`);
    try {
        const playerId = req.params.id;

        const matchesWithPlayer = await Match.find({
            $or: [
                { player1: playerId }, { player2: playerId },
                { player3: playerId }, { player4: playerId },
                { 'team1.players': playerId }, { 'team2.players': playerId },
                { 'score.setDetails.team1Pair': playerId }, { 'score.setDetails.team2Pair': playerId },
                { 'score.relayLegs.team1Players': playerId }, { 'score.relayLegs.team2Players': playerId }
            ]
        }).limit(1);

        if (matchesWithPlayer.length > 0) {
            return res.status(400).json({ message: 'Cannot delete player. They are part of one or more existing matches.' });
        }
        

        const player = await Player.findById(playerId);
        if (!player) {
            return res.status(404).json({ message: 'Player not found' });
        }

        const photoPath = player.photoUrl;
        await Player.findByIdAndDelete(playerId);

        // Delete photo file from server if it exists
        if (photoPath) {
            const fullPath = path.join(__dirname, '..', photoPath);
            fs.unlink(fullPath, (unlinkErr) => {
                if (unlinkErr && unlinkErr.code !== 'ENOENT') {
                    console.error("Error deleting player photo:", unlinkErr);
                }
            });
        }
        
        res.status(200).json({ message: 'Player deleted successfully' });

    } catch (err) {
        console.error(`!!! ERROR in DELETE /api/players/${req.params.id}:`, err);
        res.status(500).json({ message: 'Server Error deleting player', error: err.message });
    }
});


module.exports = router;