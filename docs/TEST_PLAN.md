# Test Plan

## Scope

- Backend API: Vitest + supertest, isolated in-memory SQLite per test file, mocked third-party providers, temp dirs, `NODE_ENV=test`, rate limits/cron disabled.
- Client: Vitest + Testing Library + jsdom; format utils, shared UI components, timeline, route guard.

## Backend test suites (server/src/test)

| Suite | Tests | Covers |
| --- | --- | --- |
| `auth.test.js` | — | register/login/logout/reset/forgot, password policy, JWT, CSRF, data rights |
| `catalogue.test.js` | — | medicines/categories CRUD, public search |
| `orders.test.js` | — | placement, FEFO, status transitions, cancel stock-restore, reorder, walk-in |
| `inventory.test.js` / `inventory-api.test.js` | — | batches, stock, alerts, POs |
| `delivery.test.js` | — | zones, riders, deliveries |
| `reports.test.js` | — | CSV/PDF export, receipts, permissions |
| `admin.test.js` | — | user admin, backups, data requests, notifications outbox |
| `refills.test.js` | — | refill reminders, privacy, job |
| `utils.test.js` | — | pure helpers |

**Total: 103 tests — all passing.**

## Client test suites (client/src/test)

| Suite | Tests | Covers |
| --- | --- | --- |
| `format.test.js` | 10 | money/date/labels/status tones |
| `StatusBadge.test.jsx` | 4 | badge tones/labels |
| `Timeline.test.jsx` | 3 | order timeline stages |
| `ProtectedRoute.test.jsx` | 4 | auth loading/redirect/role guard |

**Total: 21 tests — all passing.**

## Prior test runs and fixes

- Fixed user listing pagination bug (`offset` was not computed → `SQLITE_MISMATCH`/empty items).
- Fixed order/prescription/delivery transaction helper usage.
- Fixed SMS adapter argument order, analytics date modifiers (`weeks` → `days`), safe user sanitisation, async handlers, PO detail query, empty-filter handling.

## Commands

```bash
npm run test        # server then client
npm run test:server # server only
npm run test:client # client only
npm run build       # client production build
```

## Exit criteria

- All backend and client tests green; client build green; seed + demo flows verified.
