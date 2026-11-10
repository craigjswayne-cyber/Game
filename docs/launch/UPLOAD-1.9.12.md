# Uploading 1.9.12 tonight

Version **1.9.12**. Play versionCode **71**. Everything is on PR #96.
Do the steps in order; each one says what to check before moving on.

## 1. Before you build

- [ ] **CI green on PR #96** (the Gate: 8 engine shards, browser smoke,
      3 browser PR shards). https://github.com/craigjswayne-cyber/Game/pull/96
- [ ] **Release check green** on commit `69be857` or later (Actions tab,
      "Release check"). The rule since 1.9.2: no release is cut until it is.
      If anything is pushed to the PR after this, it needs running again on
      the new commit.
- [ ] **Merge #96 into main.** Both store builds are made from main, and the
      merge also deploys the website.
- [ ] **Shirt 1 on a real iPhone.** About 45 minutes after the merge the
      website updates (the Gate runs on main first). Open
      phaserugbymanager.com **in Safari on an iPhone** (the reporter's exact
      setup, a browser tab), start a career, play to half time, tap
      *Match-Day Squad: make replacements*, scroll down to the bench, then
      back up. Shirt 1 must be reachable and tappable. It could not be
      reproduced in Chromium, even emulating an iPhone 13 with real touch
      swipes, so this is the only real test of the fix. If it still fails,
      stop and send a screenshot of the whole screen.

## 2. Check the numbers

- [ ] **Play Console**: the highest version code accepted is **70**
      (1.9.11). If it is higher, set `versionCode` in
      `packaging/android/version.json` to one more than it, and note it there.
- [ ] **App Store Connect**: is 1.9.11 still waiting for review? If so,
      1.9.12 is submitted after it; Apple reviews them in turn. The build
      number must be one higher than the 1.9.11 upload (TestFlight shows it).

## 3. Android (Play)

From the repo root, on main:

```
git checkout main && git pull
npm ci
cd packaging/android
npm install
./scaffold.sh
```

- [ ] `scaffold.sh` prints the version code at the end. It must read **71**
      (or the number you set in step 2).
- [ ] Android Studio: *Build > Generate Signed App Bundle / APK* >
      Android App Bundle > your keystore, alias `phase` > **release**.
      Output: `android/app/release/app-release.aab`.
- [ ] Play Console > *Testing > Internal testing* > *Create new release* >
      upload the .aab. Release name: **1.9.12 (71)**. Release notes: the
      What's new for each language in `docs/store-listing.md` (section
      "v1.9.12").
- [ ] On your phone, from the internal track (see section 5 for what to try).
- [ ] *Promote release > Production*.

## 4. iOS (App Store)

On the Mac, from the repo root, on main:

```
git checkout main && git pull
npm ci && npm run build
cd packaging/ios && ./scaffold.sh
```

Run `./scaffold.sh`, never a bare `npx cap sync ios`: the scaffold puts the
advert and purchase bridges back into the page (APP-STORE-WALKTHROUGH 17b).

- [ ] Xcode: *Assets* shows the green ball icon, not Capacitor's blue X.
- [ ] *App* target > *General*: **Version 1.9.12** (it must match
      `node -p "require('./package.json').version"`), **Build** one higher
      than the last upload.
- [ ] Device dropdown **Any iOS Device (arm64)** > *Product > Archive*.
- [ ] Organizer > *Distribute App* > *App Store Connect* > *Upload*.
      Encryption: **No**.
- [ ] TestFlight: install and try section 5.
- [ ] App Store Connect > new version 1.9.12 > pick the build > paste the
      What's new for each language > *Add for Review* > *Submit*.
      The review notes from last time (`docs/store-listing.md`) still apply.

## 5. What to try on the device before promoting

Five minutes, on each store's test build:

1. **Women's game, manager left on "he"**: new women's career. Home shows the
   "The press call you" card; leave it. Play two or three weeks and read the
   inbox and a few player pages: no "he" or "him" about a player. Then tap
   *She* on the card: it goes, and stays gone after closing the app.
2. **Shirt 1**: half time, *Match-Day Squad*, scroll to the bench and back
   up. Shirt 1 reachable and tappable.
3. **Loans**: borrow a player (*Transfers > Loans*). His page has an
   "On loan from ..." card with *Terminate the loan*, and no *Transfer List*
   button. In the first four weeks Terminate explains it is too soon; after
   that, two taps send him back.
4. **Stats**: after a couple of matches, a kicker's page shows
   "Cons 3/4 (75%)" and Tackles. *World > Team of the Week* shows Top
   Tacklers and Top Goal Kickers under the team (the kickers board needs ten
   kicks, so it appears after a few rounds).
5. **An old career**: open a career saved on 1.9.11. It loads; Home asks the
   pronoun once; kick percentages start from today.

## 6. After it is live

- [ ] Reply to both players (drafts below).
- [ ] Update `docs/launch/LAUNCH-PROGRAMME.md` status table: current version
      1.9.12, Play code 71, App Store status.

## Replies to send once it is live

**To Eilidh** (English):

> Hi Eilidh,
>
> Version 1.9.12 is now out. Players in the women's game are no longer called
> he or him, and the game now asks whether the press should call you he or
> she. You'll see a card for it on Home; you can change it any time in
> Settings.
>
> I've also changed how the squad list works at half time so it should scroll
> back up to shirt 1. If it still gives you any trouble, send me a screenshot
> of the whole screen and I'll look again.
>
> Thanks again, and good luck with Bristol.
>
> Craig

**To the French player** (French):

> Bonjour,
>
> Merci pour ces retours. La version 1.9.12 est disponible :
>
> - Un joueur prêté à votre club ne peut plus être placé sur la liste des
>   transferts, et sa fiche propose désormais « Mettre fin au prêt », après
>   quatre semaines de prêt.
> - L'achat d'un joueur pendant son prêt existait déjà : il est possible
>   après huit semaines, pendant un mercato, si son club accepte de vendre.
>   La fiche du joueur indique ce qui bloque.
> - Les transformations et pénalités tentées et réussies sont comptées, avec
>   le pourcentage de réussite, ainsi que les plaquages. Monde > Équipe de la
>   semaine affiche les meilleurs plaqueurs et les meilleurs buteurs de chaque
>   championnat, sur la saison en cours.
>
> Les distances des coups de pied, les ateliers d'entraînement par groupe, la
> charge par joueur et le poids des mêlées ne sont pas encore dans cette
> version. Je les garde de côté.
>
> Bonne semaine,
>
> Craig
