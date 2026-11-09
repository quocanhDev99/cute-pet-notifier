#!/bin/sh
# Builds the macOS Accessibility helper as a universal binary (arm64 + x86_64).
set -e
[ "$(uname)" = "Darwin" ] || { echo "skip: nc-bridge is macOS-only"; exit 0; }
cd "$(dirname "$0")/.."
mkdir -p build/native
if [ -f build/native/nc-bridge ] && [ -z "${FORCE_REBUILD:-}" ]; then
  echo "using existing build/native/nc-bridge ($(lipo -archs build/native/nc-bridge))"
  exit 0
fi
swiftc -O -target arm64-apple-macos11 native/macos/nc-bridge.swift -o build/native/nc-bridge-arm64
swiftc -O -target x86_64-apple-macos11 native/macos/nc-bridge.swift -o build/native/nc-bridge-x64
lipo -create build/native/nc-bridge-arm64 build/native/nc-bridge-x64 -output build/native/nc-bridge
rm build/native/nc-bridge-arm64 build/native/nc-bridge-x64
echo "built build/native/nc-bridge ($(lipo -archs build/native/nc-bridge))"
