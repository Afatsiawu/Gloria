# Authentication and Role Routing

This document describes how PharmaLink decides where a signed-in user belongs and how it keeps users out of areas that belong to another role. It covers the client auth flow and the minimum server contract that makes it possible.

## Role table

| Role | Home | Allowed areas |
| --- | --- | --- |
| Customer | `/account` | Public pages, `/account/*`, `/checkout`, `/cart`, `/orders/*`, `/refills`, `/notifications` |
| Pharmacist | `/dashboard` (canonical `/pharmacist/dashboard`) | `/dashboard`, `/staff/*` for the pharmacist's own pharmacy only, change password, notifications |
| Admin | `/dashboard` (canonical `/admin/dashboard`) | `/dashboard`, `/staff/*`, `/admin/*` for any pharmacy, change password, notifications |
| Rider | `/rider` (canonical `/rider/deliveries`) | `/rider/*`, change password, notifications |
| Anonymous | `/` | Home, Medicines, medicine page, Cart, Checkout, Track order, Login, Register, Forgot/Reset password |

Public pages are available to every role as well. The canonical role URLs are mapped onto the routes the app already renders, so no existing route was renamed.

## Route mapping

The single source of truth is `client/src/config/roleRoutes.js`.

| Canonical URL | Rendered route |
| --- | --- |
| `/pharmacist/dashboard` | `/dashboard` |
| `/pharmacist/orders` | `/staff/orders` |
| `/pharmacist/prescriptions` | `/staff/prescriptions` |
| `/pharmacist/inventory` | `/staff/inventory` |
| `/pharmacist/suppliers` | `/staff/suppliers` |
| `/pharmacist/purchase-orders` | `/staff/purchase-orders` |
| `/pharmacist/walk-in` | `/staff/walk-in` |
| `/pharmacist/reports` | `/staff/reports` |
| `/admin/dashboard` | `/dashboard` |
| `/rider/deliveries` | `/rider` |

Exports used by the rest of the app:

- `getHomeRoute(role)`
- `isRouteAllowed(role, path)`
- `sanitizeNext(next, role)`
- `getNavGroups(role)`
- `ROLE_NAV`, `HOME_ROUTES`, `PUBLIC_PATHS`, `CHANGE_PASSWORD_PATH`

Only local, known routes allowed for the role survive `sanitizeNext`. Absolute URLs, protocol schemes (`https:`, `javascript:`), protocol-relative paths (`//host`), backslashes, control characters and unknown or cross-role paths return `null`, and the caller falls back to the role home.

## Sign-in and registration

```mermaid
flowchart TD
  A[Login or Register page] --> B{Already signed in?}
  B -- yes --> C{mustChangePassword?}
  C -- yes --> D[/account/change-password]
  C -- no --> E[sanitizeNext or role home]
  B -- no --> F[Submit credentials]
  F --> G{Success?}
  G -- no --> H[Inline error, button re-enabled]
  G -- yes --> I{mustChangePassword?}
  I -- yes --> D
  I -- no --> J{Valid next for role?}
  J -- yes --> K[Next page]
  J -- no --> L[Role home]
```

Registration creates customers only and signs the new account in immediately. It shows the toast "Account created.", merges the guest cart if one exists, then uses the same `next` or role-home rule. The form has no role field; the server ignores any role sent.

`next` is transported in the query string (`/login?next=%2Forders%2F210`) and mirrored in router state. It survives the Register and Forgot/Reset password links, and the numeric `/orders/:reference` redirect uses the same query form.

## Guard flow

One `RequireAuth` and one `RequireRole` cover each top-level group in `client/src/App.jsx`; `ProtectedRoute` delegates to them so the existing tests and call sites keep working.

```mermaid
flowchart TD
  A[Route render] --> B{Session loading?}
  B -- yes --> C[Loading… screen]
  B -- no --> D{Signed in?}
  D -- no --> E[/login?next=current]
  D -- yes --> F{mustChangePassword and not on change page?}
  F -- yes --> G[/account/change-password]
  F -- no --> H{Role and path allowed?}
  H -- no --> I[Toast: That page is not available for your account, then role home]
  H -- yes --> J[Render page]
```

- The loading screen is plain "Loading…" so no page flashes before the session is known.
- Wrong-role navigation shows one toast and replaces the history entry with the role home.
- The same guard runs on every navigation, including Back/Forward, because it is part of the route tree.

## Session events

| Event | Trigger | Result |
| --- | --- | --- |
| Logout | Sign out control or `AuthContext.logout()` | Server cookie cleared, user cleared, toast "You have been logged out.", redirect to Home |
| Cross-tab logout | Another tab logs out | `BroadcastChannel('pharmalink-auth')` and a `pharmalink_auth_event` marker clear this tab with the same toast |
| Expiry | Any non-auth request returns 401 | Toast "Please sign in again."; the current guard redirects to `/login?next=<current>` |

