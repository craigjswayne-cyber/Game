# The Discord server, room by room

A build sheet for the PHASE: Rugby Manager community server. Every channel,
role, rule, pinned message and safety setting is written out here so that
setting the server up is copying rather than composing, the same way
`docs/store-listing.md` treats a console form.

Read it once end to end before you touch Discord. The order matters: Community
mode has to be on before half of these channels can exist at all.

---

## 0. What this server is for, and what it can never be

The game collects nothing and sends nothing anywhere. No accounts, no
analytics, no network calls, and `scripts/netprobe.ts` fails the build if one
appears. That is the whole privacy story on both store questionnaires, and it
has one side effect that shapes this server:

**There is no telemetry. The only way to find out what is broken, what is
unbalanced and what players want is for a person to tell you.** Today that is
one e-mail address, `phaserugbymanager@gmail.com`, and the in-game Report a Bug
screen that fills a message for them. Discord is the second door, and it is the
one where players answer each other while you sleep.

Three lines that do not move:

1. **The game never talks to Discord.** No SDK, no rich presence, no webhook,
   no invite fetched at runtime. An invite link may be printed in the About
   screen and in the store listing, because a link the player taps is the
   phone's browser making a request, not the game. Anything more would be the
   first network call in the project and `netprobe` would stop it anyway.
2. **The server is not covered by "collects nothing".** Discord is a third
   party holding messages, usernames and IP addresses. The privacy policy in
   `public/privacy.html` describes the *game*. If the invite goes in the store
   listing, the listing and the policy both need one sentence saying the
   community server is Discord's, run under Discord's own terms and privacy
   policy, and that nothing said there reaches the game. Do that before you
   publish the link, not after.
3. **Removal requests do not live here.** The README promises that anybody
   named in the database who would rather not be can write to the address and
   be removed in the next update. That promise is to an e-mail address. A
   moderator seeing such a request in a channel should answer once, politely,
   with the address, and not treat a Discord message as the request having been
   made. Keep the audit trail in the inbox.

---

## 1. Turn on Community first

Almost everything below (forum channels, the announcement channel, AutoMod,
Onboarding, the Server Guide, Insights, Raid Protection) exists only on a
Community server. Turning Community off later converts every forum channel into
a text channel and flattens the posts, so decide once, now, and leave it on.

**Server Settings → Community → Enable Community**, then work through the
wizard:

| Step | Set it to |
|---|---|
| Verification level | **Medium** at launch (account must be older than 5 minutes). Raise to High (member of this server for 10 minutes) only if you get raided. |
| Explicit media content filter | **Scan media from all members.** Required for Community, and the game is rated 3+ / Everyone. |
| Default notifications | **Mentions only.** A new member who gets pinged by every transfer screenshot leaves. |
| Rules channel | `#rules` (create it first, see §3) |
| Community updates channel | `#staff-updates`, staff-only. This is where Discord posts to you, not where you post to members. |
| Moderator 2FA | **On.** Required, and it is the single highest-value security setting on the server. |

Then, still in Server Settings:

* **Safety Setup → Raid Protection: on.** Alerts go to `#mod-log`.
* **Safety Setup → DM spam protection: on.**
* **Roles → @everyone: turn off** *Mention @everyone, @here and All Roles*,
  *Manage Events*, *Create Invites* (see §4 on why invites are staff-issued at
  launch), and *Use External Apps* if you are not running bots yet.

---

## 2. One language for the server, five for the game

The game ships English, French, Spanish, Italian and Japanese
(`src/locales/`). A server with five general channels and one moderator who
reads two of them is five dead rooms and an unmoderated one.

**The server language is English.** One French channel opens at launch, because
French is the second first-class language of the project and the Top 14 and
Pro D2 are in the game. Spanish, Italian and Japanese channels open when, and
only when, there is a named volunteer moderator who reads that language and
enough traffic to justify it. Until then those players are welcome in English
and in `#translations`, which is the channel where their language actually
helps you.

Do not machine-translate the rules. If a French rules post goes up it should be
written by whoever wrote the French glossary, with the same no-break spaces
discipline the game already applies.

