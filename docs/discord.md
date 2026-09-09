# Building the Discord server, step by step

A build guide for the PHASE: Rugby Manager community server. Fifteen steps in
click order, with every value, every channel name and every block of copy
written out, so that building the server is copying rather than composing, the
same way `docs/store-listing.md` treats a console form.

Set aside **about an hour**. Do the steps in order: roles have to exist before
channels can reference them, and Community has to be on before half the
channels can exist at all.

**What you need in front of you:** a Discord account with 2FA already on, this
document, and `public/icon.svg` for the server icon.

---

## What this server is for, and what it can never be

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
   `public/privacy.html` describes the *game*. Before the invite is published
   anywhere, the policy and the listing each need one sentence saying the
   community server is Discord's, run under Discord's own terms and privacy
   policy, and that nothing said there reaches the game.
3. **Removal requests do not live here.** The README promises that anybody
   named in the database who would rather not be can write to the address and
   be removed in the next update. That promise is to an e-mail address. A
   moderator seeing such a request in a channel should answer once, politely,
   with the address, and not treat a Discord message as the request having been
   made. Keep the audit trail in the inbox.

---

## Step 0. Five decisions, before you click anything

Each of these changes what you build. Decide them now, write the answers down,
and the next fourteen steps are mechanical.

| Decision | Recommended | Why it matters |
|---|---|---|
| **Server name** | `PHASE: Rugby Manager` | Matches the store listing exactly. A community that has to guess whether it found the right server has already half left. |
| **Supporter role** | Manual receipt check, or nothing | You **cannot** verify a purchase from Discord. See Step 5. |
| **Who moderates each language** | Name a person per language, or accept English-only replies | Five language rooms with nobody reading four of them is worse than one. See "Five languages, one moderator" below. |
| **Invites** | Staff-only, one permanent public link | One link means rotating it is a four-line change, not a search of everything you ever published. |
| **Privacy sentence** | Written before launch, not after | It has to be live before the invite is published. Step 14. |

---

## Step 1. Create the server and lock your own account

1. **Add a Server → Create My Own → For a club or community.**
2. Name it as decided in Step 0. Icon can wait until Step 13.
3. **User Settings → My Account → Enable Two-Factor Auth**, on your own
   account, now. Every later step assumes it, and Community mode will demand it
   of moderators anyway.
4. Delete the default `#general` and `General` voice channel that Discord
   creates. You are building the full map in Step 6 and a stray default channel
   in the wrong category is the kind of thing nobody ever gets round to fixing.

---

## Step 2. Enable Community

Forum channels, the announcement channel, AutoMod, Onboarding, the Server
Guide, Insights and Raid Protection all exist **only** on a Community server.
Turning Community off later converts every forum channel into a text channel
and flattens the posts, so decide once, now, and leave it on.

Community needs a rules channel and an updates channel to point at, so create
two placeholder text channels first: `rules` and `staff-updates`. Step 6 builds
the rest around them.

**Server Settings → Community → Enable Community**, then work through the
wizard:

| Wizard step | Set it to |
|---|---|
| Verified email requirement | **On.** Required. It blocks most throwaway and bot accounts. |
| Explicit media content filter | **Scan media from all members.** Required, and the game is rated 3+ / Everyone. |
| Rules channel | `rules` |
| Community updates channel | `staff-updates` |
| Default notifications | **Mentions only.** A new member pinged by every transfer screenshot leaves. |
| Moderator 2FA | **On.** Required, and the single highest-value security setting on the server. |
| Verification level | **Medium** at launch: the account must be older than 5 minutes. Raise to High only if you get raided. |

---

## Step 3. Safety settings

**Server Settings → Safety Setup:**

* **Raid Protection: on.** Alerts go to `#mod-log` once it exists (Step 6);
  come back and set the channel then.
* **DM spam protection: on.**
* Leave **Discovery** off. A server nobody can find yet is a server nobody can
  raid yet, and you can turn it on when there is something to discover.

---

## Step 4. Trim @everyone

**Server Settings → Roles → @everyone.** Turn **off**:

