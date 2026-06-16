const express = require('express');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { getDashboardData, updatePermissionStatus, updateAlumniPermissions, getAllMessages, deleteMessage, toggleMessageStatus, deleteUser, deletePermission } = require('../controllers/adminController');

module.exports = (io, onlineUsers) => {
    const router = express.Router();

    router.get('/data', authenticateToken, authorizeRole(['Admin']), getDashboardData);
    router.put('/permission/status', authenticateToken, authorizeRole(['Admin']), (req, res) => updatePermissionStatus(req, res, io, onlineUsers));
    router.patch('/alumni/:alumniId/permissions', authenticateToken, authorizeRole(['Admin']), (req, res) => updateAlumniPermissions(req, res, io));
    router.get('/messages', authenticateToken, authorizeRole(['Admin']), getAllMessages);
    router.delete('/messages/:id', authenticateToken, authorizeRole(['Admin']), (req, res) => deleteMessage(req, res, io));
    router.put('/messages/:id/toggle-read', authenticateToken, authorizeRole(['Admin']), (req, res) => toggleMessageStatus(req, res, io));
    router.delete('/users/:id', authenticateToken, authorizeRole(['Admin']), (req, res) => deleteUser(req, res, io, onlineUsers));
    router.delete('/permission/:id', authenticateToken, authorizeRole(['Admin']), (req, res) => deletePermission(req, res, io, onlineUsers));

    return router;
};