---

## 3. The channel map

Twenty channels. Fewer than you want, which is right: a small busy server reads
as alive and a large quiet one reads as abandoned, and Discord's cap is 500
channels and 50 categories, so there is room to grow later.

### 📌 START HERE

| Channel | Type | Who can post | What it is |
|---|---|---|---|
| `#welcome` | Text, read-only | Staff | One pinned post: what the game is, where to get it, where to go next. Set as the Server Guide landing. |
| `#rules` | Text, read-only | Staff | The Community rules channel. Text in §6. |
| `#announcements` | **Announcement** | Staff | Patch notes, store releases, downtime on nothing (there is no server to go down). Other servers can follow it. |
| `#roll-of-honour` | Text, read-only | Staff | Occasional: the best career story of the month, the strangest scoreline, a fix that came from a player. Cheap, and it makes people post. |

### 🏉 THE GAME

| Channel | Type | Who can post | What it is |
|---|---|---|---|
| `#general` | Text | Everyone | Rugby and the game, mixed. The room that decides whether the server lives. |
| `#match-day` | Text | Everyone | Scorelines, last-minute drop goals, screenshots of the live text. Slowmode off; this is the fun one. |
| `#tactics-and-selection` | Text | Everyone | Bomb squad arguments, 6/2 versus 5/3, who to pick at 13. The `a18` in-game answer already has an opinion on this. |
| `#transfers-and-squads` | Text | Everyone | Bids, negotiations, free agents, the one prop everybody wants. |
| `#career-diaries` | **Forum** | Everyone | One thread per save. Tags: `Premiership`, `Top 14`, `URC`, `Championship`, `Pro D2`, `Nationale`, `Super Rugby Pacific`, `League One`, `Long-term`. The single best retention channel a management game can have. |
| `#screenshots` | Text | Everyone | Media-only. Turn off embeds/links for @everyone if it gets spammy. |

### 🛠 FEEDBACK

| Channel | Type | Who can post | What it is |
|---|---|---|---|
| `#bug-reports` | **Forum** | Everyone | One thread per bug. Tags: `Open`, `Needs info`, `Reproduced`, `Fixed next build`, `Fixed`, `Not a bug`, `Duplicate`. Pinned post in §7. |
| `#feature-requests` | **Forum** | Everyone | One thread per idea. Tags: `Under consideration`, `Planned`, `Shipped`, `Not planned`. React with 🏉 to support; the reaction count is the vote. |
| `#balance-and-realism` | Text | Everyone | Scoreline distributions, ratings arguments, "no Championship side wins that away". `scripts/disttest.ts` output belongs in here when you run it. |
| `#translations` | Text | Everyone | Wrong wording in fr/es/it/ja, missing no-break spaces, a rugby term that no French coach would ever use. Cheap fixes with high visible value. |
| `#help` | Text | Everyone | Saves, imports, exports, "I changed phone". Points at the export/import and share-sheet backup. |

### 🌍 LANGUE

| Channel | Type | Who can post | What it is |
|---|---|---|---|
| `#français` | Text | Everyone | Général en français. Les mêmes règles s'appliquent. |

### 🔊 VOICE

| Channel | Type | Who can post | What it is |
|---|---|---|---|
| `Clubhouse` | Voice | Everyone | One voice room. Two is one too many until the first one is ever full. |

### 🔒 STAFF

| Channel | Type | Who can post | What it is |
|---|---|---|---|
| `#staff-chat` | Text, private | Staff | Everything not for members. |
| `#staff-updates` | Text, private | Staff | The Community Updates channel. Discord writes here. |
| `#mod-log` | Text, private | Staff | AutoMod hits, Raid Protection alerts, bans and why. Every action gets a line, including yours. |

That is 20 channels and 6 categories, well inside every limit, and 13 of them
are visible and writable by `@everyone`, which clears the Onboarding
requirement (§5) with room to spare.

---

## 4. Roles

Discord allows 250 roles. You need six.

