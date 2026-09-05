# Putting adverts in the game, one step at a time

This is the plain-language version of `docs/ads-plan.md`. That document has the
reasoning and the numbers; this one has the steps, in order, with nothing
assumed. Where a step is mine to do (code), it says so. Where it is yours
(accounts, forms, signatures), it says so and tells you exactly where to click.

Read the first section before anything else, because it changes what "adding
ads" means for this game.

---

## 0. The one thing to understand first

Today the Android app is a **Trusted Web Activity**: a thin wrapper that opens
Chrome and shows phaserugbymanager.com inside it. That is why your phone says
"Chrome is running in the background" while you play. It is Chrome, doing the
work.

A wrapper like that **cannot show adverts**. Google's advert code (AdMob) only
runs inside a real app, not inside a web page. So before a single advert can
appear, the game has to be rebuilt as a real app that carries the game inside
it. That is called a **Capacitor shell**, and the iOS version you uploaded to
Apple is already one. Android has to be brought across to match.

The good news: the game itself is already ad-ready. It has two banner spaces
(bottom of Home, bottom of Results), four "watch an advert instead of paying"
buttons, and a Remove All Ads product, all written and waiting. Nothing inside
the game has to change. What has to change is the box it ships in.

Side effects of the new box, so you know before we start:

* Updates stop being same-day. Today I push to `main` and the site updates in
  twenty minutes and every phone sees it. With a real app, every update is a new
  build through Google's and Apple's review. Expect a day or two per release.
* The "Chrome in the background" notice goes away, which you asked about. It
  is the same change.

---

## Step 1. Decide, and say go

You decide two things and tell me:

1. **Yes to adverts, or not yet.** The plan document says: only worth it once
   there are enough players for the money to matter. A few hundred daily
   players earns pocket money; a few thousand earns rent. If the install base
   is small today, the honest advice is to build the shell now (it fixes the
   Chrome notice and is needed anyway) and switch adverts on later.
2. **Banners only, or banners and rewarded.** Banners are the strips at the
   bottom. Rewarded are "watch a 30-second advert to get this for free"
   buttons. The rewarded ones make more money per view and annoy nobody,
   because the player chooses them. The plan recommends both, banners first.

Say "go, shell first" and I do Step 2 without you.

---

## Step 2. The shell (mine, about a day)

I move Android from the Chrome wrapper to the Capacitor shell that iOS already
uses. Same game, same saves, same purchases, one code path for both phones.

What you will notice: nothing, except that the Chrome notice is gone. What you
will do: install the new build on your phone from the Play Console's internal
testing track when I tell you it is there, and play a week to confirm your
career is still where you left it and a purchase still works.

I ship this as an ordinary update. **No adverts yet.** We prove the box before
we put anything in it.

---

## Step 3. Your AdMob account (yours, twenty minutes)

AdMob is Google's advert service. It is free. It needs to be in your name
because the money goes to you.

1. Go to **admob.google.com** and sign in with the Google account you use for
   the Play Console (theworldofrummi, the same one). Click **Get started**.
2. It will ask for your country and time zone. United Kingdom, London.
3. It will ask you to accept the AdMob terms. Read the bit about not clicking
   your own adverts. Accept.
4. It will ask for **payment details**: your name, your address, and a bank
   account for payouts. Fill them in. Payouts start when you pass £60 and
   arrive monthly.
5. It will ask you to **verify your address** by post. Google sends a card
   with a code. This takes two to four weeks and you cannot be paid until it
   arrives. Start it now so it is not the thing we wait for later.

Send me nothing from this account. I never need your login. What I need is in
Step 4.

---

## Step 4. Register the app and make the advert units (yours, fifteen minutes)

Inside AdMob:

1. Left menu → **Apps** → **Add app**.
2. "Is the app listed on a supported app store?" → **Yes** → search
   **PHASE: Rugby Manager** → pick the Android one → **Add**.
3. Do the same again for the iOS one once Apple has approved it. Until then,
   choose **No, it is not listed** and add it by name; it can be linked later.
4. For each app, click it → **Ad units** → **Add ad unit**. Make these:

   | Ad unit name | Format | Where it appears in the game |
   |---|---|---|
   | Home banner | Banner | bottom of the Home screen |
   | Results banner | Banner | bottom of the weekly Results screen |
   | Rewarded | Rewarded | the four "watch an advert instead" buttons |

