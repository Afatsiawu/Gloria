import { config } from '../../config.js';
import { getDb } from '../../db/index.js';
import { ApiError } from '../../utils/http.js';

/**
 * SmsProvider interface: send(to, message, meta?) -> { status, provider }.
 * The mock persists every message to the notifications outbox so the demo can
 * show exactly what would have been sent.
 */
class MockSmsProvider {
  async send(to, message, meta = {}) {
    getDb()
      .prepare(
        `INSERT INTO notifications (user_id, order_id, channel, event, recipient, message, status)
         VALUES (?, ?, 'sms', ?, ?, ?, 'sent')`
      )
      .run(meta.userId ?? null, meta.orderId ?? null, meta.event || 'sms', to || '', message);
    console.log(`[sms:mock] ${to}: ${message}`);
    return { status: 'sent', provider: 'mock' };
  }
}

/**
 * Arkesel adapter stub. Env: ARKESEL_API_KEY, ARKESEL_SENDER_ID.
 * TODO: POST https://sms.arkesel.com/api/v2/sms/send with sender, message, recipients.
 */
class ArkeselProvider {
  async send() {
    if (!process.env.ARKESEL_API_KEY) {
      throw new ApiError(501, 'PROVIDER_NOT_CONFIGURED', 'Arkesel is not configured. Set ARKESEL_API_KEY.');
    }
    throw new ApiError(501, 'PROVIDER_NOT_CONFIGURED', 'Arkesel integration is stubbed for the capstone demo.');
  }
}

/**
 * mNotify adapter stub. Env: MNOTIFY_API_KEY, MNOTIFY_SENDER_ID.
 * TODO: POST https://api.mnotify.com/api/sms/quick?key=... with recipient and message.
 */
class MNotifyProvider {
  async send() {
    throw new ApiError(501, 'PROVIDER_NOT_CONFIGURED', 'mNotify integration is stubbed for the capstone demo.');
  }
}

let singleton = null;
export function getSmsProvider() {
  if (singleton) return singleton;
  if (config.smsProvider === 'arkesel') singleton = new ArkeselProvider();
  else if (config.smsProvider === 'mnotify') singleton = new MNotifyProvider();
  else singleton = new MockSmsProvider();
  return singleton;
}