| Role | Colour | Who gets it | Permissions |
|---|---|---|---|
| **Admin** | Deep forest green | You | Administrator. One holder. 2FA on the account, no exceptions. |
| **Moderator** | Parchment | Two people you actually know, once the server passes ~200 members | Manage Messages, Manage Threads, Kick, Timeout, Mute members. **Not** Ban, **not** Manage Roles, **not** Manage Channels: a compromised mod account should not be able to end the server. |
| **Translator** | Muted gold | A named volunteer per language | Nothing extra. It is a badge that tells you who to ask, and tells members whose wording correction to trust. |
| **Beta** | Slate | Members on the Play closed-testing track | Access to a temporary `#beta` channel when a build is in test. Delete the channel between builds rather than leaving a dead room. |
| **Supporter** | Bronze | See the warning below | Nothing extra. A colour and a thank-you. |
| **@everyone** | - | Everyone | Trimmed as in §1. |

**On the Supporter role, read this before you promise it.** The game has no
accounts and no network, `src/game/monetise.ts` holds no transport, and a
purchase is a receipt on the player's own device. **You cannot verify a
purchase from Discord.** The only honest options are a manual check, where a
player DMs a moderator a store receipt screenshot and a human grants the role,
or not offering the role at all. Do not build anything that looks like
automatic entitlement, and never let a Supporter role gate a channel that
contains support or bug reporting. Paying should buy game content, not the
right to be answered.

Anyone claiming to be staff who is not in this table is not staff. Say so in
the rules, because impersonation is the most common attack on a small game
server.

**Invites:** at launch, only staff can create them, and the public invite is
one permanent link that you publish yourself. If it ever gets posted somewhere
you did not choose, you delete that one link and issue another, and everything
you printed stays fixable because you only printed one thing.

---

## 5. Onboarding

**Server Settings → Onboarding.** Historically this needed at least 7 default
channels with at least 5 writable by `@everyone`; Discord has been relaxing
that requirement, so the dialog may ask for less. Either way the map in §3
clears it.

Set **Default Channels** to `#welcome`, `#rules`, `#announcements`, `#general`,
`#match-day`, `#bug-reports`, `#career-diaries`, `#help`.

Two questions, both opt-in, both cosmetic. They exist to make a new member
click something in their first thirty seconds, which is most of what onboarding
is for.

**Question 1 (multi-select): "Which league are you managing in?"**

| Answer | Emoji | Grants |
|---|---|---|
| Premiership | 🌹 | role `Premiership` |
| Top 14 | 🐓 | role `Top 14` |
| URC | ☘️ | role `URC` |
| Super Rugby Pacific | 🌊 | role `Super Rugby` |
| League One | 🌸 | role `League One` |
| Second tier, the hard way | 🪜 | role `Championship / Pro D2 / Nationale` |

**Question 2 (single-select): "What brought you here?"**

| Answer | Emoji | Opts into |
|---|---|---|
| I play the game | 🏉 | `#general`, `#match-day`, `#career-diaries` |
| I found a bug | 🐛 | `#bug-reports`, `#help` |
| I have an idea | 💡 | `#feature-requests`, `#balance-and-realism` |
| My language needs fixing | 🌍 | `#translations`, `#français` |

None of these gate anything. Every channel above is visible to everyone
anyway; the answer only decides what is already unmuted on the way in.

---

## 6. The rules, word for word

Paste into `#rules`. Eight rules, short enough to be read, specific enough to
be enforced. It is 1,868 characters, inside Discord's 2,000-character message
limit but not by much: count again if you edit it, or it posts truncated.