* Mention @everyone, @here and All Roles
* Manage Events
* Create Invites
* Use External Apps, if you are not running bots yet

Leave on: View Channels, Send Messages, Embed Links, Attach Files, Add
Reactions, Read Message History, Use Application Commands, Connect, Speak.

Turning off Create Invites is what makes the single-public-link policy from
Step 0 real rather than aspirational.

---

## Step 5. Create the roles

Roles before channels: channel permissions reference roles, and building them
the other way round means going back through 23 channels.

Discord allows 250 roles. Five of these carry permissions. The other eleven are
colours and labels that Onboarding hands out in Step 11, and they cost nothing.

### The five that carry permissions

| Role | Colour | Who gets it | Permissions |
|---|---|---|---|
| **Admin** | `#0f7a43` deep green | You, alone | Administrator. 2FA on the account, no exceptions. |
| **Moderator** | `#e9be68` gold | Two people you actually know, once the server passes ~200 members | Manage Messages, Manage Threads, Kick Members, Timeout Members, Mute Members. **Not** Ban, **not** Manage Roles, **not** Manage Channels: a compromised mod account should not be able to end the server. |
| **Translator** | `#8a6516` bronze | A named volunteer per language, verified by you | No extra permissions. It tells you who to ask, and tells members whose wording correction to trust. |
| **Beta** | `#5aa9e6` blue | Members on the Play closed-testing track | Access to a temporary `#beta` channel when a build is in test. Delete that channel between builds rather than leaving a dead room. |
| **Supporter** | `#c0362c` red | See the warning below | No extra permissions. A colour and a thank-you. |

**Before you promise a Supporter role.** The game has no accounts and no
network, `src/game/monetise.ts` holds no transport, and a purchase is a receipt
on the player's own device. **You cannot verify a purchase from Discord.** The
only honest options are a manual check, where a player DMs a moderator a store
receipt screenshot and a human grants the role, or not offering the role at
all. Do not build anything that looks like automatic entitlement, and never let
a Supporter role gate a channel that contains support or bug reporting. Paying
should buy game content, not the right to be answered.

### The five language roles

Self-selected in Onboarding. Their real job is that you can ask
`@Español, does this wording read right to you?` and reach exactly the people
who can answer.

| Role | Colour |
|---|---|
| 🇬🇧 English | default grey |
| 🇫🇷 Français | default grey |
| 🇪🇸 Español | default grey |
| 🇮🇹 Italiano | default grey |
| 🇯🇵 日本語 | default grey |

### The six league roles

Self-selected in Onboarding, purely cosmetic: `Premiership`, `Top 14`, `URC`,
`Super Rugby`, `League One`, `Second tier`.

**Order matters.** Drag the list so it reads, top to bottom: Admin, Moderator,
Translator, Beta, Supporter, the language roles, the league roles, @everyone.
Discord takes a member's colour from their highest role.

### Anyone claiming to be staff who is not in that first table is not staff

Say so in the rules. Impersonation is the most common attack on a small game
server, and Rule 7 in Step 9 is the sentence that lets a member recognise it.

---

## Step 6. Create the categories and channels

Twenty-three channels in six categories. Fewer than you want, and that is
right: a small busy server reads as alive and a large quiet one reads as
abandoned. Discord's cap is 500 channels and 50 categories, so there is room to
grow later.

Discord forces text channel names to lowercase and turns spaces into hyphens.
Names are capped at 100 characters. Emoji are allowed, and the flags below are
part of the name.

### 📌 START HERE

| Channel | Type | Who posts | What it is |
|---|---|---|---|
| `welcome` | Text, read-only | Staff | One pinned post: what the game is, where to go next. The Server Guide landing. |
| `rules` | Text, read-only | Staff | Already created in Step 2. Text in Step 9. |
| `announcements` | **Announcement** | Staff | Patch notes and store releases. Other servers can follow it. |
| `roll-of-honour` | Text, read-only | Staff | The career story of the month, the strangest scoreline, a fix that came from a player. Cheap, and it makes people post. |

### 🏉 THE GAME

