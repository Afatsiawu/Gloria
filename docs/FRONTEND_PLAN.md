# Frontend plan — PharmaLink client (Docta-inspired restyle)

Date: 9 November 2026
Status: **Step 1 complete; Steps 2–9 pending.**
Design reference: `docs/reference/landing-reference.png` (layout and colour guide only — its wording, claims, prices, ratings, app-store badges and photography are not used).
Companion documents: `docs/DESIGN_SYSTEM.md` (tokens, contrast), `docs/ASSUMPTIONS.md` (decisions), `docs/FRONTEND_AUDIT.md` (pre-restyle inventory).

## Working agreement

- Presentation only: CSS, markup structure and small presentational React components. Backend, API calls, routes, guards, contexts, business logic, the guest checkout flow and the full-page mobile menu behaviour stay as they are.
- The one route addition is the dev-only `/styleguide` required by Step 2, guarded by `import.meta.env.DEV` and absent from production builds.
- Content is unchanged: the same Home intro, search, community cards, three steps, six categories, ten pharmacies, prescription note and tracking form. No invented statistics, reviews, testimonials or claims.
- After each step: run the app, check 320, 360, 390, 414, 768, 1024, 1280, 1440 and 1920px, tick the step here, commit `frontend: step N - name`.
- No new libraries except the required `@fontsource-variable` fonts. No gradients, glass, blur, glow, neon, emojis, stock-photo hotlinks, cartoon illustrations, animated backgrounds or marketing buzzwords.

## 1. Colour system

Defined once in `client/src/tokens.css`; legacy aliases are remapped so existing selectors adopt the new palette while screens are rebuilt step by step.

| Group | Tokens |
|---|---|
| Primary — Docta Purple | `--color-primary-50 #F4F0FA`, `100 #E6DDF3`, `200 #CDBDE6`, `300 #AE97D3`, `400 #8D72BC`, **`600 #6D4FA3`**, `700 #583F8C`, `800 #46326F` |
| Secondary — Deep Indigo | `--color-indigo-700 #2E2566`, `800 #241C57`, **`900 #1C1448`** |
| Tertiary — Soft Peach | `--color-peach-50 #FFF9F4`, `100 #FDEEE2`, `200 #FBDCC5`, `300 #F6C2A0`, `700 #9A4A17` |
| Sky Blue accent | `100 #E3EEFA`, `300 #A7C7EC`, `500 #5E92D1`, `700 #2F5E9E` |
| Rose accent | `100 #FCE8EC`, `300 #F6B8C4`, `500 #E07A92`, `700 #A63A56` |
| Neutrals — Soft Lilac Grey | `0 #FFFFFF`, `25 #FBFAFD`, `50 #F6F4FA`, `100 #E9E4F0`, `200 #D8D1E4`, `500 #8A87A0`, `600 #5E5C78`, `800 #2E2B45`, `900 #1C1448` |
| Semantic | success `#1B7550` on `#E8F6EF`; warning `#9A4A17` on `#FEF1E6`; danger `#B3261E` on `#FDECEA`; info `#2F5E9E` on `#E3EEFA`; focus `#6D4FA3` |
| Charts | purple 600 → sky 500 → rose 500 → peach 300; neutral-100 grid |

Roles: white page and cards, indigo-900 headings, neutral-800 body, neutral-600 secondary; purple-600 actions and links; peach-50 alternate landing bands; indigo-900 footer. 60 / 30 / 10 (neutral / brand / supporting). Full contrast table: `docs/DESIGN_SYSTEM.md` §1.4.

## 2. Typography

- **Sora** variable 600–700 for display and headings; **DM Sans** variable 400–600 for body, UI, forms, tables and buttons; system monospace for references.
- Self-hosted Latin `woff2` in `client/public/fonts/` (33 KB + 37 KB = 70 KB), preloaded, `font-display: swap`, metric-adjusted `Arial` fallbacks.
- Display 32–48px (Home only), h1 28–36, h2 22–28, h3 18–20, h4 16–17, body-lg 18, body 16, body-sm 14, caption 13, overline 12, button 16, price 18–20 tabular. One h1 per page, no skipped levels, paragraphs max 70ch.

