const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
dotenv.config();
// Create a transporter using an email service (e.g., Gmail, SMTP, Mailgun)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false, // Use TLS
  auth: {
    user: process.env.EMAIL_USER, // Set this in your .env file
    pass: process.env.EMAIL_PASS, // Set this in your .env file
  },
});

/**
 * Sends an email to a user.
 * @param {string} subject - The subject of the email.
 * @param {string} message - The HTML message body.
 * @param {string} recipient - The recipient's email address.
 */
const main = async (subject, message, recipient) => {
  try {
    const mailOptions = {
      from: `"Nyumba Kumi Alerts" <${process.env.EMAIL_USER}>`,
      to: recipient,
      subject: subject,
      html: message,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${recipient}: ${info.messageId}`);
  } catch (err) {
    console.error(`Failed to send email to ${recipient}:`, err.message);
  }
};

module.exports = { main };
