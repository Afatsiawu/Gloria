import crypto from 'node:crypto';
import { config } from '../config.js';
import { forbidden } from '../utils/http.js';

const CSRF_COOKIE = 'csrf_token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

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
  next();
}

export function csrfProtection(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const cookieToken = req.cookies?.[CSRF_COOKIE] || '';
  const headerToken = req.get('x-csrf-token') || '';
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