## 3. Shape, depth, decoration

- Pill buttons and chips (999px), 12px inputs, 16px cards, 24px visual panels.
- e1 cards, e2 floating mini cards and desktop hover, e3 modals and toasts — no other shadows.
- Soft peach circles, faint peach dots, dotted curved SVG connectors between steps on desktop, white floating mini-UI cards showing real screens. Decoration clipped inside sections.
- 150ms ease-out on hover/focus/press only; reduced motion removes transitions.

## 4. Home structure (content unchanged)

1. Header: logo left, centred nav (Medicines, Pharmacies, How it works, Track order), cart with purple dot, outlined Login/Account pill. Phone: logo, cart, menu; search on its own row.
2. Hero: display heading, intro sentence, 56px search with attached purple button, two community cards; peach circle with phone mock of the Medicines screen and one or two mini cards.
3. Browse by category: visual left, six category rows right with round tinted icon circles, names and counts.
4. How it works: peach-50 band, centred heading, three alternating steps with 24px visual panels and mini cards, dotted connectors on desktop.
5. Our pharmacies: two groups (Doryumu 6, Kordibe 4), white cards with name, tap-to-call, "See medicines".
6. Prescription note: peach circle with check-shield/capsule outline, sentence, outlined "Browse medicines".
7. Track your order: rounded band with soft circles, two-field form and tracking phone mock.
8. Footer: indigo-900, logo, pharmacist note, contact number, Shop/Help/Account columns, divider and copyright.

Page rhythm 64–96px, container 1200px, gutters 16/24/32px.

## 5. Steps and checklist

### Step 1 — Tokens and fonts (complete)
- [x] `@fontsource-variable/sora` and `@fontsource-variable/dm-sans` installed; Latin `woff2` copied to `client/public/fonts/` (70 KB).
- [x] `tokens.css` rewritten with the full palette, type scale, spacing, radii, elevation, containers, font stacks and remapped legacy aliases.
- [x] `base.css` holds the font faces, metric fallbacks, reset, heading/body/link/focus rules, utilities and reduced motion.
- [x] Old `:root`/base block removed from `styles.css`; input borders use neutral-500, 48px height, purple focus glow; gutters 16/24/32.
- [x] `index.html`: theme-color `#6D4FA3`, font preloads.
- [x] `docs/DESIGN_SYSTEM.md` written with tokens, roles, status map and the WCAG contrast table.
- [x] Verified 320–1920px: overflow 0 at every width, both fonts loaded, body white, headings indigo.

### Step 2 — Shared components and styleguide (complete)
- [x] Buttons are pills with primary, secondary, quiet, danger, disabled and small states; inputs/selects are 48px with purple focus glow; RadioCard, Checkbox, Card, StatusChip, Tag, Alert, Toast, Stepper, Pagination, DataTable, Skeleton, EmptyState and PageTitle restyled.
- [x] New `PhoneMock` (medicines and tracking screens), `MiniCard` and `VisualFrame` (peach/blue/rose circle or 24px panel, optional image) in `components/LandingVisuals.jsx`.
- [x] Dev-only `/styleguide` shows every component, state and the three visuals; guarded with `import.meta.env.DEV` and absent from the production build.
- [x] Status map updated: placed = info, verified = primary tint, out-for-delivery = blue; badge/chip info and primary variants added.
- [x] All targets ≥44px, inputs 48px; overflow 0 at 320–1920px.

### Step 3 — Layout shells (complete)
- [x] Customer header (centred nav, outlined Login pill, cart dot, own-row search on phone), indigo footer with three columns, phone bottom nav, staff layout.
- [x] Restyle the full-page mobile menu only; behaviour unchanged. Close button 44px.
- [x] Safe areas and `100dvh`; no overlap between header, bottom nav and sticky bars.

### Step 4 — Home sections 1–3 (complete)
- [x] Hero with phone mock, mini cards and community cards.
- [x] Category rows with tinted icon circles and counts.
- [x] Peach "How it works" band, zigzag steps, desktop dotted connectors, stacked visual-first on phone/tablet.

