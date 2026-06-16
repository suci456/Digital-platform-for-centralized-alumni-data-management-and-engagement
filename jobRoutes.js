const express = require('express');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { createJob, getJobs, applyToJob, getStudentApplications, getAlumniJobs, getJobApplications, deleteJob } = require('../controllers/jobController');
module.exports = (io, onlineUsers) => {
    const router = express.Router();

    router.post('/', authenticateToken, authorizeRole(['Alumni']), (req, res) => createJob(req, res, io, onlineUsers));
    router.get('/', authenticateToken, getJobs);
    router.post('/apply', authenticateToken, authorizeRole(['Student']), (req, res) => applyToJob(req, res, io, onlineUsers));
    router.get('/applications/:studentId', authenticateToken, authorizeRole(['Student']), getStudentApplications);
    router.get('/:alumniId/jobs', authenticateToken, authorizeRole(['Alumni', 'Admin']), getAlumniJobs);
    router.get('/:jobId/applications', authenticateToken, authorizeRole(['Alumni', 'Admin']), getJobApplications);
    router.delete('/:jobId', authenticateToken, authorizeRole(['Alumni', 'Admin']), (req, res) => deleteJob(req, res, io, onlineUsers));

    return router;
};
