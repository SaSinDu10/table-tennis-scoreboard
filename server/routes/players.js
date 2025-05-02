// server/routes/players.js
const express = require('express');
const router = express.Router();
const Player = require('../models/Player'); // Ensure path is correct
const upload = require('../middleware/upload'); // Ensure path is correct
const fs = require('fs'); // Import fs for potential file deletion on error
const path = require('path'); // Import path

// --- GET all players (Sorted Alphabetically by Name) ---
router.get('/', async (req, res) => {
    console.log('--- GET /api/players ROUTE HIT ---');
    try {
        // Find all players and sort alphabetically by name (ascending)
        const players = await Player.find().sort({ name: 1 }); // Use sort({ name: 1 })
        console.log(`Found ${players.length} players.`);
        res.json(players); // Send the sorted players array
    } catch (err) {
        console.error("!!! ERROR in GET /api/players:", err);
        res.status(500).json({ message: 'Server Error fetching players' });
    }
});
// ---------------------------------------------

// --- POST create a new player (Handles file upload) ---
router.post('/', (req, res) => {
    console.log('--- POST /api/players ROUTE HIT ---');
    // Use the upload middleware configured in middleware/upload.js
    // It expects the file in a field named 'playerImage'
    upload(req, res, async (err) => {
        // --- Handle Multer Errors ---
        if (err) {
            console.error("Multer Error:", err);
            // Provide specific Multer error codes if possible
            if (err instanceof multer.MulterError) {
                // e.g., err.code === 'LIMIT_FILE_SIZE'
                return res.status(400).json({ message: `File upload error: ${err.code}` });
            } else {
                // Handle non-Multer errors from fileFilter (e.g., "Images Only!")
                return res.status(400).json({ message: err.message || err });
            }
        }
        // --- End Handle Multer Errors ---

        console.log('Multer processed file (if any). Req file:', req.file);
        console.log('Request Body:', req.body);
        const { name, category } = req.body;

        // --- Validate Text Fields ---
        if (!name || !category) {
            console.warn("Validation failed: Name or category missing.");
            // If a file was uploaded but validation failed, delete the uploaded file
            if (req.file) {
                console.log(`Deleting orphaned file: ${req.file.path}`);
                fs.unlink(req.file.path, (unlinkErr) => {
                    if (unlinkErr) console.error("Error deleting orphaned file:", unlinkErr);
                });
            }
            return res.status(400).json({ message: 'Player name and category are required.' });
        }
        // --------------------------

        // Construct photoUrl if file was uploaded
        const photoUrl = req.file ? `/uploads/players/${req.file.filename}` : null;
        console.log(`Photo URL determined: ${photoUrl}`);

        // Create new Player document
        const newPlayer = new Player({
            name: name,
            category: category,
            photoUrl: photoUrl
        });

        // --- Save to Database ---
        try {
            console.log('Attempting to save new player...');
            const savedPlayer = await newPlayer.save();
            console.log(`Player saved successfully: ${savedPlayer._id}`);
            res.status(201).json(savedPlayer); // Respond with created player data
        } catch (dbErr) {
            console.error("!!! Database Error saving player:", dbErr);
            // If DB save fails, delete the uploaded file to prevent orphans
            if (req.file) {
                console.log(`DB save failed. Deleting orphaned file: ${req.file.path}`);
                fs.unlink(req.file.path, (unlinkErr) => {
                    if (unlinkErr) console.error("Error deleting orphaned file after DB error:", unlinkErr);
                });
            }

            // Handle specific DB errors (e.g., duplicate name)
            if (dbErr.code === 11000) { // MongoDB duplicate key error
                return res.status(400).json({ message: `Player name '${name}' already exists.` });
            }
            if (dbErr.name === 'ValidationError') {
                return res.status(400).json({ message: 'Validation failed', error: dbErr.message });
            }
            // Generic server error for other DB issues
            res.status(500).json({ message: 'Server error saving player', error: dbErr.message });
        }
        // --------------------
    });
});
// ------------------------------------------

// --- Placeholder for other routes (implement later if needed) ---
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

// PUT /api/players/:id (Example - update requires more logic)
router.put('/:id', (req, res) => {
    console.log(`--- PUT /api/players/${req.params.id} ROUTE HIT ---`);
    res.status(501).json({ message: 'Player update not implemented yet.' }); // 501 Not Implemented
});

// DELETE /api/players/:id (Example - requires caution: handle related matches?)
router.delete('/:id', async (req, res) => {
    console.log(`--- DELETE /api/players/${req.params.id} ROUTE HIT ---`);
    try {
        console.log(`Finding player ${req.params.id} to delete...`);
        const player = await Player.findById(req.params.id);
        if (!player) { return res.status(404).json({ message: 'Player not found' }); }

        // --- CAUTION: Add logic here to handle matches this player is in ---
        // Option 1: Prevent deletion if in matches?
        // Option 2: Delete/update related matches? (Complex)
        console.warn(`DELETING PLAYER ${player.name} - Match handling not implemented!`);
        // -------------------------------------------------------------------

        // Delete photo file if it exists
        if (player.photoUrl) {
            const filePath = path.join(__dirname, '..', player.photoUrl); // Construct absolute path
            console.log(`Attempting to delete photo file: ${filePath}`);
            fs.unlink(filePath, (unlinkErr) => {
                if (unlinkErr && unlinkErr.code !== 'ENOENT') { // Ignore 'file not found' errors
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
// -----------------------------------------------------------------

module.exports = router;