5. Each ad unit gets an **Ad unit ID** that looks like
   `ca-app-pub-1234567890123456/1234567890`. Each app gets an **App ID** that
   looks like `ca-app-pub-1234567890123456~1234567890` (note the `~`).
6. **Send me the IDs.** Two App IDs (Android, iOS) and six Ad unit IDs (three
   per platform). These are not secrets: they appear in the app itself. Paste
   them into chat.

That is the only thing I need from your AdMob account, ever.

---

## Step 5. Consent forms (mine, with two clicks from you)

The law in the UK and Europe says a player has to be asked before adverts can
use their data, and Apple says the same thing its own way. Skip this and the
app gets pulled.

1. In AdMob → **Privacy & messaging** → **GDPR** → **Create message**. Pick
   the standard template, tick "Consent" and "Do not consent" as the two
   buttons, choose your apps, **Publish**. That is your two clicks. This is
   the form European players see once.
2. I wire the Google consent code (UMP) into the Android shell so the form
   shows before the first advert, and the Apple tracking prompt (ATT) into the
   iOS shell. Most iPhone users say no to tracking; the plan already assumes
   that, and adverts still show, just less well paid.

---

## Step 6. I put the adverts in (mine, two days) - BUILT 5 Sep

Built ahead of Steps 3 to 5, on Google's test ids, so the only thing waiting
on you is the account and the ids. What it does, in plain words:

* A thin strip at the very bottom of the Home screen and the weekly Results
  screen, under the bottom menu. Nowhere else, ever: not the title screen,
  not a match, not over a pop-up.
* On the first run in the UK or Europe, Google's consent form, once. Say no
  and the game is exactly the same game, with less relevant adverts. On
  iPhone, Apple's "allow tracking?" question first, same rule.
* Four "watch an advert instead" buttons the game already had now light up:
  the physio's consult, the scout's file, the analyst's full read, the town
  collection. A spot that is closed early earns nothing. Six a day at most.
* Remove All Ads appears in the Store, at the price you set in the console,
  and removes every banner for ever. The four buttons stay, because the player
  is the one asking for them.

Until your real ids go in, every advert says **Test Ad** across it. That is
correct and safe: it is how Google wants you to test.

With the IDs from Step 4 and the consent from Step 5:

1. I add the AdMob code to both shells and connect the three ad units to the
   spaces the game already has.
2. I switch on the **Remove All Ads** product in both stores (£1.99, already
   written; you create it in the Play Console and App Store Connect the same
   way you created the others, and I give you the exact rows).
3. Banners never appear on the title screen, during a match, or over a
   pop-up. A player who buys Remove All Ads never sees a banner again. A
   rewarded advert only ever replaces a fee the game already charges; it
   never gives a paying player something a non-paying one cannot earn. These
   rules are already in the code and are checked by the test suite.
4. I test on a real device with Google's test adverts, then with real ones.

---

### The one product to create (yours, five minutes, before the release)

The Store's Remove All Ads row sells a product neither console has yet. Make
it exactly like the others, in both places, on the day of the advert release
and not before:

**Play Console** → Monetise → Products → In-app products → **Create product**

| Field | Value |
|---|---|
| Product ID | `phase.supporter` |
| Name | Remove all ads |
| Description | Removes every banner advert from the game, permanently. The optional "watch an advert instead" buttons stay. |
| Price | £1.99 (set it in GBP and let Play convert) |
| Type | Managed product (one-off, not a subscription) |

Then **Activate** it.

**App Store Connect** → the app → Monetisation → In-App Purchases → **+**

| Field | Value |
|---|---|
| Type | Non-Consumable |
| Reference name | Remove all ads |
| Product ID | `phase.supporter` |
| Price | Tier for £1.99 |
| Display name (English UK) | Remove all ads |
| Description | Removes every banner advert from the game, permanently. |

The id must be typed exactly: a typo does not error, it renders a button that
cannot sell.

### Sending me the ids, and what I do with them

Paste the two App IDs and the six ad unit IDs from Step 4 into chat. I put
them in `packaging/shell/ads.json`, turn `testing` off in the same commit,
and rebuild. Then you build both apps the usual way (the Android walkthrough,
the iOS walkthrough), put them on internal testing / TestFlight, and check
three things on your phone: a banner at the foot of Home, none on the title
screen or in a match, and Remove All Ads in the Store. **Do not tap a live
advert in your own app.** Send me a screenshot of the Home banner instead.

