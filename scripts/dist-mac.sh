#!/bin/sh
# Build → sign with the stable local identity → DMG (arm64 + x64).
set -eu
cd "$(dirname "$0")/.."
sh scripts/build-native.sh
npm run build
npx electron-builder --mac dir --arm64 --x64
sh scripts/sign-mac.sh "dist/mac-arm64/Cute Pet Companion.app"
sh scripts/sign-mac.sh "dist/mac/Cute Pet Companion.app"
npx electron-builder --mac dmg --arm64 --prepackaged "dist/mac-arm64/Cute Pet Companion.app"
npx electron-builder --mac dmg --x64 --prepackaged "dist/mac/Cute Pet Companion.app"
