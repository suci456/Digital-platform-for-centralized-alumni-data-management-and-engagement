const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { getNotifications, markAsRead, deleteNotification } = require('../controllers/notificationController');
const router = express.Router();

router.get('/', authenticateToken, getNotifications);
router.put('/:id/read', authenticateToken, markAsRead);
router.delete('/:id', authenticateToken, deleteNotification);

module.exports = router;
