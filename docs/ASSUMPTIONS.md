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

## Guest checkout and frontend redesign decisions

1. **Guest cart storage**: guests keep a cart in `localStorage` (`pharmalink_guest_cart_v1`). On a later sign-in the cart is merged into the server cart one item at a time; items that cannot be merged stay in the guest cart. No backend cart endpoint was added for guests.
2. **One pharmacy per cart**: adding an item from a different pharmacy opens a plain confirmation ("Start a new cart?"). The same rule applies to guest and account carts.
3. **"See medicines" on Home** links to the catalogue filtered by the pharmacy's community. The public medicine search has no pharmacy-id filter and adding one was outside the allowed backend changes, so the community filter is the closest equivalent.
4. **Price sorting** on Medicines is done in the client over the first 100 results (the demo catalogue has 66 medicines). Search, category, community and stock filters remain server-side.
5. **Guest order proof**: a guest proves ownership of an order with the pair reference + phone. Tracking and prescription upload return the same generic error for "not found" and "phone mismatch"; both routes are rate-limited and audited.
6. **Guest prescriptions**: files are stored outside the web root and are never publicly accessible. A guest can only upload through the verified reference + phone flow and can see status and pharmacist remarks through tracking; the guest cannot open a stored file. Pharmacists of the order's pharmacy can view it, as before (NFR16).
7. **Prescription optional at checkout**: a guest can place an order that needs a prescription without attaching a file. The order is held as "Awaiting prescription" and the file can be uploaded later from the confirmation/track page.
8. **SMS-code linking of past guest orders** is not implemented in the UI; guest history remains accessible through reference + phone tracking. A customer can create an optional account at any time.
9. **Track page rate limiting**: 10 lookups per 10 minutes per IP; placing guest orders is limited to 12 per 10 minutes per IP. During automated visual checks these limits can be hit, which is expected behaviour.
10. **Routing**: `/orders/:reference` with a numeric segment is the signed-in order page; a non-numeric reference (for example `PH-20261107-UR3F`) opens the public tracking result after re-checking reference + phone.
11. **No new frontend libraries**: plain CSS, inline SVG line icons and the two self-hosted variable fonts required by the Docta restyle (`@fontsource-variable/sora`, `@fontsource-variable/dm-sans`). No component or animation library. Images use the existing medicine image path when present and a peach first-letter placeholder otherwise.

## Visual design pass decisions

> Historical record of the warm-green pass. It is superseded by the Docta-inspired restyle decisions below, which now set the colours and type system.

1. **Palette**: the stylesheet uses only the agreed tokens — green `#1B7F5B` (action), dark green `#14614A` (hover/pressed), soft green `#E8F4EE`, warm page `#FAF8F4`, white surfaces, text `#1F2933`, secondary `#5B6770`, border `#E4E0D8`, amber `#B45309` on `#FEF3E2`, danger `#B3261E` on `#FDECEA`. Green communicates action, amber attention and red problems.
2. **Full-width Home bands**: alternating white and warm sections are produced inside the existing `.wrap` using a large `box-shadow` spread plus `clip-path: inset(0 -100vmax)`. This gives full-bleed background bands without adding wrapper elements or causing horizontal scroll.
3. **Privacy link**: the footer "Privacy" control opens a small modal containing the short privacy notice. A new `/privacy` route was not added because the brief froze routes.
4. **Mobile menu**: `NavMenu` and its behaviour (portal, scroll lock, focus trap, Escape/route close) are unchanged. Only its typography, spacing and colours were restyled.
5. **Offline/error state**: there is no dedicated offline route. Network and fetch failures use the shared `ErrorState` panel, which follows the same empty-state styling and offers one retry action; the custom 404 page offers a single "Go home" button.
6. **Chart colour**: the main revenue chart and bar chart use green; the secondary payment-method breakdown uses amber. All charts sit in a white rounded card with a caption beneath.
7. **Loading buttons**: submitting buttons are disabled while the request runs and show the agreed "Please wait…" label. Result counts and non-button loading text keep descriptive copy.
8. **Reduced motion**: a `prefers-reduced-motion` rule removes transitions, transforms and skeleton animation for users who request it.

### Verification of the visual pass

- **Responsive check**: Home, Medicines, medicine detail, Cart, Checkout, Confirmation, Track order, account screens and the staff dashboard were opened at 320, 360, 390, 414, 768, 1024, 1280 and 1440 px. `document.documentElement.scrollWidth` never exceeded the viewport (negative deltas are the scrollbar width), so there is no horizontal scroll at any of these widths.
- **Tap targets and inputs**: a scripted audit flagged three small controls — the product-name link, the confirmation "Create an account" link and the sort `<select>`. All three were enlarged (44 px minimum and 16 px input text) and re-checked. The remaining flags are the native 20×20 radios and checkboxes, which sit inside full-size `.option-card` / `.checkbox.consent` labels and are not real targets.
- **Mobile menu**: at 390 px the menu was opened and closed programmatically. The panel is `position: fixed`, `inset: 0`, `role="dialog"`, `aria-modal="true"`, body scroll is locked while open, focus moves to "Close menu", and Escape returns focus to "Open menu" and unlocks scrolling. Behaviour is unchanged from before the visual pass.
- **Guest checkout**: the flow was exercised end-to-end twice from the guest cart through checkout to the confirmation page, most recently producing order `PH-20261108-NDA4`. The tracking page was also checked against a seeded reference + phone pair.
- **Screenshots**: Home, Medicines, Cart, Checkout, Confirmation, Track order and the staff dashboard were captured at 390 px and 1280 px and saved in `docs/screenshots/`; tracking and the order-result page are included as `tracking-*.png`.
- **Forbidden effects**: the stylesheet has no gradients, blur, `backdrop-filter`, neon colours, web fonts or bitmap artwork. The only animation is the slow skeleton shimmer, which the reduced-motion rule disables.
- **Build and tests**: the production build succeeds, client tests pass 21/21 and server tests pass 114/114. The minified stylesheet is about 46 KB (8.3 KB gzipped). This is slightly above the "about 40 KB" target but contains no fonts or images, so it was accepted rather than shrinking further for its own sake.


