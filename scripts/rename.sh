#!/usr/bin/env bash
# Sets the final brand name and Android package ID in one step.
#
#   scripts/rename.sh com.yourbrand.invoice "Your Brand"
#
# Changes: applicationId + namespace, the Kotlin package (files are moved),
# codegen package, the launcher label, APP_NAME, Maestro appIds and README.
# Leaves alone: the JS component name "InvoiceApp" and the invoiceapp://
# link scheme. Both are internal and never shown to anyone.
#
# Run on a clean git tree so the result can be reviewed with `git diff`.
# The package ID can never change once the app is on Google Play.
set -euo pipefail

NEW_ID="${1:-}"
NEW_NAME="${2:-}"
OLD_ID="com.invoiceapp.dev"

if [[ ! "$NEW_ID" =~ ^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$ ]] || [[ -z "$NEW_NAME" ]]; then
  echo "usage: scripts/rename.sh <package.id> \"<Brand name>\"" >&2
  echo "  package.id: lowercase, dot-separated, e.g. com.yourbrand.invoice" >&2
  exit 1
fi

cd "$(dirname "$0")/.."

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Commit or stash your changes first." >&2
  exit 1
fi

OLD_DIR="android/app/src/main/java/${OLD_ID//.//}"
NEW_DIR="android/app/src/main/java/${NEW_ID//.//}"
if [[ ! -d "$OLD_DIR" ]]; then
  echo "Already renamed ($OLD_DIR not found)." >&2
  exit 1
fi

# Portable in-place sed (macOS and Linux).
replace() { # replace <literal-from> <literal-to> <files...>
  local from="$1" to="$2"
  shift 2
  perl -pi -e "s/\Q${from}\E/${to//\//\\/}/g" "$@"
}

echo "Package: $OLD_ID -> $NEW_ID"
mkdir -p "$(dirname "$NEW_DIR")"
git mv "$OLD_DIR" "$NEW_DIR"
# Remove now-empty parent folders of the old package.
find android/app/src/main/java -type d -empty -delete

# macOS ships bash 3.2 (no mapfile), so file lists go through xargs.
git ls-files -z 'android/app/src/main/java/*.kt' |
  xargs -0 perl -pi -e "s/\Q${OLD_ID}\E/${NEW_ID}/g"
replace "$OLD_ID" "$NEW_ID" android/app/build.gradle package.json README.md
git ls-files -z '.maestro/*.yaml' |
  xargs -0 perl -pi -e "s/\Qappid: ${OLD_ID}\E/appId: ${NEW_ID}/gi"

echo "Name: $NEW_NAME"
# Values go through the environment so perl never re-interprets them.
# strings.xml needs & and ' escaped; config.ts needs ' and \ escaped.
XML_NAME=$(printf '%s' "$NEW_NAME" | perl -pe "s/&/&amp;/g; s/'/\\\\'/g") \
  perl -pi -e 's|<string name="app_name">.*?</string>|<string name="app_name">$ENV{XML_NAME}</string>|' \
  android/app/src/main/res/values/strings.xml
JS_NAME=$(printf '%s' "$NEW_NAME" | perl -pe "s/\\\\/\\\\\\\\/g; s/'/\\\\'/g") \
  perl -pi -e 's|^export const APP_NAME = .*;|export const APP_NAME = '"'"'$ENV{JS_NAME}'"'"';|' src/config.ts

echo
echo "Done. Next:"
echo "  1. git diff                      (review)"
echo "  2. cd android && ./gradlew clean && cd .. && npm run android"
echo "  3. Create the Drive OAuth client and Play listing with: $NEW_ID"
