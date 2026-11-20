# Uploading 1.9.15

**Only after PR #114 is merged to main and CI is green on it.**

Version 1.9.15. Play versionCode 78. Confirm 77 (1.9.14) is accepted on the
Play Console before uploading 78.

## 1. Get the release onto your Mac

```
cd ~/Game
git checkout main
git pull
npm ci
```

## 2. Android (Play)

```
cd ~/Game/packaging/android
npm install
./scaffold.sh
```

The scaffold builds the game, copies it into the Android shell and sets the
version from `packaging/android/version.json`. Check it prints
**versionCode 78** and **versionName 1.9.15**.

Then open it in Android Studio from the same folder:

```
npx cap open android
```

In Android Studio:

1. Build → Generate Signed App Bundle / APK → Android App Bundle, with your
   upload key (as last time; the key and its password stay on your machine).
2. Play Console → Production → Create new release → upload the `.aab`.
3. Release notes: the 1.9.15 "What's new" in `docs/store-listing.md` (six
   languages, each under 500 characters).
4. Review and roll out.

## 3. iOS (App Store)

```
cd ~/Game/packaging/ios
npm install
./scaffold.sh
```

It sets the version to 1.9.15. In Xcode, set the **build number one higher
than the last upload**, then Product → Archive → Distribute App → App Store
Connect. In App Store Connect, add version 1.9.15, paste the "What's new"
from `docs/store-listing.md` for each language, select the build and submit.
Use `./scaffold.sh` only, never `npx cap sync ios` on its own.

## 4. After

- Tell me when each store accepts it, and I will tag the release.
