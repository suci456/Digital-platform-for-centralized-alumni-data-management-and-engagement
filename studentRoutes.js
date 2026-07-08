const express = require('express');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { applyToAlumni, getApplications, uploadResume } = require('../controllers/studentController');
const router = express.Router();

router.post('/apply', authenticateToken, authorizeRole(['Student']), applyToAlumni);
router.get('/:studentId/applications', getApplications);
router.post('/resume', authenticateToken, authorizeRole(['Student']), upload.single('resume'), uploadResume);

module.exports = router;
