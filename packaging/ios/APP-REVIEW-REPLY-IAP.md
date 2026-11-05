# Reply to App Review: Guideline 2.1(b), In-App Purchases not found

Review of 1.9.6 (3), 5 Nov 2026. Apple could not find three products:

| App Store Connect name | Product ID | Why it was hard to find |
|---|---|---|
| Pro Manager (one-time offer) | `phase.supporter.intro` | Never on the Store shelf. Only appears as a pop-up card after the first completed competitive match (`src/game/profunnel.ts`, `src/ui/ProPrompt.tsx`). |
| Full Squad Recovery | `phase.heal` | It is on the shelf, but the app calls it **"Magic Sponge: Full Fitness"** (`store.heal` in `src/locales/en.json`). |
| The Estate, at the next ground | `phase.ground` | Only appears after buying "Max your team facilities", building it at one club, then moving to a different club (`src/ui/screens/Supporter.tsx`, estate row). |

No new build is needed. Paste the text below into the reply in App Store
Connect, and also into *App Review Information → Notes* so the next review has it.

Before sending, check in App Store Connect:

* Business → Agreements: the Paid Apps Agreement is **Active** (not just accepted
  and pending banking/tax).
* All 13 In-App Purchases are attached to version 1.9.6 and show *Waiting for
  Review* or *Ready to Submit*, not *Missing Metadata*.

---

Thank you for the review. No login is needed. All purchases are reached from the
**Store** card on the Home screen ("Store / Upgrade your team"), which appears
once a career has started. Some product names inside the app differ from the
App Store Connect reference names; the mapping and steps for each are below.

**To start:** launch the app, tap **New Game**, choose any nation and club, and
confirm. You are now on the Home screen.

**1. Full Squad Recovery ($0.99)**
Shown in the app as **"Magic Sponge: Full Fitness"**.
- Home → **Store**. It is on the shelf with a Buy button.
- It is also sold inside **Medical Centre** (Home menu).
- It can be bought once per club match played. Right after a purchase the button
  greys out and reads "Available again after your next match"; play one match
  and it returns.

**2. Pro Manager (one-time offer) ($1.99)**
Shown in the app as a pop-up card titled **"Pro Manager"** with a
**"ONE-TIME OFFER"** tag. It is not on the Store shelf by design; the normal
Pro Manager product is on the shelf.
- Do not buy the regular Pro Manager first; owning it hides the offer.
- On Home, tap Continue until the week of the first competitive (non-friendly)
  match. A first Pro Manager card appears; tap **Continue Free**.
- Play that match through to full time (Match Day → Kick Off; skipping to the
  end is fine).
- Return to the Home screen. Within a second or two the **ONE-TIME OFFER** card
  appears with the discounted price and a Buy button.
- If "Continue Free" is tapped on the one-time offer, it is gone for good on
  that device. Deleting and reinstalling the app resets it, and the steps above
  can be repeated.

**3. The Estate, at the next ground ($2.99)**
This is the repeat purchase of "Max your team facilities" for a second club, so
it appears only after a club change. It is shown in the Store on the
**"Max Upgrade Facilities"** row with the line "The buildings stayed at your old
club. This ground starts again."
- Home → **Store** → **Max Upgrade Facilities** → Buy (this is the
  "Max your team facilities" product).
- Tap **Build it at this club**, then **Build the whole estate, for good**.
- Home → **Job Centre**. Tap **Apply** on any vacancy (clubs show the chance of
  an offer; a lower-ranked club is the most likely to say yes). If the club
  offers the job, tap **Accept the Job**. If not, apply to another vacancy.
- Home → **Store**. The **Max Upgrade Facilities** row now shows a Buy button
  again. That button purchases "The Estate, at the next ground".

No purchases are restricted by storefront, region or device. All products are
configured for the sandbox environment.

---

## After sending

* Tap **Resubmit to App Review**. Do not upload a new build for this.
* Worth doing before the next version: make the in-app titles match the App Store
  Connect display names (or the other way round), so "Full Squad Recovery" and
  "Magic Sponge: Full Fitness" are the same words. Mismatched names are why the
  reviewer could not find a product that was on the shelf the whole time.
