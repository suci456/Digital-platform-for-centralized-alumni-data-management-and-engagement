const db = require('../config/db');
const { createNotification } = require('./notificationController');

const sendMessage = (req, res, io, onlineUsers) => {
    const senderId = req.user.id;
    const { receiverId, content } = req.body;

    // First, check roles to determine if a limit exists
    db.all('SELECT id, role FROM users WHERE id IN (?, ?)', [senderId, receiverId], (err, users) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const sender = users.find(u => u.id === senderId);
        const receiver = users.find(u => u.id === receiverId);

        if (sender?.role === 'Admin' || receiver?.role === 'Admin') {
            return res.status(403).json({ error: 'System Administrators are not involved in messaging. Chat is only for Students and Alumni.' });
        }
        
        const isStudentAlumniPair = (sender?.role === 'Student' && receiver?.role === 'Alumni') || 
                                    (sender?.role === 'Alumni' && receiver?.role === 'Student');

        const checkMessagingPermission = (callback) => {
            if (sender?.role === 'Alumni' && receiver?.role === 'Student') {
                db.get('SELECT can_message_students FROM alumni_profiles WHERE user_id = ?', [senderId], (err, profile) => {
                    if (err) return res.status(500).json({ error: err.message });
                    if (profile && !profile.can_message_students) {
                        return res.status(403).json({ error: 'Admin approval required to send messages to students.' });
                    }
                    callback();
                });
            } else {
                callback();
            }
        };

        const checkLimitAndSend = () => {
            checkMessagingPermission(() => {
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
                        
                        const receiverSocketId = onlineUsers.get(String(receiverId));
                        if (receiverSocketId) {
                            io.to(receiverSocketId).emit('receiveMessage', newMessage);
                        }
                        
                        // Real-time monitoring for Admins
                        io.emit('adminMonitorMessage', newMessage);

                        // Also create a persistent notification for the message with category
                        createNotification(receiverId, `New message from ${newMessage.sender_name}: ${content.substring(0, 30)}${content.length > 30 ? '...' : ''}`, io, onlineUsers, 'Chat');
                        
                        res.status(201).json({ message: 'Message sent', id: messageId, data: newMessage });
                    });
                });
            });
        };

        if (isStudentAlumniPair) {
            // Requirement 2: Chat Limit (Max 50 messages)
            db.get(`SELECT COUNT(*) as count FROM messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)`, 
                [senderId, receiverId, receiverId, senderId], (err, row) => {
                if (err) return res.status(500).json({ error: err.message });
                if (row.count >= 50) {
                    return res.status(403).json({ error: 'Chat limit reached (50 messages). Contact admin for further communication.' });
                }
                checkLimitAndSend();
            });
        } else {
            // Admins or other pairs have no limits
            checkLimitAndSend();
        }
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
