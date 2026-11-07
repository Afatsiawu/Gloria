import crypto from 'node:crypto';
import { config } from '../../config.js';
import { ApiError } from '../../utils/http.js';

/**
 * PaymentProvider interface:
 *   initiate({ order, phone, network }) -> { reference, status, provider }
 *   verify(reference) -> { status: 'pending'|'success'|'failed', reference }
 *
 * Business code imports getPaymentProvider() only; it never talks to a vendor SDK.
 */
class MockPaymentProvider {
  constructor() {
    this.pending = new Map();
  }

  async initiate(order, phone, network) {
    const failed = Math.random() < config.mockPaymentFailureRate;
    const reference = `${failed ? 'MOCK-FAIL' : 'MOCK'}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    this.pending.set(reference, {
      readyAt: Date.now() + config.mockPaymentDelayMs,
      outcome: failed ? 'failed' : 'success',
      amount: order.total,
    });
    console.log(`[payment:mock] initiated ${reference} for GHS ${order.total} (${network || 'momo'} ${phone})`);
    return { reference, status: 'pending', provider: 'mock' };
  }

  async verify(reference) {
    const entry = this.pending.get(reference);
    if (!entry) return { reference, status: 'failed' };
    if (Date.now() < entry.readyAt) return { reference, status: 'pending' };
    this.pending.delete(reference);
    return { reference, status: entry.outcome };
  }
}

/**
 * Paystack adapter stub.
 * Env: PAYSTACK_SECRET_KEY, PAYSTACK_PUBLIC_KEY.
 * TODO: POST https://api.paystack.co/transaction/initialize with email, amount in
 * pesewas and channels ['mobile_money']; map the returned authorization URL.
 * TODO: GET https://api.paystack.co/transaction/verify/:reference and map
 * data.status === 'success' to our status. Verify the webhook signature.
 */
class PaystackProvider {
  async initiate() {
    if (!process.env.PAYSTACK_SECRET_KEY) {
      throw new ApiError(501, 'PROVIDER_NOT_CONFIGURED', 'Paystack is not configured. Set PAYSTACK_SECRET_KEY.');
    }
    throw new ApiError(501, 'PROVIDER_NOT_CONFIGURED', 'Paystack integration is stubbed for the capstone demo.');
  }

  async verify() {
    throw new ApiError(501, 'PROVIDER_NOT_CONFIGURED', 'Paystack integration is stubbed for the capstone demo.');
  }
}

/**
 * Hubtel adapter stub.
 * Env: HUBTEL_CLIENT_ID, HUBTEL_CLIENT_SECRET, HUBTEL_MERCHANT_ACCOUNT.
 * TODO: obtain OAuth token, call the receive-money endpoint, poll transaction status.
 */
class HubtelProvider {
  async initiate() {
    throw new ApiError(501, 'PROVIDER_NOT_CONFIGURED', 'Hubtel integration is stubbed for the capstone demo.');
  }

  async verify() {
    throw new ApiError(501, 'PROVIDER_NOT_CONFIGURED', 'Hubtel integration is stubbed for the capstone demo.');
  }
}

let singleton = null;
export function getPaymentProvider() {
  if (singleton) return singleton;
  switch (config.paymentProvider) {
    case 'paystack':
      singleton = new PaystackProvider();
      break;
    case 'hubtel':
      singleton = new HubtelProvider();
      break;
    default:
      singleton = new MockPaymentProvider();
  }
  return singleton;
}
