const db = require('../config/db');

const createNotification = (userId, message) => {
    db.run(`INSERT INTO notifications (user_id, message) VALUES (?, ?)`, [userId, message], (err) => {
        if (err) console.error("Failed to create notification:", err);
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

module.exports = { createNotification, getNotifications, markAsRead };
