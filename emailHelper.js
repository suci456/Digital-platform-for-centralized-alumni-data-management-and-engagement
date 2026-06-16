const transporter = require('../config/mail');

/**
 * Sends a real email using Gmail SMTP.
 * Errors are caught and logged — they will NOT crash the request.
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} text - Plain text fallback
 * @param {string} [html] - Optional HTML body
 */
const sendEmailNotification = (to, subject, text, html) => {
    const mailOptions = {
        from: `"Alumni Connect Platform" <${process.env.SMTP_USER}>`,
        to,
        subject,
        text,
        ...(html && { html })
    };

    // Fire-and-forget: we don't block the API response on email
    transporter.sendMail(mailOptions)
        .then(info => {
            console.log("\n===============================");
            console.log(`📧 REAL EMAIL SENT TO: ${to}`);
            console.log(`   SUBJECT: ${subject}`);
            console.log(`   MESSAGE ID: ${info.messageId}`);
            console.log("===============================\n");
        })
        .catch(err => {
            console.error("\n===============================");
            console.error(`❌ EMAIL FAILED TO: ${to}`);
            console.error(`   ERROR: ${err.message}`);
            console.error("===============================\n");
            // Do NOT re-throw — email failure should not break registration/login
        });
};

module.exports = { sendEmailNotification };
