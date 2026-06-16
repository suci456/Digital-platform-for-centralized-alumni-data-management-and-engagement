const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const PORT = process.env.PORT || 5000;

// =============== MIDDLEWARE ===============
app.set('trust proxy', 1); // Trust Ngrok proxy headers
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use(express.static(path.join(__dirname, '../frontend/dist'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        } else if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        }
    }
}));

// =============== WEBSOCKET (SOCKET.IO) ===============
const onlineUsers = new Map();

// Expose these globally via app
app.set('io', io);
app.set('onlineUsers', onlineUsers);

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('register', (userId) => {
        if (userId) {
            const stringUserId = String(userId);
            onlineUsers.set(stringUserId, socket.id);
            socket.userId = stringUserId;
            io.emit('userStatus', { userId: stringUserId, status: 'online' });
            
            const users = Array.from(onlineUsers.keys());
            socket.emit('initialOnlineUsers', users);
        }
    });

    socket.on('typing', ({ receiverId }) => {
        const receiverSocketId = onlineUsers.get(String(receiverId));
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('typing', { senderId: socket.userId });
        }
    });

    socket.on('stopTyping', ({ receiverId }) => {
        const receiverSocketId = onlineUsers.get(String(receiverId));
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('stopTyping', { senderId: socket.userId });
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        if (socket.userId) {
            onlineUsers.delete(socket.userId);
            io.emit('userStatus', { userId: socket.userId, status: 'offline' });
        }
    });
});

// =============== MODULAR ROUTES ===============
const authRoutes = require('./routes/authRoutes');
const alumniRoutes = require('./routes/alumniRoutes')(io, onlineUsers);
const jobRoutes = require('./routes/jobRoutes')(io, onlineUsers);
const studentRoutes = require('./routes/studentRoutes');
const messageRoutes = require('./routes/messageRoutes')(io, onlineUsers);
const notificationRoutes = require('./routes/notificationRoutes');
const adminRoutes = require('./routes/adminRoutes')(io, onlineUsers);

app.use('/api/auth', authRoutes);
app.use('/api/alumni', alumniRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/mentorship', require('./routes/mentorshipRoutes')(io, onlineUsers));
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

// Create uploads folder if not exists in the root
if (!fs.existsSync(path.join(__dirname, '..', 'uploads'))) {
    fs.mkdirSync(path.join(__dirname, '..', 'uploads'));
}

// =============== HEALTH CHECK ===============
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'online', 
        time: new Date().toISOString(),
        port: PORT,
        host: '0.0.0.0'
    });
});

// Catch-all route to serve index.html for React Router (only for non-API routes)
app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\n❌ ERROR: Port ${PORT} is still in use! Use "npm run launch" to fix this.`);
    } else {
        console.error('\n❌ Server Error:', err.message);
    }
});

// =============== GLOBAL ERROR HANDLERS ===============
process.on('uncaughtException', (err) => {
    console.error('CRITICAL: Uncaught Exception:', err.message);
    console.error(err.stack);
    // Graceful shutdown can be added here if needed
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

server.listen(PORT, '0.0.0.0', () => {
    const os = require('os');
    const nIs = os.networkInterfaces();
    let localIp = '127.0.0.1';
    
    for (const name of Object.keys(nIs)) {
        for (const iface of nIs[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                localIp = iface.address;
                break;
            }
        }
    }

    console.log(`
🚀 Modular Application is running!
-----------------------------------------
🏠 Local:    http://127.0.0.1:${PORT}
📶 Network:  http://${localIp}:${PORT}
🩺 Health:   http://127.0.0.1:${PORT}/api/health
-----------------------------------------
    `);
});
