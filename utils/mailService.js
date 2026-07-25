const MailLog = require('../models/MailLog');

/**
 * Sends a mock email notification by logging it to the console
 * and saving it to the global MailLog collection.
 * 
 * @param {object} params
 * @param {string} params.to - Recipient email
 * @param {string} params.subject - Email subject
 * @param {string} params.body - Email body markdown/text
 */
const sendEmail = async ({ to, subject, body }) => {
  try {
    console.log(`\n====================================================`);
    console.log(`[MOCK EMAIL SENT]`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body: ${body}`);
    console.log(`====================================================\n`);

    // Record email inside global database for QA audit/admin view
    await MailLog.create({ to, subject, body });
  } catch (err) {
    console.error('Failed to log mock email:', err.message);
  }
};

module.exports = { sendEmail };
