const db = require('../config/db');

const getDashboardData = (req, res) => {
    db.all(`SELECT id, name, email, role, skills, projects, linkedin_url FROM users`, [], (err, users) => {
        db.all(`SELECT * FROM alumni_profiles`, [], (err, profiles) => {
            db.all(`
        SELECT p.id, p.alumni_id, p.status, u.name, u.email 
        FROM permissions p 
        JOIN users u ON p.alumni_id = u.id
      `, [], (err, permissions) => {
                db.all(`SELECT * FROM applications`, [], (err, applications) => {
                    res.json({
                        users,
                        profiles,
                        permissions,
                        applications
                    });
                });
            });
        });
    });
};

const grantPermission = (req, res) => {
    const { permissionId } = req.body;
    db.run(`UPDATE permissions SET status = 'Granted' WHERE id = ?`, [permissionId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Permission granted' });
    });
};

const getAllMessages = (req, res) => {
    db.all(`
        SELECT m.*, s.name as sender_name, r.name as receiver_name 
        FROM messages m 
        JOIN users s ON m.sender_id = s.id 
        JOIN users r ON m.receiver_id = r.id 
        ORDER BY m.sent_at DESC
    `, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
};

const deleteMessage = (req, res, onlineUsers, io) => {
    const messageId = parseInt(req.params.id);
    db.get('SELECT sender_id, receiver_id FROM messages WHERE id = ?', [messageId], (err, msg) => {
        if (!err && msg) {
            db.run('DELETE FROM messages WHERE id = ?', [messageId], function (err) {
                if (err) return res.status(500).json({ error: err.message });
                
                [msg.sender_id, msg.receiver_id].forEach(uId => {
                    const sId = onlineUsers.get(uId);
                    if (sId) io.to(sId).emit('messageDeleted', { messageId });
                });
                
                res.json({ message: 'Message deleted successfully' });
            });
        } else {
            res.status(404).json({ error: 'Message not found' });
        }
    });
};

module.exports = { getDashboardData, grantPermission, getAllMessages, deleteMessage };
