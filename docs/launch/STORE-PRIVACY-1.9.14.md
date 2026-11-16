# PHASE: store privacy declarations for the next version

Ship these alongside the next build, together with `phase-privacy-update.patch` (privacy policy page plus the in-game "Your data" text in all six languages).

Check every answer against Google's own AdMob disclosure pages before you submit:
- Google Play: "Prepare your app for Google Play's Data safety section" (AdMob help)
- Apple: "Prepare for Apple's App Store data disclosure requirements" (Google Mobile Ads SDK docs)

## Google Play: Data safety (Play Console > App content > Data safety)

Data collected: Yes. Data shared: Yes (with Google, through AdMob).

| Data type | Collected | Shared | Purposes |
|---|---|---|---|
| Location: Approximate location (from IP address) | Yes | Yes | Advertising or marketing; Analytics; Fraud prevention, security and compliance |
| App activity: App interactions | Yes | Yes | Advertising or marketing; Analytics; Fraud prevention, security and compliance |
| App info and performance: Crash logs | Yes | Yes | Analytics; Fraud prevention, security and compliance |
| App info and performance: Diagnostics | Yes | Yes | Analytics; Fraud prevention, security and compliance |
| Device or other IDs (advertising ID, app set ID) | Yes | Yes | Advertising or marketing; Analytics; Fraud prevention, security and compliance |

Other questions:
- Is data encrypted in transit? Yes (AdMob uses HTTPS).
- Can users request deletion? The game holds no data. Point to the "Deleting your data" section of the privacy policy (phaserugbymanager.com/privacy.html#delete), which explains resetting the advertising ID.
- Is collection required or optional? Required for ad serving; personalisation is optional (consent form).
- Privacy policy URL: the updated page.

## Apple: App Privacy (App Store Connect > App Privacy)

"Do you or your third-party partners collect data?" Yes.

| Data type | Used for | Linked to user | Used for tracking |
|---|---|---|---|
| Location: Coarse Location | Third-party advertising; Analytics | Check Google's page | Check Google's page |
| Identifiers: Device ID | Third-party advertising; Analytics | Check Google's page | Yes (the app asks the App Tracking Transparency question) |
| Usage Data: Product Interaction | Third-party advertising; Analytics | Check Google's page | Check Google's page |
| Usage Data: Advertising Data | Third-party advertising; Analytics | Check Google's page | Yes |
| Diagnostics: Crash Data | Analytics | No | No |
| Diagnostics: Performance Data | Analytics | No | No |
| Diagnostics: Other Diagnostic Data | Analytics | No | No |

Privacy policy URL: the updated page.

## Order of work
1. Merge the patch, bump the version, build.
2. Publish the updated privacy page to the website first, so the stores link to the new text.
3. Update Data safety and App Privacy in the consoles in the same release window.
4. Tick both items off in the marketing tick list (section 6, Compliance).
