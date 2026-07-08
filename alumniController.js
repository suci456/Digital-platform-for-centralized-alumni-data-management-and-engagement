const db = require('../config/db');

const createProfile = (req, res) => {
    const userId = req.user.id;
    const { companyName, domain, description, experienceYears, achievements, companyHistory } = req.body;

    db.run(`INSERT INTO alumni_profiles (user_id, company_name, domain, description, experience_years, achievements, company_history) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, companyName, domain, description, experienceYears || null, achievements || null, companyHistory || null],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ message: 'Profile created', id: this.lastID });
        }
    );
};

const getProfiles = (req, res) => {
    db.all(`
    SELECT ap.id, ap.company_name, ap.domain, ap.description, ap.experience_years, ap.achievements, ap.company_history, u.name as alumni_name, u.email
    FROM alumni_profiles ap
    JOIN users u ON ap.user_id = u.id
  `, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
};

const searchProfiles = (req, res) => {
    const { company, domain, experience } = req.query;
    let query = `
    SELECT ap.id, ap.company_name, ap.domain, ap.description, ap.experience_years, ap.achievements, ap.company_history, u.name as alumni_name, u.email
    FROM alumni_profiles ap
    JOIN users u ON ap.user_id = u.id
    WHERE 1=1
  `;
    const params = [];

    if (company) {
        query += ` AND ap.company_name LIKE ?`;
        params.push(`%${company}%`);
    }
    if (domain) {
        query += ` AND ap.domain LIKE ?`;
        params.push(`%${domain}%`);
    }
    if (experience) {
        query += ` AND ap.experience_years >= ?`;
        params.push(experience);
    }

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
};

const getAlumniApplications = (req, res) => {
    const { alumniId } = req.params;

    db.get(`SELECT status FROM permissions WHERE alumni_id = ?`, [alumniId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        const hasPermission = row && row.status === 'Granted';
        if (!hasPermission) {
            return res.status(403).json({ error: 'Permission required to view student data', status: row?.status || 'None' });
        }

        db.all(`
      SELECT app.id as application_id, app.status, u.name as student_name, u.email as student_email, r.file_path as resume_path
      FROM applications app
      JOIN alumni_profiles ap ON app.alumni_profile_id = ap.id
      JOIN users u ON app.student_id = u.id
      LEFT JOIN resumes r ON u.id = r.student_id
      WHERE ap.user_id = ?
    `, [alumniId], (err, apps) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(apps);
        });
    });
};

const requestPermission = (req, res) => {
    const { alumniId } = req.body;
    db.run(`INSERT OR IGNORE INTO permissions (alumni_id, status) VALUES (?, 'Pending')`,
        [alumniId],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Permission requested' });
        }
    );
};

module.exports = { createProfile, getProfiles, searchProfiles, getAlumniApplications, requestPermission };
