# Project status

_Last updated: 26 September 2026_

**Summary:** all 8 build phases are finished. The app works end to end on the
emulator in all 5 languages. What remains are accounts and keys only you can
create. After that comes one round of end-to-end verification, then the
Play upload.

## Phases

| Phase | Scope | Commit | Status |
|---|---|---|---|
| 1 | Foundation, design system, app shell | `9faff80`, `19dc424` | Done |
| 2 | Domain engine, SQLite data layer, seed data | `858e8b8`, `055b0ba` | Done |
| 3 | Onboarding, inbox, editor, clients, items, command palette | `f9f171f` | Done |
| 4 | PDF engine, 4 templates, live preview, sharing | `6eab404` | Done |
| 5 | Expenses, mileage, reports, photos, signatures | `2abdf9e` | Done |
| 6 | Backup/restore, Drive, import, reminders, recurring invoices | `1e2a2f6` | Done (Drive needs your Cloud project) |
| 7 | Pro purchase, paywall, app lock, widget, tablet layouts | `c9365f7` | Done (purchase needs RevenueCat) |
| 8 | Polish, localization QA, release build, launch docs | `081ee31` | Done |

## Quality checks (as of Phase 8)

| Check | Result |
|---|---|
| Unit tests (Jest) | 381 passed |
| Typecheck, lint | Clean |
| End-to-end flows (Maestro, 7 flows) | 7/7 passed, including all 5 languages |
| Release build smoke test | Onboarding → invoice → payment, and PDF preview/save pass |
| Text contrast | All text tokens meet WCAG AA (guarded by a test) |
| Translations (ES, PT, FR, DE) | Complete; placeholders checked by tests |
| Cold start to inbox (emulator, release) | ~0.6 s (target < 1.5 s) |
| Size | JS bundle 5.7 MB; estimated Play download ~14 MB (arm64) |
| 16 KB page alignment | All 26 native libraries aligned |

## Waiting on you

Step-by-step instructions: [launch/SETUP_CHECKLIST.md](launch/SETUP_CHECKLIST.md).

| # | Item | Status |
|---|---|---|
| 1 | Brand name + package ID (can't change after first Play upload) | Pending |
| 2 | Upload keystore (keep private, do not send) | Pending |
| 3 | Google Cloud project: Drive API + Android OAuth client | Pending |
| 4 | Play Console app + in-app product `pro_lifetime` ($9.99) | Pending |
| 5 | RevenueCat public SDK key (`goog_…`) | Pending |
| 6 | Sentry DSN | Pending |
| 7 | Support email | Pending |
| 8 | Privacy policy + terms hosted at public URLs | Pending (texts ready in [launch/](launch)) |

Until these arrive the app runs with safe placeholders:
- Pro can be unlocked from Settings → Developer, in debug builds only.
- Crash reporting stays off.
- The About section in Settings stays hidden.
- The launcher icon is a neutral placeholder.

## Verification once the items arrive

- [ ] `scripts/rename.sh <package.id> "<Brand>"`, then clean build
- [ ] Drive: back up → uninstall → reinstall → restore, plus the weekly automatic backup
- [ ] Purchase: test purchase → force stop → airplane mode → reopen keeps Pro
- [ ] Reinstall restores Pro
- [ ] Refund removes Pro with no data lost
- [ ] Sentry receives a test crash; source maps upload in release builds
- [ ] Signed `bundleRelease` uploaded to internal testing; pre-launch report clean
- [ ] Full Maestro suite + release smoke test re-run

## Manual checks on a real phone

These change phone-wide settings, so they were not done on the emulator.

- [ ] Font size and display size at maximum (200%)
- [ ] TalkBack: create and send an invoice without looking
- [ ] App lock with a real screen lock
- [ ] Printing to a real printer

## Launch documents

- [launch/SETUP_CHECKLIST.md](launch/SETUP_CHECKLIST.md): accounts and keys, step by step
- [launch/store-listing.md](launch/store-listing.md): title, descriptions and screenshot captions in 5 languages
- [launch/privacy-policy.md](launch/privacy-policy.md), [launch/terms.md](launch/terms.md): fill in the `{placeholders}`, then host
- [launch/data-safety.md](launch/data-safety.md): Play Console Data safety answers

## Known limits (by design, v1)

- No card payment processing, web version, multi-device sync or e-invoice formats (XRechnung, ZUGFeRD, CFDI, NF-e).
- Some mileage rate presets are marked "verify" in `src/domain/mileage.ts`. Check the current official rates before launch.
