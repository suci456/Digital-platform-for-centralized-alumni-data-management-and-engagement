const express = require('express');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { requestMentorship, respondMentorship, getStudentMentorships, getAlumniMentorships } = require('../controllers/mentorshipController');
const router = express.Router();

router.post('/request', authenticateToken, authorizeRole(['Student']), requestMentorship);
router.post('/respond', authenticateToken, authorizeRole(['Alumni']), respondMentorship);
router.get('/student', authenticateToken, authorizeRole(['Student']), getStudentMentorships);
router.get('/alumni', authenticateToken, authorizeRole(['Alumni']), getAlumniMentorships);

module.exports = router;
