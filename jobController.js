const db = require('../config/db');
const { createNotification } = require('./notificationController');
const { sendEmailNotification } = require('../utils/emailHelper');

const createJob = (req, res, io, onlineUsers) => {
    const userId = req.user.id;
    const { companyName, role, salary, location, applicationDeadline } = req.body;

    db.get('SELECT id FROM alumni_profiles WHERE user_id = ?', [userId], (err, profile) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!profile) return res.status(400).json({ error: 'You must create an alumni profile first before posting jobs.' });

        db.run(`INSERT INTO jobs (alumni_profile_id, company_name, role, salary, location, application_deadline) VALUES (?, ?, ?, ?, ?, ?)`,
            [profile.id, companyName, role, salary || null, location, applicationDeadline],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                const jobId = this.lastID;
                
                // Notify all students
                db.all(`SELECT id FROM users WHERE role = 'Student'`, [], (err, students) => {
                    if (!err && students) {
                        const jobMsg = `New vacancy alert! ${role} at ${companyName}. Check job section to apply.`;
                        students.forEach(student => {
                            createNotification(student.id, jobMsg, io, onlineUsers, 'System');
                        });
                    }
                });

                // Global Sync - use the passed io parameter (NOT req.app.get which shadows it)
                if (io) io.emit('adminDataUpdated');
                if (io) io.emit('jobsUpdated');

                res.status(201).json({ message: 'Job posted', id: jobId });
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

const applyToJob = (req, res, io, onlineUsers) => {
    const studentId = req.user.id;
    const { jobId } = req.body;
    db.run(`INSERT INTO job_applications (job_id, student_id) VALUES (?, ?)`, [jobId, studentId], function (err) {
        if (err) {
            if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Already applied for this job' });
            return res.status(500).json({ error: err.message });
        }

        const applicationId = this.lastID;

        db.get(`SELECT ap.user_id, u.email, j.role, j.company_name, s.name as student_name FROM jobs j JOIN alumni_profiles ap ON j.alumni_profile_id = ap.id JOIN users u ON ap.user_id = u.id, users s WHERE j.id = ? AND s.id = ?`, [jobId, studentId], (err, jobData) => {
            if (jobData) {
                const msg = `New Internship Application: ${jobData.student_name} applied for ${jobData.role} at ${jobData.company_name}.`;
                createNotification(jobData.user_id, msg, io, onlineUsers, 'Permission');
                sendEmailNotification(jobData.email, `New Application for ${jobData.role}`, msg);

                // Socket Emission to the alumni who posted the job
                const alumniSocketId = onlineUsers?.get(String(jobData.user_id));
                if (alumniSocketId && io) {
                    io.to(alumniSocketId).emit('newJobApplication', {
                        jobId,
                        applicationId,
                        studentName: jobData.student_name,
                        role: jobData.role,
                        message: msg
                    });
                }
            }
        });

        // Global Sync
        if (io) io.emit('adminDataUpdated');

        res.status(201).json({ message: 'Successfully applied', id: applicationId });
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
    
    // First find the alumni_user_id for this job
    db.get(`SELECT ap.user_id FROM jobs j JOIN alumni_profiles ap ON j.alumni_profile_id = ap.id WHERE j.id = ?`, [jobId], (err, job) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!job) return res.status(404).json({ error: 'Job not found' });
        
        // Check permission
        db.get(`SELECT status FROM permissions WHERE alumni_id = ?`, [job.user_id], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            
            if (!row || row.status !== 'Granted') {
                return res.status(403).json({ error: 'Permission required to view student data', status: row?.status || 'None' });
            }
            
            db.all(`
                SELECT ja.id as application_id, ja.status, ja.applied_at, 
                       u.id as student_id, u.name as student_name, u.email as student_email,
                       u.skills, u.projects, u.linkedin_url,
                       r.file_path as resume_path 
                FROM job_applications ja
                JOIN users u ON ja.student_id = u.id
                LEFT JOIN resumes r ON u.id = r.student_id
                WHERE ja.job_id = ?
            `, [jobId], (err, rows) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json(rows);
            });
        });
    });
};

const deleteJob = (req, res, io, onlineUsers) => {
    const { jobId } = req.params;
    const userId = req.user.id;

    // Verify ownership
    db.get(`SELECT j.id, j.role, j.company_name FROM jobs j JOIN alumni_profiles ap ON j.alumni_profile_id = ap.id WHERE j.id = ? AND ap.user_id = ?`, [jobId, userId], (err, job) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!job) return res.status(403).json({ error: 'Unauthorized or job not found' });

        // Get applicants to notify
        db.all(`SELECT student_id FROM job_applications WHERE job_id = ?`, [jobId], (err, applicants) => {
            if (err) return res.status(500).json({ error: err.message });

            // Delete job
            db.run(`DELETE FROM jobs WHERE id = ?`, [jobId], function (err) {
                if (err) return res.status(500).json({ error: err.message });

                const msg = `The job for "${job.role}" at "${job.company_name}" has been removed by the recruiter.`;
                
                // Notify applicants
                if (applicants) {
                    applicants.forEach(app => {
                        createNotification(app.student_id, msg, io, onlineUsers, 'Delete');
                    });
                }

                // Global Sync - use the passed io parameter (NOT req.app.get which shadows it)
                if (io) io.emit('adminDataUpdated');
                if (io) io.emit('jobsUpdated');

                res.json({ message: 'Job deleted and applicants notified' });
            });
        });
    });
};

module.exports = { createJob, getJobs, applyToJob, getStudentApplications, getAlumniJobs, getJobApplications, deleteJob };
