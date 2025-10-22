const nodemailer = require('nodemailer');

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function sendEmail({ name, email, subject, message }) {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    SUPPORT_EMAIL,
    FROM_EMAIL,
  } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    const err = new Error('Email service not configured: set SMTP_* env vars');
    err.status = 500;
    throw err;
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  const toAddress = SUPPORT_EMAIL || 'support@queryfuel.io';
  const fromAddress = FROM_EMAIL || SMTP_USER;

  const textContent = `New support request from QueryFuel\n\nName: ${name}\nEmail: ${email}\nSubject: ${subject}\n\nMessage:\n${message}`;

  const htmlContent = `
    <div style="font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;line-height:1.6;color:#111827">
      <h2 style="margin:0 0 8px 0">New support request</h2>
      <p style="margin:0 0 16px 0;color:#4b5563">From your QueryFuel contact form</p>
      <table style="border-collapse:collapse;width:100%;max-width:640px">
        <tbody>
          <tr>
            <td style="padding:8px 0;width:120px;color:#6b7280">Name</td>
            <td style="padding:8px 0">${escapeHtml(name)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;width:120px;color:#6b7280">Email</td>
            <td style="padding:8px 0">${escapeHtml(email)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;width:120px;color:#6b7280">Subject</td>
            <td style="padding:8px 0">${escapeHtml(subject)}</td>
          </tr>
        </tbody>
      </table>
      <div style="margin-top:16px;padding:12px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;white-space:pre-wrap">${escapeHtml(message)}</div>
    </div>
  `;

  await transporter.sendMail({
    from: { name: 'QueryFuel Contact', address: fromAddress },
    replyTo: email,
    to: toAddress,
    subject: `[Contact] ${subject}`,
    text: textContent,
    html: htmlContent,
  });
}

exports.handler = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, email, subject, message } = req.body || {};

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }

    await sendEmail({ name, email, subject, message });
    return res.json({ ok: true });
  } catch (err) {
    console.error('functions/api/contact error:', err);
    const status = err.status || 500;
    return res.status(status).json({ error: 'Failed to send message' });
  }
};
