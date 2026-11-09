# Frontend audit — PharmaLink client

Date: 9 November 2026
Scope: `client/` (React 18 + Vite frontend). Backend, API calls, routes, business logic, guest checkout and the full-page mobile menu behaviour are out of scope and were not modified.

## 1. Method

- Read all 35 route pages in `client/src/pages`, the 7 shared components, `App.jsx`, `Layout.jsx`, `NavMenu.jsx` and `styles.css` (3,635 lines, 278 unique class selectors).
- Reviewed the full screenshot set in `docs/screenshots/` (70 images: every screen at 390px and 1280px) taken from the running app in this working tree.
- Measured `document.documentElement.scrollWidth` at 320, 360, 390, 414, 768, 1024, 1280 and 1440px; measured tap targets, CSS size, media queries, inline styles, `!important`, gradients/blur, non-ASCII glyphs and icon coverage.
- Calculated WCAG contrast ratios for every proposed text/background pair with a script (values below in the plan).
- Ran the existing suites: client 21/21 pass, server 114/114 pass. Guest checkout was exercised end-to-end in this build (latest order `PH-20261108-NDA4`).

## 2. What is already healthy

These must be preserved through the redesign:

- No horizontal scroll at any tested width; tables already stack below 768px with `data-label` cells.
- Guest checkout, cart conflict handling, order tracking by reference + phone, prescription upload, staff queue actions and all 30 functional requirements work.
- The full-page menu (portal, scroll lock, focus trap, Escape/route close, breakpoint auto-close) works and must keep its behaviour.
- Route-level code splitting, lazy product images, skip link, page titles and the reduced-motion rule exist.
- No gradients, blur, `backdrop-filter`, neon colours, raster artwork or emoji. Only four `!important` rules, all inside `prefers-reduced-motion`.
- Only two inline styles, both dynamic chart widths (allowed).
- No raw hex values outside `:root`.

## 3. Findings

Severity: **blocker** (must change to meet the brief), **high** (clear quality/consistency gap), **medium** (polish or robustness), **low** (hygiene).

| ID | Severity | Area | Finding |
|---|---|---|---|
| F-01 | blocker | Colour | The stylesheet implements the previous warm-green palette (`#1B7F5B`, `#FAF8F4`, `#E4E0D8`). The requested Care Teal, Clinical Blue, Fresh Mint and Clean Slate systems are absent. All 13 colour tokens in `styles.css:1-30` change. |
| F-02 | blocker | Typography | The UI uses a system font stack only. There is no Plus Jakarta Sans, no Inter, no self-hosted font files, no preload and no metric-adjusted fallback. |
| F-03 | high | Type scale | Sizes drift from the requested scale: h2 is 20–24px (requested 22–28), h3 is 16–18px (requested 18–20), buttons are 15px (requested 16), and there are no display, body-lg, h4, overline, price or reference tokens. |
| F-04 | high | Breakpoints | Media queries mix `min-width` and `max-width` and use off-scale values 599, 600, 767, 900 and 1023. The requested system is mobile-first `min-width` only at 480, 768, 1024, 1280 and 1536. |
| F-05 | high | Containers | One `--max: 1120px` container is used for customer and staff content. The requested split is 1200px customer / 1440px staff with 16/24/32px gutters. |
| F-06 | high | Focus | The focus ring is a green outline (`styles.css:109`); inputs replace the outline with a green glow. The requested ring is 2px `#2F6FB8` with a 2px white offset. |
| F-07 | high | Elevation | Cards use `0 1px 3px rgba(0,0,0,.06)` and `0 4px 14px rgba(0,0,0,.08)`, plus ad-hoc green/red focus glows and a `0 -2px 10px` bottom bar. The requested system has only e0–e3 with blue-black `rgba(18,38,42,…)` values. |
| F-08 | medium | Radii | Cards are 8px; ad-hoc 2px, 3px and 4px radii appear in places. The requested set is 6px controls, 10px cards, 999px chips. |
| F-09 | medium | Spacing | Uses 12/14/20/28/40/72px outside the 4px scale; section rhythm is 48px/72px instead of 48px/80px. |
| F-10 | medium | Icons | Only 11 icons exist at 1.8px stroke: Home, Search, Cart, User, Menu, Close, Cross, Check, Phone, Package, Warning. Filter, location, upload, clock, alert, info, trash, plus, minus, copy, chevron and capsule are missing, so text glyphs (`+`, `−`, `×`, `→`) are used instead. |
| F-11 | high | Medicines | On phone the filter panel renders inline below the toolbar instead of as a full-screen bottom sheet with a solid background and Apply action. It also does not trap or move focus as a sheet should. |
| F-12 | medium | Product cards | Product names are `h3` (`UI.jsx:208`), skipping h2 on the page. Placeholder thumbnails are full-width squares that dominate the card height and repeat the same letter. Requested: h4 names and a smaller tinted media area. |
| F-13 | medium | Home | Pharmacy groups switch to two columns at 900px (off-scale); the track card is capped at 720px; step/category card rhythm and the soft-green footer differ from the requested white/secondary-900 treatment. |
| F-14 | medium | Staff | Staff content inherits the 1120px container; tiles switch at 900px; info bars use green/red tints rather than the requested warning/danger semantic bars; charts use green/amber rather than primary/secondary/tertiary. |
| F-15 | medium | Tables | Tables stack below 768px correctly, but `th` elements have no `scope`, the sticky header offset is hard-coded to 64px, and zebra uses the page background rather than a dedicated zebra token. |
| F-16 | high | Accessibility | No `aria-describedby`/`aria-invalid` on field errors, no `aria-busy` on loading buttons, the `Modal` has initial focus and Escape but no focus trap (`UI.jsx:319-359`), product headings skip a level, and the tablist has no `aria-controls`/`tabpanel` relationship. |
| F-17 | high | Print | No print styles at all. Receipts, confirmation and reports would print navigation and shadows. |
| F-18 | medium | Meta/assets | `theme-color` is `#1B7F5B` (old palette); favicon is the old green cross; no Open Graph tags. No font payload yet, so CLS from the new fonts has to be prevented. |
| F-19 | medium | CSS size | `styles.css` is 58,139 bytes source / 46,210 bytes minified, above the ~40KB target for the new pass. |
| F-20 | low | Hygiene | Legacy `--grey` alias, stale palette comments, `150ms ease` instead of `ease-out`, and text glyphs for icon actions. |

