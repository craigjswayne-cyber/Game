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

# COCOAPODS: NOT NEEDED HERE, AND THE CHECK THAT SAID OTHERWISE WAS WRONG.
#
# A previous version of this script refused to run on macOS without `pod`, on
# the general belief that `cap add ios` ends in `pod install`. It does not, for
# THIS project: Capacitor 8 resolves iOS dependencies through Swift Package
# Manager when every plugin ships a Package.swift, which is the case here - the
# real run prints "All Capacitor plugins have a Package.swift file" and writes
# Package.swift instead. A clean Mac with no CocoaPods scaffolds this project
# perfectly well, and the guard would have blocked a working setup on every
# re-run.
#
# So the check is now the honest one: complain only if a Podfile actually
# exists, which is the only circumstance in which `pod` is required.
if [ -f ios/App/Podfile ] && ! command -v pod >/dev/null 2>&1; then
  echo
  echo "This project generated a Podfile, so CocoaPods IS needed after all:"
  echo "  brew install cocoapods    (or: sudo gem install cocoapods)"
  echo
  echo "Note that macOS's built-in Ruby may be too old - CocoaPods needs 3.0+."
  exit 1
fi

# ---- REGISTER THE PLUGIN, OR IT DOES NOT EXIST ----
#
# Capacitor 8 does NOT find plugins by scanning the Objective-C runtime. Its
# CapacitorBridge.registerPlugins() starts with five built-ins and then reads
# ONE thing: packageClassList in the bundled capacitor.config.json. Every class
# named there is looked up with NSClassFromString and registered; nothing else
# is ever considered.
#
# The CLI builds that list from installed npm plugin PACKAGES. PhaseBilling is
# not a package - it is four files copied into the app target - so `cap sync`
# writes `"packageClassList": []` and the plugin is invisible to the web view.
#
# That is not a subtle failure, but it is a silent one: the Swift compiles, the
# CAP_PLUGIN macro is correct, Compile Sources lists everything, and the game
# simply has no shop, because the Store row is gated on a live bridge. The
# owner's first run on a Mac lost an evening to it, with
# `Object.keys(Capacitor.Plugins)` returning the five built-ins and nothing else.
#
# So the list is patched here, after every sync, because the CLI rewrites this
# file each time and anything we put in the SOURCE config is discarded.
CONFIG="$APP/capacitor.config.json"
if [ -f "$CONFIG" ]; then
  node -e '
    const fs = require("fs")
    const f = process.argv[1]
    const c = JSON.parse(fs.readFileSync(f, "utf8"))
    const list = new Set(c.packageClassList ?? [])
    const had = list.has("PhaseBilling")
    list.add("PhaseBilling")
    c.packageClassList = [...list]
    fs.writeFileSync(f, JSON.stringify(c, null, 2) + "\n")
    console.log(had ? "    PhaseBilling already registered" : "    registered PhaseBilling in packageClassList")
  ' "$CONFIG"
else
  echo "!! $CONFIG is missing - the plugin cannot be registered and the shop will not appear"
  exit 1
fi

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
