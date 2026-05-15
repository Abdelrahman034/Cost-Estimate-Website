const nodemailer = require('nodemailer');

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

/**
 * Send an RFQ email to a supplier
 * @param {string} to - Supplier email address
 * @param {string} subject - Email subject
 * @param {string} body - Email body (plain text or HTML)
 * @param {Array} attachments - Optional attachments
 */
async function sendRFQEmail(to, subject, body, attachments = []) {
  const transporter = createTransporter();

  const htmlBody = body
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME || 'HVAC Estimating'}" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text: body,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
        <div style="background: #1e40af; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">Request for Quote</h2>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          ${htmlBody}
        </div>
        <div style="text-align: center; padding: 16px; color: #9ca3af; font-size: 12px;">
          This email was sent via the HVAC Cost Estimator Platform
        </div>
      </div>
    `,
    attachments,
  };

  const result = await transporter.sendMail(mailOptions);
  return { messageId: result.messageId, accepted: result.accepted };
}

/**
 * Send proposal PDF to a client
 */
async function sendProposal(to, clientName, projectName, pdfPath) {
  const transporter = createTransporter();

  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME || 'HVAC Estimating'}" <${process.env.EMAIL_USER}>`,
    to,
    subject: `Bid Proposal – ${projectName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1e40af; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">Bid Proposal Enclosed</h2>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p>Dear ${clientName},</p>
          <p>Please find attached our bid proposal for <strong>${projectName}</strong>.</p>
          <p>We appreciate the opportunity to bid on this project and look forward to working with you.</p>
          <p>If you have any questions, please don't hesitate to reach out.</p>
          <br>
          <p>Best regards,</p>
          <p><strong>${process.env.EMAIL_FROM_NAME || 'HVAC Estimating Team'}</strong></p>
        </div>
      </div>
    `,
    attachments: [
      {
        filename: `Proposal_${projectName.replace(/\s+/g, '_')}.pdf`,
        path: pdfPath,
        contentType: 'application/pdf',
      },
    ],
  };

  const result = await transporter.sendMail(mailOptions);
  return { messageId: result.messageId, accepted: result.accepted };
}

module.exports = { sendRFQEmail, sendProposal };
