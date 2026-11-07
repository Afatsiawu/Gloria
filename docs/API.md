# API Reference

Base URL: `/api` (e.g. `http://localhost:4000/api`). All responses JSON unless noted. Errors use a consistent envelope:

```json
{ "error": "message", "details": [ { "path": "body.phone", "message": "Enter a valid Ghana mobile number" } ] }
```

Auth: JWT in httpOnly cookie (`Authorization: Bearer` also accepted), double-submit CSRF cookie on state-changing routes.

## Health

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | – | Liveness/readiness |

## Auth & users

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | – (rate-limited) | Self-service registration |
| POST | `/api/auth/login` | – (rate-limited) | Login with phone or email |
| POST | `/api/auth/logout` | ✓ | Logout |
| GET | `/api/auth/me` | ✓ | Current user (safe fields) |
| POST | `/api/auth/forgot-password` | – | Request reset (mock SMS/email) |
| POST | `/api/auth/reset-password` | – | Reset with token |
| GET | `/api/auth/csrf` | – | CSRF token bootstrap |
| GET | `/api/users` | admin | Paginated user list (`?role=&pharmacyId=&q=&active=&page=&pageSize=`) |
| POST | `/api/users` | admin | Create user (pharmacist/rider/customer/admin) |
| PATCH | `/api/users/:id` | admin | Update user / assign pharmacy / role |
| POST | `/api/users/:id/suspend` | admin | Suspend user |
| POST | `/api/users/:id/activate` | admin | Activate user |
| GET | `/api/users/data-requests` | admin | Deletion/data requests |
| POST | `/api/users/data-requests/:id/process` | admin | Process deletion request (anonymise) |

## Catalogue & medicines

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/medicines` | optional | Public catalogue (`?q=&category=&community=&pharmacyId=`) |
| GET | `/api/medicines/:id` | optional | Medicine detail |
| POST | `/api/medicines` | admin | Create medicine |
| PATCH | `/api/medicines/:id` | admin | Update medicine |
| DELETE | `/api/medicines/:id` | admin | Delete medicine |
| GET | `/api/categories` | – | Categories |
| POST | `/api/categories` | admin | Create category |
| DELETE | `/api/categories/:id` | admin | Delete category |

## Cart & orders

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/cart` | customer | Get current cart |
| POST | `/api/cart` | customer | Add item |
| PATCH | `/api/cart` | customer | Update quantity |
| DELETE | `/api/cart` | customer | Clear cart |
| POST | `/api/orders` | customer | Place order (`placeSchema`: items, fulfilment, payment) |
| GET | `/api/orders` | customer/staff | List orders (scoped / paged) |
| GET | `/api/orders/:id` | customer/pharmacist/rider | Order detail (access-scoped) |
| GET | `/api/orders/:id/timeline` | customer/pharmacist/rider | Order events |
| POST | `/api/orders/:id/cancel` | customer/pharmacist | Cancel (restores stock) |
| POST | `/api/orders/:id/reorder` | customer | Reorder from history (re-validates stock) |

## Prescriptions

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/orders/:orderId/prescriptions` | customer | Upload prescription (multipart `file`, JPEG/PNG/WebP/PDF ≤ 5 MB) |
| GET | `/api/prescriptions/:id/file` | customer/pharmacist | Serve prescription file (authenticated, scoped) |
| PATCH | `/api/prescriptions/:id` | pharmacist | Approve / reject (auto-verify on approval) |

## Payments

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/payments/:id/verify` | customer | Verify mock MoMo payment / capture |
| GET | `/api/payments/order/:orderId` | customer/pharmacist | Payment state for order |

## Inventory, batches, alerts, POs, suppliers, zones, riders, deliveries

| Area | Key endpoints |
| --- | --- |
| Inventory | `GET /api/inventory/stock`, `GET /api/inventory/expiry`, `GET /api/inventory/alerts`, `POST/PATCH /api/inventory/items/:itemId` |
| Batches / POs / suppliers / zones / riders / deliveries | see route modules `inventory`, `purchase`, `suppliers`, `delivery`, `admin` |

Representative endpoints:

- `GET /api/inventory/stock?from=&to=&pharmacyId=`
- `GET /api/inventory/expiry?days=&pharmacyId=`
- `GET /api/inventory/alerts?pharmacyId=&days=`
- `GET /api/purchase-orders?pharmacyId=&status=`
- `GET /api/suppliers?pharmacyId=`
- `GET /api/delivery-zones?pharmacyId=&includeInactive=true`
- `GET /api/riders?pharmacyId=`
- `GET /api/delivery/deliveries` (pharmacist queue), `GET /api/rider/deliveries` (rider), `PATCH /api/deliveries/:id` (pharmacist assign / rider complete)
- `GET /api/analytics/sales?from=&to=&pharmacyId=` etc. (see `analytics`)

## Refills, notifications, backups, reports, dashboard

| Area | Key endpoints |
| --- | --- |
| Refills | `GET /api/refills`, `POST /api/refills/:id/…`, `POST /api/jobs/refill-reminders`, `DELETE /api/refills/:id` |
| Notifications | `GET /api/notifications/my`, admin outbox: `GET /api/admin/notifications/outbox`, `POST /api/jobs/stock-alerts` |
| Backups | `GET /api/admin/backups`, `POST /api/admin/backups` |
| Reports | `GET /api/reports/stock`, `/expiry`, `/sales`, `/export`, `GET /api/orders/:id/receipt`, `POST /api/reports/generate` |
| Dashboard | `GET /api/dashboard` (scoped or admin-wide) |
| Analytics | `GET /api/analytics/sales`, `GET /api/analytics/forecast` (requires `pharmacyId` for admin) |
| Audit | `GET /api/admin/audit` |

## Error codes

| Status | Meaning |
| --- | --- |
| 400 | Validation error (zod details) |
| 401 | Missing/invalid session |
| 403 | Authenticated but wrong role / scoping violation |
| 404 | Resource not found |
| 429 | Rate limit exceeded |
| 500 | Internal error |

## Testing the API

See [TEST_PLAN.md](TEST_PLAN.md). API tests use supertest with an isolated in-memory DB and mocked providers.
