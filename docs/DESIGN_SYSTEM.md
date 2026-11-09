# Design system — PharmaLink (Docta-inspired)

Date: 9 November 2026
Scope: customer, account and staff interfaces in `client/`.
Source of truth for values: `client/src/tokens.css`. No colour, radius or shadow is defined anywhere else.

The visual direction is a calm neighbourhood pharmacy with a warm, rounded, editorial feel: white space, a deep indigo voice, purple actions, soft peach bands and a small amount of blue and rose for supporting colour. It is flat and soft — no gradients, glass, blur, glow, neon, cartoon illustrations or photography-dependent layouts.

## 1. Colour tokens

### 1.1 Brand and supporting palettes

| Group | Tokens |
|---|---|
| Primary — Docta Purple | `--color-primary-50 #F4F0FA`, `100 #E6DDF3`, `200 #CDBDE6`, `300 #AE97D3`, `400 #8D72BC`, **`600 #6D4FA3`**, `700 #583F8C`, `800 #46326F` |
| Secondary — Deep Indigo | `--color-indigo-700 #2E2566`, `800 #241C57`, **`900 #1C1448`** |
| Tertiary — Soft Peach | `--color-peach-50 #FFF9F4`, `100 #FDEEE2`, `200 #FBDCC5`, `300 #F6C2A0`, `700 #9A4A17` |
| Accent — Sky Blue | `--color-sky-100 #E3EEFA`, `300 #A7C7EC`, `500 #5E92D1`, `700 #2F5E9E` |
| Accent — Rose | `--color-rose-100 #FCE8EC`, `300 #F6B8C4`, `500 #E07A92`, `700 #A63A56` |
| Neutrals — Soft Lilac Grey | `--color-white #FFFFFF`, `--color-neutral-25 #FBFAFD`, `50 #F6F4FA`, `100 #E9E4F0`, `200 #D8D1E4`, `500 #8A87A0`, `600 #5E5C78`, `800 #2E2B45`, `900 #1C1448` |
| Semantic | success `#1B7550` on `#E8F6EF`; warning `#9A4A17` on `#FEF1E6`; danger `#B3261E` on `#FDECEA`; info `#2F5E9E` on `#E3EEFA` |
| Focus | 2px solid `#6D4FA3` (`--color-focus`), 2px offset; white outline on indigo surfaces |
| Charts | series 1 purple 600, series 2 sky 500, series 3 rose 500, series 4 peach 300; grid neutral 100 |

Indigo 900 and neutral 900 are the same value; the neutral alias exists so text tokens read clearly.

### 1.2 Roles (60 / 30 / 10)

- **60% neutral:** white page and cards, neutral-25 subtle panels, neutral-100 decorative borders.
- **30% brand:** indigo-900 headings and footer, purple-600 buttons, links, active states and logo mark.
- **10% supporting:** peach-50 section bands, peach/blue/rose visual panels, semantic tints.

| Role | Token |
|---|---|
| Page background | `--color-page` (white) |
| Card / surface | `--color-surface` (white) |
| Subtle surface (account shell, sticky bars) | `--color-surface-subtle` (neutral-25) |
| Headings and main text | `--color-text` (indigo-900) |
| Body text | `--color-text-body` (neutral-800) |
| Secondary text | `--color-text-muted` (neutral-600) |
| Decorative border | `--color-border` (neutral-100) |
| Control border | `--color-control-border` (neutral-500) |
| Focus | `--color-focus` (primary-600) |

- Primary button: solid primary-600, white text, pill. Hover primary-700, pressed primary-800.
- Secondary button: white surface, 1.5px primary-600 border, primary-600 text.
- Quiet button: text only in primary-600.
- Header "Login": outlined pill on white.
- Alternate landing sections: peach-50 band. Dark band and footer: indigo-900 with white text.

### 1.3 Status and tag map

| State | Background | Text |
|---|---|---|
| Placed | info-tint | info |
| Awaiting prescription | warning-tint | warning |
| Verified | primary-100 | primary-800 |
| Ready | success-tint | success |
| Out for delivery | info-tint (sky) | info |
| Completed | success-tint | success |
| Cancelled | danger-tint | danger |
| In stock | success-tint | success |
| Low stock / near expiry | warning-tint | warning |
| Out of stock / expired | danger-tint | danger |
| "Prescription needed" tag | primary-100 | primary-800 |

### 1.4 Contrast table

