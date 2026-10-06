# PHASE: Master release, launch and marketing programme (owner's brief)

The owner's brief, saved as given (6 Oct 2026), so we can work through it item
by item. The working board built from it, against the actual repository, is
`docs/launch/LAUNCH-PROGRAMME.md`.

Status of this brief: **the plan we are working to once the game is fully
ready.** Launch planning becomes implementation work only after the
1.8.10/1.8.11 release-hardening gate is green.

---

We are approaching the point where PHASE: Rugby Manager should stop being treated primarily as a development project and start being treated as a product that needs to be released, marketed, supported and continuously improved.

Once the current 1.8.10 / 1.8.11 release-hardening work is complete, help build the complete roadmap from the current state of the repository to a professional public launch on Google Play and Apple App Store.

This is NOT a request to add gameplay features. The goal is to make sure we have thought through everything required to launch PHASE properly. A comprehensive, practical, tick-box programme that we can work through.

## Core principle

PHASE's product proposition:

> PHASE is the rugby management game where the world remembers what you did.

The game should feel like: I made a decision, something happened, I understand why, the world remembers it, now I have another decision.

The launch should communicate that identity. Do not reduce PHASE to "a rugby management game". Communicate what makes it different: consequential decisions, player relationships, persistent memory, rivalries, transfers, tactical decisions, club identity, manager identity, career history, emergent stories, a world that remembers what the manager did.

## First: audit the current repository

Before recommending anything, inspect the actual repository; do not assume a previously discussed system still exists exactly as described. Audit: current version, package.json, Android packaging, iOS packaging, Play configuration, App Store configuration, Pro Manager/IAP, advertising, Ruck integration, localisation, analytics, crash/error handling, Discord/community infrastructure, README/docs, release scripts, CI, GitHub workflows, release automation, marketing assets, website assets, branding, screenshots, trailer/video assets, legal/privacy files, support mechanisms, telemetry/analytics, release notes, changelog, store metadata. If something already exists, mark it **DONE / VERIFY** rather than proposing it again.

## Phase 0: Release hardening

The 1.8.10/1.8.11 work must finish before launch planning becomes implementation work.

**Product:** No P0 bugs. No P1 bugs. Samsung physical Android Back test passed. Android gesture Back tested. Android navigation-button Back tested. iPhone tested. Fresh install tested. Upgrade tested. Save/load tested. Career restoration tested. App background/resume tested. Offline behaviour tested. Long-session test. Match fingerprint unchanged. No gameplay regression. No save corruption. No debug UI. No placeholder copy. No placeholder artwork.

**Monetisation:** Pro purchase. Pro restore. Failed purchase. Cancelled purchase. Pending purchase. Reinstall. Intro offer. Correct pricing. Discount calculations. Ads. "Free with ad" behaviour. Pro funnel. No accidental purchase prompts during inappropriate game states.

**News / Ruck:** Ruck branding correct. Ruck attribution correct. News behaves correctly. Legal/permission confirmed.

## Phase 1: Google Play release

**Developer/account:** Play Console access, developer profile, contact details, developer email, website, privacy policy, support URL.

**App listing:** app name, short description, full description, app icon, feature graphic, phone screenshots, tablet screenshots where appropriate, promo video, category, tags, content rating, target audience, Data Safety, ads declaration, app access declaration, other required Play declarations.

**Store localisation:** decide which store locales to support from the languages PHASE already supports (English, French, Spanish, Italian, Afrikaans, Japanese). Do not assume every listing needs full localisation if not justified; recommend the best approach.

**Production build:** production AAB, correct versionName, correct versionCode, signing, package ID, release configuration, R8/ProGuard, native Android Back handler, scaffold.sh, clean packaging test, release AAB archived.

**Billing** (`phase.supporter`, `phase.supporter.intro`): products exist, correct prices, correct countries, intro pricing, purchase, cancellation, failure, pending, restore, reinstall, existing Pro user, store bridge failure.

**Release:** internal test, closed test if required, production application, store review, staged rollout decision, release notes, production monitoring.

## Phase 2: Apple App Store

**Account:** Apple Developer account active, App Store Connect, bundle ID, certificates, provisioning, signing.

**Store listing:** app name, subtitle, description, keywords, promotional text, screenshots, app icon, app preview, privacy URL, support URL, age rating, App Privacy, content rights, localisation.

**IAP:** `phase.supporter`, `phase.supporter.intro`, pricing, localisation, purchase, restore, cancellation, failure, reinstall, TestFlight.

**Submission:** archive, upload, TestFlight, physical iPhone QA, review notes, App Review submission, approval, release.

## Phase 3: Brand system

Audit existing branding and identify gaps: final logo, wordmark, app icon, favicon, colour palette, typography, UI brand rules, social templates, store screenshot template, trailer end card, Discord branding, website branding, YouTube banner, X/Twitter header, Instagram profile, TikTok profile. The same product everywhere; avoid generic "sports game" branding.

## Phase 4: Trailer

Core concept: "The world remembers what you did." Communicate the loop, not lots of screens. Narrative: you make a decision; the match responds; a player reacts; a relationship changes; a consequence appears later; the world remembers it; your career develops; you make another decision.

