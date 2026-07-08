const express = require('express');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { createProfile, getProfiles, searchProfiles, getAlumniApplications, requestPermission } = require('../controllers/alumniController');
const router = express.Router();

router.post('/profile', authenticateToken, authorizeRole(['Alumni']), createProfile);
router.get('/profiles', authenticateToken, getProfiles);
router.get('/search', authenticateToken, searchProfiles);
router.get('/:alumniId/applications', getAlumniApplications);
router.post('/permission', requestPermission);

module.exports = router;