WCAG 2.2 thresholds: 4.5:1 for normal text, 3:1 for large text (≥24px or ≥18.66px bold) and UI boundaries.

| Pair | Ratio | Use | Result |
|---|---:|---|---|
| indigo-900 on white | 16.89 | headings, main text | AA |
| indigo-900 on neutral-25 | 16.25 | headings on account shell | AA |
| indigo-900 on neutral-50 | 15.48 | headings on subtle panels | AA |
| indigo-900 on peach-50 | 16.18 | headings on landing bands | AA |
| neutral-800 on white | 13.57 | body text | AA |
| neutral-800 on neutral-25 | 13.05 | body on account shell | AA |
| neutral-600 on white | 6.41 | secondary text | AA |
| neutral-600 on neutral-25 | 6.16 | secondary text | AA |
| neutral-600 on neutral-50 | 5.87 | secondary text | AA |
| neutral-600 on peach-50 | 6.13 | eyebrows on peach bands | AA |
| white on primary-600 | 6.37 | primary button | AA |
| white on primary-700 | 8.38 | primary hover | AA |
| white on primary-800 | 10.79 | primary pressed | AA |
| white on indigo-900 | 16.89 | footer and dark band | AA |
| white on indigo-800 | 15.23 | dark band hover | AA |
| white at 80% over indigo-900 (#D2D0DA) | 11.08 | footer links | AA |
| primary-600 on white | 6.37 | links and purple text | AA |
| primary-700 on white | 8.38 | link hover | AA |
| primary-800 on white | 10.79 | pressed text | AA |
| primary-600 on primary-50 | 5.67 | purple text on tint | AA |
| primary-700 on primary-50 | 7.46 | hover on tint | AA |
| primary-800 on primary-100 | 8.22 | verified chip | AA |
| primary-600 on peach-50 | 6.10 | links on landing band | AA |
| primary-600 on neutral-25 | 6.12 | focus ring on account shell | AA (3:1) |
| peach-700 on white | 6.24 | peach labels | AA |
| peach-700 on peach-50 | 5.97 | eyebrows on band | AA |
| peach-700 on peach-100 | 5.50 | text on peach panel | AA |
| sky-700 on white | 6.53 | blue text | AA |
| sky-700 on sky-100 | 5.56 | info chip | AA |
| rose-700 on white | 6.25 | rose text | AA |
| rose-700 on rose-100 | 5.32 | rose chip | AA |
| success on success-tint | 5.09 | success chip | AA |
| success on white | 5.67 | success text | AA |
| warning on warning-tint | 5.63 | warning chip | AA |
| danger on danger-tint | 5.72 | danger chip | AA |
| danger on white | 6.54 | error text | AA |
| info on info-tint | 5.56 | info chip | AA |
| white on sky-700 | 6.53 | blue badge | AA |
| white on rose-700 | 6.25 | rose badge | AA |
| white on peach-700 | 6.24 | peach badge | AA |
| neutral-500 border on white | 3.47 | input/select boundary | AA (3:1) |
| neutral-200 border on white | 1.48 | decorative divider | Decorative only |
| neutral-100 border on white | 1.25 | card and table border | Decorative only |

**Recorded deviation — control borders.** The brief pairs neutral-100 card borders with a 3:1 UI-boundary requirement. Neutral-100 is 1.25:1 on white, so it cannot be the only boundary of an input. Interactive controls therefore use neutral-500 (3.47:1). Card, table and divider borders stay neutral-100 because they are decorative and the control is identified by its label, background and purple focus state. No text uses a ratio below AA.

**Note on supporting tints.** Peach-300, sky-300 and rose-300 are fill/decoration colours only. They are never used behind small text; text on supporting colour always uses the 700 shade.

## 2. Typography

### 2.1 Families

| Token | Stack |
|---|---|
| `--font-heading` | `"Sora", "Sora Fallback", "DM Sans", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif` |
| `--font-body` | `"DM Sans", "DM Sans Fallback", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif` |
| `--font-mono` | `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace` |

- Sora variable (600–700 for headings and display), DM Sans variable (400–600 for body, UI, forms, tables and buttons).
- Both are self-hosted from `client/public/fonts/` as Latin-subset `woff2` (Sora 33 KB, DM Sans 37 KB; 70 KB total).
- `font-display: swap`; the two files are preloaded in `index.html`.
- Metric-adjusted fallbacks (`Sora Fallback`, `DM Sans Fallback`) use `local("Arial")` with `size-adjust` and ascent/descent overrides derived from each font's metrics, so the swap does not shift layout.
- Order references and codes use the system monospace stack with tabular figures.

### 2.2 Scale

| Token | Used for | Family | Size | Weight | Line height |
|---|---|---|---|---|---|
| `--text-display` | Home hero heading only | Sora | `clamp(32px, 1.35rem + 3.2vw, 48px)` | 700 | 1.1 |
| `--text-h1` | Page titles | Sora | `clamp(28px, 1.5rem + 1.25vw, 36px)` | 700 | 1.15 |
| `--text-h2` | Section headings | Sora | `clamp(22px, 1.22rem + 0.75vw, 28px)` | 600 | 1.25 |
| `--text-h3` | Card and panel titles | Sora | `clamp(18px, 1.06rem + 0.3vw, 20px)` | 600 | 1.25 |
| `--text-h4` | Product and list names | DM Sans | `clamp(16px, 0.97rem + 0.15vw, 17px)` | 600 | 1.35 |
| `--text-body-lg` | Hero sentence | DM Sans | 18px | 400 | 1.6 |
| `--text-body` | Paragraphs, forms | DM Sans | 16px | 400 | 1.6 |
| `--text-body-sm` | Secondary text, eyebrows | DM Sans | 14px | 400/500 | 1.5 |
| `--text-caption` | Timestamps, hints | DM Sans | 13px | 400 | 1.4 |
| `--text-overline` | Group labels, table headers | DM Sans | 12px, uppercase, 0.04em | 600 | 1.3 |
| `--text-button` | Buttons and nav links | DM Sans | 16px | 600 | 1 |
| `--text-price` | Prices, totals | DM Sans, tabular | `clamp(18px, 1.06rem + 0.3vw, 20px)` | 600 | 1.2 |

Rules: one `h1` per page; no skipped levels; paragraphs capped at `--measure` (70ch); body text never below 16px except the caption, overline and body-sm tokens; section eyebrows are body-sm sentence case (not uppercase); uppercase only for overline labels. Tabular figures on prices, quantities, dates and table numbers (`.tnum`).

## 3. Shape, depth, motion and decoration

| Token | Value | Use |
|---|---|---|
| `--radius-pill` / `--radius-chip` | 999px | buttons, chips, count dot, avatar |
| `--radius-input` | 12px | inputs, selects, text areas |
| `--radius-card` | 16px | cards, product tiles, mini cards |
| `--radius-panel` | 24px | large visual panels, CTA band, modals |

| Token | Value | Use |
|---|---|---|
| `--elevation-1` | `0 1px 3px rgba(28,20,72,.06)` | cards and tables |
| `--elevation-2` | `0 8px 24px rgba(28,20,72,.10)` | floating mini-UI cards, desktop hover |
| `--elevation-3` | `0 16px 40px rgba(28,20,72,.14)` | modals and toasts |

No other shadow exists. The only non-elevation shadow allowed is the state glow on inputs (`0 0 0 3px` primary-100 on focus, danger-tint on error) and focus outlines.

- **Motion:** 150ms ease-out on hover, focus and press only. No scroll animations. All transitions and the skeleton animation are removed under `prefers-reduced-motion: reduce`.
- **Decoration:** large soft peach circles behind visuals, faint peach dots near section headings, dotted curved SVG connectors between the "How it works" steps on desktop, and white floating mini-UI cards that show real screens. Decorative shapes sit inside `overflow: clip` sections.
- **Not allowed:** gradients, glass or blur, `backdrop-filter`, neon, glow, emoji, stock-photo hotlinks, cartoon illustration, animated backgrounds, or marketing statistics/reviews.

## 4. Spacing and layout

- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64, 96px (`--space-1` … `--space-9`).
- Section rhythm: `--section-space` = `clamp(64px, 8vw, 96px)`.
- Container: 1200px customer, 1440px staff, 720px narrow reading measure.
- Gutters: 16px base, 24px at 768px, 32px at 1024px.
- Breakpoints: 480, 768, 1024, 1280, 1536 (min-width only). Base styles target 360px and work at 320px.
- Card padding: 16px phone, 24px at 768px.
- Tap targets ≥44×44px; inputs 48px tall with 16px text; tables stack into cards below 768px; staff sidebar appears at 1024px.
- `100dvh` and `env(safe-area-inset-*)` on the full-page menu, bottom navigation and sticky checkout bar.