## Docta-inspired restyle decisions

1. **Palette replaces, not supplements, the old one.** Every teal, blue and mint value is remapped through the tokens in `client/src/tokens.css`; legacy variable names (`--accent`, `--bg`, `--line`, etc.) are aliases to the new purple/indigo/peach/neutral tokens while each screen is rebuilt. The aliases are deleted once no selector uses them. No hex value outside `tokens.css` is intended by the end of Step 9.
2. **Fonts are the only new dependencies.** The brief explicitly requires Sora and DM Sans. Only the Latin variable `woff2` files are shipped (Sora 33 KB, DM Sans 37 KB; 70 KB total), self-hosted in `client/public/fonts/`, preloaded, with `font-display: swap`. Sora and DM Sans are copied from `@fontsource-variable` packages, not a CDN.
3. **Metric-adjusted fallbacks sit between the brand font and the system stack.** The brief lists `"Sora", "DM Sans", system-ui, …` and separately requires metric-adjusted fallbacks. The resolved stacks are `"Sora", "Sora Fallback", "DM Sans", system-ui, …` and `"DM Sans", "DM Sans Fallback", system-ui, …`, where each fallback is `local("Arial")` with `size-adjust` (133.7% Sora, 122.3% DM Sans) and ascent/descent overrides calculated from the font metrics. This keeps the requested families and order while preventing layout shift during the swap.
4. **Control borders use neutral-500, not neutral-100.** Neutral-100 is 1.25:1 on white and cannot be the only boundary of an input under the 3:1 UI rule. Inputs, selects and text areas use neutral-500 (3.47:1). Cards, tables and dividers keep neutral-100 because they are decorative. Text pairs all meet AA; the contrast table is in `docs/DESIGN_SYSTEM.md`.
5. **Page background is white.** The previous warm cream page is gone. White is the page and card colour; neutral-25 is reserved for quiet account surfaces and subtle panels; peach-50 marks alternate landing bands. This keeps the Home page visually distinct from the Medicines catalogue.
6. **No photos and no invented proof.** Home visuals are built from the product's own UI: a CSS phone frame containing real seeded medicine data, white mini cards and peach/blue/rose panels. `client/src/config/landingImages.js` exposes eight optional slots, all `null` by default. README explains sizes, WebP/60 KB guidance, meaningful `alt` text and the rule that only images the project owns or is licensed to use may be added. No statistics, ratings, reviews or testimonials are introduced.
7. **Home content is unchanged.** The existing intro, search, community counts, three step texts, six categories, ten pharmacies, prescription sentence and tracking form are rearranged into the reference's rhythm; no copy is rewritten into marketing claims.
8. **Privacy stays a modal.** No `/privacy` route is added. The footer "Privacy notice" link opens the existing modal.
9. **The styleguide is the only route exception.** `/styleguide` is a development tool guarded by `import.meta.env.DEV`; it must not appear in a production build.
10. **Full-page mobile menu behaviour is frozen.** Only its colours, type and spacing change; portal, scroll lock, focus trap, history sentinel and breakpoints are untouched.
11. **Header search placement.** On phones the customer header keeps logo, cart and menu on one row and the medicine search on its own row. On desktop the header search is hidden on Home and Medicines because those pages already own a prominent search field; other customer pages keep it. This preserves the existing search entry point without duplicating it.
12. **Charts use the new palette in order**: purple-600 main series, sky-500 secondary, rose-500 tertiary, peach-300 fourth; neutral-100 grid lines. Legends always label the series, so colour is not the only cue.
13. **Favicon and browser chrome.** The favicon becomes a purple capsule/cross mark and `theme-color` is `#6D4FA3`, matching the primary action colour.

### Verification of Step 1

- Sora and DM Sans report `loaded` in `document.fonts.status`; computed styles show Sora on `h1` and DM Sans on `body`.
- `document.documentElement.scrollWidth` equals the viewport at 320, 360, 390, 414, 768, 1024, 1280, 1440 and 1920px (overflow 0).
- Body background is `rgb(255,255,255)`; `h1` colour is `rgb(28,20,72)` (indigo-900).
- Font payload 70 KB (Sora 33 KB + DM Sans 37 KB), under the 80 KB target.
- No old teal/blue/mint hex remains in `styles.css`; the two ad-hoc input focus glows were replaced with primary-100 and danger-tint tokens.

## Deviations from the original specification

1. **bcryptjs** used instead of native `bcrypt` to avoid native compilation issues in the delivery environment.
2. **`order_events`** table added as an explicit migration (timeline) beyond the original core list.
3. **Password reset / data subject request** endpoints added to satisfy security & compliance requirements.

## Open items

- Real payment/SMS/email provider credentials (documented in `.env.example`).
- TLS termination details for production deployment.