### Step 5 — Home sections 4–6, footer, image slots (complete)
- [x] Pharmacies grid 3/2/1, prescription section, rounded tracking band.
- [x] `client/src/config/landingImages.js` (all null), `VisualFrame` image support, README sizing/licensing notes.
- [x] Footer complete; phone columns 1–2; no social icons.

### Step 6 — Customer pages
- [ ] Medicines, medicine detail, cart, checkout, confirmation, tracking and account pages in white/purple with 16px cards and neutral-100 borders.
- [ ] Confirmation panel primary-50/peach-50 with success check; placeholders peach-100 with purple first letter; account card 420px on neutral-25.
- [ ] Guest checkout unchanged and working at 320px.

### Step 7 — Staff area
- [ ] White sidebar with right border, primary-50 active link and 3px purple left bar, overline group labels.
- [ ] Summary tiles (max 4), sticky table heads, light hover, status chips, new chart palette.
- [ ] Walk-in sales and rider list restyled; tables usable at 360px without sideways scroll.

### Step 8 — States and details
- [ ] Loading, empty and error states; toasts; 404; focus details; print styles for receipts and reports.
- [ ] Purple capsule/cross favicon and theme-color; `aria-describedby`/`aria-invalid` on field errors; table `scope`.
- [ ] No raw error text; destructive actions confirm.

### Step 9 — QA and screenshots
- [ ] Responsive pass at all nine widths, portrait/landscape, 200% zoom; no horizontal scroll; targets ≥44px.
- [ ] Axe/Lighthouse accessibility fixes; contrast re-check; search for old teal/blue/mint values and unused CSS.
- [ ] Client/server tests and the guest checkout walkthrough pass.
- [ ] Screenshots of Home, Medicines, Checkout, Tracking and a staff page at 390px and 1280px in `docs/screenshots/`.

## 6. Verification

| Check | Result |
|---|---|
| Fonts | Sora and DM Sans load from `public/fonts`; payload 70 KB |
| Overflow at 320/360/390/414/768/1024/1280/1440/1920 | 0px at every width |
| Body background / heading colour | white / `rgb(28,20,72)` (indigo-900) |
| Old palette in `styles.css` | no old hex values remain; only the purple remap |
| Header nav centre (≥1024px) | 512/512, 640/640, 720/720 and 960/960 at 1024/1280/1440/1920 |
| Footer | indigo-900 background, three columns from 768px, two at phone widths |
| Mobile menu (390px) | dialog, scroll lock on/off, 44×44 close, focus inside, history sentinel, closes on route and Escape |
| Staff shell | sidebar 264px from 1024px, active primary-50 with 3px purple bar; topbar 64px |
| Home hero | search pill 56px (44px input/button), purple focus ring, two columns from 1024px, mini cards inside the viewport at 320–1920px |
| Home categories | six 64px+ rows; orbit visible only from 1024px in a 440px column |
| How it works | peach-50 band; 260px panels on phone, 300px from 1024px; zigzag and dashed connectors only from 1024px |
| Home pharmacies | 10 white cards in 1/2/3 columns at 320/640/1024px; community overline on each card |
| Prescription and tracking | peach circle 220/260px; tracking band primary-50, 24px radius, one column then form + phone at 1024px |

## 7. Risks

| Risk | Mitigation |
|---|---|
| Legacy selectors still reference old aliases | Aliases point to new tokens; each screen is rebuilt in Steps 3–7 and aliases removed as usage reaches zero |
| Old teal/blue/mint hex survives in JS or SVG | Final `grep` for every old hex in Step 9 |
| Home restructure changes content | Copy is lifted verbatim from the existing `HomePage`; no new claims |
| Menu behaviour changes | Only CSS tokens/typography touched; behaviour re-tested in Step 3 |
| Font swap shifts layout | Metric-adjusted fallbacks, preload, `font-display: swap` |
| Decorative circles cause sideways scroll | Sections use `overflow: clip`; measured at every width |
| Styleguide leaks to production | `import.meta.env.DEV` guard; inspect `dist` after build |
