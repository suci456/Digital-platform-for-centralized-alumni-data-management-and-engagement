const db = require('../config/db');
const { createNotification } = require('./notificationController');
const { sendEmailNotification } = require('../utils/emailHelper');

const createJob = (req, res) => {
    const userId = req.user.id;
    const { companyName, role, salary, location, applicationDeadline } = req.body;

    db.get('SELECT id FROM alumni_profiles WHERE user_id = ?', [userId], (err, profile) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!profile) return res.status(400).json({ error: 'You must create an alumni profile first before posting jobs.' });

        db.run(`INSERT INTO jobs (alumni_profile_id, company_name, role, salary, location, application_deadline) VALUES (?, ?, ?, ?, ?, ?)`,
            [profile.id, companyName, role, salary || null, location, applicationDeadline],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.status(201).json({ message: 'Job posted', id: this.lastID });
            }
        );
    });
};

const getJobs = (req, res) => {
    db.all(`SELECT j.*, ap.user_id as alumni_user_id, u.name as posted_by 
            FROM jobs j 
            JOIN alumni_profiles ap ON j.alumni_profile_id = ap.id 
            JOIN users u ON ap.user_id = u.id 
            ORDER BY j.created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
};

const applyToJob = (req, res) => {
    const studentId = req.user.id;
    const { jobId } = req.body;
    db.run(`INSERT INTO job_applications (job_id, student_id) VALUES (?, ?)`, [jobId, studentId], function (err) {
        if (err) {
            if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Already applied for this job' });
            return res.status(500).json({ error: err.message });
        }

        db.get(`SELECT ap.user_id, u.email, j.role, j.company_name FROM jobs j JOIN alumni_profiles ap ON j.alumni_profile_id = ap.id JOIN users u ON ap.user_id = u.id WHERE j.id = ?`, [jobId], (err, jobData) => {
            if (jobData) {
                const msg = `A student has applied for your ${jobData.role} position at ${jobData.company_name}.`;
                createNotification(jobData.user_id, msg);
                sendEmailNotification(jobData.email, `New Application for ${jobData.role}`, msg);
            }
        });

        res.status(201).json({ message: 'Successfully applied', id: this.lastID });
    });
};

const getStudentApplications = (req, res) => {
    const { studentId } = req.params;
    if (parseInt(studentId) !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

    db.all(`SELECT job_id, status FROM job_applications WHERE student_id = ?`, [studentId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
};

const getAlumniJobs = (req, res) => {
    const { alumniId } = req.params;
    db.all(`SELECT j.* FROM jobs j JOIN alumni_profiles ap ON j.alumni_profile_id = ap.id WHERE ap.user_id = ? ORDER BY j.created_at DESC`, [alumniId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
};

const getJobApplications = (req, res) => {
    const { jobId } = req.params;
    db.all(`
        SELECT ja.id as application_id, ja.status, ja.applied_at, u.id as student_id, u.name as student_name, u.email as student_email, r.file_path as resume_path 
        FROM job_applications ja
        JOIN users u ON ja.student_id = u.id
        LEFT JOIN resumes r ON u.id = r.student_id
        WHERE ja.job_id = ?
    `, [jobId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
};

module.exports = { createJob, getJobs, applyToJob, getStudentApplications, getAlumniJobs, getJobApplications };
