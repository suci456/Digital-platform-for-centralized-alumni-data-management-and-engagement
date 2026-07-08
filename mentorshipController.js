const db = require('../config/db');
const { createNotification } = require('./notificationController');
const { sendEmailNotification } = require('../utils/emailHelper');

const requestMentorship = (req, res) => {
    const studentId = req.user.id;
    const { alumniProfileId } = req.body;
    db.run(`INSERT INTO mentorship_requests (student_id, alumni_profile_id) VALUES (?, ?)`, [studentId, alumniProfileId], function (err) {
        if (err) {
            if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Request already sent' });
            return res.status(500).json({ error: err.message });
        }

        db.get(`SELECT u.id, u.email, s.name as student_name FROM alumni_profiles ap JOIN users u ON ap.user_id = u.id, users s WHERE ap.id = ? AND s.id = ?`, [alumniProfileId, studentId], (err, data) => {
            if (data) {
                const msg = `You have a new mentorship request from ${data.student_name}.`;
                createNotification(data.id, msg);
                sendEmailNotification(data.email, 'New Mentorship Request', msg);
            }
        });

        res.status(201).json({ message: 'Mentorship requested', id: this.lastID });
    });
};

const respondMentorship = (req, res) => {
    const alumniUserId = req.user.id;
    const { requestId, status } = req.body;

    db.get(`SELECT mr.id, mr.student_id, u.email, a.name as alumni_name FROM mentorship_requests mr JOIN alumni_profiles ap ON mr.alumni_profile_id = ap.id JOIN users u ON mr.student_id = u.id, users a WHERE mr.id = ? AND ap.user_id = ? AND a.id = ?`, [requestId, alumniUserId, alumniUserId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(403).json({ error: 'Unauthorized or request not found' });

        db.run(`UPDATE mentorship_requests SET status = ? WHERE id = ?`, [status, requestId], function (err) {
            if (err) return res.status(500).json({ error: err.message });

            const msg = `Your mentorship request to ${row.alumni_name} has been ${status.toLowerCase()}.`;
            createNotification(row.student_id, msg);
            sendEmailNotification(row.email, `Mentorship Request ${status}`, msg);

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
    db.all(`SELECT mr.*, u.name as student_name, u.email as student_email FROM mentorship_requests mr JOIN alumni_profiles ap ON mr.alumni_profile_id = ap.id JOIN users u ON mr.student_id = u.id WHERE ap.user_id = ?`, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
};

module.exports = { requestMentorship, respondMentorship, getStudentMentorships, getAlumniMentorships };
