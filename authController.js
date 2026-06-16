const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db'); // I'll create this next
const { sendEmailNotification } = require('../utils/emailHelper');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

const register = async (req, res) => {
    const { name, email, password, role } = req.body;

    if (!['Student', 'Alumni', 'Admin'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run(`INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`,
            [name, email, hashedPassword, role],
            function (err) {
                if (err) {
                    if (err.message.includes('UNIQUE')) {
                        return res.status(400).json({ error: 'Email already exists' });
                    }
                    return res.status(500).json({ error: err.message });
                }
                const newUserId = this.lastID;
                const token = jwt.sign({ id: newUserId, role }, JWT_SECRET, { expiresIn: '24h' });

                // Fetch io and onlineUsers for real-time updates
                const io = req.app.get('io');
                const onlineUsers = req.app.get('onlineUsers');

                // If role is Alumni, auto-create status for Admin review
                if (role === 'Alumni') {
                    db.serialize(() => {
                        db.run(`INSERT INTO alumni_profiles (user_id, company_name, domain) VALUES (?, 'Not Set', 'Not Set')`, [newUserId], function(err) {
                            if (!err) {
                                db.run(`INSERT OR IGNORE INTO permissions (alumni_id, status) VALUES (?, 'Pending')`, [newUserId], function() {
                                    if (io) io.emit('adminDataUpdated');
                                });
                            }
                        });
                    });
                } else {
                    if (io) io.emit('adminDataUpdated');
                }

                // Notify Admins
                db.all(`SELECT id FROM users WHERE role = 'Admin'`, [], (err, admins) => {
                    if (!err && admins) {
                        const adminMsg = `New User Registered: ${name} (${role})`;
                        admins.forEach(admin => {
                            const { createNotification } = require('./notificationController');
                            createNotification(admin.id, adminMsg, io, onlineUsers, 'System');
                        });
                    }
                });

                // Send real welcome email (HTML)
                const welcomeHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 30px; border-radius: 8px;">
                  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Alumni Connect!</h1>
                  </div>
                  <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0;">
                    <h2 style="color: #333;">Hello, ${name}! 🎉</h2>
                    <p style="color: #555; font-size: 16px; line-height: 1.6;">
                      Your registration as a <strong>${role}</strong> on the Alumni Connect Platform was <strong>successful</strong>.
                    </p>
                    <div style="background: #f0f4ff; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; border-radius: 4px;">
                      <p style="margin: 0; color: #444;"><strong>Account Details:</strong></p>
                      <p style="margin: 5px 0; color: #555;">👤 Name: ${name}</p>
                      <p style="margin: 5px 0; color: #555;">📧 Email: ${email}</p>
                      <p style="margin: 5px 0; color: #555;">🎫 Role: ${role}</p>
                    </div>
                    <p style="color: #555; font-size: 14px;">You can now log in and explore all the features available on the platform.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #999; font-size: 12px; text-align: center;">If you did not create this account, please ignore this email.</p>
                  </div>
                </div>`;

                sendEmailNotification(
                    email,
                    `🎉 Registration Successful - Welcome to Alumni Connect, ${name}!`,
                    `Hello ${name},\n\nYour registration as a ${role} was successful!\n\nAccount Details:\n- Name: ${name}\n- Email: ${email}\n- Role: ${role}\n\nYou can now log in and explore the platform.\n\nWelcome aboard!\nThe Alumni Connect Team`,
                    welcomeHtml
                );

                res.status(201).json({ id: this.lastID, name, email, role, token });
            }
        );
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const login = (req, res) => {
    const { email, password } = req.body;

    db.get(`SELECT id, name, email, password, role FROM users WHERE email = ?`,
        [email],
        async (err, user) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!user) return res.status(401).json({ error: 'Invalid email or password' });

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) return res.status(401).json({ error: 'Invalid email or password' });

            const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
            delete user.password;

            // Send login security email (HTML)
            const loginTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
            const loginHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 30px; border-radius: 8px;">
              <div style="background: linear-gradient(135deg, #34d399 0%, #059669 100%); padding: 25px; border-radius: 8px 8px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">✅ Login Successful</h1>
              </div>
              <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0;">
                <h2 style="color: #333;">Welcome Back, ${user.name}!</h2>
                <p style="color: #555; font-size: 16px;">You have successfully logged in to your Alumni Connect account.</p>
                <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px;">
                  <p style="margin: 0; color: #444;"><strong>Session Details:</strong></p>
                  <p style="margin: 5px 0; color: #555;">📧 Account: ${user.email}</p>
                  <p style="margin: 5px 0; color: #555;">⏰ Time: ${loginTime} (IST)</p>
                  <p style="margin: 5px 0; color: #555;">🎫 Role: ${user.role}</p>
                </div>
                <p style="color: #555; font-size: 14px;">We're glad to have you back! Explore new opportunities and connect with others.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="color: #999; font-size: 12px; text-align: center;">This is an automated notification from Alumni Connect.</p>
              </div>
            </div>`;

            sendEmailNotification(
                user.email,
                `✅ Login Successful - Welcome Back to Alumni Connect!`,
                `Hello ${user.name},\n\nYou have successfully logged in to your account.\n\nLogin Time: ${loginTime} (IST)\nAccount: ${user.email}\n\nWelcome back!\n\nThe Alumni Connect Team`,
                loginHtml
            );

            res.json({ message: 'Login successful', user, token });
        }
    );
};

module.exports = { register, login };
