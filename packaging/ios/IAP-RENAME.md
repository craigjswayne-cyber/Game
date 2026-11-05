# Rename the In-App Purchases in App Store Connect to match the app

Goal: every product's name in App Store Connect is the same words the player
(and App Review) sees on the in-app Store shelf.

## Apple's rules (checked 5 Nov 2026)

* **Reference Name**: internal only, up to 64 characters, editable at any time,
  no review.
* **Display Name**: shown to customers, 2 to 30 characters. A change needs
  review and has its own status; the old name stays live until it is approved.
* While a product is **Ready for Review**, **Waiting for Review** or **In
  Review**, only the reference name, price and availability can be edited.

Source: developer.apple.com/help/app-store-connect/reference/in-app-purchases-and-subscriptions/

## The names

Change 7 of the 12 products. The other 5 already match.

| Product ID | Current name | New name (Reference Name and Display Name) | Chars |
|---|---|---|---|
| `phase.heal` | Full Squad Recovery | Magic Sponge: Full Fitness | 26 |
| `phase.estate` | Max your team facilities | Max Upgrade Facilities | 22 |
| `phase.ground` | The Estate, at the next ground | Max Upgrade Facilities, again | 29 |
| `phase.uncapped` | Remove the Wage Cap | Remove the salary cap | 21 |
| `phase.inject.s` | Small Cash Injection | Board Injection (Small) | 23 |
| `phase.inject.m` | Medium Cash Injection | Board Injection (Medium) | 24 |
| `phase.inject.l` | Large Cash Injection | Board Injection (Large) | 23 |
| `phase.supporter` | Pro Manager | no change | |
| `phase.supporter.intro` | Pro Manager (one-time offer) | no change | |
| `phase.license` | Support the game | no change | |
| `phase.pinnacle` | Become an International Coach | no change | |
| `phase.inject.xl` | The Sugar Daddy | no change | |

Leave product IDs, prices and types alone. Product IDs cannot be changed, and
the app finds products by ID, so no new build is needed.

## Step by step

### Step 1. See what can be edited

1. Go to appstoreconnect.apple.com and sign in.
2. **Apps** → **PHASE: Rugby Manager**.
3. Left sidebar, under **Monetization**: **In-App Purchases**.
4. Note the **Status** of each product. It decides Step 3.

### Step 2. Rename the Reference Names (do this now, no review)

For each of the 7 products in the table:

1. Click the product's name in the list.
2. At the top, under the product's details, find **Reference Name**.
3. Replace it with the new name from the table.
4. Click **Save** (top right).
5. Go back to the list and do the next one.

### Step 3. Rename the Display Names

**If the status is Waiting for Review, Ready for Review or In Review**
(most likely, since they went in with version 1.9.6): you cannot edit the
display name yet. Do not pull the products out of the submission to do it: a
first In-App Purchase has to be reviewed with an app version, and pulling them
out means re-adding all of them and waiting for review again. Instead:

1. Send the App Review reply (`APP-REVIEW-REPLY-IAP.md`). It already tells
   the reviewer each product's in-app name.
2. Once the products are **Approved**, do the steps below. The name change
   then goes to review by itself; the old name stays on sale until it passes.

**If the status is Prepare for Submission, Rejected, Developer Action Needed
or Approved**, do it now. For each of the 7 products:

1. Click the product's name.
2. Scroll to **App Store Localization**.
3. Click the language row (for example **English (U.K.)**).
4. Replace **Display Name** with the new name. Leave **Description** as it is
   unless it no longer reads right (limit 45 characters).
5. Click **Save** in the dialog, then **Save** at the top of the page.
6. If there is more than one language row, do each one. Tell Claude which
   languages are listed and it will give names that match the app's own
   translations and fit in 30 characters (several of them run over as they
   are).
7. Back on the list, check the product shows a new localization status for
   review.

### Step 4. Submit the name changes

* If the products were editable as part of this 1.9.6 submission, they go back
  in when you tap **Resubmit to App Review** on the version.
* If they were already Approved, the localization changes are reviewed on their
  own. If App Store Connect asks you to add them to a submission, add them with
  the next app version.

### Step 5. Update the review reply (only if names changed before you reply)

If Step 3 was done before sending the reply, the names in the reply now match
the shelf exactly. The steps in it stay correct; the "Shown in the app as ..."
lines just become a little redundant, which does no harm.

## In the repo

`packaging/ios/Products.storekit` (the local StoreKit test file used in
Xcode) has been updated to the new names so local testing reads the same.
