# Security

Security design for PharmaLink (server).

## Authentication

- **Password hashing**: bcryptjs, cost ≥ 10 (configurable via `BCRYPT_ROUNDS`).
- **Session**: JWT signed with `JWT_SECRET`, delivered in an **httpOnly** cookie (double-submit CSRF cookie also set on safe bootstrap).
- **CSRF**: double-submit cookie pattern (`X-CSRF-Token` header) enforced on state-changing API routes; exempt only for documented public endpoints.
- **Rate limiting**: auth endpoints and general API limiter (configurable via env; disabled in tests).
- **Password policy**: minimum 8 characters, lower + upper + digit (see `server/src/utils/password.js`).

## Transport & headers

- `helmet` baseline headers; CSP disabled for SPA compatibility during development (documented).
- `compression` for responses.
- CORS allow-list from `CLIENT_ORIGIN` (and `CLIENT_ORIGINS` if set).
- `morgan` request logging (dev/combined).

## Data protection

- **Prescription files**: stored **outside the web root** (e.g. `server/uploads/prescriptions` with strict static serving disabled), served only through an authenticated, ownership-checked endpoint; uploaded via multer with field `file`, image compression via sharp to WebP, allowed types JPEG/PNG/WebP/PDF, 5 MB limit.
- **Personal data**: data subject requests processed by anonymisation (GDPR-style); `password_hash` never returned in user responses (sanitized `safeUser`).
- **Audit**: admin/staff actions written to audit log.

## Business rules that protect data & integrity

- Ownership/scoping: customers own their orders; pharmacists/riders scoped to their pharmacy; admin can operate across pharmacies via pharmacy picker.
- Money: stored as REAL GHS rounded to 2 decimals; all writes go through services with transactions.
- Stock: reservations and deductions inside `BEGIN IMMEDIATE`; cancelled/failed payments restore stock.
- Refill reminders and notification content kept private per customer.

## Operational security

- Secrets via environment variables; `.env` git-ignored; `.env.example` committed.
- Backup retention (`BACKUP_RETENTION_DAYS`) and scheduled backups (`BACKUP_CRON`).
- JWT expiry (`JWT_EXPIRES_IN`).

## Security testing

Covered in `server/src/test/auth.test.js` (auth flows, CSRF, password policy, data rights) and admin/user suites. See [TEST_PLAN.md](TEST_PLAN.md).
