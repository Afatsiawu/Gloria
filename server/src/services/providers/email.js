import { config } from '../../config.js';
import { getDb } from '../../db/index.js';
import { ApiError } from '../../utils/http.js';

/** EmailProvider interface: send(to, subject, body, meta?) -> { status, provider }. */
class MockEmailProvider {
  async send(to, subject, body, meta = {}) {
    getDb()
      .prepare(
        `INSERT INTO notifications (user_id, order_id, channel, event, recipient, message, status)
         VALUES (?, ?, 'email', ?, ?, ?, 'sent')`
      )
      .run(meta.userId ?? null, meta.orderId ?? null, meta.event || 'email', to || '', `Subject: ${subject}\n\n${body}`);
    console.log(`[email:mock] ${to}: ${subject}`);
    return { status: 'sent', provider: 'mock' };
  }
}

/**
 * SendGrid adapter stub. Env: SENDGRID_API_KEY, SENDGRID_FROM_EMAIL.
 * TODO: POST https://api.sendgrid.com/v3/mail/send with personalizations.
 */
class SendGridProvider {
  async send() {
    if (!process.env.SENDGRID_API_KEY) {
      throw new ApiError(501, 'PROVIDER_NOT_CONFIGURED', 'SendGrid is not configured. Set SENDGRID_API_KEY.');
    }
    throw new ApiError(501, 'PROVIDER_NOT_CONFIGURED', 'SendGrid integration is stubbed for the capstone demo.');
  }
}

/**
 * SMTP adapter stub. Env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.
 * TODO: use nodemailer (add dependency) to send transactional mail.
 */
class SmtpProvider {
  async send() {
    throw new ApiError(501, 'PROVIDER_NOT_CONFIGURED', 'SMTP integration is stubbed for the capstone demo.');
  }
}

let singleton = null;
export function getEmailProvider() {
  if (singleton) return singleton;
  if (config.emailProvider === 'sendgrid') singleton = new SendGridProvider();
  else if (config.emailProvider === 'smtp') singleton = new SmtpProvider();
  else singleton = new MockEmailProvider();
  return singleton;
}
