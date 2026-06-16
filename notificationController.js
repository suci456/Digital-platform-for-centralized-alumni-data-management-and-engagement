const db = require('../config/db');

const createNotification = (userId, message, io, onlineUsers, category = 'General') => {
    db.run(`INSERT INTO notifications (user_id, message, category) VALUES (?, ?, ?)`, [userId, message, category], function(err) {
        if (err) {
            console.error("Failed to create notification:", err);
            return;
        }
        
        // Real-time socket emission
        if (io && onlineUsers) {
            const socketId = onlineUsers.get(String(userId));
            if (socketId) {
                io.to(socketId).emit('newNotification', {
                    id: this.lastID,
                    message,
                    category,
                    created_at: new Date().toISOString(),
                    is_read: 0
                });
            }
        }
    });
};

const getNotifications = (req, res) => {
    db.all(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC`, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
};

const markAsRead = (req, res) => {
    db.run(`UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Marked as read' });
    });
};

const deleteNotification = (req, res) => {
    db.run(`DELETE FROM notifications WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Notification deleted' });
    });
};

module.exports = { createNotification, getNotifications, markAsRead, deleteNotification };