**Masters:** 16:9, 9:16, 1:1, 4:5, store versions, YouTube version, social versions. **Cuts:** 60s master, 30s, 15s, 6s teaser. **Production:** script, storyboard, capture list, gameplay capture, UI capture, music, music licence, sound design, voiceover decision, voiceover, captions, end card, CTA, thumbnail, final exports. Verify current Google Play, App Store, YouTube, TikTok, Instagram specifications before finalising export requirements; do not invent dimensions.

## Phase 5: Store screenshots

A deliberate screenshot story, each communicating a player benefit:
1. YOUR CLUB. YOUR WAY.
2. EVERY DECISION HAS CONSEQUENCES.
3. YOUR PLAYERS REMEMBER.
4. THE WORLD REMEMBERS.
5. BUILD YOUR SQUAD.
6. MASTER MATCHDAY.
7. BUILD YOUR LEGACY.
8. NO TWO CAREERS ARE THE SAME.

Create: Android screenshots, iPhone screenshots, correct aspect ratios, correct dimensions, localisation strategy, screenshot copy, final artwork, export files.

## Phase 6: Website

Determine whether a website exists; if not, plan a lightweight launch site. Hero: "PHASE. The rugby management game where the world remembers what you did." Then trailer, download buttons, core features, screenshots, career system, player relationships, tactical depth, world memory, legacy, Discord/community. Pages: Home, About, Features, Download, Support, Privacy, Terms, Contact, Press kit. Tracking: analytics, store click tracking, UTM system, Search Console, SEO basics.

## Phase 7: Discord

Information: #welcome, #announcements, #latest-version, #patch-notes, #known-issues, #faq. Community: #general, #career-stories, #tactics, #transfers, #clubs, #screenshots. Feedback: #suggestions, #bug-reports, #support. Create rules, welcome message, roles, moderation, bug template, feature request template, community guidelines.

## Phase 8: Release automation

