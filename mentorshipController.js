const db = require('../config/db');
const { createNotification } = require('./notificationController');
const { sendEmailNotification } = require('../utils/emailHelper');

const requestMentorship = (req, res, io, onlineUsers) => {
    const studentId = req.user.id;
    const { alumniProfileId } = req.body;
    db.run(`INSERT INTO mentorship_requests (student_id, alumni_profile_id) VALUES (?, ?)`, [studentId, alumniProfileId], function (err) {
        if (err) {
            if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Request already sent' });
            return res.status(500).json({ error: err.message });
        }

        const requestId = this.lastID;

        db.get(`SELECT u.id, u.email, s.name as student_name FROM alumni_profiles ap JOIN users u ON ap.user_id = u.id, users s WHERE ap.id = ? AND s.id = ?`, [alumniProfileId, studentId], (err, data) => {
            if (data) {
                const msg = `New Internship Application: ${data.student_name} applied for mentorship.`;
                createNotification(data.id, msg, io, onlineUsers, 'Permission');
                sendEmailNotification(data.email, 'New Mentorship Request', msg);

                // Socket Emission
                const alumniSocketId = onlineUsers?.get(data.id);
                if (alumniSocketId && io) {
                    io.to(alumniSocketId).emit('newMentorshipRequest', {
                        requestId: requestId,
                        studentName: data.student_name,
                        message: msg
                    });
                }
            }
        });

        // Global Sync handled via the passed 'io' parameter
        if (io) io.emit('adminDataUpdated');

        res.status(201).json({ message: 'Mentorship requested', id: requestId });
    });
};

const respondMentorship = (req, res, io, onlineUsers) => {
    const alumniUserId = req.user.id;
    const { requestId, status } = req.body;

    db.get(`
        SELECT mr.id, mr.student_id, u.email, a.name as alumni_name 
        FROM mentorship_requests mr 
        JOIN alumni_profiles ap ON mr.alumni_profile_id = ap.id 
        JOIN users u ON mr.student_id = u.id 
        JOIN users a ON ap.user_id = a.id
        WHERE mr.id = ? AND ap.user_id = ? AND a.id = ?`, [requestId, alumniUserId, alumniUserId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(403).json({ error: 'Unauthorized or request not found' });

        db.run(`UPDATE mentorship_requests SET status = ? WHERE id = ?`, [status, requestId], function (err) {
            if (err) return res.status(500).json({ error: err.message });

            const msg = `Your mentorship request to ${row.alumni_name} has been ${status.toLowerCase()}.`;
            createNotification(row.student_id, msg, io, onlineUsers, 'Permission');
            sendEmailNotification(row.email, `Mentorship Request ${status}`, msg);

            // Socket Emission
            const studentSocketId = onlineUsers?.get(row.student_id);
            if (studentSocketId && io) {
                io.to(studentSocketId).emit('mentorshipResponse', {
                    requestId: requestId,
                    status: status,
                    alumniName: row.alumni_name,
                    message: msg
                });
            }

            // Global Sync handled via the passed 'io' parameter
            if (io) io.emit('adminDataUpdated');

            res.json({ message: `Mentorship ${status}` });
        });
    });
};

const getStudentMentorships = (req, res) => {
    db.all(`SELECT mr.*, u.name as alumni_name, ap.company_name FROM mentorship_requests mr JOIN alumni_profiles ap ON mr.alumni_profile_id = ap.id JOIN users u ON ap.user_id = u.id WHERE mr.student_id = ?`, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
};

const getAlumniMentorships = (req, res) => {
    const alumniId = req.user.id;
    
    db.get(`SELECT status FROM permissions WHERE alumni_id = ?`, [alumniId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (!row || row.status !== 'Granted') {
            return res.status(403).json({ error: 'Permission required to view student data', status: row?.status || 'None' });
        }
        
        db.all(`SELECT mr.*, u.name as student_name, u.email as student_email FROM mentorship_requests mr JOIN alumni_profiles ap ON mr.alumni_profile_id = ap.id JOIN users u ON mr.student_id = u.id WHERE ap.user_id = ?`, [alumniId], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    });
};

module.exports = { requestMentorship, respondMentorship, getStudentMentorships, getAlumniMentorships };