| Channel | Type | Who posts | What it is |
|---|---|---|---|
| `general` | Text | Everyone | Rugby and the game, mixed. The room that decides whether the server lives. |
| `match-day` | Text | Everyone | Scorelines, last-minute drop goals, screenshots of the live text. Slowmode off; this is the fun one. |
| `tactics-and-selection` | Text | Everyone | Bomb squad arguments, 6/2 versus 5/3, who to pick at 13. |
| `transfers-and-squads` | Text | Everyone | Bids, negotiations, free agents, the one prop everybody wants. |
| `career-diaries` | **Forum** | Everyone | One thread per save. The best retention channel a management game can have. |
| `screenshots` | Text | Everyone | Media only. Turn off embeds and links for @everyone if it gets spammy. |

### 🌍 YOUR LANGUAGE

The game ships five languages, so feedback has five front doors. **This is
where a player writes in their own language**, and it is the first thing a
non-English speaker sees that says the game is theirs too.

| Channel | Language | Windows note |
|---|---|---|
| `🇬🇧-feedback-english` | English | shows as `GB` |
| `🇫🇷-retours-français` | French | shows as `FR` |
| `🇪🇸-comentarios-español` | Spanish | shows as `ES` |
| `🇮🇹-feedback-italiano` | Italian | shows as `IT` |
| `🇯🇵-フィードバック` | Japanese | shows as `JP` |

**Why the language name is in the channel name and not just the flag.** Windows
has no flag emoji: Segoe UI Emoji renders 🇫🇷 as the two letters `FR`. A
channel called `🇫🇷` alone is a pair of letters to every Windows member, which
is most of them on desktop. Flag plus word reads correctly on every platform,
which is what the flag is for.

If Discord refuses a character when you type the name, drop the accents rather
than the word: `français` → `francais`, `español` → `espanol`. The Japanese
channel is katakana and needs no fallback.

### 🛠 TRACKED FEEDBACK

The language rooms are where a report arrives. These are where it becomes work
with a state you can see. Anyone can open a thread here in English; a
translator or moderator carries over anything that arrived in another language
and links back to it.

| Channel | Type | Tags |
|---|---|---|
| `bug-reports` | **Forum** | `Open`, `Needs info`, `Reproduced`, `Fixed next build`, `Fixed`, `Not a bug`, `Duplicate` |
| `feature-requests` | **Forum** | `Under consideration`, `Planned`, `Shipped`, `Not planned` |
| `balance-and-realism` | Text | Scoreline distributions, ratings arguments. `scripts/disttest.ts` output belongs in here. |
| `help` | Text | Saves, imports, exports, "I changed phone". |

### 🔊 VOICE

| Channel | Type | What it is |
|---|---|---|
| `Clubhouse` | Voice | One voice room. Two is one too many until the first one is ever full. |

### 🔒 STAFF

| Channel | Type | What it is |
|---|---|---|
| `staff-chat` | Text, private | Everything not for members. |
| `staff-updates` | Text, private | Created in Step 2. Discord writes here; you do not. |
| `mod-log` | Text, private | AutoMod hits, Raid Protection alerts, bans and why. Every action gets a line, including yours. |

That is 23 channels and 6 categories, and 19 of them are visible and writable
by `@everyone`, which clears the Onboarding requirement in Step 11 several
times over.

---

## Step 7. Forum channels and their tags

Three channels have to be created as **Forum** channels, not converted later:
`career-diaries`, `bug-reports` and `feature-requests`.

For each: **create channel → Forum → Create.** Then **Edit Channel → Tags**,
and add:

| Forum | Tags, in this order |
|---|---|
| `career-diaries` | Premiership, Top 14, URC, Championship, Pro D2, Nationale, Super Rugby Pacific, League One, Long-term |
| `bug-reports` | Open, Needs info, Reproduced, Fixed next build, Fixed, Not a bug, Duplicate |
| `feature-requests` | Under consideration, Planned, Shipped, Not planned |

On `bug-reports` and `feature-requests`, tick **"Moderators only"** on every tag
except none of them: members choose nothing, staff set the state. On
`career-diaries`, leave the tags open so a player tags their own diary with
their league.

