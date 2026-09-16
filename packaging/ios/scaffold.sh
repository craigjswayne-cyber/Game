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

# ---- AND INTO THE TARGET, WHICH IS A SEPARATE THING FROM THE FOLDER ----
#
# Registering the class in packageClassList is necessary and not sufficient:
# NSClassFromString only finds a class the target actually compiled, and the
# copy above put four files in a folder, not in the target. `cap add ios`
# generates project.pbxproj from Capacitor's template, which has never heard of
# them. Until this runs, the shop is missing on a shell that looks correct in
# every other way - the failure this project has paid for more than once.
echo "==> putting the purchase bridge into the App target"
node install-billing.mjs

# ---- ADVERTS: the bridge the game speaks to, and the App ID the SDK needs ----
# The AdMob plugin is an npm package, so cap sync registered it in
# packageClassList itself (the set above keeps PhaseBilling beside it). The
# page-side provider and the Info.plist keys come from
# packaging/shell/install-ads.mjs, after every sync.
echo "==> installing the advert bridge"
node ../shell/install-ads.mjs ios

# ---- THE PLUGIN DOES NOT KNOW ITSELF UNTIL initialize() ----
#
# @capacitor-community/admob 8.1.0 wires its executors to the plugin instance
# inside initialize():
#
#     @objc func initialize(_ call: CAPPluginCall) {
#         self.bannerExecutor.plugin = self
#         ...
#         self.consentExecutor.plugin = self
#
# Every executor holds that as `weak var plugin`, and every one of them finds
# the screen to draw on through `plugin?.getRootVC()`. So before initialize()
# has run, that reference is nil and anything they are asked to do fails with
# "No ViewController" - including showConsentForm, which by Google's own
# documented order has to happen BEFORE initialize().
#
# An iPhone Simulator, 5 Sep, three times over and 900ms apart:
#   the consent form would not open (No ViewController) - trying again
# It was never going to open. The wiring is therefore done at load(), where a
# plugin normally does it, and initialize() keeps doing it too - harmless, and
# it means an upgrade that fixes this upstream just makes the patch redundant.
echo "==> teaching the AdMob plugin who it is before initialize()"
node -e '
  const fs = require("fs")
  const f = "node_modules/@capacitor-community/admob/ios/Sources/AdMobPlugin/AdMobPlugin.swift"
  if (!fs.existsSync(f)) { console.log("!! " + f + " is missing - adverts will not work"); process.exit(1) }
  let s = fs.readFileSync(f, "utf8")
  if (s.includes("PHASE: wired at load()")) { console.log("    already wired at load()"); process.exit(0) }
  const anchor = "    private let consentExecutor = ConsentExecutor()"
  if (!s.includes(anchor)) { console.log("!! the plugin no longer looks like 8.1.0 - check whether it still needs this"); process.exit(1) }
  const patch = anchor + `

    // PHASE: wired at load(). Upstream does this in initialize() only, which
    // leaves every executor with a nil plugin - and so no view controller to
    // present on - for anything called before initialize(). The consent form
    // must be shown before initialize(), so upstream it can never be shown.
    override public func load() {
        self.bannerExecutor.plugin = self
        self.adInterstitialExecutor.plugin = self
        self.adRewardExecutor.plugin = self
        self.adRewardInterstitialExecutor.plugin = self
        self.consentExecutor.plugin = self
    }`
  s = s.replace(anchor, patch)
  fs.writeFileSync(f, s)
  if (!fs.readFileSync(f, "utf8").includes("PHASE: wired at load()")) { console.log("!! the patch did not take"); process.exit(1) }
  console.log("    wired at load() - the consent form now has a screen to open on")
'

# ---- iPHONE ONLY ----
#
# Owner, mid-submission: "this game is not for ipad or watch, its purely for
# mobile". Capacitor scaffolds every project as UNIVERSAL - the generated
# pbxproj carries TARGETED_DEVICE_FAMILY = "1,2", which is iPhone plus iPad -
# and Xcode's General tab then lists four destinations: iPhone, iPad, Mac
# (Designed for iPad) and Apple Vision (Designed for iPad). The last two are
# free consequences of claiming iPad, not separate choices.
#
# Claiming iPad is not cosmetic. App Store Connect demands a full set of iPad
# screenshots for any binary that supports it, and holds the submission until
# they exist - so a game nobody intends to ship on iPad blocks its own release
# waiting for artwork of a layout that was never designed.
#
# 1 = iPhone. 2 = iPad. "1,2" = both. The three SUPPORTS_ flags drop the Mac
# and Vision destinations that ride along with iPad.
#
# Patched here rather than in Xcode because `cap add ios` regenerates this file
# from Capacitor's own template, so a change made only in the UI is lost the
# next time anybody scaffolds - the same trap the app icon fell into.
#
# There is nothing to switch off for Apple Watch: a watchOS app is a separate
# target that has to be added deliberately, and this project has never had one.
PBX=ios/App/App.xcodeproj/project.pbxproj
if [ -f "$PBX" ]; then
  if grep -q 'TARGETED_DEVICE_FAMILY = "1,2"' "$PBX"; then
    sed -i.bak 's/TARGETED_DEVICE_FAMILY = "1,2";/TARGETED_DEVICE_FAMILY = "1";\n\t\t\t\tSUPPORTS_MACCATALYST = NO;\n\t\t\t\tSUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD = NO;\n\t\t\t\tSUPPORTS_XR_DESIGNED_FOR_IPHONE_IPAD = NO;/g' "$PBX"
    rm -f "$PBX.bak"
    echo "    set iPhone-only (TARGETED_DEVICE_FAMILY = 1)"
  else
    echo "    already iPhone-only"
  fi
