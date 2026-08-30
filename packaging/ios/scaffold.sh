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

# COCOAPODS, BEFORE ANYTHING EXPENSIVE.
#
# `cap add ios` ends by running `pod install`, and CocoaPods does NOT come with
# Xcode - a clean Mac does not have it. This script was verified end to end on
# Linux, where the pod step is skipped entirely, so the gap never showed up
# until somebody ran it on the machine it is actually for. Failing here, before
# the game is built and the platform is scaffolded, costs seconds; failing
# inside `cap add` costs a confusing half-finished ios/ directory.
if [ "$(uname)" = "Darwin" ] && ! command -v pod >/dev/null 2>&1; then
  cat <<'MISSING'
CocoaPods is not installed, and `cap add ios` needs it.

Install it with ONE of these, then run this script again:

  brew install cocoapods        # if you have Homebrew - the tidier route
  sudo gem install cocoapods    # if you do not

Check it worked with:  pod --version
MISSING
  exit 1
fi

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