Set `announcements` to an Announcement channel too: **Edit Channel → enable
Announcement Channel**.

---

## Step 8. Lock the private channels

For each of `staff-chat`, `staff-updates` and `mod-log`:

**Edit Channel → Permissions → Private Channel**, then add `Admin` and
`Moderator`.

Then the read-only ones. For `welcome`, `rules`, `announcements` and
`roll-of-honour`: **Permissions → @everyone → Send Messages: off**. Leave Add
Reactions on in `announcements`, so people can react to a release without
cluttering it.

Finally, go back to **Safety Setup** and point Raid Protection alerts at
`#mod-log`.

---

## Step 9. Post the rules

Paste into `#rules`. Eight rules, short enough to be read, specific enough to
be enforced. It is 1,900 characters, inside Discord's 2,000-character message
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
   DMing staff a bug that belongs in a feedback room, no advertising other
   servers or products without asking first.

7. Staff are: @Admin and @Moderator, and that is the complete list. Nobody
   from this server will ever DM you first asking for money, a login, a
   receipt or a file. Report anyone who does.

8. Write in whichever of the five game languages you like, in the room with
   your flag on it. Replies may come back in English, and a wording fix in
   any language is genuinely welcome.

Moderation: a word, then a timeout, then a ban. Rules 3, 4 and 5 skip
straight to the end. Appeals go to phaserugbymanager@gmail.com.

Nothing said here reaches the game. The game collects nothing and sends
nothing anywhere; this server is Discord's, under Discord's terms and
privacy policy.
```

---

## Step 10. Post and pin the guides

Ten posts. Every one fits in a single Discord message. Pin each one in its own
channel.

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
🌍 Your language - five rooms, one per game language, pick your flag
🐛 #bug-reports - where a bug becomes a thread you can follow

This is an unofficial, independent game. Clubs, competitions, grounds and
sponsors are fictional and no official badge, kit or logo ships with it.
```

### `#bug-reports`

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

Not comfortable writing it in English? Post it in your own language in the
🌍 rooms instead and it will be carried over here.

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

### `#career-diaries`

```
One thread per save. Tag it with the league you are in.

What makes a good diary: the state of the club when you took over, what
you said you would do, and then what actually happened. Screenshots of the
league table, the inbox, the day the board lost patience.

Nobody minds a diary that ends in the sack. Those are the good ones.
```

### `#roll-of-honour`

```
The month's best, posted here and nowhere else.

The career worth reading, the scoreline nobody believed, the bug report
that was so good it got fixed the same day, the wording fix that made the
French edition better.

If something in another channel deserves to be here, tell a moderator.
```

---

### The five language rooms

Same post, five languages. Each one is pinned in the channel with its flag.

**These are drafts by a non-native writer.** Before you pin the French,
Spanish, Italian and Japanese versions, have a native speaker read them, the
same way the game's own glossary was checked. A community's first impression of
its own language room is not the place for a wrong preposition.

#### `🇬🇧-feedback-english`

```
🇬🇧 Feedback in English

Bugs, wording, ideas: post them here.

For a bug, the game writes the report for you: ⚙️ → Report a Bug. It carries
the build, the career, the last screens and the seed, and no player names and
no save file. It sends nothing anywhere: you read it on screen, then paste it
here.

Anything that needs tracking gets a thread in #bug-reports, where the tags say
where it has got to. Everything else can just stay here.
```

#### `🇫🇷-retours-français`

```
🇫🇷 Vos retours en français

Écrivez ici en français : bugs, fautes de traduction et idées.

Pour un bug, le jeu rédige le rapport à votre place : ⚙️ → Report a Bug. Il
contient la version, la carrière, les derniers écrans et la graine, et ne
contient ni nom de joueur ni sauvegarde. Rien n'est envoyé nulle part : vous
lisez le tout à l'écran, puis vous le collez ici.

La réponse pourra vous arriver en anglais. Le rapport sera repris dans
#bug-reports sous forme de fil en anglais, pour que vous puissiez en suivre
l'avancement.

Le glossaire français tient aux espaces insécables devant ; : ! ? et dans les
guillemets. S'il en manque une, c'est un bug aussi.

Ce jeu est non officiel et indépendant. Les clubs et les compétitions sont
fictifs.
```

