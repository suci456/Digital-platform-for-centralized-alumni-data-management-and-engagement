const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // true for port 465, false for 587
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

module.exports = transporter;
