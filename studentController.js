const db = require('../config/db');
const { createNotification } = require('./notificationController');
const { sendEmailNotification } = require('../utils/emailHelper');

const applyToAlumni = (req, res) => {
    const studentId = req.user.id;
    const { alumniProfileId } = req.body;

    db.run(`INSERT INTO applications (student_id, alumni_profile_id) VALUES (?, ?)`,
        [studentId, alumniProfileId],
        function (err) {
            if (err) {
                if (err.message.includes('UNIQUE')) {
                    return res.status(400).json({ error: 'Already applied' });
                }
                return res.status(500).json({ error: err.message });
            }

            const applicationId = this.lastID;

            // Notify the alumni about the new application
            db.get(`SELECT ap.user_id, u.email, u.name as alumni_name, ap.company_name, s.name as student_name 
                    FROM alumni_profiles ap 
                    JOIN users u ON ap.user_id = u.id
                    JOIN users s ON s.id = ?
                    WHERE ap.id = ?`, [studentId, alumniProfileId], (err, data) => {
                if (!err && data) {
                    const io = req.app.get('io');
                    const onlineUsers = req.app.get('onlineUsers');

                    const msg = `New Application: ${data.student_name} has applied to your profile at ${data.company_name}.`;
                    createNotification(data.user_id, msg, io, onlineUsers, 'Permission');
                    sendEmailNotification(data.email, 'New Student Application', msg);

                    // Direct socket emission to the alumni
                    if (io && onlineUsers) {
                        const alumniSocketId = onlineUsers.get(String(data.user_id));
                        if (alumniSocketId) {
                            io.to(alumniSocketId).emit('newJobApplication', {
                                applicationId,
                                studentName: data.student_name,
                                message: msg
                            });
                        }
                    }

                    // Global Sync
                    if (io) io.emit('adminDataUpdated');
                }
            });

            res.status(201).json({ message: 'Successfully applied', id: applicationId });
        }
    );
};

const getApplications = (req, res) => {
    const { studentId } = req.params;
    db.all(`SELECT alumni_profile_id, status FROM applications WHERE student_id = ?`, [studentId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
};

const uploadResume = (req, res) => {
    const studentId = req.user.id;
    const filePath = req.file ? req.file.filename : null;

    if (!filePath) return res.status(400).json({ error: 'No file uploaded' });

    db.run(`INSERT OR REPLACE INTO resumes (student_id, file_path) VALUES (?, ?)`,
        [studentId, filePath],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });

            db.run(`UPDATE users SET skills = ?, projects = ?, linkedin_url = ? WHERE id = ?`,
                [req.body.skills || null, req.body.projects || null, req.body.linkedinUrl || null, studentId],
                function (updateErr) {
                    if (updateErr) console.error("Error updating student profile data", updateErr);
                    
                    // Global Sync
                    const io = req.app.get('io');
                    if (io) io.emit('adminDataUpdated');
                }
            );

            res.json({ message: 'Resume uploaded and profile updated', filePath });
        }
    );
};

module.exports = { applyToAlumni, getApplications, uploadResume };
