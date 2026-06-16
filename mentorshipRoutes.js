const express = require('express');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { requestMentorship, respondMentorship, getStudentMentorships, getAlumniMentorships } = require('../controllers/mentorshipController');
module.exports = (io, onlineUsers) => {
    const router = express.Router();

    router.post('/request', authenticateToken, authorizeRole(['Student']), (req, res) => requestMentorship(req, res, io, onlineUsers));
    router.post('/respond', authenticateToken, authorizeRole(['Alumni']), (req, res) => respondMentorship(req, res, io, onlineUsers));
    router.get('/student', authenticateToken, authorizeRole(['Student']), getStudentMentorships);
    router.get('/alumni', authenticateToken, authorizeRole(['Alumni']), getAlumniMentorships);

    return router;
};
