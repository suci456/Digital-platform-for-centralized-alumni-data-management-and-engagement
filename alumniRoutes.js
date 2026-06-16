const express = require('express');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { createProfile, updateProfile, getAlumniProfile, getProfiles, searchProfiles, getAlumniApplications, requestPermission } = require('../controllers/alumniController');

module.exports = (io, onlineUsers) => {
    const router = express.Router();

    router.post('/profile', authenticateToken, authorizeRole(['Alumni']), (req, res) => createProfile(req, res, io, onlineUsers));
    router.put('/profile', authenticateToken, authorizeRole(['Alumni']), (req, res) => updateProfile(req, res, io, onlineUsers));
    router.get('/profile', authenticateToken, authorizeRole(['Alumni']), getAlumniProfile);
    router.get('/profiles', authenticateToken, getProfiles);
    router.get('/search', authenticateToken, searchProfiles);
    router.get('/:alumniId/applications', getAlumniApplications);
    router.post('/permission', requestPermission);
    
    return router;
};
