import crypto from 'node:crypto';
import { config } from '../config.js';
import { forbidden } from '../utils/http.js';

const CSRF_COOKIE = 'csrf_token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Tokens remain 64 hex characters for backwards compatibility with existing
// clients/tests. A separate HMAC signature lets the API validate a token that
// is supplied in the X-CSRF-Token header even when the double-submit cookie
// cannot be stored or sent (for example third-party cookie blocking in
// cross-origin deployments).
function signToken(token) {
  return crypto
    .createHmac('sha256', config.jwtSecret || 'dev-only-insecure-secret-change-me')
    .update(token)
    .digest('base64url');
}

function isValidSignature(token, signature) {
  if (typeof token !== 'string' || typeof signature !== 'string') return false;
  if (!/^[a-f0-9]{64}$/.test(token) || !signature) return false;
  const expected = signToken(token);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function ensureCsrfCookie(req, res, next) {
  let token = req.cookies?.[CSRF_COOKIE];
  if (!token || token.length !== 64) {
    token = newToken();
  }
  // Always refresh the cookie so it survives sessions and is readable by JS
  // (double-submit pattern: cookie + X-CSRF-Token header must match).
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    sameSite: config.cookieSecure ? 'none' : 'lax',
    secure: config.cookieSecure,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
  req.csrfToken = token;
  req.csrfSignature = signToken(token);
  next();
}

export function csrfProtection(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const cookieToken = req.cookies?.[CSRF_COOKIE] || '';
  const headerToken = req.get('x-csrf-token') || '';
  const headerSignature = req.get('x-csrf-signature') || '';

  // Accept a token + signature pair supplied by the client. This keeps CSRF
  // protection working when the double-submit cookie cannot be stored or sent
  // (for example third-party cookie blocking in cross-origin deployments).
  if (isValidSignature(headerToken, headerSignature)) {
    return next();
  }

  // Backwards-compatible double-submit cookie check.
  if (!cookieToken || !headerToken || cookieToken.length !== headerToken.length) {
    return next(forbidden('Security token missing or invalid. Refresh the page and try again.'));
  }
  const a = Buffer.from(cookieToken);
  const b = Buffer.from(headerToken);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return next(forbidden('Security token missing or invalid. Refresh the page and try again.'));
  }
  next();
}
