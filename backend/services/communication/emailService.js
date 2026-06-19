const { Resend } = require('resend');

function getClient() {
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM = () =>
  `"${process.env.EMAIL_FROM_NAME || 'HVAC Estimating'}" <${process.env.EMAIL_FROM || 'no-reply@resend.dev'}>`;

async function sendRFQEmail(to, subject, body, attachments = []) {
  const resend = getClient();

  const htmlBody = body
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  const payload = {
    from: FROM(),
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
  };

  if (attachments.length) {
    payload.attachments = attachments.map((a) => ({
      filename: a.filename,
      content: a.path,
    }));
  }

  const { data, error } = await resend.emails.send(payload);
  if (error) throw new Error(error.message);
  return { messageId: data.id };
}

async function sendProposal(to, clientName, projectName, pdfPath) {
  const resend = getClient();
  const fs = require('fs');

  const { data, error } = await resend.emails.send({
    from: FROM(),
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
        content: fs.readFileSync(pdfPath),
      },
    ],
  });

  if (error) throw new Error(error.message);
  return { messageId: data.id };
}

async function sendInviteEmail(to, inviteUrl, companyName) {
  const resend = getClient();

  const { data, error } = await resend.emails.send({
    from: FROM(),
    to,
    subject: `You've been invited to join ${companyName} on HVAC Estimator`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1e40af; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">Team Invitation</h2>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p>You've been invited to join <strong>${companyName}</strong> on the HVAC Cost Estimator platform.</p>
          <br>
          <a href="${inviteUrl}" style="display:inline-block;background:#1e40af;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
            Accept Invitation
          </a>
          <br><br>
          <p style="color:#6b7280;font-size:13px;">This link expires in 7 days. If you didn't expect this invitation, you can ignore this email.</p>
        </div>
      </div>
    `,
  });

  if (error) throw new Error(error.message);
  return { messageId: data.id };
}

module.exports = { sendRFQEmail, sendProposal, sendInviteEmail };
