// backend/middleware/upload.js
const multer = require('multer');
const path = require('path');

// Set up storage engine
const storage = multer.diskStorage({
    destination: './uploads/players/', // Folder to save images
    filename: function(req, file, cb) {
        // Generate unique filename: fieldname-timestamp.extension
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

// Init upload variable
const upload = multer({
    storage: storage,
    limits: { fileSize: 1000000 }, // Limit file size (e.g., 1MB)
    fileFilter: function(req, file, cb) {
        checkFileType(file, cb);
    }
}).single('playerImage'); // 'playerImage' is the name of the form field

// Check File Type function
function checkFileType(file, cb) {
    // Allowed extensions
    const filetypes = /jpeg|jpg|png|gif/;
    // Check extension
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    // Check mime type
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb('Error: Images Only!'); // Send an error if file type is wrong
    }
}

module.exports = upload;