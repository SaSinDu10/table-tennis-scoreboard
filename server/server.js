// backend/server.js (or app.js)
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path'); 
require('dotenv').config();

const playerRoutes = require('./routes/players');
const matchRoutes = require('./routes/matches');
const statsRoutes = require('./routes/stats');
// Import other routes... (matches, etc.)

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json()); // for parsing application/json

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/players', playerRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/stats', statsRoutes);

app.use('/api/matches', require('./routes/matches'));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.error("MongoDB Connection Error:", err));

// Start Server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Basic error handling middleware (optional but good)
app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err.stack);
    res.status(500).send('Something broke!');
});