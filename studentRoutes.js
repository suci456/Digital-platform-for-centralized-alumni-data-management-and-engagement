const express = require('express');
const multer = require('multer');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { applyToAlumni, getApplications, uploadResume } = require('../controllers/studentController');
const router = express.Router();

router.post('/apply', authenticateToken, authorizeRole(['Student']), applyToAlumni);
router.get('/:studentId/applications', getApplications);
router.post('/resume', authenticateToken, authorizeRole(['Student']), (req, res) => {
    upload.single('resume')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ error: `File upload error: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ error: err.message });
        }
        uploadResume(req, res);
    });
});

module.exports = router;