If you want to see real adverts on your own phone without risk, Android
Studio's Logcat prints a line beginning "Use RequestConfiguration.Builder"
with a long id when the app first shows an advert; send me that id and I add
it to `testDevices`, which makes your phone see test adverts on a live build.

## Step 7. The store paperwork (yours, thirty minutes, on the day)

Adverts change what the stores have to be told. On the release that carries
them, and not before:

**Play Console** → your app → **App content**:
* **Ads** → "Yes, my app contains ads". (This puts a "Contains ads" label on
  the listing. That is normal.)
* **Data safety** → **Manage** → answer exactly this:

  | Question | Answer |
  |---|---|
  | Does your app collect or share any of the required user data types? | Yes |
  | Is all of the user data collected by your app encrypted in transit? | Yes |
  | Do you provide a way for users to request that their data is deleted? | Yes, and the explanation is: the advertising identifier is reset or deleted in the phone's own settings; the app holds no account data |
  | Data types → Device or other IDs → **Device or other IDs** | tick |
  | Device or other IDs → Is this data collected, shared, or both? | Collected **and** Shared |
  | Is this data processed ephemerally? | No |
  | Is this data required, or can users choose? | Users can choose (the Remove all ads purchase and the consent form) |
  | Why is this user data collected? | Advertising or marketing |
  | Why is this user data shared? | Advertising or marketing |
  | Everything else (location, personal info, financial, messages, photos, files, activity, browsing, contacts, calendar, health) | No, unchanged |

* **Advertising ID** (a separate question under App content) → Yes, the app
  uses an advertising ID → purpose: Advertising or marketing.
* **Privacy policy** → the link does not change; the page at
  phaserugbymanager.com/privacy.html is updated in the same release.

**App Store Connect** → your app → **App Privacy** → Edit:
* Change **Data Not Collected** to:

  | Data type | Used for | Linked to the user | Used for tracking |
  |---|---|---|---|
  | Identifiers → Device ID | Third-Party Advertising | Yes | **Yes** |
  | Usage Data → Advertising Data | Third-Party Advertising | Yes | No |
  | Diagnostics → Crash Data | (leave off: the app has no crash reporting) | | |

  "Used for tracking: Yes" on the Device ID is what the App Tracking
  Transparency prompt in the app corresponds to. Apple checks that the two
  agree.
* The tracking prompt's wording is already in the app: "This lets the game
  show adverts that are more relevant to you. Say no and you still get every
  part of the game, with less relevant adverts."

---

## Step 8. Release, then look at the numbers (both of us)

1. I ship the advert build to both stores.
2. After two weeks, open AdMob → **Reports**. The number that matters is
   **eCPM** (what a thousand advert views earn) and the total. Send me a
   screenshot and I will tell you whether it is worth tuning.
3. Only once there are thousands of daily players is it worth switching on
   **mediation** (letting other advert networks bid). Before that it adds
   complexity and nothing else.

---

## What stays true throughout

* The website never gets an advert or a tracker. The test suite fails if it
  does.
* No advert ever interrupts a match.
* Remove All Ads means what it says.
* Nothing in the game moves behind an advert or a paywall.

## Where we are today

| Step | Status |
|---|---|
| 0. Understand the shell | this document |
| 1. Decide | **decided 4 Sep: shell first, adverts later** |
| 2. Build the shell | **done 4 Sep**: built, uploaded as 1.2.9 (17), tested on your phone, all six checks passed |
| 3. AdMob account | **done 5 Sep** (the postcard PIN still to type in when it arrives) |
| 4. Register and make units | **done 5 Sep**: eight ids in `packaging/shell/ads.json`, test mode off |
| 5. Consent message | **confirm**: Privacy & messaging → European regulations → a published message covering both apps. Without it the UK sees NO adverts, because the app refuses to ask for one it has no consent for |
| 6. Adverts in | **built 5 Sep, live ids 5 Sep** (`packaging/shell/`, v1.3.0); your next Android build carries them |
| 7. Paperwork | on release day; the exact answers are written above |
| 8. Measure | two weeks after |