Desired flow: GitHub release, release metadata, Discord announcement, website/changelog, social-ready copy, patch notes. Investigate what can be safely automated with the existing GitHub infrastructure. GitHub release to Discord announcement (version, what's new, important fixes, links, release date, platform availability). Also investigate: PR merged to private dev channel; release to changelog; release to website; release to social copy; critical issue to admin Discord; crash alert to admin Discord. No unnecessary infrastructure; simple, reliable automation.

## Phase 9: Social media strategy

Content pillars: PHASE (gameplay/features), STORIES (emergent career stories), RUGBY (relevant discussion), DECISIONS ("What would you do?"), DEVELOPMENT (behind the scenes), COMMUNITY (player stories).

Pre-launch, 3 weeks. Week -3 INTRODUCE: announcement, logo, concept, teaser, gameplay, developer story, core proposition. Week -2 SHOW: recruitment, tactics, matchday, player relationships, transfers, academy, club history, rivalries, consequences. Week -1 COUNTDOWN: 7 days to tomorrow, launch trailer. Launch day: announcement, trailer, store links, website, Discord, Reddit/community outreach, founder post, email. Post-launch content engine: player stories, weird careers, transfers, upsets, bad decisions, tactical debates, "What would you do?", community screenshots, rivalries, development, updates. The emergent stories PHASE produces should become marketing content.

## Phase 10: Content bank

Before launch: 30 social posts, 15 short videos, 10 gameplay clips, 10 decision posts, 10 career/story posts, 5 developer posts, 5 community posts, launch trailer, 30s, 15s, 6s. A sensible calendar; not everything promotional; a rugby/game account that happens to have a game.

## Phase 11: Press / PR

Press kit: logo pack, screenshots, gameplay GIFs, trailer, game description, feature list, developer story, developer bio, platform info, contact, press release, review instructions, press kit landing page. Outreach list: rugby websites, rugby journalists, podcasts, rugby YouTubers, rugby TikTok creators, sports gaming creators, Football Manager creators, mobile gaming creators, indie publications, rugby communities. The pitch is a story, not "please review my game". Find the strongest PHASE story.

## Phase 12: Rugby community

Identify relevant Reddit communities, Facebook groups, X communities, YouTubers, podcasts, journalists, amateur rugby communities, fantasy rugby, rugby gaming, management-game communities. For each: appropriate content, whether promotion is allowed, what value PHASE provides, before or after launch. No spam.

## Phase 13: Creator programme

Categories: rugby, Football Manager, sports gaming, mobile gaming, indie. Build: creator list, contact details, outreach template, review build process, press kit, tracking spreadsheet, follow-up schedule, affiliate/creator tracking if appropriate. Recommend whether codes/affiliates/incentives are worthwhile; do not assume.

## Phase 14: Founding player community

Roughly 20-50 people: rugby fan, management-game player, mobile gamer, non-management player. Create: early tester group, Discord role, feedback channel, bug reporting, structured feedback questions, community recognition. Ask: What did you think you were supposed to do? What happened? Why did it happen? What would you do differently? What made you want to play another match? What confused you? What was your favourite moment? Would you play another season? Use the answers as product evidence.

## Phase 15: Analytics

Audit current architecture; if none, the minimum viable set. Acquisition (store impressions, page views, installs, referral source). Activation (first launch, career started, first match, first season, second season). Retention (D1, D7, D30, seasons 1-3). Engagement (sessions, duration, matches, career length, transfers, tactical changes, player interactions). Monetisation (Pro funnel shown, Pro conversion, intro conversion, full-price conversion, ads, rewarded ads, restore). Technical (crashes, ANRs, purchase failures, save failures, device/OS issues). No invasive tracking; only data that materially helps; consider privacy/GDPR first.

## Phase 16: Customer support

Support email, support page, FAQ, purchase FAQ, restore guide, save troubleshooting, device troubleshooting, known issues, bug-report process, refund guidance, response templates. Answers for: Pro purchased but locked; restore purchase; changed device; career disappeared; game crashes; rewarded ad failed; update problems; language problems; save problems.

## Phase 17: Legal / compliance

Privacy policy, terms, GDPR, UK GDPR, Google Data Safety, Apple App Privacy, advertising disclosures, Ruck permissions/licensing, music licence, font licences, image licences, software licences, open-source notices, third-party SDK inventory, age rating, children's/privacy considerations, account deletion if applicable. Flag anything needing human/legal confirmation; never claim compliance because code looks right.

## Phase 18: Commercial / finance

Dashboard: Downloads, Active Players, Retention, Pro, Revenue. Prepare: Pro pricing, intro pricing, advertising revenue, store fees, VAT/tax, marketing budget, creator budget, advertising budget, software costs, monthly revenue reporting.

## Phase 19: Paid marketing

Do not spend heavily at first. Establish Meta Ads, TikTok Ads, Google Ads, tracking, conversion events, UTM system, creative variants, audiences, landing pages; then test small amounts. Creative concepts: Rugby, Management, Consequences, Stories, "What would you do?". Find what converts before scaling.

## Phase 20: Launch-day runbook

Before release: builds approved, listings ready, website ready, Discord ready, social scheduled, trailer uploaded, press contacted, creator outreach sent, support ready, analytics ready. Release: Google Play live, App Store live, test download, fresh install, purchase, restore, first career, analytics event, website links, Discord announcement, social announcement. First hours, monitor: crashes, ANRs, purchases, reviews, Discord, support, social, download/install issues. Escalation rules.

## Phase 21: Update machine

GitHub, development, QA, release candidate, Play/App Store, approval, release, GitHub Release, Discord, website, social, analytics, player feedback, next release; minimal manual work. Every release has: version, versionCode, release notes, changelog, Discord announcement, social copy, store "What's New", website update where appropriate.

## Phase 22: Post-launch 7-day review

Do not start building features. Analyse downloads, activation, first match, retention, crashes, support issues, reviews, Discord, social, purchase funnel, ad behaviour. What worked, what failed, what confused players, what delighted them, what made them stop, what generated organic sharing.

## Phase 23: 30-day review

D1/D7/D30 retention, season completion, career length, Pro conversion, ad engagement, most/least-used systems, most confusing systems, most common bugs, most requested features, most loved features, reviews, community feedback. Then the next roadmap from evidence.

## Phase 24: 1.9 / post-launch roadmap

Only after launch evidence exists. Every proposed feature must answer: does this create a better decision, consequence, memory or story? If not, challenge it. No features merely because another management game has them.

## Master project management system

Every task: ID, workstream, task, priority, status, owner, dependency, target date, definition of done, URL/file, notes. Statuses: ⬜ NOT STARTED, 🔵 IN PROGRESS, 🟡 BLOCKED, 🟢 DONE, 🔴 BLOCKER, ⏸️ DEFERRED. Priorities: P0 must happen before release; P1 should happen before release; P2 important but can follow launch; P3 future/optional.

A release dashboard at the top (current version, target release, target date, Android, iOS, website, trailer, Discord, marketing, press, analytics, support, legal) and a RELEASE READINESS row per workstream.

For every section: what exists, what is missing, what needs verification, what needs external/manual work, what can be automated, dependencies, priority, definition of done. Remove duplicated work; mark complete items done; mark non-essential items P2/P3 rather than bloating the launch.

**Critical release principle:** once the product passes the final QA gate, stop building gameplay features. The next phase is PRODUCTISE, PACKAGE, MARKET, LAUNCH, MEASURE, LEARN.

## Final output requested

1. Current state. 2. Missing. 3. Release blockers. 4. Master checklist. 5. Dependency map. 6. Timeline (release hardening; store preparation; creative production; marketing infrastructure; pre-launch campaign; launch; first 7 days; first 30 days). 7. Automation plan (GitHub, release, Discord, website, social, changelog: what is automated and what stays manual). 8. Content calendar. 9. Trailer plan. 10. Store plan. 11. Marketing plan (organic, PR, creators, community, paid). 12. Launch day plan. 13. Post-launch plan (7-day and 30-day). 14. Biggest risks. 15. Final release gate: READY TO LAUNCH / NOT READY TO LAUNCH.

The objective: when every P0/P1 item is green, PHASE is genuinely ready to launch.
