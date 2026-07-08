const db = require('../config/db');

const sendMessage = (req, res, io, onlineUsers) => {
    const senderId = req.user.id;
    const { receiverId, content } = req.body;

    db.run(`INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)`, [senderId, receiverId, content], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        const messageId = this.lastID;
        
        db.get('SELECT name as sender_name FROM users WHERE id = ?', [senderId], (err, row) => {
            const newMessage = {
                id: messageId,
                sender_id: senderId,
                receiver_id: receiverId,
                content: content,
                is_read: 0,
                sent_at: new Date().toISOString(),
                sender_name: row ? row.sender_name : 'Unknown'
            };
            
            const receiverSocketId = onlineUsers.get(receiverId);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('receiveMessage', newMessage);
            }
            
            res.status(201).json({ message: 'Message sent', id: messageId, data: newMessage });
        });
    });
};

const getMessages = (req, res) => {
    const currentUserId = req.user.id;
    const otherUserId = req.params.userId;

    db.all(`
        SELECT m.*, u.name as sender_name 
        FROM messages m 
        JOIN users u ON m.sender_id = u.id
        WHERE (m.sender_id = ? AND m.receiver_id = ?) 
           OR (m.sender_id = ? AND m.receiver_id = ?)
        ORDER BY m.sent_at ASC
    `, [currentUserId, otherUserId, otherUserId, currentUserId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
};

const getContacts = (req, res) => {
    const currentUserId = req.user.id;
    db.all(`
        SELECT DISTINCT u.id, u.name, u.role
        FROM users u
        WHERE u.id IN (
            SELECT receiver_id FROM messages WHERE sender_id = ?
            UNION
            SELECT sender_id FROM messages WHERE receiver_id = ?
            UNION
            SELECT mr.student_id 
            FROM mentorship_requests mr 
            JOIN alumni_profiles ap ON mr.alumni_profile_id = ap.id 
            WHERE ap.user_id = ? AND mr.status = 'Accepted'
            UNION
            SELECT ap.user_id 
            FROM mentorship_requests mr 
            JOIN alumni_profiles ap ON mr.alumni_profile_id = ap.id 
            WHERE mr.student_id = ? AND mr.status = 'Accepted'
        )
    `, [currentUserId, currentUserId, currentUserId, currentUserId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
};

module.exports = { sendMessage, getMessages, getContacts };
