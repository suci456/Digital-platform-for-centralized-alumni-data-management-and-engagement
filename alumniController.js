const db = require('../config/db');
const { createNotification } = require('./notificationController');
const { sendEmailNotification } = require('../utils/emailHelper');

const createProfile = (req, res, io, onlineUsers) => {
    const userId = req.user.id;
    const { companyName, domain, description, experienceYears, achievements, companyHistory } = req.body;

    // Check if profile exists
    db.get('SELECT id FROM alumni_profiles WHERE user_id = ?', [userId], (err, profile) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (profile) {
            return res.status(400).json({ error: 'Profile already exists. Use update instead.' });
        }

        db.run(`INSERT INTO alumni_profiles (user_id, company_name, domain, description, experience_years, achievements, company_history) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userId, companyName, domain, description, experienceYears || null, achievements || null, companyHistory || null],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                const profileId = this.lastID;

                // Add pending permission request
                db.run(`INSERT OR IGNORE INTO permissions (alumni_id, status) VALUES (?, 'Pending')`, [userId], function(err) {
                    if (err) console.error("Failed to insert pending permission", err);
                    
                    // Notify Admins
                    db.all(`SELECT id, email FROM users WHERE role = 'Admin'`, [], (err, admins) => {
                        if (!err && admins) {
                            const adminMsg = `New Alumni Registration: ${req.user.name} has completed their profile and is waiting for access approval.`;
                            admins.forEach(admin => {
                                createNotification(admin.id, adminMsg, io, onlineUsers, 'Permission');
                                sendEmailNotification(admin.email, "New Alumni Pending Approval", adminMsg);
                            });
                        }
                    });

                    // Global Sync
                    if (io) io.emit('adminDataUpdated');
                });

                res.status(201).json({ message: 'Profile created and pending admin approval', id: profileId });
            }
        );
    });
};

const updateProfile = (req, res, io, onlineUsers) => {
    const userId = req.user.id;
    const { companyName, domain, description, experienceYears, achievements, companyHistory } = req.body;

    db.run(`UPDATE alumni_profiles SET company_name = ?, domain = ?, description = ?, experience_years = ?, achievements = ?, company_history = ? WHERE user_id = ?`,
        [companyName, domain, description, experienceYears || null, achievements || null, companyHistory || null, userId],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Profile not found' });
            
            // Notify Admins of update
            db.all(`SELECT id FROM users WHERE role = 'Admin'`, [], (err, admins) => {
                if (!err && admins) {
                    const updateMsg = `Profile Updated: ${req.user.name} has updated their alumni profile details.`;
                    admins.forEach(admin => {
                        createNotification(admin.id, updateMsg, io, onlineUsers, 'System');
                    });
                    
                    if (io) io.emit('adminDataUpdated');
                }
            });

            res.json({ message: 'Profile updated' });
        }
    );
};

const getAlumniProfile = (req, res) => {
    const userId = req.user.id;
    db.get('SELECT * FROM alumni_profiles WHERE user_id = ?', [userId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Profile not found' });
        res.json(row);
    });
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

    db.get(`SELECT can_view_students FROM alumni_profiles WHERE user_id = ?`, [alumniId], (err, profile) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!profile) return res.status(404).json({ error: 'Alumni profile not found' });

        if (!profile.can_view_students) {
            return res.status(403).json({ 
                error: 'Admin approval required to view student details', 
                needsApproval: true 
            });
        }

        db.all(`
            SELECT 
                app.id as application_id, 
                app.status, 
                u.name as student_name, 
                u.email as student_email, 
                r.file_path as resume_path,
                'General' as type,
                NULL as job_role
            FROM applications app
            JOIN alumni_profiles ap ON app.alumni_profile_id = ap.id
            JOIN users u ON app.student_id = u.id
            LEFT JOIN resumes r ON u.id = r.student_id
            WHERE ap.user_id = ?
            
            UNION ALL
            
            SELECT 
                ja.id as application_id, 
                ja.status, 
                u.name as student_name, 
                u.email as student_email, 
                r.file_path as resume_path,
                'Job' as type,
                j.role as job_role
            FROM job_applications ja
            JOIN jobs j ON ja.job_id = j.id
            JOIN alumni_profiles ap ON j.alumni_profile_id = ap.id
            JOIN users u ON ja.student_id = u.id
            LEFT JOIN resumes r ON u.id = r.student_id
            WHERE ap.user_id = ?
            ORDER BY application_id DESC
        `, [alumniId, alumniId], (err, apps) => {
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
            
            // Notify admins about permission request
            const io = req.app.get('io');
            const onlineUsers = req.app.get('onlineUsers');
            
            db.get(`SELECT name FROM users WHERE id = ?`, [alumniId], (err, user) => {
                if (!err && user) {
                    db.all(`SELECT id FROM users WHERE role = 'Admin'`, [], (err, admins) => {
                        if (!err && admins) {
                            const msg = `Permission Request: ${user.name} is requesting access to view student data.`;
                            admins.forEach(admin => {
                                createNotification(admin.id, msg, io, onlineUsers, 'Permission');
                            });
                        }
                    });
                }
            });
            
            if (io) io.emit('adminDataUpdated');
            res.json({ message: 'Permission requested' });
        }
    );
};

module.exports = { createProfile, updateProfile, getAlumniProfile, getProfiles, searchProfiles, getAlumniApplications, requestPermission };
