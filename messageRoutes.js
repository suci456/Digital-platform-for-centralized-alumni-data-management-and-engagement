const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { sendMessage, getMessages, getContacts } = require('../controllers/messageController');

module.exports = (io, onlineUsers) => {
    const router = express.Router();

    router.post('/send', authenticateToken, (req, res) => sendMessage(req, res, io, onlineUsers));
    router.get('/:userId', authenticateToken, getMessages);
    router.get('/contacts/list', authenticateToken, getContacts);

    return router;
};