#### `🇪🇸-comentarios-español`

```
🇪🇸 Comentarios en español

Escribe aquí en español: fallos, textos mal traducidos e ideas.

Si es un fallo, el juego escribe el informe por ti: ⚙️ → Report a Bug. Incluye
la versión, la partida, las últimas pantallas y la semilla, y no incluye
nombres de jugadores ni tu partida guardada. No se envía a ninguna parte: lo
lees entero en pantalla y luego lo pegas aquí.

Puede que te respondamos en inglés. El informe se llevará a #bug-reports como
hilo en inglés, para que puedas seguir su estado.

Este es un juego no oficial e independiente. Los clubes y las competiciones son
ficticios.
```

#### `🇮🇹-feedback-italiano`

```
🇮🇹 Feedback in italiano

Scrivi qui in italiano: bug, traduzioni sbagliate e idee.

Se è un bug, il gioco prepara la segnalazione per te: ⚙️ → Report a Bug.
Contiene la versione, la carriera, le ultime schermate e il seed, e non
contiene né nomi di giocatori né il tuo salvataggio. Non viene inviata da
nessuna parte: la leggi per intero sullo schermo e poi la incolli qui.

Potremmo risponderti in inglese. La segnalazione verrà portata in #bug-reports
come discussione in inglese, così puoi seguirne lo stato.

Questo è un gioco non ufficiale e indipendente. I club e le competizioni sono
di fantasia.
```

#### `🇯🇵-フィードバック`

```
🇯🇵 日本語でのフィードバック

バグ、翻訳の誤り、ご要望は、この部屋に日本語で書いてください。

バグの場合は、ゲーム内の ⚙️ → Report a Bug で本文が自動的に作られます。
ビルド番号、キャリア、直前の画面、シード値だけが含まれ、選手名やセーブデータは
含まれません。どこにも送信されないので、画面で全文を確認してから、ここに
貼り付けてください。

返信は英語になることがあります。内容は #bug-reports に英語のスレッドとして
引き継ぎ、そこで進み具合を追えるようにします。

このゲームは非公式・独立した作品です。クラブや大会は架空のものです。
```

---

## Step 11. Onboarding

**Server Settings → Onboarding.** Discord's API documentation states the
requirement as at least 7 default channels with at least 5 of them writable by
`@everyone`; the in-app dialog has been relaxing this, so it may ask for less.
Either way the map in Step 6 clears it several times over.

**Default channels:** `welcome`, `rules`, `announcements`, `general`,
`match-day`, `career-diaries`, `bug-reports`, `help`, and all five 🌍 language
channels.

Two questions. Both are opt-in and neither gates anything: every channel above
is visible to everyone anyway, and the answer only decides what is already
unmuted on the way in.

### Question 1, single-select: "Which language do you play in?"

This is the one that earns its place. It puts a new member in their own
language room before they have typed anything.

| Answer | Emoji | Grants | Opts into |
|---|---|---|---|
| English | 🇬🇧 | role `🇬🇧 English` | `🇬🇧-feedback-english` |
| Français | 🇫🇷 | role `🇫🇷 Français` | `🇫🇷-retours-français` |
| Español | 🇪🇸 | role `🇪🇸 Español` | `🇪🇸-comentarios-español` |
| Italiano | 🇮🇹 | role `🇮🇹 Italiano` | `🇮🇹-feedback-italiano` |
| 日本語 | 🇯🇵 | role `🇯🇵 日本語` | `🇯🇵-フィードバック` |

### Question 2, multi-select: "Which league are you managing in?"

| Answer | Emoji | Grants |
|---|---|---|
| Premiership | 🌹 | role `Premiership` |
| Top 14 | 🐓 | role `Top 14` |
| URC | ☘️ | role `URC` |
| Super Rugby Pacific | 🌊 | role `Super Rugby` |
| League One | 🌸 | role `League One` |
| Second tier, the hard way | 🪜 | role `Second tier` |

---

## Step 12. AutoMod

