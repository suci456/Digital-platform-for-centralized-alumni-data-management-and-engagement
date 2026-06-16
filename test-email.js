require('dotenv').config();
const nodemailer = require('nodemailer');

console.log('\n🔍 Reading SMTP credentials from .env...');
console.log(`   SMTP_USER: ${process.env.SMTP_USER}`);
console.log(`   SMTP_PASS: ${process.env.SMTP_PASS ? '✅ Set (' + process.env.SMTP_PASS.length + ' chars)' : '❌ NOT SET'}`);

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

async function testEmail() {
    console.log('\n📧 Verifying SMTP connection...');
    
    try {
        await transporter.verify();
        console.log('✅ SMTP connection OK — credentials are valid!\n');
    } catch (err) {
        console.error('❌ SMTP verification FAILED:', err.message);
        console.error('\nPossible fixes:');
        console.error('  1. Make sure SMTP_USER and SMTP_PASS are set in backend/.env');
        console.error('  2. Use a Gmail App Password (not your normal password)');
        console.error('  3. Enable 2FA on your Google account before generating App Password');
        process.exit(1);
    }

    const testRecipient = process.env.SMTP_USER; // Sends to yourself
    console.log(`📤 Sending test email to: ${testRecipient}`);

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 30px; border-radius: 8px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Email Test Successful!</h1>
      </div>
      <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0;">
        <h2 style="color: #333;">Your Alumni Connect email system is working!</h2>
        <p style="color: #555; font-size: 16px; line-height: 1.6;">
          This is a test email from your <strong>Alumni Connect Platform</strong>.
        </p>
        <div style="background: #f0f4ff; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; color: #444;"><strong>✅ System Status:</strong></p>
          <p style="margin: 5px 0; color: #555;">📧 Gmail SMTP: Connected</p>
          <p style="margin: 5px 0; color: #555;">🔐 App Password: Valid</p>
          <p style="margin: 5px 0; color: #555;">⏰ Test Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (IST)</p>
        </div>
        <p style="color: #555; font-size: 14px;">Real emails will now be sent whenever a user registers or logs in.</p>
      </div>
    </div>`;

    try {
        const info = await transporter.sendMail({
            from: `"Alumni Connect Platform" <${process.env.SMTP_USER}>`,
            to: testRecipient,
            subject: '✅ Test Email - Alumni Connect Platform is Working!',
            text: 'Your Alumni Connect email system is working correctly! This is a test from your backend.',
            html
        });

        console.log('\n' + '='.repeat(50));
        console.log('🎉 TEST EMAIL SENT SUCCESSFULLY!');
        console.log('='.repeat(50));
        console.log(`   To      : ${testRecipient}`);
        console.log(`   Subject : ✅ Test Email - Alumni Connect Platform is Working!`);
        console.log(`   ID      : ${info.messageId}`);
        console.log('='.repeat(50));
        console.log('\n📬 Check your Gmail inbox now!\n');
    } catch (err) {
        console.error('\n❌ Failed to send email:', err.message);
        process.exit(1);
    }
}

testEmail();
