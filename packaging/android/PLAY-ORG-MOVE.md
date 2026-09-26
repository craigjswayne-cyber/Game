# Moving the game to the company's Play account

The owner has registered a company and is publishing under it (26 Sep 2026).
The app already lives on the personal Play account as
`com.phaserugbymanager.app`, with players, purchases, a signing key and a
history of version codes (see `version.json`). The goal is to move that app to
the company's account and keep all of it. Uploading it again as a new app would
need a new package name, and everyone on the current app would be stranded on it.

Google changes the Play Console's labels from time to time. Where a click below
does not match the screen, go by Google's help article "Transfer apps to a
different developer account" in the Play Console Help Center. It is the
authority, not this file.

---

## Stage 1. The company's D-U-N-S number

Google requires every organisation developer account to have a D-U-N-S number
issued by Dun & Bradstreet, under exactly the company's registered legal name
and address.

1. Look the company up on Dun & Bradstreet's free D-U-N-S lookup (Google links
   to it from the organisation sign-up page). A newly registered company often
   has one already, created from the Companies House record.
2. If it has none, request one there. It is free, but it can take up to 30
   days. **Do not pay** for an "expedited" D-U-N-S: Google does not need one.
3. Check that the name and address on the D-U-N-S record match the Companies
   House record exactly. A mismatch is the most common reason organisation
   verification stalls.

## Stage 2. The organisation developer account

1. Sign in to https://play.google.com/console with the Google account that will
   own the company's developer account. Use a company address that you will keep,
   not a personal Gmail, because this account will own the game from now on.
2. Create a developer account, choose **An organisation**, and pay the one-off
   $25 registration fee. **Keep the receipt:** the transfer in Stage 4 asks for
   this payment's transaction ID.
3. Enter the D-U-N-S number, the legal name and address, a public contact email
   and phone number, and the company website (`https://phaserugbymanager.com`).
   The developer name, address and contact details are shown publicly on the
   store page.
4. Complete identity and organisation verification. Google may ask for company
   documents and will verify the website and phone number.
5. Set up the **payments profile** for the company (Play Console → Settings →
   Payments profile, or the merchant set-up it prompts for). The game sells
   in-app products, so the new account needs a merchant profile, bank account
   and tax details before the purchases can move to it.

Organisation accounts do not have to run the 12-tester, 14-day closed test that
new personal accounts must pass before production.

## Stage 3. Before you ask for the transfer

On the **personal** account:

1. Let any release that is in review finish. Do not start a new upload until
   the transfer is complete.
2. Note the highest version code Play has accepted (App bundle explorer). It
   moves with the app. Write it into `version.json` so the next upload goes one
   above it.
3. Check the app is in good standing: no unresolved policy issues under
   **Policy status**.

On the **company** account, find the two things the transfer form asks for:

- the **account ID** (Play Console → Settings → Developer account → Account
  details), and
- the **transaction ID** of the $25 registration payment (from the receipt, or
  from payments.google.com).

## Stage 4. The transfer

1. In the **personal** account's Play Console, start the app transfer (Google's
   help article names the current place in the menus). Select
   `com.phaserugbymanager.app`, then enter the company account's ID and
   registration transaction ID.
2. Accept the request in the **company** account's Play Console if it asks you
   to.
3. Google reviews the request. The app stays live throughout. The only change
   players see is the developer name on the store page.

What moves with the app: the store listing, reviews and ratings, players and
installs, statistics, in-app products and purchases, testing tracks and
testers, and the Play App Signing key. The upload key (`android.keystore`,
alias `phase`) stays on your machine and keeps working: nothing about the build
changes.

## Stage 5. After the transfer

1. **AdMob.** The advert ids in `packaging/shell/ads.json` belong to an AdMob
   account, not to Play, and a Play transfer does not move them. Either keep
   that AdMob account (the ads keep working and paying it) or create the
   company's own AdMob account, add the app to it, and put the new App ID and
   ad unit ids into `ads.json` before the next build. Link the app to AdMob
   again from the company's Play account.
2. **Privacy policy.** `public/privacy.html` does not say who runs the game.
   Add the company's registered name (and number) as the operator, and consider
   a company contact address instead of the Gmail one. The store listing's
   privacy policy URL stays the same.
3. **Store listing and forms.** Open each of these once on the new account and
   check they came across: Data safety, content rating, target audience, ads
   declaration, app access. Fix anything showing as incomplete.
4. **Target API.** Check **Policy status** for a target-API warning before the
   next upload. `PLAY-WALKTHROUGH.md` builds against Android 15 (API 35), and
   Google raises the minimum every August.
5. **Next release.** Build and upload exactly as `PLAY-WALKTHROUGH.md`
   describes, using the version code above the highest one Play has accepted.
   Then promote to Production.

## Why not just publish from the company account as a new app

A second app would need a new package name, so every current player would be
left on the old app with no update path. Purchases made on the old app would not
carry over, and the reviews and install history would start from nothing. The
transfer keeps all of that.
