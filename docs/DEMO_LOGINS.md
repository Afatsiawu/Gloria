# Demo Logins

All accounts below are created by the development seed (`server/src/db/seed.js`). They exist for demos, testing and screenshots only.

- **Login page**: `/login`
- **Identifier**: either the email address or the phone number (Ghana format, e.g. `+233241000001` or `0241000001`)
- **Password**: shared per role, as listed below
- **Reset**: `npm run seed` recreates all demo users with these credentials and clears existing data

> Change every password before any real deployment. These credentials are public in the repository.

## Where each role lands after login

| Role | Main pages |
|---|---|
| Customer | `/medicines`, `/cart`, `/checkout`, `/orders`, `/account`, `/refills`, `/notifications` |
| Pharmacist | `/dashboard`, `/staff/orders`, `/staff/prescriptions`, `/staff/inventory`, `/staff/deliveries`, `/staff/reports` |
| Rider | `/rider` |
| Admin | `/admin/users`, `/admin/medicines`, `/admin/analytics`, `/admin/audit`, `/admin/settings`, `/admin/outbox`, plus all staff pages |

## Admin

| Name | Email | Phone | Password |
|---|---|---|---|
| Kofi Mensah | admin@pharmalink.gh | +233240000001 | `Admin123!` |

The admin sees all pharmacies, manages medicines, users, audit logs, notifications and settings.

## Pharmacists (10)

One pharmacist per pharmacy. Staff views are scoped to that pharmacist's pharmacy.

| Pharmacy | Community | Name | Email | Phone | Password |
|---|---|---|---|---|---|
| Doryumu Community Pharmacy | Doryumu | Akua Boateng | pharmacist1@pharmalink.gh | +233241000001 | `Pharm123!` |
| Osudoku Health Pharmacy | Doryumu | Yaw Darko | pharmacist2@pharmalink.gh | +233241000002 | `Pharm123!` |
| St. Mary's Chemist | Doryumu | Efua Owusu | pharmacist3@pharmalink.gh | +233241000003 | `Pharm123!` |
| Adom Pharmacy | Doryumu | Kwabena Osei | pharmacist4@pharmalink.gh | +233241000004 | `Pharm123!` |
| Nyame Nti Pharmacy | Doryumu | Adjoa Badu | pharmacist5@pharmalink.gh | +233241000005 | `Pharm123!` |
| Shai Hills Pharmacy | Doryumu | Kwame Tetteh | pharmacist6@pharmalink.gh | +233241000006 | `Pharm123!` |
| Kordibe Community Pharmacy | Kordibe | Ama Kudzo | pharmacist7@pharmalink.gh | +233241000007 | `Pharm123!` |
| Volta Care Pharmacy | Kordibe | Selorm Agbeko | pharmacist8@pharmalink.gh | +233241000008 | `Pharm123!` |
| Amani Chemist | Kordibe | Mawuli Attah | pharmacist9@pharmalink.gh | +233241000009 | `Pharm123!` |
| Bethel Pharmacy | Kordibe | Doris Aidoo | pharmacist10@pharmalink.gh | +233241000010 | `Pharm123!` |

Use these accounts to test the order queue, prescription review, inventory, deliveries, purchase orders and reports.

## Riders (2)

| Pharmacy | Community | Name | Email | Phone | Password |
|---|---|---|---|---|---|
| Doryumu Community Pharmacy | Doryumu | Musah Adams | rider1@pharmalink.gh | +233242000001 | `Rider123!` |
| Kordibe Community Pharmacy | Kordibe | Comfort Torsu | rider2@pharmalink.gh | +233242000002 | `Rider123!` |

Riders see only deliveries assigned to their pharmacy and can update delivery status.

## Customers (12)

| Name | Community | Email | Phone | Password |
|---|---|---|---|---|
| Ama Serwaa | Doryumu | customer1@example.com | +233243000001 | `Customer123!` |
| Kwame Asante | Doryumu | customer2@example.com | +233243000002 | `Customer123!` |
| Esi Danso | Doryumu | customer3@example.com | +233243000003 | `Customer123!` |
| Yaw Oduro | Kordibe | customer4@example.com | +233243000004 | `Customer123!` |
| Akosua Frimpong | Kordibe | customer5@example.com | +233243000005 | `Customer123!` |
| Kofi Antwi | Kordibe | customer6@example.com | +233243000006 | `Customer123!` |
| Abena Nyarko | Kordibe | customer7@example.com | +233243000007 | `Customer123!` |
| Kojo Amankwah | Doryumu | customer8@example.com | +233243000008 | `Customer123!` |
| Adwoa Mensah | Kordibe | customer9@example.com | +233243000009 | `Customer123!` |
| Kwesi Appiah | Doryumu | customer10@example.com | +233243000010 | `Customer123!` |
| Afia Sarpong | Doryumu | customer11@example.com | +233243000011 | `Customer123!` |
| Nana Yeboah | Doryumu | customer12@example.com | +233243000012 | `Customer123!` |

Customers have seeded carts, orders, refill reminders and notifications so the account screens are populated.

## Guest access

No account is needed for the customer shop. A guest can browse medicines, use the cart, place an order at `/checkout`, upload a prescription and track it at `/track` using the order reference plus phone number. Guest orders also appear in the relevant pharmacist's order list and prescription queue.

Seeded guest orders for testing at `/track` (use the phone number below; the order reference is generated on each seed run and can be read from the pharmacist order list or the seed console):

| Customer | Phone | Pharmacy | Status |
|---|---|---|---|
| Ama Mensah | +233244000001 | Doryumu Community Pharmacy | Placed |
| Kojo Owusu | +233244000002 | Kordibe Community Pharmacy | Ready |
| Efua Asare | +233244000003 | St. Mary's Chemist | Completed |
| Yaw Boateng | +233244000004 | Adom Pharmacy | Awaiting prescription |

To find a seeded guest reference directly, open the pharmacist order list for that pharmacy or run:

```bash
node -e "const db=require('better-sqlite3')('./server/data/pharmacy.db',{readonly:true});console.log(db.prepare('select reference,guest_name,guest_phone from orders where guest_phone is not null').all())"
```
