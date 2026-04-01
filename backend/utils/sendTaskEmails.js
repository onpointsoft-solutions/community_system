const { main } = require('./email');
const User = require('../models/User');

const sendTaskEmails = async (zoneId, task) => {
  try {
    // Fetch all users in the zone
    const users = await User.find({household: task.assignedTo});

    // Prepare the email content
    const subject = `New Task: ${task.title}`;
    const message = `
      <h3>New Task in Your Household</h3>
      <p><strong>Title:</strong> ${task.title}</p>
      <p><strong>Description:</strong> ${task.description}</p>
      <p><strong>Priority:</strong> ${task.priority || 'Normal'}</p>
      <p><strong>Status:</strong> ${task.status || 'Active'}</p>
      <p>Please stay informed and take necessary actions.</p>
    `;

    // Send emails concurrently
    await Promise.all(users.map(user => main(subject, message, user.email)));

    console.log(`Task email sent to ${users.length} members in zone ${zoneId}`);
  } catch (err) {
    console.error('Error sending task emails:', err.message);
  }
};

module.exports = sendTaskEmails;
