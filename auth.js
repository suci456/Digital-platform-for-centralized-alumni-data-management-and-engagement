const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access token required' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.log("Token verification failed:", err.message);
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

const authorizeRole = (roles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            console.log("Stale token detected (missing role). Forcing re-login.");
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        if (!roles.includes(req.user.role)) {
            console.log(`AuthorizeRole Failed: required ${roles}, user has ${req.user.role}`);
            return res.status(403).json({ error: 'Access denied: insufficient permissions' });
        }
        next();
    };
};

module.exports = { authenticateToken, authorizeRole };
