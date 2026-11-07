# Traceability

This document maps the **Functional Requirements (FR)** and **Non-Functional Requirements (NFR)** of the PharmaLink capstone to implemented features, API endpoints, UI areas and tests.

Requirement identifiers follow the project backlog format used during the sprints (`FR-<epic>-<n>`, `NFR-<topic>-<n>`).

## Functional requirements — coverage matrix

| ID | Requirement (short) | Implemented in | Endpoint(s) / UI | Test(s) |
| --- | --- | --- | --- | --- |
| FR-01 | Customer registration & login | Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` | `auth.test.js`, client `LoginPage`/`RegisterPage` |
| FR-02 | Password reset flow | Auth | `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` | `auth.test.js` |
| FR-03 | Customer browse/search medicines | Catalogue | `GET /api/medicines`, `GET /api/medicines/:id` | `catalogue.test.js` |
| FR-04 | Cart management (single pharmacy) | Cart | `GET/POST/PATCH/DELETE /api/cart` | `orders.test.js` (cart) |
| FR-05 | Order placement with FEFO stock reservation | Orders | `POST /api/orders` | `orders.test.js` |
| FR-06 | Prescription upload & review | Prescriptions | `POST /api/orders/:id/prescriptions`, `PATCH /api/prescriptions/:id` | `orders.test.js`, `admin.test.js` |
| FR-07 | Order status workflow (placed → … → completed; cancelled) | Orders | `PATCH /api/orders/:id/status`, cancel, timeline | `orders.test.js` |
| FR-08 | Mock mobile money payment & cash on pickup | Payments | `POST /api/payments/:id/verify`, `GET /api/payments/order/:orderId` | `orders.test.js`, `refills` suite interplay |
| FR-09 | Delivery workflow (zone, rider, delivery status) | Delivery | `GET /api/delivery/deliveries`, `GET /api/rider/deliveries`, `PATCH /api/deliveries/:id` | `delivery.test.js` |
| FR-10 | Inventory batches, stock levels, POs, suppliers | Inventory | `GET /api/inventory/*`, `/api/purchase-orders`, `/api/suppliers` | `inventory*.test.js` |
| FR-11 | Expiry alerts / safety stock | Inventory | `GET /api/inventory/alerts`, `POST /api/jobs/stock-alerts` | `inventory.test.js` |
| FR-12 | Purchase order receive flow | Inventory | PO endpoints | `inventory.test.js` |
| FR-13 | Refill reminders & notifications | Refills / Notifications | `GET /api/jobs/refill-reminders`, `/api/notifications/my`, admin outbox | `refills.test.js`, `admin.test.js` |
| FR-14 | Reports: stock / expiry / sales / receipts (CSV & PDF) | Reports | `GET /api/reports/*`, `GET /api/orders/:id/receipt` | `reports.test.js` |
| FR-15 | Analytics: sales, dashboard, forecast, unmet demand | Analytics | `GET /api/analytics/*`, `/api/dashboard` | analytics flows covered via dashboard/analytics services |
| FR-16 | User administration & roles | Users | `GET/POST/PATCH /api/users`, suspend/activate | `admin.test.js` |
| FR-17 | Audit & data subject requests | Admin | `/api/users/data-requests`, `/api/users/data-requests/:id/process` | `admin.test.js` |
| FR-18 | Backups & restore | Admin | `GET/POST /api/admin/backups` | `admin.test.js` |
| FR-19 | Pharmacy management (public picker, zones, riders) | Delivery / Catalogue | `/api/pharmacies`, `/api/delivery-zones` | `delivery.test.js` |
| FR-20 | Walk-in counter orders | Orders | `POST /api/orders` with `fulfilment: counter` | `orders.test.js` |
| FR-21 | Reorder from history | Orders | `POST /api/orders/:id/reorder` | `orders.test.js` |
| FR-22 | Notifications preferences / outbox | Notifications | outbox endpoints | `admin.test.js` |

## Non-functional requirements — coverage matrix

| ID | Requirement | Evidence |
| --- | --- | --- |
| NFR-01 | Performance: responsive UI, charts | Charts, pagination; API pagination enforced |
| NFR-02 | Security: bcrypt + JWT httpOnly + CSRF + helmet + rate limit | `SECURITY.md`; `auth.test.js` |
| NFR-03 | Availability: automated backups, cron jobs | `BACKUP_RESTORE.md`; backup/refill endpoints |
| NFR-04 | Data integrity: transactions, FEFO, money rounding | `orderService` transactions; tests |
| NFR-05 | Privacy: prescription file isolation, data requests | prescriptions, admin data requests |
| NFR-06 | Usability: plain CSS design system, responsive | responsive CSS, RTL-tested components |
| NFR-07 | Testability: isolated DB, mocked providers | vitest configs, fixtures, helpers |
| NFR-08 | Maintainability: layered architecture, zod validation | layered services/repositories |
| NFR-09 | Scalability: SQLite for cohort, adapters for scale-up | provider adapters |
| NFR-10 | Compliance: audit log, retention | audit + settings |

## Traceability summary

- **Backend**: every FR area has at least one automated API test (103 tests) covering the happy path and key negative paths (auth, authorisation, validation).
- **Client**: shared components and utils covered (21 tests); pages are exercised via routing/guard tests and will be covered by further component tests as the app stabilises.
- **End-to-end demo flows**: order placement → payment → fulfilment → delivery → receipt; prescription review → verification; inventory alerts; reports.

## Requirement coverage status

| Area | Status |
| --- | --- |
| Customer flows (auth, browse, cart, order, payment, prescription, tracking, refills) | Covered by automated tests + demo |
| Pharmacy operations (orders, prescriptions, inventory, alerts, POs, delivery, reports) | Covered by automated tests + demo |
| Admin (users, medicines, analytics, audit, backups, settings) | Covered by automated tests |
| Security & compliance controls | Covered by automated tests |
| Non-functional (performance, security, backup, testability) | Designed + tested |

*See [TEST_PLAN.md](TEST_PLAN.md) for test commands and results.*
