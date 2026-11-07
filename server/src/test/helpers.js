import request from 'supertest';
import { getDb } from '../db/index.js';
import { TEST_PASSWORD } from './fixtures.js';

/**
 * A small supertest wrapper that keeps the session cookies and automatically
 * sends the double-submit CSRF header on mutating requests.
 */
export async function makeClient(app) {
  const agent = request.agent(app);
  const client = {
    agent,
    csrfToken: '',
    user: null,
    get: (url) => agent.get(url),
    post: (url, body) => agent.post(url).set('X-CSRF-Token', client.csrfToken).send(body),
    patch: (url, body) => agent.patch(url).set('X-CSRF-Token', client.csrfToken).send(body),
    del: (url, body) => agent.delete(url).set('X-CSRF-Token', client.csrfToken).send(body),
    upload: (url, buffer, filename = 'prescription.png', field = 'file') =>
      agent.post(url).set('X-CSRF-Token', client.csrfToken).attach(field, buffer, filename),
    async init() {
      const response = await agent.get('/api/auth/csrf');
      client.csrfToken = response.body.csrfToken;
      return client;
    },
    async login(identifier, password = TEST_PASSWORD) {
      const response = await client.post('/api/auth/login', { identifier, password });
      if (response.status === 200) client.user = response.body.user;
      return response;
    },
  };
  return client.init();
}

// A valid 1x1 PNG, enough for sharp to exercise the image pipeline.
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

export function setStock(batchId, quantity) {
  getDb().prepare('UPDATE batches SET quantity_on_hand = ? WHERE id = ?').run(quantity, batchId);
}

export function stockOf(batchId) {
  return getDb().prepare('SELECT quantity_on_hand FROM batches WHERE id = ?').get(batchId).quantity_on_hand;
}
