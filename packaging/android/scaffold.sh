#!/usr/bin/env bash
#
# Generate the Android shell and install the purchase plugin into it.
#
# The Android twin of packaging/ios/scaffold.sh. Everything here runs on any
# machine with Node: the platform scaffold, the plugin install, the Gradle and
# manifest patches, the icons. What it CANNOT do is compile or sign - that
# needs the Android SDK, which is Android Studio's job on the owner's machine
# (PLAY-WALKTHROUGH.md). The script stops where the SDK becomes necessary and
# prints exactly what is left.
#
# Usage:  cd packaging/android && npm install && ./scaffold.sh
#
# Re-runnable: `cap add` runs once, `cap sync` every time after, and every
# patch below checks whether it has already been applied. `cap sync` rewrites
# the web assets and the plugin list but NOT app/build.gradle, MainActivity or
# the resources, so the patches survive a sync; they are re-applied anyway in
# case the platform was regenerated from scratch.
#
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "==> installing the shell toolchain (pinned in package.json)"
  npm install
fi

echo "==> building the game"
npm --prefix ../.. run build

if [ -d android ]; then
  echo "==> platform exists: syncing web assets and plugins"
  npx cap sync android
else
  echo "==> adding the Android platform"
  npx cap add android
fi

APP=android/app
PKG_DIR=$APP/src/main/java/com/phaserugbymanager/app

# ---- THE PURCHASE PLUGIN ----
echo "==> installing the purchase plugin"
cp PhaseBilling.java "$PKG_DIR/PhaseBilling.java"
echo "    PhaseBilling.java"

# REGISTER IT, OR IT DOES NOT EXIST. Capacitor Android finds plugins written
# into the app (as opposed to npm packages) only through registerPlugin() in
# the activity, before super.onCreate. The iOS shell had exactly this failure
# mode in a different costume (packageClassList): a plugin that compiled,
# loaded, and was invisible to the web view, so the game had no shop.
MAIN=$PKG_DIR/MainActivity.java
if ! grep -q "registerPlugin(PhaseBilling.class)" "$MAIN"; then
  cat > "$MAIN" <<'EOF'
package com.phaserugbymanager.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // the purchase bridge is part of the app, not an npm package, so it is
        // registered here by hand - before super.onCreate, or the bridge has
        // already built its plugin list without it
        registerPlugin(PhaseBilling.class);
        super.onCreate(savedInstanceState);
    }
}
EOF
  echo "    registered PhaseBilling in MainActivity"
else
  echo "    PhaseBilling already registered"
fi

# ---- GRADLE: the billing library, and the version Play will see ----
GRADLE=$APP/build.gradle
BILLING_VERSION=$(node -p "require('./version.json').billingLibrary")
if ! grep -q "com.android.billingclient:billing" "$GRADLE"; then
  sed -i.bak "s|    implementation project(':capacitor-android')|    implementation project(':capacitor-android')\n    // Play Billing, for PhaseBilling.java - the same products the TWA sold\n    implementation \"com.android.billingclient:billing:${BILLING_VERSION}\"|" "$GRADLE"
  rm -f "$GRADLE.bak"
  echo "    added Play Billing ${BILLING_VERSION} to app/build.gradle"
else
  echo "    Play Billing already in app/build.gradle"
fi

# versionCode is the number Play counts uploads by; it must beat the highest
# Play has ever accepted for this package (15, the last TWA build) and it is
# recorded in version.json rather than typed into Gradle so nobody has to
# remember it. versionName is the release the game calls itself.
VCODE=$(node -p "require('./version.json').versionCode")
VNAME=$(node -p "require('../../package.json').version")
sed -i.bak -E "s/versionCode [0-9]+/versionCode ${VCODE}/; s/versionName \"[^\"]*\"/versionName \"${VNAME}\"/" "$GRADLE"
rm -f "$GRADLE.bak"
echo "    versionCode ${VCODE}, versionName ${VNAME}"

# ---- MANIFEST: portrait, like the game ----
MANIFEST=$APP/src/main/AndroidManifest.xml
if ! grep -q 'android:screenOrientation="portrait"' "$MANIFEST"; then
  sed -i.bak 's|android:name=".MainActivity"|android:name=".MainActivity"\n            android:screenOrientation="portrait"|' "$MANIFEST"
  rm -f "$MANIFEST.bak"
  echo "    portrait only"
fi

# ---- ICONS AND SPLASH, ours rather than Capacitor's ----
echo "==> drawing the launcher icon and the splash"
node icons-android.mjs

echo
echo "the shell is built. package: com.phaserugbymanager.app, versionCode ${VCODE} (${VNAME})"
echo
echo "ON A MACHINE WITH ANDROID STUDIO, from this folder:"
echo "  npx cap open android"
echo
echo "then Build > Generate Signed App Bundle, with the SAME keystore that signed"
echo "every Play upload so far (android.keystore, alias phase). PLAY-WALKTHROUGH.md"
echo "has every click. Never upload a bundle signed with any other key: Play"
echo "would refuse it, and if it did not, nobody on the old version could update."
