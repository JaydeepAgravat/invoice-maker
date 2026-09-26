# Launch setup checklist

Everything in the app is built. These are the pieces only you can create,
because they need your accounts. Do them roughly in this order: the package
ID is used by almost every later step and **cannot change after the first
Play upload**.

When each item is done, send me the value in the "Send me" column and I will
plug it in and verify it end to end.

| # | Item | Send me | Where it goes |
|---|------|---------|---------------|
| 1 | Brand name + package ID | e.g. `Ledgerly`, `com.ledgerly.invoice` | `scripts/rename.sh` |
| 2 | Upload key (keystore) | nothing (keep it private) | `~/.gradle/gradle.properties` |
| 3 | Google Cloud project for Drive | "done" + the Cloud project ID | nothing in code (see below) |
| 4 | Play Console app + `pro_lifetime` product | "done" | Play Console |
| 5 | RevenueCat project | public Android SDK key (`goog_…`) | `src/config.ts` → `REVENUECAT_ANDROID_KEY` |
| 6 | Sentry project | DSN (`https://…@….ingest.sentry.io/…`) | `src/config.ts` → `SENTRY_DSN` |
| 7 | Support email | address | `src/config.ts` → `SUPPORT_EMAIL` |
| 8 | Privacy policy + terms URLs | two URLs | `src/config.ts` → `PRIVACY_URL`, `TERMS_URL` |

---

## 1. Brand name and package ID

Pick the name and a package ID you own the domain for (reverse-DNS,
lowercase), for example `com.yourbrand.invoice`. Then:

```bash
scripts/rename.sh com.yourbrand.invoice "Your Brand"
```

The script moves the Kotlin package, updates `applicationId`, the launcher
name, `APP_NAME`, Maestro flows and the README. Review with `git diff`.

The app icon is a neutral placeholder (a document mark on the accent colour).
Once there is a logo, replace the three files in
`android/app/src/main/res/drawable/ic_launcher_*.xml` (foreground, background,
monochrome; 108×108 dp canvas, keep the mark inside the centre 66 dp).
The accent colour lives in one place: `src/ui/tokens/colors.ts`.

## 2. Upload key

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore invoice-upload.keystore \
  -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

Store the keystore somewhere safe (a password manager, not the repo) and add
to `~/.gradle/gradle.properties`:

```
INVOICE_UPLOAD_STORE_FILE=/absolute/path/invoice-upload.keystore
INVOICE_UPLOAD_STORE_PASSWORD=…
INVOICE_UPLOAD_KEY_ALIAS=upload
INVOICE_UPLOAD_KEY_PASSWORD=…
```

Release builds pick it up automatically. Enrol in **Play App Signing** when
creating the app (default); Google then holds the real signing key.

## 3. Google Drive backup (Google Cloud)

The app uses the hidden per-app Drive folder (`drive.appdata` scope). Users
see only "See, create and delete its own configuration data in your Google
Drive". No server, no client secret.

1. <https://console.cloud.google.com> → create a project (e.g. "Invoice app").
2. **APIs & Services → Library → Google Drive API → Enable.**
3. **OAuth consent screen** → External → app name, support email, logo
   (optional), privacy policy URL. Scopes: add
   `https://www.googleapis.com/auth/drive.appdata`. It is a
   non-sensitive scope, so no Google verification review is needed.
   Publish the consent screen ("In production").
4. **Credentials → Create credentials → OAuth client ID → Android**, twice:
   - Package name: your package ID. SHA-1: the **upload key** SHA-1
     (`keytool -list -v -keystore invoice-upload.keystore -alias upload`).
   - Package name: same. SHA-1: the **Play App Signing** key SHA-1 (Play
     Console → Test and release → App integrity → App signing).
   - Optional third one for local debug builds: SHA-1 of
     `android/app/debug.keystore` (`keytool -list -v -keystore android/app/debug.keystore -storepass android`).
5. Nothing to paste into the app: Android matches the package + signature.

I will then verify: back up → uninstall → reinstall → restore from Drive,
and the weekly automatic backup.

## 4. Play Console

1. Create the app (default language English (United States), App, Free).
2. **Monetize → Products → In-app products → Create product**
   - Product ID: `pro_lifetime` (must match exactly)
   - Name: "Pro" · Description: "Unlimited sending, all templates, reports, expenses, mileage and automatic backup. One payment."
   - Price: USD 9.99, then "Update exchange rates" so Play sets local prices.
   - Activate.
   Play only allows products once an APK/AAB with the Billing permission has
   been uploaded to a track: upload the first internal-testing build first
   (`cd android && ./gradlew bundleRelease`).
3. **License testing** (Settings → License testing): add your Google
   account so test purchases are free.
4. Fill in the store listing, content rating, target audience (18+ is
   simplest; this is a business tool), data safety and ads ("No ads") using
   the files in this folder.

## 5. RevenueCat

1. <https://app.revenuecat.com> → new project → add a **Google Play** app with
   your package ID.
2. Connect Play: follow RevenueCat's "Google Play service credentials" guide
   (a service account with access in Play Console). Takes up to 36 h to
   become active.
3. **Product catalog → Products → import** `pro_lifetime`.
4. **Entitlements → New** with identifier `pro` → attach `pro_lifetime`.
5. **Offerings**: the default offering with one package containing
   `pro_lifetime` (the app falls back to the product directly if missing).
6. Send me the **public Android SDK key** (starts with `goog_`). It is safe to
   ship in the app.

I will then verify: test purchase → force-stop → airplane mode → reopen
(Pro kept), restore on a fresh install, and refund → Pro removed with no data
lost.

## 6. Sentry (crash reports)

1. <https://sentry.io> → new project → platform **React Native**.
2. Settings → **Security & Privacy**: turn on "Data scrubber" and "Use
   default scrubbers"; turn off "Store native crash reports" only if you want
   to stay in the free tier's limits.
3. Send me the **DSN**.
4. For readable stack traces in release builds, create an **auth token**
   (Settings → Auth tokens, scope `project:releases`) and keep it for CI; I
   will add source-map upload to the release build.

Crash reports are off in debug builds, off while the DSN is empty, and users
can turn them off in Settings → Privacy and security.

## 7–8. Support email, privacy policy and terms

- A support address you will actually answer (reviews mention support a lot).
- Host `privacy-policy.md` and `terms.md` from this folder (fill in the
  `{…}` placeholders) at stable URLs, e.g. a simple GitHub Pages or Notion
  page. Play requires the privacy policy URL in the listing and on the OAuth
  consent screen.

## Things to check yourself on a real phone

These change phone-wide settings, so I did not do them on the emulator:

- **Font size 200%** (Settings → Display → Font size, and Display size to
  largest): walk through inbox, editor, line sheet, share sheet, paywall.
- **TalkBack** on: create an invoice and send it without looking.
- **A phone with a screen lock**: turn on App lock, background the app,
  come back.
- **Printing** to a real printer or "Save as PDF" from the print dialog.
