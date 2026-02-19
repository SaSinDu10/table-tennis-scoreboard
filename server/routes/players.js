// server/routes/players.js
const express = require('express');
const router = express.Router();
const Player = require('../models/Player');
const upload = require('../middleware/upload');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const { uploadPlayerImage } = require('../middleware/upload');

// --- GET all players ---
router.get('/', async (req, res) => {
    console.log('--- GET /api/players ROUTE HIT ---');
    try {
        const players = await Player.find().sort({ name: 1 });
        console.log(`Found ${players.length} players.`);
        res.json(players);
    } catch (err) {
        console.error("!!! ERROR in GET /api/players:", err);
        res.status(500).json({ message: 'Server Error fetching players' });
    }
});

// --- POST create a new player (Handles file upload) ---
router.post('/', (req, res) => {
    console.log('--- POST /api/players ROUTE HIT ---');
    uploadPlayerImage(req, res, async (err) => {
        // Handle potential Multer errors
        if (err) {
            console.error("Player Photo Multer Error:", err);
            if (err instanceof multer.MulterError) {
                return res.status(400).json({ message: `File upload error: ${err.code}` });
            }
            return res.status(400).json({ message: err.message || "File upload error" });
        }

        console.log('Multer processed file (if any). Req file:', req.file);
        console.log('Request Body:', req.body);
        const { name, category } = req.body;

        // Validate Text Fields
        if (!name || !category) {
            console.warn("Validation failed: Name or category missing.");
            if (req.file) { // Clean up orphaned file
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
            console.log('Attempting to save new player...');
            const savedPlayer = await newPlayer.save();
            console.log(`Player saved successfully: ${savedPlayer._id}`);
            res.status(201).json(savedPlayer);
        } catch (dbErr) {
            console.error("!!! Database Error saving player:", dbErr);
            if (req.file) { // Clean up orphaned file on DB error
                fs.unlink(req.file.path, (unlinkErr) => {
                    if (unlinkErr) console.error("Error deleting orphaned file after DB error:", unlinkErr);
                });
            }
            if (dbErr.code === 11000) { // Duplicate name error
                return res.status(400).json({ message: `Player name '${name}' already exists.` });
            }
            res.status(500).json({ message: 'Server error saving player', error: dbErr.message });
        }
    });
});

// --- Placeholder for other routes ---
// GET /api/players/:id
router.get('/:id', async (req, res) => {
    console.log(`--- GET /api/players/${req.params.id} ROUTE HIT ---`);
    try {
        const player = await Player.findById(req.params.id);
        if (!player) {
            return res.status(404).json({ message: 'Player not found' });
        }
        res.json(player);
    } catch (err) {
        console.error(`!!! ERROR in GET /api/players/${req.params.id}:`, err);
        if (err.name === 'CastError') { return res.status(400).json({ message: 'Invalid Player ID format' }); }
        res.status(500).json({ message: 'Server Error fetching player' });
    }
});

// PUT /api/players/:id
router.put('/:id', (req, res) => {
    console.log(`--- PUT /api/players/${req.params.id} ROUTE HIT ---`);
    res.status(501).json({ message: 'Player update not implemented yet.' });
});

// DELETE /api/players/:id 
router.delete('/:id', async (req, res) => {
    console.log(`--- DELETE /api/players/${req.params.id} ROUTE HIT ---`);
    try {
        console.log(`Finding player ${req.params.id} to delete...`);
        const player = await Player.findById(req.params.id);
        if (!player) { return res.status(404).json({ message: 'Player not found' }); }
        console.warn(`DELETING PLAYER ${player.name} - Match handling not implemented!`);
        // -------------------------------------------------------------------

        // Delete photo file if it exists
        if (player.photoUrl) {
            const filePath = path.join(__dirname, '..', player.photoUrl);
            console.log(`Attempting to delete photo file: ${filePath}`);
            fs.unlink(filePath, (unlinkErr) => {
                if (unlinkErr && unlinkErr.code !== 'ENOENT') {
                    console.error("Error deleting player photo:", unlinkErr);
                } else if (!unlinkErr) {
                    console.log(`Deleted photo file: ${filePath}`);
                }
            });
        }

        await Player.findByIdAndDelete(req.params.id);
        console.log(`Player ${req.params.id} deleted successfully.`);
        res.status(200).json({ message: 'Player deleted successfully', deletedPlayerId: req.params.id });

    } catch (err) {
        console.error(`!!! ERROR in DELETE /api/players/${req.params.id}:`, err);
        res.status(500).json({ message: 'Server Error deleting player', error: err.message });
    }
});

module.exports = router;