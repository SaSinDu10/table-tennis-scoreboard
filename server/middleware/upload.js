// server/middleware/upload.js
const multer = require('multer');
const path = require('path');

// --- Reusable Helper Function to Check File Type ---
// We only need ONE of these.
function checkImageType(file, cb) {
    // Allowed extensions
    const filetypes = /jpeg|jpg|png|gif/;
    // Check extension
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    // Check mime type
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true); // Success
    } else {
        cb(new Error('Error: Images Only! (jpeg, jpg, png, gif)')); // Pass an actual Error object
    }
}
// ---------------------------------------------------


// --- Multer Storage Engine for PLAYER Photos ---
const playerPhotoStorage = multer.diskStorage({
    destination: './uploads/players/', // Folder for player photos
    filename: function(req, file, cb) {
        // Generate unique filename
        cb(null, 'playerImage-' + Date.now() + path.extname(file.originalname));
    }
});

// --- Middleware for PLAYER Photo Upload ---
const uploadPlayerImage = multer({
    storage: playerPhotoStorage,
    limits: { fileSize: 1000000 }, // 1MB limit
    fileFilter: function(req, file, cb) {
        checkImageType(file, cb); // Use the reusable helper
    }
}).single('playerImage'); // Expects the file on a form field named 'playerImage'
// ------------------------------------------


// --- Multer Storage Engine for TEAM Logos ---
const teamLogoStorage = multer.diskStorage({
    destination: './uploads/teams/', // Separate folder for team logos
    filename: function(req, file, cb) {
        // Generate unique filename
        cb(null, 'teamLogo-' + Date.now() + path.extname(file.originalname));
    }
});

// --- Middleware for TEAM Logo Upload ---
const uploadTeamLogo = multer({
    storage: teamLogoStorage,
    limits: { fileSize: 1000000 }, // 1MB limit
    fileFilter: function(req, file, cb) {
        checkImageType(file, cb); // Use the reusable helper
    }
}).single('teamLogo');


module.exports = {
    uploadPlayerImage,
    uploadTeamLogo
};