fi

# ---- THE VERSION AND THE BUILD NUMBER, FROM THE FILES THAT ALREADY HOLD THEM ----
#
# Capacitor's template ships MARKETING_VERSION = 1.0 and CURRENT_PROJECT_VERSION
# = 1, and the walkthrough used to say "type the version and build number into
# Xcode's General tab". The owner once rebuilt against a stale figure and
# uploaded an old game with the new release notes on it, and a duplicate build
# number is refused only by an email from Apple, an hour after the upload.
#
# So neither is typed any more. The version is the root package.json, the same
# figure Play and the game itself carry. The build number is the Play version
# code from ../android/version.json: one number, spent in one file, and a
# build reads the same on both stores. Apple only requires the build number to
# be unique within a version string and higher than the last upload of it,
# which going up with the Play code guarantees. Info.plist reads both through
# $(MARKETING_VERSION) and $(CURRENT_PROJECT_VERSION), so the pbxproj is the
# one place to set them.
VNAME=$(node -p "require('../../package.json').version")
VBUILD=$(node -p "require('../android/version.json').versionCode")
if [ -f "$PBX" ]; then
  sed -i.bak -E "s/MARKETING_VERSION = [^;]+;/MARKETING_VERSION = ${VNAME};/g; s/CURRENT_PROJECT_VERSION = [^;]+;/CURRENT_PROJECT_VERSION = ${VBUILD};/g" "$PBX"
  rm -f "$PBX.bak"
  if ! grep -q "MARKETING_VERSION = ${VNAME};" "$PBX" || ! grep -q "CURRENT_PROJECT_VERSION = ${VBUILD};" "$PBX"; then
    echo "!! could not set the version in $PBX - Xcode would archive 1.0 (1)"; exit 1
  fi
  echo "    version ${VNAME}, build ${VBUILD} (the Play version code)"
fi

# ---- THE ICON, OURS RATHER THAN CAPACITOR'S ----
# `cap add ios` writes a placeholder (a blue X on a grey check) into the icon
# set and nothing in a sync replaces it; it shipped in the first 1.2.4 upload
# before anybody looked. The real one is committed beside this script, drawn by
# scripts/icons.mjs: 1024x1024, no alpha, square corners, as Apple requires.
ICONSET=ios/App/App/Assets.xcassets/AppIcon.appiconset
if [ -d "$ICONSET" ]; then
  ICON=$(node -p "JSON.parse(require('fs').readFileSync('$ICONSET/Contents.json','utf8')).images.find(i => i.size === '1024x1024').filename")
  cp AppIcon-1024.png "$ICONSET/$ICON"
  echo "    app icon: AppIcon-1024.png over $ICON"
else
  echo "!! $ICONSET is missing - the build would carry Capacitor's placeholder icon"; exit 1
fi

# ---- EXPORT COMPLIANCE, ANSWERED IN THE BUNDLE ----
# The app has no encryption of its own; the only encryption in it is HTTPS
# inside Apple's frameworks and the advert SDK, which is exempt. With this key
# the upload does not stop to ask, and TestFlight does not hold the build for
# a missing compliance answer.
PLIST=ios/App/App/Info.plist
if ! grep -q ITSAppUsesNonExemptEncryption "$PLIST"; then
  node -e '
    const fs = require("fs"); const f = process.argv[1]
    let p = fs.readFileSync(f, "utf8")
    p = p.replace(/(\n<\/dict>\s*<\/plist>\s*)$/, "\n\t<key>ITSAppUsesNonExemptEncryption</key>\n\t<false/>$1")
    fs.writeFileSync(f, p)
    if (!fs.readFileSync(f, "utf8").includes("ITSAppUsesNonExemptEncryption")) { console.log("!! could not write ITSAppUsesNonExemptEncryption"); process.exit(1) }
  ' "$PLIST"
  echo "    ITSAppUsesNonExemptEncryption = NO in Info.plist"
else
  echo "    ITSAppUsesNonExemptEncryption already in Info.plist"
fi

BUNDLE=$(grep -m1 'PRODUCT_BUNDLE_IDENTIFIER' ios/App/App.xcodeproj/project.pbxproj | tr -d '\t ;' | cut -d= -f2)
echo
echo "the shell is built. bundle identity: $BUNDLE, version ${VNAME} build ${VBUILD}"
echo
echo "ON A MAC, from this folder:"
echo "  npx cap open ios"
echo
echo "the version, the build number, the icon and the export-compliance answer are"
echo "already in the project: Xcode's General tab must read ${VNAME} (${VBUILD})."
echo
echo "then, in Xcode, two things (README.md section 5 has the detail):"
echo "  1. Signing & Capabilities > Team, and check the bundle id above"
echo "  2. Product > Scheme > Edit Scheme > Run > Options >"
echo "     StoreKit Configuration = Products.storekit  (to test purchases)"
echo
echo "there is NO In-App Purchase capability to add, whatever older notes say:"
echo "it is on by default for an explicit App ID and the picker does not list"
echo "it. If the capability list looks short and ends in \"N Capabilities"
echo "Unavailable\", that is an unset Team, not a missing entitlement."
echo
echo "the file drag and the bridging-header setting are NO LONGER manual steps:"
echo "install-billing.mjs put both into the project above. If the shop is still"
echo "missing on device, open About & legal in the game - it now says which"
echo "bridges the shell actually brought."
