# PHASE: Rugby Manager community server

A Discord server for two jobs: finding what is wrong with the game in every
language it speaks, and giving rugby people somewhere to talk. The bot in this
folder builds the server and runs three things on it:

- **Club tags.** `/club` (or the button in `#pick-your-club`): men's club,
  women's club or national team, then the league, then the club. The member's
  name then wears that club's role, in the club's first kit colour. One club
  and one national team at a time; picking again swaps it.
- **Language roles.** `/language`: which of the six game languages someone
  plays in, so there is always somebody to ask about a French or Japanese line.
- **Bug reports.** `/bug`: one form with the language, the area of the game, a
  summary, what happened and up to three screenshots. It becomes a post in the
  `#bug-reports` forum, tagged with the language, the area and **Open**.

The club list is exported from the game itself (171 clubs in 15 leagues, plus
the 16 national teams a manager can be offered), so it always matches.

## What `/setup` builds

| Category | Channels |
| --- | --- |
| Start here | `#welcome`, `#rules`, `#announcements`, `#patch-notes`, `#pick-your-club` (read-only for members) |
| The clubhouse | `#general`, `#real-rugby`, `#tactics-talk`, `#career-stories`, `#screenshots`, `#off-topic` |
| Language lounges | `#français`, `#español`, `#italiano`, `#日本語`, `#afrikaans` |
| Game feedback | `#bug-reports` forum, `#suggestions` forum |
| Match day | a voice channel |

Roles: **Developer**, **Moderator** and **Tester** (you hand these out), the six
language roles, and a club role the first time anyone picks that club.

`#bug-reports` tags: the six languages, eight areas (Translation, Match engine,
Tactics, Squad, Club, Screens, Saves and crashes, Other) and four statuses
(Open, Confirmed, Fixed, Not a bug). To move a report along, open the post and
change its tags. In the forum you can filter by any tag, for example
"French + Translation + Open".

`/setup` only adds. Anything already there with the same name is left alone,
so you can run it again safely after changing `src/config.js`.

## Setting it up (about 15 minutes)

You need [Node.js](https://nodejs.org) 20.6 or newer on the machine that will
run the bot.

1. **Make the server.** In Discord: the **+** in the server list, then
   **Create My Own**. Name it (for example "PHASE: Rugby Manager").
2. **Make the bot.** Go to <https://discord.com/developers/applications>,
   **New Application**, name it "PHASE". Then:
   - **General Information**: copy the **Application ID**.
   - **Bot**: **Reset Token** and copy the token. Treat it like a password.
3. **Fill in the settings.** In this `discord` folder, copy `.env.example`
   to `.env` and paste in the token and the Application ID. For `GUILD_ID`,
   turn on **Developer Mode** (User Settings, Advanced), right-click your
   server's icon and **Copy Server ID**.
4. **Install and register the commands.**
   ```
   cd discord
   npm install
   npm run register
   ```
5. **Invite the bot.** `npm run invite` prints a link. Open it, pick your
   server, **Authorise**. It asks only for what it uses: manage roles and
   channels, post, create forum posts, attach screenshots. It does not ask
   for Administrator.
6. **Put the bot's role high enough.** Server Settings, **Roles**: drag the
   **PHASE** role above where club roles will go (just under Developer and
   Moderator is right). Discord only lets a bot hand out roles below its own;
   this is the one step people miss.
7. **Start the bot and build the server.**
   ```
   npm start
   ```
   Then in any channel type `/setup`. It builds everything above and posts
   the welcome, the rules and the club-picker buttons.
8. **Give yourself the Developer role**, and try `/club`, `/language` and
   `/bug` yourself.

If `/setup` says it cannot create the forums, turn on **Community** for the
server (Server Settings, **Enable Community**) and run `/setup` again. The
same setting also gives you Discord's own welcome screen and rules screening,
which are worth having for a public server.

## Keeping it running

The bot answers only while `npm start` is running. For a public server it
needs a machine that stays on: a spare computer, a Raspberry Pi, or a small
cloud host. Nothing else is needed: no database (everything it knows is in the
roles and the forum).

## When the game changes

- **New or renamed clubs:** from the repo root run `cd discord && npm run teams`.
  That rewrites `data/teams.json` from the game. Restart the bot. A renamed
  club gets a new role the next time someone picks it; delete the old role by
  hand.
- **New channels, tags or wording:** edit `src/config.js`, restart, `/setup`.
- **New commands:** edit `src/commands.js`, then `npm run register`.

`npm test` checks every menu, the bug form and the forum tags against
Discord's limits (25 options a menu, 5 questions a form, 20 tags a forum,
250 roles a server) without needing a token.
