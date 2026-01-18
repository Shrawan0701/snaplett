const axios = require('axios');

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const SENDER_NAME = process.env.BREVO_SENDER_NAME;
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL;

async function sendOTPEmail(toEmail, otp) {
  await axios.post(
    'https://api.brevo.com/v3/smtp/email',
    {
      sender: {
        name: SENDER_NAME,
        email: SENDER_EMAIL
      },
      to: [{ email: toEmail }],
      subject: 'Snaplet Password Reset OTP',
      htmlContent: `
        <div style="font-family:Arial">
          <h2>Reset your Snaplet password</h2>
          <p>Your OTP is:</p>
          <h1>${otp}</h1>
          <p>This OTP is valid for 10 minutes.</p>
        </div>
      `
    },
    {
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json'
      }
    }
  );
}

module.exports = { sendOTPEmail };
