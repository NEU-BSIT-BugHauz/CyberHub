
const nodemailer = require('nodemailer');

let transporter;

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASSWORD,
  } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) {
    throw new Error('Email service SMTP configuration is incomplete.');
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: SMTP_SECURE === 'true',
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASSWORD,
    },
  });

  return transporter;
}

async function sendPasswordResetEmail(email, resetUrl) {
  const mailer = getTransporter();

  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;

  return mailer.sendMail({
    from,
    to: email,
    subject: 'CyberHub Password Reset',
    text: [
      'We received a request to reset your CyberHub password.',
      '',
      `Use this link to reset your password: ${resetUrl}`,
      '',
      'This link expires in 15 minutes and can only be used once.',
      '',
      'If you did not request a password reset, you can ignore this email.',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2>CyberHub Password Reset</h2>

        <p>
          We received a request to reset your CyberHub password.
        </p>

        <p>
          Click the button below to choose a new password.
        </p>

        <p>
          <a
            href="${resetUrl}"
            style="
              display: inline-block;
              padding: 12px 20px;
              background: #10B981;
              color: #ffffff;
              text-decoration: none;
              border-radius: 6px;
            "
          >
            Reset Password
          </a>
        </p>

        <p>
          This link expires in 15 minutes and can only be used once.
        </p>

        <p>
          If you did not request this reset, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}

module.exports = {
  sendPasswordResetEmail,
};
