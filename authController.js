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
                const token = jwt.sign({ id: this.lastID, role }, JWT_SECRET, { expiresIn: '24h' });
                
                // Security Email
                sendEmailNotification(
                    email, 
                    "Registration Successful - Welcome to Alumni Connect", 
                    `Hello ${name},\n\nYour registration as a ${role} was successful. Welcome to the platform!`
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
            
            // Security Notification
            sendEmailNotification(
                user.email, 
                "Security Alert: New Login", 
                `Hello ${user.name},\n\nA successful login was recently made to your account. If this wasn't you, please contact support immediately.`
            );

            res.json({ message: 'Login successful', user, token });
        }
    );
};

module.exports = { register, login };
