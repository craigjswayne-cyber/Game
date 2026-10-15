# Backlog (PROPOSED, awaiting owner decision)

Written 15 Oct 2026. Nothing here is approved. Ordered by priority inside each
group. Size: S = an evening, M = a weekend, L = more than a weekend.
"Owner" means it needs you, a console, a device or a Mac; no code from us.

## iOS launch blockers

| # | Item | Size | Who | Why |
|---|---|---|---|---|
| 1 | Re-answer AdMob data collection on Play Data safety and Apple App Privacy (checklist B1) | S | Owner | Under-declaring is a rejection risk on Apple and a policy risk on the live Play listing |
| 2 | Compile `PhaseBilling.swift` in Xcode 26+, add `AppStore.sync()` to Restore, run the StoreKit test (S1, S15) | M | Owner (Mac), we draft the Swift | Purchases are the only revenue path; this code has never been built |
| 3 | When Apple approves the account: create the app record, all 12 products, the EU trader declaration, the age rating, TestFlight. Flip the "Coming soon" lines on the landing page on launch day (B9, B10, B12, S9) | M | Owner | Required for submission |

## Live bugs and stability

| # | Item | Size | Who | Why |
|---|---|---|---|---|
| 4 | Run the 1.9.0 device table on Android and play 2 to 3 seasons before rollout past 20% (release report sections 5 to 7) | M | Owner | 1.9.0 changed set pieces in the engine with no human play-test |
| 5 | Add a version number to saves, written on save and ignored on load for now | S | Us | Cheap now, expensive after the first save format change; fully reversible |
| 6 | Keep unused consumable credits through a reinstall (for example inside the export file) | M | Us, needs a design choice | Paid items vanishing is a refund and review risk |

## Retention and monetisation

| # | Item | Size | Who | Why |
|---|---|---|---|---|
| 7 | Native in-app review prompt after a good moment (a win or a season end), at most once per version | S to M | Us (shell) | No review prompt exists; ratings drive store ranking. Needs care with the no-network rule (it lives in the shell, like ads) |
| 8 | Fix the Pro Manager price in the docs (£2.99 vs $1.99) and confirm all 12 prices in both consoles | S | Owner and us | Docs drive the agents; a wrong price spreads |

## Nice to have

| # | Item | Size | Who | Why |
|---|---|---|---|---|
| 9 | Weekly retention check from the Play Console dashboards, noted in `docs/studio/` | S | Owner | Only retention signal available without adding analytics |
| 10 | Roadmap 1a: phase-shaped match view (scrums and lineouts look like scrums and lineouts) | L | Us | Better store screenshots and first impressions. Too big for now; listed so it is not lost |

## Decisions needed from you

- Approve, drop or reorder items.
- Item 6: which approach (needs options, to follow if approved).
- Item 7: build it now or after iOS launch.
