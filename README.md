# PharmaLink — Data-Driven Integrated Pharmacy and Customer Order System

**Ghana, Shai-Osudoku District — community pharmacies in Doryumu and Kordibe.**

PharmaLink is a full-stack pharmacy operations and customer ordering platform for a network of 10 community pharmacies. It integrates prescription intake, pharmacist verification, stock management, fulfilment (counter / delivery), payments, customer communication, and analytics into a single data-driven system.

---

## Table of contents

- [What it does](#what-it-does)
- [Tech stack](#tech-stack)
- [Architecture at a glance](#architecture-at-a-glance)
- [Getting started](#getting-started)
- [Demo accounts](#demo-accounts)
- [Configuration](#configuration)
- [Scripts](#scripts)
- [Testing](#testing)
- [Documentation](#documentation)
- [Project structure](#project-structure)
- [Assumptions and scope](#assumptions-and-scope)

## What it does

PharmaLink covers the end-to-end pharmaceutical workflow:

1. **Customer** browses/search medicines for a single pharmacy, adds items to a cart, checks out (mock mobile-money payment or cash on pickup), and uploads a prescription when required.
2. **Pharmacist** receives orders, reviews prescriptions, verifies stock, marks orders ready / out for delivery, manages inventory, purchase orders, suppliers, delivery zones and riders, runs alerts and refill jobs, and exports reports.
3. **Rider** receives assigned deliveries and marks them delivered.
4. **Admin** operates across all pharmacies via a pharmacy picker, manages users, medicines, categories, audit and compliance data requests, settings, backups, and analytics/forecasts.

Core differentiator: **data-driven**. Sales, stock, expiry, demand forecasting and safety-stock alerting are computed from real transactional data (FEFO order fulfilment, batch expiry, unmet demand).

## Tech stack

| Concern | Choice |
| --- | --- |
| Frontend | React 18, Vite, React Router v6, plain CSS design system, Chart.js via react-chartjs-2 |
| Backend | Node 20+ (env runs 24), Express 4, ES modules |
| Database | SQLite via better-sqlite3 (WAL, foreign keys ON, prepared statements) |
| Auth | bcryptjs password hashing (cost ≥ 10), JWT in httpOnly cookie, CSRF double-submit cookie |
| Validation | zod |
| File uploads | multer (JPEG/PNG/WebP/PDF ≤ 5 MB, field `file`), sharp (WebP compression) |
| Documents | pdfkit (receipts, CSV-free PDF reports) |
| Reporting | hand-written CSV export, PDF export |
| Security/ops | helmet, rate limiting, compression, CORS allow-list, morgan, node-cron, express-rate-limit |
| Tests | Vitest + supertest (server), Vitest + Testing Library (client) |

Third-party services (payment provider, SMS gateway, email/SMTP) are behind adapter interfaces with a deterministic mock provider by default and real-provider placeholders (Paystack, Hubtel, Arkesel, MoNify/Mnotify, SendGrid, SMTP) configured through environment variables.

## Architecture at a glance

```
Browser (React SPA)  ──HTTPS──>  Express API  ──better-sqlite3──>  SQLite file
                          (JWT cookie + CSRF)         (WAL / FK / prepared stmts)
```

- **Frontend**: `client/` — Vite SPA, React Router, plain CSS (`styles.css`), charts.
- **Backend**: `server/` — Express app, layered `routes → controllers → services → repositories`, middleware, providers.
- **Database**: `server/src/db/migrations/001_init.sql` + `002_order_events.sql`, migration runner.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for component diagrams and data flow.

## Getting started

Prerequisites: **Node 20+** (the current environment runs Node 24) and npm workspaces.

```bash
git clone <repo-url> && cd <repo>
npm install
cp .env.example .env          # adjust values as needed
npm run seed                   # demo database
npm run dev                    # API on :4000, client on :5173 (proxy /api -> :4000)
```

- API health check: `GET http://localhost:4000/api/health`
- Client: `http://localhost:5173`

Production-style run:

```bash
npm run build && npm run start
```

## Demo accounts

| Role | Identifier | Password | Notes |
| --- | --- | --- | --- |
| Admin | `+233240000001` (or `admin@pharmalink.gh`) | `Admin123!` | Cross-pharmacy oversight |
| Pharmacist | `+233241000001` | `Pharm123!` | Scoped to their pharmacy |
| Rider | `+233242000001` | `Rider123!` | Scoped to assigned deliveries |
| Customer | `+233243000001` | `Customer123!` | Has sample orders, prescriptions |

All demo passwords satisfy the password policy (≥ 8 chars, lower + upper + digit).

## Configuration

Key environment variables (see `.env.example`):

- `NODE_ENV`, `PORT=4000`, `CLIENT_ORIGIN=http://localhost:5173`
- `DB_PATH=./data/pharmacy.db`
- `JWT_SECRET`, `JWT_EXPIRES_IN=7d`, `BCRYPT_ROUNDS=10`, `COOKIE_SECURE=false`
- `PAYMENT_PROVIDER`, `SMS_PROVIDER`, `EMAIL_PROVIDER` (`mock` by default)
- `MOCK_PAYMENT_FAILURE_RATE=0`, `MOCK_PAYMENT_DELAY_MS=4000`
- Operations: `EXPIRY_ALERT_DAYS=90`, `FORECAST_WINDOW_WEEKS=4`, `FORECAST_LEAD_TIME_DAYS=7`, `SAFETY_STOCK_DAYS=3`, `BACKUP_RETENTION_DAYS=14`, `BACKUP_CRON=0 2 * * *`, `ENABLE_CRON=true`

## Scripts

| Command | Workspace | Purpose |
| --- | --- | --- |
| `npm run dev` | root | Run server + client concurrently |
| `npm run seed` | root | Seed demo database |
| `npm run build` | client | Vite production build |
| `npm run start` | server | Express server |
| `npm run test` | root | Server tests then client tests |
| `npm run test:server` / `npm run test:client` | root | Workspace-specific tests |
| `npm run lint` / `npm run format` | root | ESLint / Prettier |

## Testing

- **Server**: 103 tests across 10 suites (auth, catalogue, orders, inventory, delivery, reports, admin, refills, inventory API, utils) using Vitest + supertest with an isolated in-memory SQLite database per test file, mocked third-party providers, temp upload/backup/report directories.
- **Client**: 21 tests across 4 suites (format utils, StatusBadge, Timeline, ProtectedRoute) using Vitest + Testing Library + jsdom.
- **Full run**: `npm run test` — all passing.
- **Client build**: `npm run build` — passing.

## Documentation

| Doc | Purpose |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture, diagrams, service flows |
| [docs/DATABASE.md](docs/DATABASE.md) | Schema, migrations, seed data |
| [docs/API.md](docs/API.md) | Endpoint reference |
| [docs/SECURITY.md](docs/SECURITY.md) | Security design and controls |
| [docs/BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md) | Backup and restore procedures |
| [docs/USER_MANUAL.md](docs/USER_MANUAL.md) | End-user / staff / admin walkthrough |
| [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md) | Assumptions and documented deviations |
| [docs/TEST_PLAN.md](docs/TEST_PLAN.md) | Test plan and coverage |
| [docs/TRACEABILITY.md](docs/TRACEABILITY.md) | Requirements traceability |

## Project structure

```
/
├── client/                 # React 18 + Vite SPA
│   └── src/
│       ├── api/            # API client, CSRF helper, downloads
│       ├── components/     # UI kit, Timeline, PharmacyPicker, Charts, Layout, ProtectedRoute
│       ├── context/        # AuthContext
│       ├── hooks/          # useApi
│       ├── pages/          # public / customer / staff / admin / rider / NotFound
│       ├── test/           # client tests
│       └── utils/format.js
├── server/                 # Express API
│   └── src/
│       ├── controllers/ services/ repositories/ middleware/ routes/
│       ├── db/             # migrations, connection, seed
│       ├── services/providers/  # payment, SMS, email adapters (mock default)
│       └── test/           # API tests, fixtures, helpers
└── docs/
```

## Assumptions and scope

See [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md). In summary: JavaScript (not TypeScript) throughout; Node 24 in this environment (spec asked for 20); money stored as GHS decimals rounded to 2 places; prescriptions served only via authenticated endpoint from outside web root; third-party providers mocked behind adapters with real-provider TODOs.

---

## Final summary (for the capstone submission)

- **Product**: PharmaLink — integrated pharmacy ordering and operations platform for 10 community pharmacies in Doryumu & Kordibe, Ghana.
- **Stack**: React 18 + Vite / Node 20 + Express / SQLite (better-sqlite3) / Chart.js / Express security middleware / zod / multer-pdfkit.
- **Capabilities**: prescription-driven ordering with FEFO fulfilment; mock mobile-money (MTN MoMo) with auto-verify and cash-on-pickup; delivery workflow with riders and zones; inventory batches, expiry alerts, safety stock, purchase orders, supplier management; refill reminders and notifications outbox; analytics, demand forecasting; CSV/PDF reports and receipts; audit + data subject requests + backups; full user/admin/roles.
- **Quality**: 103 backend tests + 21 client tests passing; client production build passing; end-to-end demo flows covered by tests.
- **Demo**: see [Demo accounts](#demo-accounts).