**Server Settings → AutoMod.** Four rules, all alerting to `#mod-log`, none of
them silently deleting anything a moderator will not see. Exempt the
`Moderator` role from all four, so a mod quoting a scam link in the log does not
trip the filter.

| Rule | Action | Why |
|---|---|---|
| Block spam content | Block message, alert | Discord's own model. Free, and it catches the join-and-post-a-link accounts. |
| Block mention spam, threshold 5 | Block, timeout 5 min, alert | Standard raid behaviour. |
| Custom keyword: slurs and the usual list | Block message, alert | Discord's preset word lists plus anything you have actually seen. |
| Custom keyword: `free nitro`, `steamcommunity`, `.ru/`, `discord-gift`, `airdrop` | Block message, alert | Scam links are the one attack a game server of this size reliably gets. |

**AutoMod is the reason five language rooms are survivable.** Its spam and
scam-link rules do not care what language the message is in, so the rooms you
cannot read are still protected from the thing that actually attacks them.

Do not add a no-swearing filter. The audience argues about rugby.

---

## Step 13. Server Guide, icon and banner

* **Server Settings → Server Guide → Resource Pages:** three of them, pointing
  at `#rules`, `#bug-reports` and the 🌍 category.
* **New Member To-Dos:** `#welcome`, `#general`, and the member's own language
  room.
* **Icon:** from `public/icon.svg`, exported at 512×512 PNG.
* **Banner:** optional, and it needs Level 1 boost. Skip it at launch.
* A vanity URL needs Level 3 boost and is not worth buying at launch.

---

## Step 14. Publish the invite

Once the server is built, and only then. The privacy sentence goes live
**before** the link does.

1. **`public/privacy.html`**: one sentence saying the community server is
   Discord's, run under Discord's terms and privacy policy, and that nothing
   said there reaches the game.
2. **`src/ui/screens/About.tsx`**, next to the existing contact line, as an
   external link. Add the string to all five files in `src/locales/`, then
   build: `scripts/netprobe.ts` sweeps for absolute URLs, so check the invite
   passes as a link and is not flagged as a fetch. If netprobe objects, keep
   the invite out of the app rather than loosening the probe.
3. **`docs/store-listing.md`**, one line in the long description. Re-count the
   characters; the file warns that both consoles silently truncate.
4. **`README.md`**, under the contact address.

Create the invite itself with **Invite People → Edit invite link → Expire
after: Never, Max number of uses: No limit**, then copy it into those four
places and nowhere else.

---

## Step 15. The first week

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
map in Step 6 supports a thousand members without a single new channel.

---

## Five languages, one moderator

Five language rooms is the right call for a game that ships in five languages,
and it is also five rooms you cannot personally read. Four things make that
work, and they are worth setting up in the first month rather than the first
crisis:

1. **AutoMod does not read, it matches.** Spam, scam links and mention floods
   are caught in Japanese exactly as well as in English. The attacks you
   actually get are covered on day one.
2. **One Translator per language, named.** Not a moderator, no permissions: a
   person who will tell you when something in their room needs your attention.
   Recruit them from the first people who correct a wording mistake, because
   they have already volunteered by doing it.
3. **Say that replies may be in English.** Every language pinned post above
   says it. A player who knows the answer will arrive in English does not read
   an English answer as a snub.
4. **Machine translation is fine for reading, not for posting.** Run an
   unfamiliar message through a translator to understand it. Do not post a
   machine-translated reply into a room whose members can tell.

If a language room is still empty after three months, archive it rather than
leaving it as evidence that nobody came. That is a decision to take with the
data, not now.

---

## Appendix: the flags on Windows

Windows has no flag emoji. The system font, Segoe UI Emoji, does not include
them, so 🇫🇷 renders as the letters `FR` on Windows 10 and 11, in Discord as in
everything else. macOS, iOS, Android and ChromeOS all render the flag.

Nothing here breaks because of it, because every flagged channel name also
carries the language in words. A Windows member sees `FR-retours-français`,
which is still exactly the room they were looking for. Do not "fix" this by
replacing the words with flags, and do not ask members to install a font.
