import nodemailer from 'nodemailer';
import { logger } from '../../config/logger';

const smtpHost = process.env.SMTP_HOST;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;
  if (!smtpHost || !smtpUser || !smtpPass) {
    logger.error('SMTP not configured — email sending disabled. Set SMTP_HOST, SMTP_USER, SMTP_PASS.');
    return null;
  }
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(process.env.SMTP_PORT || '587'),
    auth: { user: smtpUser, pass: smtpPass },
  });
  return transporter;
}

export const sendEmail = async (to: string, subject: string, text: string) => {
  const t = getTransporter();
  if (!t) {
    logger.warn({ to, subject }, 'Email not sent — SMTP not configured');
    return;
  }
  try {
    const info = await t.sendMail({
      from: '"PalSafar Support" <support@palsafar.com>',
      to,
      subject,
      text,
    });
    logger.info({ messageId: info.messageId }, 'Email sent successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to send email');
  }
};
