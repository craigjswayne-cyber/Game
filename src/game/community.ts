/**
 * ---- THE COMMUNITY SERVER ----
 *
 * The PHASE Discord: bug reports in any of the six languages, ideas, and rugby
 * talk. The game links to it from the menu, the bug report screen and About.
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
