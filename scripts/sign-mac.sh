#!/bin/sh
# Sign the packaged app with the project's stable local identity so macOS permissions
# (Accessibility for the app and its nc-bridge helper) survive rebuilds/updates.
#
#   sh scripts/sign-mac.sh "dist/mac-arm64/Cute Pet Companion.app"
#
# Identity lives in build/signing/cpc-signing.keychain-db (git-ignored). The keychain is added to
# the user's search list ONLY while signing and the previous list is restored afterwards.
set -eu
APP="${1:?usage: sign-mac.sh <path/to/App.app>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KC="$ROOT/build/signing/cpc-signing.keychain-db"
PASS_FILE="$ROOT/build/signing/keychain.pass"
NAME="Cute Pet Companion Local Signing"
[ -f "$KC" ] && [ -f "$PASS_FILE" ] || { echo "No local signing keychain in build/signing — app left unsigned." >&2; exit 0; }

ORIG_LIST="$(security list-keychains -d user | sed -e 's/^ *"//' -e 's/"$//')"
restore() { # shellcheck disable=SC2086
  security list-keychains -d user -s $ORIG_LIST
}
trap restore EXIT

security unlock-keychain -p "$(cat "$PASS_FILE")" "$KC"
# shellcheck disable=SC2086
security list-keychains -d user -s $ORIG_LIST "$KC"
ID="$(security find-identity "$KC" | awk -v n="$NAME" 'index($0, n) { print $2; exit }')"
[ -n "$ID" ] || { echo "Signing identity not found" >&2; exit 1; }

# 1) everything nested (frameworks, Electron helper apps) — each keeps its own bundle id
codesign --force --deep --sign "$ID" --keychain "$KC" "$APP"
# 2) our helper with a stable explicit identifier
codesign --force --sign "$ID" --keychain "$KC" --identifier com.cutepet.companion.nc-bridge "$APP/Contents/Resources/nc-bridge"
# 3) reseal the app itself (identifier comes from CFBundleIdentifier = com.cutepet.companion)
codesign --force --sign "$ID" --keychain "$KC" "$APP"

codesign --verify --deep --strict "$APP"
echo "Signed: $(codesign -dr - "$APP" 2>&1 | tail -1)"
