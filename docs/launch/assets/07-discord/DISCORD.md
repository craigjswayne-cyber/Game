# PHASE on Discord

Invite: discord.gg/3KKfDVsMb (from `src/game/community.ts`).

## Art (in `final/`)

| File | Where | Size |
|---|---|---|
| `discord-server-icon-512.png` | Server Settings > Overview > icon | 512 x 512 |
| `discord-server-banner-960x540.png` | Server banner (needs Boost level 2) | 960 x 540 |
| `discord-welcome-1600x900.png` | Pinned at the top of #welcome | 1600 x 900 |
| Release header | `04-social/final/launch/LCH-12/LCH-12-wide-1600x900.png` (regenerate per version from `posts.json`) | 1600 x 900 |

The welcome image names #welcome and #bug-reports. Create those channels before
pinning it (launch programme D2).

## Channel layout (from the launch programme, D2)

INFO: #welcome · #announcements · #patch-notes · #known-issues · #faq
HELP: #bug-reports · #support · #suggestions · #feedback
TALK: #general · #careers · #tactics · #rugby

## Templates

Post these as the server, not as a person, except the founder post. Keep the
house style: British English, no em dashes, no exclamation marks.

### #welcome (pinned)

```
**Welcome to the PHASE dressing room.**

PHASE: Rugby Manager is the rugby management game where the world remembers what you did.

**Start here**
• Read #faq. Most questions are answered there.
• Found a bug? Post in #bug-reports with your phone, the game version (Manager menu > About & legal) and what happened.
• Ideas go in #suggestions.
• Share your career in #careers. The strangest ones get featured.

**House rules**
1. Be decent. Disagree about rugby, never about people.
2. No spoilers of other people's careers without asking.
3. No piracy, cheats or leaked builds.
4. English in the main channels; bug reports in any of the game's six languages.

Get PHASE: https://play.google.com/store/apps/details?id=com.phaserugbymanager.app
```

### #announcements: release (generated)

The release workflow posts this automatically from `docs/releases/<version>.md`.
Its shape:

```
**PHASE 1.8.11**

**What's new**
• Ruck joins as our news partner: league news, rumours and law talk now carry the ruck.co.uk byline.
• Adverts moved to quieter spots and never cover a button.
• Advert privacy choices are in Settings.

**Fixes**
• The Back button never closes the game.
• ...

**Available now**
Google Play
```

App Store joins the "Available now" line once iOS is live (add it to
`release.mjs`, one line).

### #patch-notes (full list, by hand when needed)

```
**PHASE X.Y.Z: patch notes**

**What's new**
• 

**Fixes**
• 

**Known issues**
• 

Update through Google Play. Reply in #bug-reports if something's still wrong.
```

### #announcements: general

```
**[Short headline, sentence case]**

[Two or three sentences. What it is, why it matters to a manager, what to do.]

[One link.]
```

### #known-issues (pinned, kept current)

```
**Known issues, PHASE X.Y.Z** (updated [date])

• [What happens] · [who it affects] · [workaround] · [fix expected in]

Not listed? Report it in #bug-reports.
```

### Event or community challenge

```
**This week's challenge: [name]**

[The rule in one line, e.g. "Win a league with a squad average age under 24."]

Post a screenshot of your Manager Legacy in #careers by [day]. The best three go in our next community post, with your permission.
```

### Founder post (owner, in your own voice)

```
I built PHASE because [your reason, one sentence].

The idea is simple: the game should remember what you did. Keep a promise and the player remembers. Break one and every agent hears about it.

It's free on Google Play today. Tell me what you think, honestly, in #feedback. I read everything.

[Name]
```

## Webhook for release automation (owner)

1. Server Settings > Integrations > Webhooks > New Webhook, channel #announcements, name "PHASE", avatar `discord-server-icon-512.png`.
2. Copy the webhook URL.
3. GitHub: repository Settings > Secrets and variables > Actions > New secret, name `DISCORD_RELEASE_WEBHOOK`, value the URL. Never paste it anywhere in the repository.
4. Test: Actions > Release communications > Run workflow, version 1.8.11, post off (dry run). Then once with post on.
