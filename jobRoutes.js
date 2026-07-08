const express = require('express');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { createJob, getJobs, applyToJob, getStudentApplications, getAlumniJobs, getJobApplications } = require('../controllers/jobController');
const router = express.Router();

router.post('/', authenticateToken, authorizeRole(['Alumni']), createJob);
router.get('/', authenticateToken, getJobs);
router.post('/apply', authenticateToken, authorizeRole(['Student']), applyToJob);
router.get('/applications/:studentId', authenticateToken, authorizeRole(['Student']), getStudentApplications);
router.get('/:alumniId/jobs', authenticateToken, authorizeRole(['Alumni', 'Admin']), getAlumniJobs);
router.get('/:jobId/applications', authenticateToken, authorizeRole(['Alumni', 'Admin']), getJobApplications);

module.exports = router;
