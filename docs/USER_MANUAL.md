# User Manual

## Overview

PharmaLink serves four personas. All use the same React SPA with role-based routing.

Demo accounts and credentials for every role are listed in [DEMO_LOGINS.md](DEMO_LOGINS.md).

## Customer

1. **Register / login** at `/register` or `/login` (phone or email + password).
2. **Browse**: `/search` — search medicines, filter by pharmacy/community.
3. **Open medicine**: `/medicine/:id` — view price, stock, add to cart.
4. **Cart**: `/cart` — single pharmacy cart, quantities.
5. **Checkout**: `/checkout` — fulfilment (counter / delivery), delivery address, digital address (`GA-XXX-XXXX`), payment method (mock MoMo / cash on pickup).
6. **Prescription**: upload via checkout/orders when required; pharmacist approves → order verified.
7. **Orders**: `/orders` list, `/orders/:id` tracking with timeline; cancel; reorder.
8. **Refills**: `/refills` — personal refill reminders.
9. **Notifications**: `/notifications` — in-app + provider copies.
10. **Profile**: `/profile` — details, data export request, delete account request.

## Pharmacist / staff

1. **Dashboard**: `/dashboard` — today's orders, revenue, alerts.
2. **Order queue**: `/orders` — see placed orders, start prescription review.
3. **Prescription queue**: `/prescriptions` — approve / reject; auto-verify on approval.
4. **Inventory**: `/inventory` — stock levels, expiry, alerts, batches.
5. **Alerts**: expiry & safety-stock alert runs (`POST /api/jobs/stock-alerts`).
6. **Deliveries**: assign rider / deliver.
7. **Zones & riders**: manage delivery zones and rider list for the pharmacy.
8. **Purchase orders**: create/receive POs; supplier management.
9. **Reports**: stock / expiry / sales CSV + PDF export; order receipt PDF.
10. **Refill jobs**: `POST /api/jobs/refill-reminders`.

Staff routes are pharmacy-scoped; admin sees cross-pharmacy via pharmacy picker.

## Rider

1. **Rider deliveries**: `/rider` — assigned deliveries for their pharmacy(s).
2. **Update status**: picked up → out for delivery → delivered; stock already deducted at placement.

## Admin

1. **Users**: create/suspend/activate staff & customers; role & pharmacy assignment.
2. **Medicines**: catalogue management.
3. **Analytics**: sales, dashboard, demand forecast, unmet demand.
4. **Audit & data requests**: review actions; process deletion requests (anonymise).
5. **Settings**: operational settings.
6. **Backups**: trigger/inspect backups; retention.
7. **Outbox**: notifications audit.

## Demo walkthrough

See [README.md](../README.md#demo-accounts) for demo credentials and [ARCHITECTURE.md](ARCHITECTURE.md) for flows.
