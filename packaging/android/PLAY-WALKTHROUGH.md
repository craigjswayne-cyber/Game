# The Android app, as a real app: every click

This replaces the Bubblewrap build in `packaging/twa/`. The old Play app was a
Trusted Web Activity: Chrome, showing phaserugbymanager.com. The new one is a
Capacitor shell: the game itself inside the app, purchases through Google Play
Billing directly, and no Chrome. Same package name, same signing key, so to
Play and to every player it is an ordinary update.

Three things to hold in your head before the clicks:

* **It is the same key or nothing.** Every Play upload so far was signed with
  `android.keystore` (alias `phase`). This one must be too. Play refuses a
  bundle signed with any other key, and if it did not, nobody on the old
  version could update to it. The keystore never leaves your machine and is
  never pasted anywhere, including to me.
* **Careers do not move across on their own.** The old app kept saves inside
  Chrome. The new app has its own storage and cannot see Chrome's. The website
  already shows players on the old app a card asking them to back up
  (Saves → Export) before they update, and the new app's title screen offers
  Import on first run. Purchases are different: they are on the Google account
  and come back on their own.
* **Updates are no longer same-day.** Until now a push to `main` reached every
  phone in twenty minutes. From now on a game update is a new build through
  these steps and Play review. Reserve an hour, expect a day.

---

## Part 1. Once, on your machine

### 1. Android Studio

You have the Android SDK from the Bubblewrap days. You also need Android
Studio itself (Bubblewrap did not): https://developer.android.com/studio,
the standard install, defaults throughout. First launch → *More Actions* →
*SDK Manager* → tick **Android 15 (API 35)** SDK Platform and, under *SDK
Tools*, **Android SDK Build-Tools 35** and **Android SDK Command-line Tools**.
Apply.

### 2. The repo, current

```
cd ~/Game
git pull
npm ci
```

### 3. Build the shell

```
cd packaging/android
npm install
./scaffold.sh
```

This builds the game, creates the `android/` project (or refreshes it),
installs the purchase plugin, adds Play Billing to Gradle, sets the version
Play will see, makes it portrait, and draws the icons and splash. It ends by
printing the version code. **Read that number.** It must be higher than
anything Play has accepted before (15). It comes from `version.json` in this
folder.

### 4. Open it

```
npx cap open android
```

Android Studio opens the project. The first open downloads Gradle and
dependencies; give it five minutes and watch the bar at the bottom. When it
says nothing more, *Build → Assemble Project* (older versions call it *Make
Project*). It should finish with **BUILD SUCCESSFUL** at the bottom.

Android Studio may offer to upgrade the project's Android Gradle Plugin when
it opens. Either answer works: the scaffold writes a Gradle file both the
current and the next plugin generation accept. If a build ever ends red on
`getDefaultProguardFile('proguard-android.txt')`, run `./scaffold.sh` again;
it rewrites that line to the `-optimize` preset, which every version takes.

If it complains about the SDK location, *File → Project Structure → SDK
Location* and point it at your SDK folder (the same one Bubblewrap used,
usually `~/Android/Sdk` or `%LOCALAPPDATA%\Android\Sdk`).

### 5. Run it on your phone, unsigned, once

Plug the phone in with USB debugging on (Settings → About → tap Build number
seven times → Developer options → USB debugging). Pick the phone in the
device drop-down at the top, press the green Run arrow. The game installs and
opens as an app: no Chrome, no address bar, our icon.

**This build cannot buy anything.** It is signed with a debug key and Play
does not know it. The Store will say the store is unavailable, which is
correct. Purchases are tested in Part 2.

---

## Part 2. Every release

### 6. Version

Open `packaging/android/version.json`. `versionCode` must be one more than
the last number Play accepted. Change it, and change the version in the root
`package.json` if the game's version has moved. Run `./scaffold.sh` again so
Gradle gets both.

### 7. Generate the signed bundle

*Build → Generate Signed App Bundle / APK…*

1. **Android App Bundle** → Next.
2. **Key store path** → *Choose existing…* → `packaging/twa/android.keystore`
   (or wherever yours lives). Password: the one you set for Bubblewrap.
3. **Key alias**: `phase`. Key password: the same, unless you set a
   different one.
4. Tick *Remember passwords* if this is your own machine only.
5. Next → **release** → Create.

It writes `android/app/release/app-release.aab`. Android Studio shows a
"locate" link when it is done.

### 8. Play Console: internal testing first

https://play.google.com/console → the app → *Testing → Internal testing* →
*Create new release* → upload `app-release.aab`.

* Release name: the version, e.g. `1.2.8 (16)`.
* Release notes: what changed. For this first one: "The app is now a full
  app rather than a browser wrapper. Back up your careers in the old version
  first (Saves → Export), then Import them here."
* Save → Review release → Start rollout to Internal testing.

Play processes the bundle for a few minutes. If it rejects the version code
as already used, raise `versionCode` and go from step 6.

### 9. Test it for real

Your phone must be on the internal testers list (*Internal testing →
Testers*; you added yourself for the TWA builds). Open the opt-in link on the
phone, install from Play, and:

1. Open the game. Title screen → the *Import a backup* card is there on a
   fresh install.
2. Start a career. Play a week. Close the app fully, reopen: the career is
   there.
3. **Buy something.** Store → Support the game → Buy. Play's own sheet
   opens. Pay (you are a licence tester, so it is a test charge that is
   refunded). The Supporters Club count on the Profile goes up by one.
4. Buy a consumable (a cash injection). Check the money landed and the row
   is buyable again.
5. Kill the app during a purchase, reopen, go to the Store: the paid item is
   offered as *Apply here*, not lost.
6. Restore: uninstall, reinstall from Play, open the Store. Owned
   non-consumables show as owned without paying again.

If any of those fail, send me a screenshot and the exact step. Do not
promote.

### 10. Promote

*Internal testing → the release → Promote release → Production*. Review and
roll out. Full rollout is fine: everyone on the old version is offered the
update on their next visit to Play.

---

## The old build

`packaging/twa/` stays in the repository as history and for the record of
version codes. Do not build from it again. The website it loaded is still the
website, and phaserugbymanager.com keeps updating same-day for anyone who
plays in a browser.

## What you never do

Never paste the keystore, its password, or an upload key certificate into a
chat, an email or a ticket, with me or with anyone. Fingerprints, package
names, version codes and error messages are fine. If the key is ever exposed,
Play has a key-reset process; use it rather than hoping.
