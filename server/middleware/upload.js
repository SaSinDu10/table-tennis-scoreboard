// server/middleware/upload.js
const multer = require('multer');
const path = require('path');


function checkImageType(file, cb) {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Error: Images Only! (jpeg, jpg, png, gif)'));
    }
}


// --- Multer Storage Engine for PLAYER Photos ---
const playerPhotoStorage = multer.diskStorage({
    destination: './uploads/players/',
    filename: function(req, file, cb) {
        cb(null, 'playerImage-' + Date.now() + path.extname(file.originalname));
    }
});

// --- Middleware for PLAYER Photo Upload ---
const uploadPlayerImage = multer({
    storage: playerPhotoStorage,
    limits: { fileSize: 1000000 },
    fileFilter: function(req, file, cb) {
        checkImageType(file, cb);
    }
}).single('playerImage'); 


// --- Multer Storage Engine for TEAM Logos ---
const teamLogoStorage = multer.diskStorage({
    destination: './uploads/teams/',
    filename: function(req, file, cb) {
        cb(null, 'teamLogo-' + Date.now() + path.extname(file.originalname));
    }
});

// --- Middleware for TEAM Logo Upload ---
const uploadTeamLogo = multer({
    storage: teamLogoStorage,
    limits: { fileSize: 1000000 },
    fileFilter: function(req, file, cb) {
        checkImageType(file, cb);
    }
}).single('teamLogo');


module.exports = {
    uploadPlayerImage,
    uploadTeamLogo
};
