#!/usr/bin/env bash
#
# Generate the iOS shell and install the purchase plugin into it.
#
# Everything this script does was verified end to end on Linux against
# Capacitor 8.5.0: the platform scaffold, the bundle identity, the asset copy
# and the plugin install all happen here. What it CANNOT do is compile, sign
# or archive - that is Xcode, and Xcode is a Mac. The script stops at the
# point where a Mac becomes necessary and prints exactly what is left.
#
# Usage:  cd packaging/ios && npm install && ./scaffold.sh
#
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "==> installing the shell toolchain (pinned in package.json)"
  npm install
fi

echo "==> building the game"
npm --prefix ../.. run build

if [ -d ios ]; then
  echo "==> platform exists: syncing web assets and plugins"
  npx cap sync ios
else
  echo "==> adding the iOS platform"
  npx cap add ios
fi

APP=ios/App/App
echo "==> installing the purchase plugin into $APP"
for f in PhaseBilling.swift PhaseBilling.m App-Bridging-Header.h Products.storekit; do
  cp "$f" "$APP/$f"
  echo "    $f"
done

BUNDLE=$(grep -m1 'PRODUCT_BUNDLE_IDENTIFIER' ios/App/App.xcodeproj/project.pbxproj | tr -d '\t ;' | cut -d= -f2)
echo
echo "the shell is built. bundle identity: $BUNDLE"
echo
echo "ON A MAC, from this folder:"
echo "  npx cap open ios"
echo
echo "then, in Xcode, four things (README.md section 5 has the detail):"
echo "  1. drag the four files above into the App target if they are not listed"
echo "  2. Build Settings > Objective-C Bridging Header = App/App-Bridging-Header.h"
echo "  3. Signing & Capabilities > + Capability > In-App Purchase"
echo "  4. Product > Scheme > Edit Scheme > Run > Options >"
echo "     StoreKit Configuration = Products.storekit  (to test purchases)"