Only the guest cart (`pharmalink_guest_cart_v1`), the auth event marker and the admin pharmacy-picker preference are written to `localStorage`. The role and the session token live in the httpOnly cookie / in-memory context, never in `localStorage`.

## Server contract

- `POST /api/auth/login`, `POST /api/auth/register` and `GET /api/auth/me` return the same user object: `{ id, fullName, role, pharmacyId, pharmacyName, mustChangePassword }` plus the legacy profile fields. No password hash is returned.
- The JWT identifies the user, but the role, pharmacy and active flag are reloaded from the database on every request, so a role change or suspension applies on the next request.
- Registration accepts customers only. Staff accounts are created by an admin through `/api/users`, where `mustChangePassword` can be set.
- `users.must_change_password` is added by migration `004` with a default of 0; `/auth/me/password` clears it.
- Suspended accounts receive "This account is suspended. Contact the pharmacy."; wrong identifiers and passwords keep one generic message.
- Pharmacists are scoped to their own pharmacy in orders, prescriptions, inventory, delivery, dashboard, analytics and reports; cross-pharmacy access returns 403. Admins may select a pharmacy.
- Logout clears the auth cookie.
- Past guest orders can be linked only through an opt-in one-time code (`POST /auth/me/link-orders/request`, `POST /auth/me/link-orders/verify`); nothing is linked automatically.

## Navigation

`ROLE_NAV` holds one grouped menu per role:

- Customers: Home, Medicines, Pharmacies, Track order, Cart, Account.
- Pharmacists: Orders, Stock and Reports groups covering every staff page.
- Admins: Operations, Stock and Administration groups.
- Riders: Deliveries.

`getNavGroups(role)` feeds both the desktop staff sidebar and the full-page mobile menu, so they cannot drift. Staff never see the customer cart icon or the bottom navigation. On customer pages they see the customer layout with a "Back to dashboard" header link; on Home the link reads "Dashboard". The pharmacist staff topbar shows the pharmacy name.

## Edge cases

- **Forced password change** is enforced by the layout on every path, so an admin or staff member created with a temporary password cannot use the rest of the app first. The change page has its own Log out.
- **Pharmacist without a pharmacy** gets a full-page "No pharmacy assigned" message with Log out instead of a broken staff shell.
- **Duplicate submits** are blocked by the `submitting` flag and disabled buttons on login, register, forgot/reset password and password change; errors appear inline and the button is re-enabled.
- **Customer data 403s** (for example an order that belongs to someone else) stay on the page as an inline error. Only staff-area 403s trigger the wrong-area redirect.

## Verification

Automated:

- Server: `npm test` in `/server` — 12 files, 122 tests passed, including the role access matrix and verified order linking.
- Client: `npm test` in `/client` — 5 files, 39 tests passed, including 18 role-routing/navigation cases.
- Client production build: `npm run build` succeeds.

Manual (running API on port 4000 and Vite on 5173):

- Signed out `/orders/210` → `/login?next=%2Forders%2F210`; signing in as customer1 returned to `/orders/210`.
- Registering a new customer signed in, showed "Account created." and landed on `/account`; the guest cart was merged into the account cart and the guest key removed.
- Each role signed in to its home: customer `/account`, pharmacist and admin `/dashboard`, rider `/rider`.
- Pharmacist opening `/account` and customer opening `/dashboard` showed "That page is not available for your account." and returned to their own home.
- Signed-in visits to `/login` and `/forgot-password` redirected to the role home.
- Staff stayed on Home with the "Dashboard" pill; on `/medicines` the pill read "Back to dashboard" and there was no cart icon or bottom nav.
- Cross-tab logout and a simulated 401 produced "You have been logged out." and "Please sign in again."; expiry redirected to `/login?next=%2Faccount`.
- The admin forced-change account could not open `/dashboard` until the password was changed; its Log out returned Home.
- A pharmacist with no pharmacy saw the full-page message and Log out.
- The past-order linking section showed the ineligible message for a fresh phone, and a seeded guest order was linked only after entering the 6-digit code.

## Remaining gaps

- Canonical URLs such as `/pharmacist/dashboard` are mapped for redirects and `next`, but are not themselves router routes; opening one directly shows the 404 page. Renaming the routes was out of scope.
- Forced password change is enforced by the client and by the login response. A token issued before the flag was set could still call APIs directly until the password changes; a server middleware would close that gap.
- Cross-tab logout relies on `BroadcastChannel` with a `storage` fallback; browsers that block both cannot notify other tabs, though the next request in those tabs will get a 401 and sign out.
- Guest order linking is opt-in and only matches orders with the same phone number; orders placed with a different phone cannot be claimed.
