const db = require('../config/db');
const { createNotification } = require('./notificationController');

const getDashboardData = (req, res) => {
    const queries = {
        users: "SELECT id, name, email, role, skills, projects, linkedin_url FROM users",
        profiles: "SELECT ap.*, u.name, u.email FROM alumni_profiles ap JOIN users u ON ap.user_id = u.id WHERE u.role = 'Alumni'",
        permissions: "SELECT p.id, p.alumni_id, p.status, u.name, u.email FROM permissions p JOIN users u ON p.alumni_id = u.id WHERE u.role = 'Alumni'",
        applications: "SELECT * FROM applications"
    };

    const results = {};
    let errorSent = false;

    const checkDone = () => {
        if (results.users && results.profiles && results.permissions && results.applications) {
            res.json(results);
        }
    };

    const handleError = (err) => {
        if (!errorSent) {
            errorSent = true;
            res.status(500).json({ error: "Failed to fetch dashboard data: " + err.message });
        }
    };

    Object.entries(queries).forEach(([key, sql]) => {
        db.all(sql, [], (err, rows) => {
            if (err) return handleError(err);
            results[key] = rows;
            checkDone();
        });
    });
};

const updatePermissionStatus = (req, res, io, onlineUsers) => {
    const { permissionId, status } = req.body;
    const adminId = req.user.id;

    // Get Alumni ID and Name first
    db.get(`SELECT p.alumni_id, u.name as alumni_name, u.email as alumni_email FROM permissions p JOIN users u ON p.alumni_id = u.id WHERE p.id = ?`, [permissionId], (err, permData) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!permData) return res.status(404).json({ error: 'Permission record not found' });

        const alumniId = permData.alumni_id;
        const alumniName = permData.alumni_name;

        db.run(`UPDATE permissions SET status = ? WHERE id = ?`, [status, permissionId], function (err) {
            if (err) return res.status(500).json({ error: err.message });

            let msgText = '';
            let updateAlumniQuery = null;

            if (status === 'Granted') {
                msgText = `Congratulations ${alumniName}! Your access to student applications has been approved by the Administrator. You can now view student details.`;
                updateAlumniQuery = "UPDATE alumni_profiles SET can_view_students = 1, can_message_students = 1 WHERE user_id = ?";
            } else if (status === 'Rejected') {
                msgText = `We regret to inform you that your application for data access has been rejected. Please contact the administrator for more details.`;
                updateAlumniQuery = "UPDATE alumni_profiles SET can_view_students = 0, can_message_students = 0 WHERE user_id = ?";
            } else if (status === 'Revoked') {
                msgText = `Your access to student applications has been revoked by the Administrator. You can reply to this message if you have any questions.`;
                updateAlumniQuery = "UPDATE alumni_profiles SET can_view_students = 0, can_message_students = 0 WHERE user_id = ?";
            }

            // Sync with alumni_profiles table if needed
            if (updateAlumniQuery) {
                db.run(updateAlumniQuery, [alumniId]);
            }

            if (msgText) {
                createNotification(alumniId, msgText, io, onlineUsers, 'Permission');
            }

            // Direct socket emission to the alumni for instant permission update
            if (io && onlineUsers) {
                const alumniSocketId = onlineUsers.get(String(alumniId));
                if (alumniSocketId) {
                    const canView = status === 'Granted' ? true : false;
                    const canMessage = status === 'Granted' ? true : false;
                    io.to(alumniSocketId).emit('permissionsUpdated', { 
                        can_view_students: canView, 
                        can_message_students: canMessage,
                        status: status
                    });
                }
            }

            if (io) io.emit('adminDataUpdated');
            res.json({ message: `Permission ${status}` });
        });
    });
};

const getAllMessages = (req, res) => {
    db.all(`
        SELECT m.*, u1.name as sender_name, u2.name as receiver_name 
        FROM messages m 
        JOIN users u1 ON m.sender_id = u1.id 
        JOIN users u2 ON m.receiver_id = u2.id 
        ORDER BY m.sent_at DESC
    `, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
};

const deleteMessage = (req, res, io) => {
    const { id } = req.params;
    db.run(`DELETE FROM messages WHERE id = ?`, [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (io) io.emit('adminDataUpdated');
        res.json({ message: 'Message deleted' });
    });
};

const toggleMessageStatus = (req, res, io) => {
    const { id } = req.params;
    db.run(`UPDATE messages SET is_read = 1 - is_read WHERE id = ?`, [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (io) io.emit('adminDataUpdated');
        res.json({ message: 'Message status toggled' });
    });
};


const updateAlumniPermissions = (req, res, io) => {
    const { alumniId } = req.params;
    const { can_view_students, can_message_students } = req.body;

    db.run(
        `UPDATE alumni_profiles 
         SET can_view_students = ?, can_message_students = ? 
         WHERE user_id = ?`,
        [can_view_students ? 1 : 0, can_message_students ? 1 : 0, alumniId],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            
            // Sync with permissions table status
            let status = (can_view_students || can_message_students) ? 'Granted' : 'Revoked';
            db.run(`UPDATE permissions SET status = ? WHERE alumni_id = ?`, [status, alumniId]);

            // Notify the alumni about permission change
            const onlineUsers = req.app.get('onlineUsers');
            const viewLabel = can_view_students ? 'granted' : 'revoked';
            const msgLabel = can_message_students ? 'granted' : 'revoked';
            const notifMsg = `Your permissions have been updated: View Students: ${viewLabel}, Messaging: ${msgLabel}.`;
            createNotification(parseInt(alumniId), notifMsg, io, onlineUsers, 'Permission');

            if (io) {
                io.emit('adminDataUpdated');
                const alumniSocketId = onlineUsers?.get(String(alumniId));
                if (alumniSocketId) {
                    io.to(alumniSocketId).emit('permissionsUpdated', { can_view_students, can_message_students });
                }
            }
            
            res.json({ message: 'Permissions updated successfully' });
        }
    );
};

