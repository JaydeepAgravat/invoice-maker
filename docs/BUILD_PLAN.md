# Invoice Maker (Android) — v1.0 Build Plan (8 phases)

## Context
Greenfield repo (only `docs/PRODUCT_SPEC.md`). Goal: a commercial, premium-quality offline invoice/estimate app for Android that earns money through a single $9.99 lifetime unlock. Top priority is Linear-grade UI/UX with attention to every detail. The spec has been extended through 12 rounds of decisions (below). Everything ships in v1.0 (about 10–12 weeks). The brand, package ID, website and support email are decided later; the app uses the codename **`invoice`** and a temporary package ID that gets renamed before the first Play upload.

## Locked decisions
| Area | Decision |
|---|---|
| Stack | Bare React Native CLI (latest stable, New Arch, Hermes, TS strict), **no Expo**. minSdk 26, target 36, 16 KB page aligned |
| UI | Custom Linear-style design system · Unistyles 3 · Reanimated 4 · Gesture Handler · @gorhom/bottom-sheet · Inter Display + Inter (tabular numbers) · Lucide icons + custom SVG illustrations · light + dark (follow system + override) |
| Motion / tone | 150–250 ms critically damped springs, shared-element list→detail, respects reduce-motion. Copy is calm and precise, with no emoji and no exclamation marks |
| Data | op-sqlite (money in integer minor units, rates in basis points, quantity in milli-units), MMKV for settings/entitlement, Zustand + repo hooks, react-hook-form + zod |
| PDF | Own Kotlin Turbo Module `HtmlToPdf` (off-screen WebView → PrintDocumentAdapter), print via PrintManager. Base64 fonts and images |
| Billing | RevenueCat, one non-consumable `pro_lifetime` at **$9.99 fixed** (Play converts per country) |
| Telemetry | Sentry crash reporting only, opt-out, no PII |
| Docs (9) | Invoice, Estimate/Quote, Receipt, Credit note, Pro-forma, Delivery note, Change order, Purchase order, Statement of account |
| Markets / i18n | UI in EN, ES, PT, FR, DE. Tax + legal-wording presets for US, UK, CA, AU, ES, MX, BR, FR, DE, PT, plus Other. No e-invoice formats. Language + currency per client |
| Templates | Classic, Minimal (free) · Modern, Bold (Pro). Letter/A4, accent color, fonts, QR |
| Free vs Pro | Free: 5 sends/month + footer, 6 doc types (Inv/Est/Rec/CN/PF/DN), 2 templates, manual backup, CSV export, overdue reminders, basic dashboard. Pro: unlimited, no footer, all templates/colors/fonts, auto Drive backup, photos, client signature, reports, expenses, mileage, CO/PO/Statement. Users' own data is never locked |
| Navigation | Linear-style inbox with saved views (All, Drafts, Unpaid, Overdue, Estimates, Paid) + left drawer (Clients, Items, Expenses, Mileage, Reports, Settings) + pinned "+ New" button + command/search palette |
| Signature UX | Swipe actions with haptic thresholds + undo · live PDF preview while editing · command palette · smart keypad (calculator, hour presets) · adjustable haptics · biometric/PIN app lock · full TalkBack + font scaling · tablet/foldable two-pane layout |
| Onboarding | 2 screens (country+language, business name), then the first invoice. Numbering format defaults from the country, with a "Change" chip on first save (prefix-0001 or year-based) |
| Other v1 | Edit-after-send with revision log · smart unit set · share: WhatsApp/Email/SMS/Print/Save · structured payment details per country + QR (Pix, SEPA EPC, links) · Drive backup (manual + weekly auto) + zip + CSV · overdue + recurring (schedule → draft → one-tap send) notifications · contacts/CSV/competitor-export import · reports (income, clients, tax, aging, profit) · expenses with receipt photo · mileage · Glance home-screen widget · contextual backup nudges · honest one-screen paywall |
| Process | Design directly in code, verified on the Android emulator (screenshots in light + dark). Strict testing. Git + private GitHub, commit per phase, GitHub Actions CI |

## Architecture
```
android/app/src/main/java/<pkg>/
  htmltopdf/   HtmlToPdfModule.kt      (toPdf, print)
  haptics/     HapticsModule.kt        (precise VibrationEffect primitives)
  widget/      Glance widget (reads a small JSON summary written by JS)
  applock/     BiometricPrompt bridge
src/
  specs/       Turbo Module codegen specs
  domain/      money, calc, tax-presets/<country>, numbering, statuses, units, statement, i18n-format  (pure TS)
  data/        db, migrations/, repositories/, search index (FTS5)
  pdf/         templates/{classic,minimal,modern,bold}, partials, i18n labels, qr, render
  backup/      zip, csv, drive, auto-backup rules, import/{csv,contacts,competitors}
  billing/     revenuecat, entitlement, free-limit
  notifications/ notifee scheduling (overdue, recurring)
  features/    inbox, editor, preview, clients, items, expenses, mileage, reports, settings, onboarding, paywall, palette, lock
  ui/          tokens, theme, primitives (Text, Button, Row, Sheet, Keypad, MoneyInput, Chip, Swipeable, EmptyState, Toast), icons, illustrations
  i18n/        en, es, pt, fr, de (ICU messages)
```

## 8 phases

