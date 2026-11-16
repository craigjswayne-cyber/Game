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
 * The invite was meant never to expire (owner, 28 Sep 2026); it did, and was
 * replaced on 16 Nov 2026 (owner: "The in game discord link and website
 * discord link have expired"). Change it here, and on the landing page, the
 * support page and the store descriptions (docs/store-listing.md).
 *
 * Every button that uses it is a plain link opened in a new tab, not a
 * window.open(): an in-app browser that blocks script-opened windows still
 * follows a link the player tapped.
 */
export const COMMUNITY_URL = 'https://discord.gg/kJg5NdsRnq'

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
// 1.9.14: the channel invite expired with the server one; the server invite
// stands in until the owner sends a channel invite that does not expire
export const BUG_CHANNEL_URL = 'https://discord.gg/kJg5NdsRnq'

/**
 * ---- IDEAS AND SUGGESTIONS (owner, round 6) ----
 *
 * "Ideas and suggestions bit should be shared on" this invite: every place
 * that asks for an idea (the ideas box on the bug screen, About) opens it.
 * Bug reports keep BUG_CHANNEL_URL. Same rules: a link the player taps,
 * nothing sent by the game (scripts/netprobe.ts allows it in this file).
 */
// 1.9.14: as BUG_CHANNEL_URL, the server invite until a lasting channel one
export const IDEAS_URL = 'https://discord.gg/kJg5NdsRnq'

/**
 * ---- THE GAME'S SOCIAL ACCOUNTS (1.9.3, owner) ----
 *
 * @phaserugbymanager on TikTok and Instagram, linked from About and from the
 * landing page's footer. Same rules as the Discord links: a link the player
 * taps, nothing sent by the game (scripts/netprobe.ts allows both here).
 */
export const TIKTOK_URL = 'https://www.tiktok.com/@phaserugbymanager'
export const INSTAGRAM_URL = 'https://www.instagram.com/phaserugbymanager/'
