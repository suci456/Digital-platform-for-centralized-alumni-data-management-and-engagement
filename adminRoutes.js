const express = require('express');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { getDashboardData, grantPermission, getAllMessages, deleteMessage } = require('../controllers/adminController');

module.exports = (io, onlineUsers) => {
    const router = express.Router();

    router.get('/data', authenticateToken, authorizeRole(['Admin']), getDashboardData);
    router.post('/permission/grant', grantPermission);
    router.get('/messages', authenticateToken, authorizeRole(['Admin']), getAllMessages);
    router.delete('/messages/:id', authenticateToken, authorizeRole(['Admin']), (req, res) => deleteMessage(req, res, onlineUsers, io));

    return router;
};
