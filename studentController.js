const db = require('../config/db');

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
            res.status(201).json({ message: 'Successfully applied', id: this.lastID });
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
                }
            );

            res.json({ message: 'Resume uploaded and profile updated', filePath });
        }
    );
};

module.exports = { applyToAlumni, getApplications, uploadResume };
