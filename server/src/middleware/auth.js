import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { getDb } from '../db/index.js';
import { unauthorized, forbidden } from '../utils/http.js';

export const TOKEN_COOKIE = 'pharm_token';

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

export function setAuthCookie(res, token) {
  res.cookie(TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: config.cookieSecure ? 'none' : 'lax',
    secure: config.cookieSecure,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(TOKEN_COOKIE, {
    path: '/',
    sameSite: config.cookieSecure ? 'none' : 'lax',
    secure: config.cookieSecure,
  });
}

export function findUserById(id) {
  return getDb()
    .prepare(
      `SELECT u.id, u.role, u.full_name, u.phone, u.email, u.pharmacy_id, u.community,
              u.delivery_address, u.digital_address_code, u.is_active, u.must_change_password,
              u.created_at, p.name AS pharmacy_name
         FROM users u LEFT JOIN pharmacies p ON p.id = u.pharmacy_id
        WHERE u.id = ?`
    )
    .get(id);
}

function userFromRequest(req) {
  const token = req.cookies?.[TOKEN_COOKIE];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = findUserById(payload.sub);
    if (!user || !user.is_active) return null;
    return user;
  } catch {
    return null;
  }
}

export function authenticate(req, _res, next) {
  const user = userFromRequest(req);
  if (!user) return next(unauthorized('Please sign in to continue.'));
  req.user = user;
  next();
}

export function optionalAuth(req, _res, next) {
  req.user = userFromRequest(req);
  next();
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized('Please sign in to continue.'));
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };
}

/** Pharmacists and riders are always scoped to the pharmacy they belong to. */
export function pharmacyScope(req, requestedPharmacyId) {
  if (req.user.role === 'admin') return requestedPharmacyId ? Number(requestedPharmacyId) : null;
  return req.user.pharmacy_id;
}
