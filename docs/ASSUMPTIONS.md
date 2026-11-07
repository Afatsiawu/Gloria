# Assumptions & Scope Decisions

This capstone project was built autonomously from a product specification; where the specification was ambiguous or incomplete, the following assumptions were made and recorded.

## Assumptions

1. **Language/runtime**: JavaScript (ES modules) with plain CSS on React 18 + Vite; backend Node.js + Express with better-sqlite3. (The alternative TypeScript stack was considered but not chosen for delivery speed and tooling stability.)
2. **Node version**: spec requested Node 20; the development environment runs Node 24. Code targets Node 20+ APIs; no version-specific behaviour is relied upon.
3. **Money**: stored as REAL GHS with 2-decimal rounding; all arithmetic in GHS.
4. **Pharmacies**: 10 demo pharmacies — 6 in Doryumu, 4 in Kordibe (Shai-Osudoku District); communities limited to these two.
5. **Order statuses**: `placed → awaiting_prescription → verified → ready → out_for_delivery → completed`; plus `cancelled`.
6. **Fulfilment**: `counter` (cash on pickup) or `delivery` (MoMo or cash). Momo orders start `pending` and use mock auto-verification.
7. **Digital address**: Ghana postnet format `GA-XXX-XXXX`.
8. **Phone numbers**: Ghana mobile normalized to `+233XXXXXXXXX` (accepts `0XX` prefixes).
9. **Prescriptions**: uploaded as image/PDF; stored outside web root; served only via authenticated endpoint; compressed to WebP via sharp; field name `file`; allowed types JPEG/PNG/WebP/PDF; max 5 MB.
10. **Cart**: single pharmacy per customer; reorder re-validates stock.
11. **Admin cross-pharmacy operations** via pharmacy picker; staff/rider scoped to own pharmacy.
12. **Third-party adapters**: payment (Paystack/Hubtel/Arkesel), SMS (MoNify/Mnotify), email (SendGrid/SMTP) behind provider interfaces; default **mock** adapter with deterministic behaviour; real provider keys via env with TODO wiring.

## Scope decisions

1. **SQLite over Postgres/Prisma**: chosen for zero-config local operation; WAL + FK ON + prepared statements enabled.
2. **JWT httpOnly cookie + CSRF double-submit**: required by security requirements; CORS allow-list configured.
3. **PDF/CSV reports**: hand-written generators (pdfkit / CSV util) rather than external services.
4. **Analytics & forecasting**: computed in-house (moving-average / demand-based) rather than third-party BI.
5. **Refill reminders**: `node-cron` scheduled job with manual trigger endpoint.
6. **Backups**: SQLite file copy + retention; scheduled.

## Deviations from the original specification

1. **bcryptjs** used instead of native `bcrypt` to avoid native compilation issues in the delivery environment.
2. **`order_events`** table added as an explicit migration (timeline) beyond the original core list.
3. **Password reset / data subject request** endpoints added to satisfy security & compliance requirements.

## Open items

- Real payment/SMS/email provider credentials (documented in `.env.example`).
- TLS termination details for production deployment.
