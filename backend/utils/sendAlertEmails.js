const { main } = require('./email');
const User = require('../models/User');

const sendAlertEmails = async (zoneId, alert) => {
  try {
    // Fetch all users in the zone
    const users = await User.find({ zone: zoneId });

    // Prepare the email content
    const subject = `New Alert: ${alert.title}`;
    const message = `
      <h3>New Alert in Your Zone</h3>
      <p><strong>Title:</strong> ${alert.title}</p>
      <p><strong>Description:</strong> ${alert.description}</p>
      <p><strong>Priority:</strong> ${alert.priority || 'Normal'}</p>
      <p><strong>Status:</strong> ${alert.status || 'Active'}</p>
      <p>Please stay informed and take necessary actions.</p>
    `;

    // Send emails concurrently
    await Promise.all(users.map(user => main(subject, message, user.email)));

    console.log(`Alert email sent to ${users.length} members in zone ${zoneId}`);
  } catch (err) {
    console.error('Error sending alert emails:', err.message);
  }
};

module.exports = sendAlertEmails;