### Phase 1 — Foundation and design system (~1.5 wk)
- RN CLI init (verify the latest stable RN and library versions on npm first), TS strict, ESLint/Prettier, Jest, Maestro, git + CI, release signing, Sentry.
- Design research pass (Linear, Mercury, Things, Raycast, Stripe) → token set: color (neutral scales + one accent, light and dark), type scale (Inter Display/Inter, tabular numbers), spacing on a 4 pt grid, radii, borders, elevation, motion curves, haptic map.
- Primitive component library + an in-app "Kitchen sink" screen, i18n scaffold (5 locales), app shell: drawer, inbox skeleton, "+ New" button, theme switching, predictive back.
- **Done when:** the app runs on the emulator; the kitchen sink screenshots in light and dark match the token spec; CI is green.

### Phase 2 — Domain engine and data layer (~1.5 wk)
- `money`, `calc` (per-line + document discounts, inclusive/exclusive, multi/compound tax, rounding modes), `numbering` (both formats, atomic), statuses for all 9 types, change-order math against its estimate, statement of account builder, units, tax presets + legal mentions for 10 countries + Other.
- SQLite schema (spec §7, extended: doc types, change-order links, revisions, activity log, expenses, mileage, recurring schedules, client language/currency, payment-method fields), forward-only migrations, repositories, FTS5 search, seed with 1,000 docs.
- **Done when:** 100% coverage on `domain/`; fixture totals match for every country preset; migration tests pass.

### Phase 3 — Core flows: inbox, editor, clients, items (~2 wk)
- Onboarding (2 screens), inbox with saved views, filters and swipe actions, document editor for all 9 types (line-item sheet, smart keypad, catalog autocomplete, "save to catalog" toggle, discounts, taxes, dates/terms), client/item CRUD with per-client language + currency, record payment (partials), mark sent, void, duplicate, convert estimate → invoice, change order from an accepted estimate, edit-after-send with revision log, undo toasts, autosave, command palette.
- **Done when:** the Maestro flow "onboard → client → 3-line invoice → partial payment → Partially paid" passes; estimate → change order → invoice passes; all screens reviewed in light and dark.

### Phase 4 — PDF engine, templates and sharing (~2 wk)
- `HtmlToPdf` Kotlin module, 4 templates × 9 doc types × 5 languages × Letter/A4, pagination (repeated headers, no split rows, photo appendix), structured payment block + QR (Pix, EPC, link), signature, tax-invoice title logic, footer for free tier, live preview while editing (throttled WebView), share sheet (WhatsApp/Email/SMS/Print/Save) with message templates.
- **Done when:** golden HTML snapshot tests pass for the full matrix; the 40-line invoice paginates correctly; PDF < 1 MB without photos; text is selectable; visual check of every template.

### Phase 5 — Money: expenses, mileage, reports, dashboard (~1.5 wk)
- Expense log with receipt photo, mileage log (per-country rate presets), reports (income by month/client, tax collected, aging, profit + mileage deduction) with SVG charts and CSV/PDF export, inbox header totals.
- Photos on documents (carried over on convert) and client signature capture on device.
- **Done when:** report numbers match fixture calculations; exports open correctly in Sheets/Excel.

### Phase 6 — Backup, import, notifications (~1.5 wk)
- Zip export/import (preview, merge/replace), CSV export, Android Auto Backup rules (WAL checkpoint), Google Drive appDataFolder (manual + weekly WorkManager job, keep last 5), contextual backup nudges.
- Import: phone contacts, CSV with column mapping, Invoice Simple / Zoho / Bookipi export parsers.
- Notifee: overdue reminders, recurring schedules → draft → one-tap send; POST_NOTIFICATIONS requested only when a reminder is turned on.
- **Done when:** uninstall → reinstall → restore round-trip equality (hash of all rows + files); 1,000-doc restore < 10 s; each import parser passes its fixtures.

### Phase 7 — Monetization and platform extras (~1 wk)
- RevenueCat `pro_lifetime`, entitlement cache (offline), paywall, free-limit counter (per calendar month, re-share doesn't count), gating across all Pro features, restore, refund → graceful downgrade.
- App lock (BiometricPrompt/PIN), Glance widget, tablet/foldable two-pane layouts, haptics settings.
- **Done when:** purchase → offline restart keeps Pro; reinstall auto-restores; a refund removes Pro with no data loss; paywall only appears on the 6th share or a Pro tap.

### Phase 8 — Polish, localization QA and launch (~1.5 wk)
- Full translation pass (ES/PT/FR/DE) + pseudo-locale overflow test, TalkBack audit, contrast, 48 dp targets, font scale up to 200%, empty-state illustrations, performance (cold start < 1.5 s, 60/120 fps lists), 16 KB alignment check, Data Safety answers, store listing copy in 5 languages, screenshots, final brand name + package ID rename, internal → closed → production.
- **Done when:** zero crashes in closed testing; the Maestro suite passes in all 5 locales; the pre-launch report is clean.

## Verification (every phase)
- `npm test` (Jest, domain coverage gate), `npx tsc --noEmit`, lint.
- Maestro E2E on the Android emulator; I take screenshots in light + dark and review them before handing over.
- `./gradlew assembleRelease` in CI.
- Commit at the end of each phase; you push to the private GitHub repo.

## Needed from you later (not blocking coding)
Brand name → package ID · Google Cloud project for Drive OAuth · RevenueCat account + Play product `pro_lifetime` · Sentry DSN · support email · privacy/terms page (before Play submission).
