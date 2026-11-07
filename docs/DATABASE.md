# Database

PharmaLink uses **SQLite** accessed through **better-sqlite3** with **WAL** journal mode and **foreign keys ON**, and prepared statements throughout. Schema changes are versioned SQL migrations applied by the migration runner at server start.

## Migrations

| File | Purpose |
| --- | --- |
| `server/src/db/migrations/001_init.sql` | Core schema: pharmacies, users, medicines, categories, batches, suppliers, inventory transactions, orders, prescriptions, payments, delivery zones, riders, deliveries, notifications, settings, audit, refills, unmet demand, carts, password resets, data requests |
| `server/src/db/migrations/002_order_events.sql` | Order lifecycle timeline (`order_events`) |

## Key tables

| Table | Purpose |
| --- | --- |
| `pharmacies` | 10 demo pharmacies (6 Doryumu, 4 Kordibe), license numbers |
| `users` | customers, pharmacists, riders, admins; roles, pharmacy scoping, consent, data subject fields |
| `medicines` | catalogue: name, strength, form, price, pharmacy-scoped stock via batches |
| `medicine_categories` | therapeutic categories |
| `batches` | stock lots: batch number, expiry, quantity, FEFO ordering |
| `suppliers` | procurement contacts per pharmacy |
| `purchase_orders` | PO lifecycle (draft → ordered → received / cancelled) |
| `inventory_transactions` | stock movements (receipts, dispensing, adjustments) |
| `carts` | single-pharmacy cart per customer |
| `orders` | customer orders with fulfilment mode (counter / delivery), totals, status |
| `order_events` | immutable timeline (placed, prescription review, verified, ready, out_for_delivery, completed, cancelled) |
| `prescriptions` | prescription metadata + file path (file stored outside web root) |
| `payments` | provider payments: mock MoMo / cash_on_pickup / adapter attempts, references, status |
| `delivery_zones` | per-pharmacy delivery areas, radius / SLA |
| `deliveries` | rider assignments and delivery status |
| `notifications` | in-app outbox + delivery records (SMS/email adapters write copies) |
| `refill_reminders` | scheduled customer reminders |
| `unmet_requests` | demand signals (search frequency) for forecasting |
| `audit_log` | admin/staff actions |
| `settings` | operational settings (expiry alert days, forecast window, safety stock) |
| `password_resets` / `data_requests` | password reset tokens, GDPR-style deletion requests |

## Conventions

- **Identifiers**: integer PKs; human-friendly references (e.g. order reference like `ORD-…`, pharmacy license `DD-PH-XXX`) generated via `server/src/utils/reference.js`.
- **Money**: `REAL` GHS rounded to 2 decimals.
- **Timestamps**: UTC ISO strings / SQLite `datetime('now')` style.
- **Enums**: stored as text (`order_status`, `payment_status`, `user_role`, …).

## Seed data

`server/src/db/seed.js` populates:

- 10 pharmacies (6 Doryumu, 4 Kordibe) with zones, suppliers, batches, medicines.
- 66 medicines across categories.
- 25 users (1 admin, 8 pharmacists, 2 riders, 14 customers) with deterministic demo passwords.
- 222 orders with events, payments, prescriptions, fulfilment history.
- Batches, POs, refills, unmet demand, audit entries, demo prescription (PDF).

Run: `npm run seed`.

## Backup & restore

See [BACKUP_RESTORE.md](BACKUP_RESTORE.md). Operational DB file: `server/data/pharmacy.db` (git-ignored, WAL files `*-shm` / `*-wal`).