const deleteUser = (req, res, io, onlineUsers) => {
    const userId = parseInt(req.params.id);

    db.get('SELECT id, name, role, email FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ error: 'User not found' });

        db.serialize(() => {
            db.run("BEGIN TRANSACTION");

            // 1. Notify Related Parties (Before deletion)
            if (user.role === 'Alumni') {
                db.all(`SELECT student_id FROM mentorship_requests mr JOIN alumni_profiles ap ON mr.alumni_profile_id = ap.id WHERE ap.user_id = ?`, [userId], (err, records) => {
                    if (!err && records) {
                        const msg = `The Alumni ${user.name} has been removed from the platform. Your mentorship session has been cancelled.`;
                        records.forEach(r => createNotification(r.student_id, msg, io, onlineUsers, 'Delete'));
                    }
                });
            } else if (user.role === 'Student') {
                db.all(`SELECT ap.user_id FROM job_applications ja JOIN jobs j ON ja.job_id = j.id JOIN alumni_profiles ap ON j.alumni_profile_id = ap.id WHERE ja.student_id = ?`, [userId], (err, records) => {
                    if (!err && records) {
                        const msg = `The student ${user.name} who applied to your job has been removed from the platform.`;
                        records.forEach(r => createNotification(r.user_id, msg, io, onlineUsers, 'Delete'));
                    }
                });
            }

            // 2. Cascade Deletions
            const queries = [
                ['DELETE FROM messages WHERE sender_id = ? OR receiver_id = ?', [userId, userId]],
                ['DELETE FROM notifications WHERE user_id = ?', [userId]],
                ['DELETE FROM permissions WHERE alumni_id = ?', [userId]],
                ['DELETE FROM resumes WHERE student_id = ?', [userId]],
                ['DELETE FROM job_applications WHERE student_id = ?', [userId]],
                ['DELETE FROM applications WHERE student_id = ?', [userId]],
                ['DELETE FROM mentorship_requests WHERE student_id = ?', [userId]],
            ];

            queries.forEach(q => db.run(q[0], q[1]));

            // 3. Alumni Specific (Jobs and Profile)
            db.get('SELECT id FROM alumni_profiles WHERE user_id = ?', [userId], (err, profile) => {
                if (profile) {
                    const pid = profile.id;
                    db.run('DELETE FROM job_applications WHERE job_id IN (SELECT id FROM jobs WHERE alumni_profile_id = ?)', [pid]);
                    db.run('DELETE FROM jobs WHERE alumni_profile_id = ?', [pid]);
                    db.run('DELETE FROM applications WHERE alumni_profile_id = ?', [pid]);
                    db.run('DELETE FROM mentorship_requests WHERE alumni_profile_id = ?', [pid]);
                    db.run('DELETE FROM alumni_profiles WHERE id = ?', [pid]);
                }

                // 4. Finally delete user
                db.run('DELETE FROM users WHERE id = ?', [userId], function (err) {
                    if (err) {
                        db.run("ROLLBACK");
                        return res.status(500).json({ error: err.message });
                    }
                    db.run("COMMIT");
                    if (io) {
                        io.emit('adminDataUpdated');
                        io.emit('jobsUpdated');
                    }
                    res.json({ message: 'User and all related data deleted successfully' });
                });
            });
        });
    });
};

const deletePermission = (req, res, io, onlineUsers) => {
    const { id } = req.params;
    
    // Look up alumni info before deleting so we can notify them
    db.get(`SELECT p.alumni_id, u.name FROM permissions p JOIN users u ON p.alumni_id = u.id WHERE p.id = ?`, [id], (err, permData) => {
        db.run(`DELETE FROM permissions WHERE id = ?`, [id], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            
            // Notify the alumni
            if (permData && io && onlineUsers) {
                const msg = `Your permission record has been removed by the administrator.`;
                createNotification(permData.alumni_id, msg, io, onlineUsers, 'Delete');
            }
            
            if (io) io.emit('adminDataUpdated');
            res.json({ message: 'Permission record deleted' });
        });
    });
};

module.exports = { 
    getDashboardData, 
    updatePermissionStatus, 
    updateAlumniPermissions,
    deleteUser, 
    deletePermission,
    getAllMessages,
    deleteMessage,
    toggleMessageStatus
};