```
🏉 PHASE: Rugby Manager - server rules

1. Be decent. Argue about the 6/2 bench, not about each other. No harassment,
   no slurs, no pile-ons.

2. Keep it 3+. The game is rated Everyone. Nothing sexual, nothing gory,
   nothing you would not put on a club noticeboard.

3. This is an unofficial, independent game. Clubs, competitions, grounds and
   sponsors in the game are fictional. Do not post official club badges, kits
   or league logos here, and do not ask for them to be added. It is the one
   thing that could end both the game and this server.

4. Real people. Player names are real, used to identify people in a sporting
   database and nothing else. Talk about them as sportspeople. Nothing about
   anyone's private life. If you are a player, or acting for one, and want a
   name removed, e-mail phaserugbymanager@gmail.com and it goes in the next
   update. A message here is not a request; the e-mail is.

5. No piracy, no cracked builds, no modified APKs, no "free unlock" links.
   Instant ban, no appeal.

6. One post is enough. No cross-posting the same bug into four channels, no
   DMing staff a bug that belongs in #bug-reports, no advertising other
   servers or products without asking first.

7. Staff are: @Admin and @Moderator, and that is the complete list. Nobody
   from this server will ever DM you first asking for money, a login, a
   receipt or a file. Report anyone who does.

8. English in the main channels, French in #français. Wrong wording in any of
   the five game languages belongs in #translations, and is genuinely
   welcome.

Moderation: a word, then a timeout, then a ban. Rules 3, 4 and 5 skip
straight to the end. Appeals go to phaserugbymanager@gmail.com.

Nothing said here reaches the game. The game collects nothing and sends
nothing anywhere; this server is Discord's, under Discord's terms and
privacy policy.
```

---

## 7. Pinned messages, word for word

All five fit in a single Discord message (865, 1,117, 795, 491 and 331
characters against the 2,000 limit), so none of them needs splitting.

### `#welcome`

```
Welcome to PHASE: Rugby Manager 🏉

A classic-style rugby union management game for mobile: 8 competitions,
100+ clubs, ~1,600 real players, live-text match day, and careers that run
for a decade.

The game collects nothing and sends nothing anywhere. No accounts, no
analytics, no network calls at all. Your careers live on your phone, with
export, import and a share-sheet backup.

Start here:
📜 #rules - eight of them, thirty seconds
📣 #announcements - patch notes land here
🏉 #general - say hello, tell us who you took over
📖 #career-diaries - one thread per save, and the best room on the server
🐛 #bug-reports - read the pinned post first, it makes bugs fixable
💡 #feature-requests - react 🏉 on the ones you want

This is an unofficial, independent game. Clubs, competitions, grounds and
sponsors are fictional and no official badge, kit or logo ships with it.
```

### `#bug-reports` (post guidelines)

```
Read this before posting. It is the difference between a bug that gets
fixed this week and one that never gets found.

The game builds the report for you. In-game: ⚙️ → Report a Bug. It gathers
the build number, the career, the last screens you were on and the seed,
which is the one field that lets your career be rebuilt from scratch here.
It attaches no player names, no manager name, no squad and no save file,
and it sends nothing anywhere: you read the whole thing on screen, then
copy it.

Paste that block into your post. Then add, in your own words:

  What you did:
  What you expected:
  What happened instead:
  Every time, or only once?

One bug per thread. If it is already here, add to that thread instead of
opening a new one; a second person saying "me too, on a Pixel 8" is worth
more than a second thread.

Tags get set by staff: Open → Needs info → Reproduced → Fixed next build →
Fixed. If your thread goes quiet on Needs info, that is a question waiting
for you.

Save corruption, a career you cannot load, anything that eats progress:
post it and say so in the first line. That jumps the queue.
```

### `#feature-requests`

```
One idea per thread. Title it as the thing you want, not as a complaint:
"Let me see a player's form over the last 5 games", not "the form display
is useless".

React 🏉 on threads you want. That count is how the list gets ordered.

Tags are set by staff: Under consideration, Planned, Shipped, Not planned.
Not planned is not a snub. It usually means it would need the game to talk
to a server, and this game never will.

Things that will always be Not planned:
- Official club badges, kits or league logos. The game is unofficial and
  everything in it is fictional by design.
- Accounts, cloud saves, online leagues, leaderboards. All of them need a
  network call, and the game has never made one.
- Anything paid that changes the simulation. Nothing behind the till
  touches a match result.
```

### `#translations`

```
The game ships English, French, Spanish, Italian and Japanese.

Post: the language, the screen, what it currently says, and what it should
say. A screenshot helps. Rugby terms matter more than grammar here: if no
coach in your country would ever say it that way, that is a bug, and one
that a native speaker can spot in a second and a developer never will.

French: the glossary keeps no-break spaces before ; : ! ? and inside
guillemets. If you see one missing, that is worth reporting too.
```

