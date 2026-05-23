/**
 * Email Service
 * Sends transactional emails (welcome, notifications).
 * Uses nodemailer; mock-compatible — if SMTP not configured, logs to console.
 */

import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Mock transporter — logs emails to console in dev
    transporter = nodemailer.createTransport({
      streamTransport: true,
      newline: 'unix',
      buffer: true,
    });
    console.log('[Email] No SMTP configured — emails will be logged to console');
  }

  return transporter;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(opts: EmailOptions): Promise<void> {
  const from = process.env.SMTP_USER
    ? `"AppForge" <${process.env.SMTP_USER}>`
    : 'noreply@appforge.dev';

  try {
    const info = await getTransporter().sendMail({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text || opts.html.replace(/<[^>]*>/g, ''),
    });

    if (!process.env.SMTP_HOST) {
      // Log mock email to console
      console.log(`[Email Mock] To: ${opts.to} | Subject: ${opts.subject}`);
    } else {
      console.log(`[Email] Sent to ${opts.to}: ${info.messageId}`);
    }
  } catch (err) {
    // Non-fatal — log but don't crash
    console.error('[Email] Failed to send:', err);
  }
}

// ── Templates ──────────────────────────────────────────────────────────────────

export function welcomeEmail(name: string): Pick<EmailOptions, 'subject' | 'html'> {
  return {
    subject: 'Welcome to AppForge!',
    html: `
<!DOCTYPE html>
<html>
<body style="font-family: Inter, sans-serif; background: #f9fafb; padding: 40px 0;">
  <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; border: 1px solid #e5e7eb;">
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="display: inline-block; width: 48px; height: 48px; background: #6366f1; border-radius: 12px; line-height: 48px; text-align: center;">
        <span style="color: white; font-weight: bold; font-size: 20px;">A</span>
      </div>
      <h1 style="color: #111827; margin: 16px 0 4px; font-size: 22px;">Welcome to AppForge</h1>
      <p style="color: #6b7280; margin: 0;">Hi ${name || 'there'}, your account is ready.</p>
    </div>
    <p style="color: #374151; line-height: 1.6;">
      You can now create web applications from JSON configuration — no code required.
      Start by creating your first app from the dashboard.
    </p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${process.env.FRONTEND_URL}/dashboard"
         style="background: #6366f1; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
        Go to Dashboard →
      </a>
    </div>
    <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
      AppForge · Config-driven app generator
    </p>
  </div>
</body>
</html>`,
  };
}

export function recordCreatedEmail(
  entityName: string,
  recordId: string,
  appName: string,
): Pick<EmailOptions, 'subject' | 'html'> {
  return {
    subject: `New ${entityName} created in ${appName}`,
    html: `
<!DOCTYPE html>
<html>
<body style="font-family: Inter, sans-serif; background: #f9fafb; padding: 40px 0;">
  <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; border: 1px solid #e5e7eb;">
    <h2 style="color: #111827; margin: 0 0 12px;">New ${entityName} Created</h2>
    <p style="color: #6b7280;">A new record was created in <strong>${appName}</strong>.</p>
    <p style="color: #9ca3af; font-size: 12px;">Record ID: ${recordId}</p>
  </div>
</body>
</html>`,
  };
}