## 4. Screen-by-screen

| Screen | Current state | Main gaps |
|---|---|---|
| Home | Hero band, 52px search, 2 community cards, 3 steps, 6 category tiles, 10 grouped pharmacy cards, track card, prescription note. Good content match. | Palette, fonts, section rhythm, footer colour, icon arrows, display scale. |
| Medicines | Toolbar, applied chips, 4-column grid at lg, sort, load more, empty/error states. Content complete. | Mobile filter sheet, product card hierarchy (h3/h4, thumb size), 15px controls, chips. |
| Medicine detail | Overview card, price, add to cart, availability table that stacks. | Type/colour tokens, table semantics. |
| Cart | Two-column at lg, sticky summary, phone sticky total, quantity controls. | 15px text in places, control radii/shadows, sticky bar height vs new bottom nav. |
| Checkout | Numbered cards, radio option cards, summary, consent, sticky total, inline validation. | Error linkage (`aria-describedby`), 48px inputs, option-card token styling. |
| Confirmation | Soft-green panel, check, monospace reference + Copy, stepper. | Palette/type tokens, print treatment. |
| Tracking | Vertical stepper, items, total, prescription remark/upload. | Palette/type tokens, timestamps/caption scale. |
| Account (login, register, reset, profile, orders, refills, notifications) | Narrow 400px form card, labels above fields, consistent buttons. | 420px card, h4/overline tokens, ARIA error wiring. |
| Staff dashboard | 4 tiles, alert bars, recent-orders table. | 1440 container, tile breakpoint, semantic bars, table semantics. |
| Staff lists/forms | White cards, tables that stack, status chips, forms. | Token/scale consistency, 48px controls, action links, POS layout at 768px. |
| Analytics | 3 chart components, green/amber, chart cards, captions. | Primary/secondary/tertiary chart palette, max 2 charts + 1 table per tab. |
| Admin/rider | Same shell, tables/forms, status chips. | Token consistency, containers, table semantics. |
| 404/error/offline | Custom 404, shared error state with retry. | Palette/type refresh, print/offline notice. |

## 5. Screenshot index

The 390px and 1280px pairs in `docs/screenshots/` cover: Home, Medicines, Medicine detail, Cart, Checkout, Confirmation, Track form, Tracking result, Login, Register, Account, Orders, Order detail, Refills, Notifications, staff dashboard and every staff table/form (orders, prescriptions, inventory, suppliers, purchase orders, walk-in, alerts, deliveries, zones, reports), admin users/medicines/analytics/audit/outbox/settings, rider, 404 and search.

Notable evidence:

- `home-390.png` — content order and community counts are correct; fixed bottom nav overlays the viewport as designed.
- `medicines-1280.png` — 4-column grid works, but placeholder thumbnails take roughly half of each card and product names sit at h3 size.
- `checkout-1280.png` — two-column layout and selected radio cards work; form controls are 44px and error text is not linked to fields.
- `dashboard-390.png` — tables stack cleanly without sideways scroll; alert bars use the old red/amber tints.

## 6. What must not change

- All API calls, request shapes and endpoints.
- Routes and route guards, including `/styleguide` being dev-only when added.
- Guest cart/checkout logic, localStorage key, tracking proof, prescription upload.
- `NavMenu` behaviour (portal, scroll lock, history sentinel, focus trap, Escape/route close, 1024px auto-close).
- Content limits per screen: no new sections or marketing copy.
- Test contracts and demo data.

## 7. Conclusion

The app is functionally complete and responsive, but its visual system is the previous warm-green pass, not the requested Care Teal / Clinical Blue / Fresh Mint / Clean Slate system. The redesign is therefore a token-and-component rewrite plus targeted markup fixes (mobile filter sheet, table semantics, ARIA error wiring, heading levels, print styles) — not a feature build. The plan for that work is in `docs/FRONTEND_PLAN.md`.
