/**
 * ---- THE COMMUNITY SERVER ----
 *
 * The PHASE Discord: bug reports in any of the six languages, ideas, and rugby
 * talk. The game links to it from the foot of Home, the manager's menu, the
 * bug report screen and About (the title screen gave it up in 1.8.1).
 *
 * A LINK, NOT A CONNECTION. Nothing in the game talks to Discord. The address
 * is opened only when the player taps it, in their own browser or the Discord
 * app, and nothing about the career goes with it: a bug report reaches the
 * server only because the player copied it and pasted it there themselves.
 * So the store forms' "collects no data" stays true (scripts/netprobe.ts
 * allows this one address, in this one file, for that reason).
 *
 * The invite never expires (owner, 28 Sep 2026). If it is ever replaced, this
 * is the only line to change.
 *
 * Every button that uses it is a plain link opened in a new tab, not a
 * window.open(): an in-app browser that blocks script-opened windows still
 * follows a link the player tapped.
 */
export const COMMUNITY_URL = 'https://discord.gg/3KKfDVsMb'

/**
 * ---- THE BUG-REPORTS CHANNEL (1.8.2) ----
 *
 * Owner: "Post on Discord" on the bug screen must land in the bug-reports
 * channel, not the server's front door. This is a channel invite, so it opens
 * straight into that channel. Only the bug report's button uses it; the menu's
 * "Join us on Discord", Home and About keep COMMUNITY_URL; ideas go to IDEAS_URL.
 * Same rules as above: a link the player taps, nothing sent by the game
 * (scripts/netprobe.ts allows this address in this file too).
 */
export const BUG_CHANNEL_URL = 'https://discord.gg/TWmWQxu38z'

/**
 * ---- IDEAS AND SUGGESTIONS (owner, round 6) ----
 *
 * "Ideas and suggestions bit should be shared on" this invite: every place
 * that asks for an idea (the ideas box on the bug screen, About) opens it.
 * Bug reports keep BUG_CHANNEL_URL. Same rules: a link the player taps,
 * nothing sent by the game (scripts/netprobe.ts allows it in this file).
 */
export const IDEAS_URL = 'https://discord.gg/472rzEQbZ'