### `#career-diaries`

```
One thread per save. Tag it with the league you are in.

What makes a good diary: the state of the club when you took over, what
you said you would do, and then what actually happened. Screenshots of the
league table, the inbox, the day the board lost patience.

Nobody minds a diary that ends in the sack. Those are the good ones.
```

---

## 8. AutoMod

**Server Settings → AutoMod.** Four rules, all logging to `#mod-log`, none of
them silently deleting anything a moderator will not see.

| Rule | Action | Why |
|---|---|---|
| Block spam content | Block message, alert `#mod-log` | Discord's own model. Free, and it catches the join-and-post-a-link accounts. |
| Block mention spam, threshold 5 | Block message, timeout 5 minutes, alert | Standard raid behaviour. |
| Custom keyword: slurs and the usual list | Block message, alert | Use Discord's preset word lists plus anything you have actually seen. |
| Custom keyword: `free nitro`, `steamcommunity`, `.ru/`, `discord-gift`, `airdrop` | Block message, alert | Scam links are the one attack a game server of this size reliably gets. |

Exempt the `Moderator` role from all four so a mod quoting a scam link in
`#mod-log` does not trip the filter.

Do not add a "no swearing" filter. The audience argues about rugby.

---

## 9. Where the invite goes

Once the server is built, and only then:

* `src/ui/screens/About.tsx`, next to the existing contact line, as an external
  link. Add the string to all five files in `src/locales/`, and run the build:
  `scripts/netprobe.ts` sweeps for absolute URLs, so check the invite is
  allowed as a link and not flagged as a fetch. If netprobe objects, keep the
  invite out of the app rather than loosening the probe.
* `docs/store-listing.md`, in the long description, one line. Re-count the
  characters; the file warns that both consoles silently truncate.
* `README.md`, under the contact address.
* `public/privacy.html`, one sentence per §0.2.

A vanity URL needs Level 3 boost and is not worth buying at launch. Use the
permanent invite, publish exactly one, and keep it in the four places above so
that rotating it is a four-line change.

---

## 10. Launch checklist

- [ ] Server created, 2FA on the owner account
- [ ] Community enabled, all six wizard settings as §1
- [ ] Raid Protection and DM spam protection on
- [ ] `@everyone` permissions trimmed, invites staff-only
- [ ] 6 categories, 20 channels created as §3
- [ ] `#announcements` set as an Announcement channel
- [ ] `#bug-reports`, `#feature-requests`, `#career-diaries` created as Forum channels, tags added
- [ ] Roles created as §4, Supporter decision made and written down
- [ ] Onboarding configured, both questions, default channels set
- [ ] Rules posted in `#rules`
- [ ] Five pinned posts from §7 posted and pinned
- [ ] Four AutoMod rules live, Moderator role exempt
- [ ] Server Guide filled: 3 resource pages pointing at `#rules`, `#bug-reports`, `#career-diaries`
- [ ] Icon and banner: the game's icon from `public/icon.svg`, deep forest green
- [ ] Privacy policy sentence added before the invite is published anywhere
- [ ] Invite published in the four places in §9

---

## 11. The first month

A new server is quiet, and a quiet server that its owner has stopped visiting
never recovers. Three habits carry it:

1. **Answer every bug thread within a day, even if the answer is "not yet".**
   The tags exist so that a player can see their report moved. A bug that gets
   `Reproduced` in twelve hours buys more goodwill than the fix does.
2. **Post the patch notes in `#announcements` before the store listing updates.**
   People who are in a Discord for a game want to know first. It costs nothing
   and it is the only exclusive you can honestly offer.
3. **Start the first three career diaries yourself.** Take over a Championship
   side, post the table every few weeks, get sacked in public. An empty forum
   channel stays empty; three threads is a room.

And one thing not to do: do not open more channels because it is quiet. Quiet
is a traffic problem, and every extra room divides the traffic you have. The
map in §3 supports a thousand members without a single new channel.
