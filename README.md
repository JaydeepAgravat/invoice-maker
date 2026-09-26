# Invoice Maker (codename)

Offline invoice, estimate and receipt maker for Android. Bare React Native (no Expo), New Architecture.

- Product spec: [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md)
- Build plan and locked decisions: [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md)

## Setup

Requirements: Node 22+, JDK 17, Android SDK (API 36) with NDK 27.1.

```bash
npm install
echo "sdk.dir=$HOME/Library/Android/sdk" > android/local.properties
npm start
npm run android
```

On Android 17 (API 37) devices, debug builds need local-network access to reach Metro.
Grant it once after installing instead of tapping through the prompt:

```bash
adb shell pm grant com.invoiceapp.dev android.permission.ACCESS_LOCAL_NETWORK
```

Release builds never include this permission.

## Checks

```bash
npm run typecheck
npm run lint
npm test
```

## Structure

```
src/
  app/        navigation, root providers, drawer
  features/   one folder per product area (inbox, documents, settings, ...)
  ui/         design system: tokens, theme, primitives, illustrations, toast
  i18n/       en, es, pt, fr, de
  lib/        small pure utilities
  specs/      Turbo Module codegen specs (native code in android/app/src/main/java)
```

Design rules live in `src/ui/tokens`. Components read semantic tokens only, never raw colors.

## Release signing

The upload key is kept out of the repo. Add these to `~/.gradle/gradle.properties`:

```
INVOICE_UPLOAD_STORE_FILE=/absolute/path/upload.jks
INVOICE_UPLOAD_STORE_PASSWORD=...
INVOICE_UPLOAD_KEY_ALIAS=upload
INVOICE_UPLOAD_KEY_PASSWORD=...
```

Without them, release builds are signed with the debug key (fine for CI, not for Play).
