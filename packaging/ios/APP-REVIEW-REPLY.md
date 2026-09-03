# Reply to App Review: Guideline 2.1, Information Needed

Apple's first reply to a new developer account is nearly always this one. It is
not a bug report and it does not want a new build. It wants a screen recording
and six written answers. Paste the answers below into the reply in App Store
Connect, AND into *App Review Information → Notes* on the version page, so the
next submission does not ask again.

Everything here is true of the shipped app. If a fact changes (a new external
service, an account system, ads), change the answer before sending it.

---

## The screen recording (item 1)

Record on an iPhone running the current iOS, not the simulator.

1. Settings → Control Center → add *Screen Recording* if it is not there.
2. Swipe down, tap the record button, wait for the three-second countdown.
3. Record this, in this order, in one take of two to three minutes:
   - Launch the app from the home screen. Let the title screen show.
   - **New Game** → pick a nation and a club → confirm.
   - Home: scroll once so the whole menu is seen, including the **STORE** card.
   - Open **Squad**, tap one player so the profile shows, go back.
   - **Continue** through the week until Match Day, then **Kick Off**. Let the
     match run for thirty seconds or so, then skip to the end and let the
     result and the post-match screens show.
   - Open the **Store**. Scroll the shelf so every product's Buy button is
     seen. Do not need to buy anything; if you do, use a Sandbox tester
     account so no money moves.
   - **Settings**: change the language once (say to French) and back.
   - **About & legal**: let the "Unofficial, and independent" statement show.
   - Return to Home and stop the recording from the status bar.
4. The recording lands in Photos. Attach it in the App Store Connect reply
   (the paper-clip in the reply box), or upload it to iCloud Drive and paste a
   shared link. Keep it under 500 MB; 1080p for three minutes is well under.

There is no account registration, login, account deletion or user-generated
content in the app, so none of those flows exist to record. Say so in the
reply (the text below does).

---

## The written reply (items 1 to 6)

Paste from the line below to the end of the section.

---

Thank you for the review. Answers to each point follow, and the same text has
been added to the Notes field of App Review Information.

**1. Screen recording.** Attached. It was captured on a physical iPhone running
the current iOS and begins with launching the app. It shows the typical flow:
starting a career, choosing a club, reading the squad, playing a match, opening
the in-app Store, changing language in Settings, and the About & legal page.
The app has no account registration, login or account deletion, and no
user-generated content, so there are no such flows to demonstrate.

**2. Purpose and audience.** PHASE: Rugby Manager is a single-player rugby
union management simulation. The player takes charge of a club, picks the team,
sets tactics, handles training, transfers, contracts, the board, the press and
the club's finances, and plays out season after season. It is for rugby fans
who want a deep, offline, text-and-tactics management game in the style of a
classic sports manager. It solves the problem that rugby has almost no games of
this kind, and it provides many seasons of play with no connection required.

**3. Setting up and using the app.** No login, credentials or sample files are
needed. Launch the app, tap New Game, choose a nation and a club, and the career
begins. Continue advances time; Match Day and Kick Off play a fixture; Squad,
Tactics, Training, Transfers, Finances and Board are reached from the Home
menu. The Store (also on the Home menu) lists the optional in-app purchases.
Settings holds language, text size, day/night and colour skins. About & legal
holds the privacy policy and the unofficial-status statement.

**4. External services.** None, beyond Apple's own. The only external service
the app uses is Apple In-App Purchase through StoreKit, for the optional
purchases configured alongside this submission. There are no data providers,
no authentication service, no third-party payment processor, no analytics SDK,
no advertising SDK and no AI service. The app makes no network requests of its
own; all content is bundled and all game state is stored on the device. The
"Report a bug" and contact buttons open the device's Mail app to
phaserugbymanager@gmail.com; nothing is sent automatically.

**5. Regional differences.** None. The app functions identically in every
region. It ships in English, French, Spanish, Italian and Japanese, chosen by
the user in Settings; the choice affects language only, not features or
content.

**6. Regulated industry and third-party material.** The app is not in a
regulated industry. It contains no licensed or protected third-party material:
no club badges, kits, logos, photographs, competition names or sponsor marks of
any real organisation. Clubs, competitions, grounds and sponsors in the game are
fictional. Player names are real, used solely to identify people in a sporting
database, as a newspaper or an almanac does; the app is clearly labelled as
unofficial and independent on the title screen, in About & legal and in the
privacy policy, and a contact address for removal requests is published in
all three places.

---

## Afterwards

* Once the reply and recording are in, tap **Resubmit to App Review**. Do not
  upload a new build for this; a new build restarts the queue.
* Optional tidy: the version page still reads *1.1.17* while the build reads
  *1.2.4 (4)*. Apple does not require them to match, but the version number can
  be edited to 1.2.4 on the version page while the submission is in the
  rejected state, and it saves a question later.
* The iOS update to 1.2.5 waits until this version is approved; then it goes
  up as an ordinary update with these notes already in place.
