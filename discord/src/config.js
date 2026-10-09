// Everything the server is made of, in one place: the roles, the channels, the
// forum tags and the words. /setup builds from this and nothing else, so a
// change to the layout is a change here followed by /setup again (it only
// adds what is missing and never deletes).
import { readFileSync } from 'node:fs'

export const TEAMS = JSON.parse(readFileSync(new URL('../data/teams.json', import.meta.url), 'utf8'))

/** The six languages the game ships in. `role` is what a member wears. */
export const LANGUAGES = [
  { id: 'en', name: 'English', role: 'English' },
  { id: 'fr', name: 'French', role: 'Français' },
  { id: 'es', name: 'Spanish', role: 'Español' },
  { id: 'it', name: 'Italian', role: 'Italiano' },
  { id: 'ja', name: 'Japanese', role: '日本語' },
  { id: 'af', name: 'Afrikaans', role: 'Afrikaans' },
]

/** Where in the game a problem is. `tag` is the bug forum's tag for it:
 *  Discord caps a forum tag at 20 characters and a forum at 20 tags. */
export const AREAS = [
  { id: 'translation', tag: 'Translation', name: 'Translation or wording', hint: 'A wrong, missing or English word in another language' },
  { id: 'match', tag: 'Match engine', name: 'Match engine', hint: 'Scores, commentary, highlights, subs, cards' },
  { id: 'tactics', tag: 'Tactics', name: 'Tactics and selection', hint: 'Team sheet, game plan, set piece, bench' },
  { id: 'squad', tag: 'Squad', name: 'Squad and transfers', hint: 'Contracts, market, loans, scouting, training' },
  { id: 'club', tag: 'Club', name: 'Club and finances', hint: 'Board, money, sponsors, facilities, jobs' },
  { id: 'screens', tag: 'Screens', name: 'Screens and layout', hint: 'Text cut off, overlapping, too small, wrong colour' },
  { id: 'saves', tag: 'Saves and crashes', name: 'Saves and crashes', hint: 'Lost progress, freezes, the game will not load' },
  { id: 'other', tag: 'Other', name: 'Something else', hint: 'Anything that does not fit above' },
]

/** Bug forum status tags. Moderators move a post along by changing its tag. */
export const STATUSES = ['Open', 'Confirmed', 'Fixed', 'Not a bug']

/** Staff roles. The bot never gives these out; the owner does. */
export const STAFF_ROLES = [
  { name: 'Developer', colour: 0xd4a017, hoist: true },
  { name: 'Moderator', colour: 0x3b82f6, hoist: true },
  { name: 'Tester', colour: 0x22c55e, hoist: false },
]

export const BUG_FORUM = 'bug-reports'
export const IDEAS_FORUM = 'suggestions'
export const PICK_CHANNEL = 'pick-your-club'

/**
 * The layout. `readOnly` channels are for the staff to post in and everyone
 * else to read. Forums carry their tags and the guidance shown when someone
 * starts a post.
 */
export const LAYOUT = [
  {
    category: 'Start here',
    channels: [
      { name: 'welcome', readOnly: true, topic: 'What this server is for, in every language the game speaks.' },
      { name: 'rules', readOnly: true, topic: 'Read these before you post.' },
      { name: 'announcements', readOnly: true, topic: 'News from the developer.' },
      { name: 'patch-notes', readOnly: true, topic: 'What changed in each version.' },
      { name: PICK_CHANNEL, readOnly: true, topic: 'Choose the club you manage and the language you play in.' },
    ],
  },
  {
    category: 'The clubhouse',
    channels: [
      { name: 'general', topic: 'Anything rugby, anything the game.' },
      { name: 'real-rugby', topic: 'The weekend\'s matches, the tables, the selections, the arguments.' },
      { name: 'tactics-talk', topic: 'Game plans, set pieces, benches: what works and why.' },
      { name: 'career-stories', topic: 'Titles, sackings, relegation escapes and the signing that won it.' },
      { name: 'screenshots', topic: 'Show us your club.' },
      { name: 'off-topic', topic: 'Everything that is not rugby.' },
    ],
  },
  {
    category: 'Language lounges',
    channels: [
      { name: 'français', topic: 'Le jeu et le rugby, en français.' },
      { name: 'español', topic: 'El juego y el rugby, en español.' },
      { name: 'italiano', topic: 'Il gioco e il rugby, in italiano.' },
      { name: '日本語', topic: 'ゲームとラグビーの話を日本語で。' },
      { name: 'afrikaans', topic: 'Die speletjie en rugby, in Afrikaans.' },
    ],
  },
  {
    category: 'Game feedback',
    channels: [
      {
        name: BUG_FORUM,
        forum: true,
        topic: 'Use /bug to report a problem: it asks for the language, the area and a screenshot, and tags the post for you. One problem per post, please. Search first: if it is already here, add to that post instead.',
        tags: [
          ...LANGUAGES.map(l => l.name),
          ...AREAS.map(a => a.tag),
          ...STATUSES,
        ],
      },
      {
        name: IDEAS_FORUM,
        forum: true,
        topic: 'One idea per post. Say what you would change, and what it would let you do that you cannot do now.',
        tags: ['Match', 'Tactics', 'Squad', 'Club', 'Screens', 'Other', 'Under review', 'Planned', 'Done', 'Not planned'],
      },
    ],
  },
  {
    category: 'Match day',
    channels: [
      { name: 'Match day', voice: true },
    ],
  },
]

export const WELCOME = [
  '# Welcome to PHASE: Rugby Manager',
  'For people who play the game, and anyone who would rather talk rugby than do the washing up.',
  '',
  '**Two things this server is for:**',
  '1. **Finding what is wrong with the game, in every language it speaks.** If a word is wrong, a screen breaks or a result makes no sense, use `/bug` and tell us. Reports in any of the six languages are welcome.',
  '2. **Talking rugby.** The game, the real thing, your career, your club.',
  '',
  '**Start in <#{PICK}>:** choose the club you manage and the language you play in, and your name will carry them.',
  '',
  '**Signalez les problèmes en français.** Utilisez `/bug`.',
  '**Informa de los errores en español.** Usa `/bug`.',
  '**Segnala i problemi in italiano.** Usa `/bug`.',
  '**不具合は日本語で報告できます。** `/bug` を使ってください。',
  '**Rapporteer foute in Afrikaans.** Gebruik `/bug`.',
].join('\n')

export const RULES = [
  '# Rules',
  '1. Be decent. Argue about rugby as hard as you like; never about the person.',
  '2. No abuse of anyone for who they are: nationality, gender, race, religion, sexuality or anything else.',
  '3. Keep bug reports to one problem each, and search before you post.',
  '4. Use the right room: problems go in the bug forum through `/bug`, ideas in the suggestions forum.',
  '5. No advertising, no piracy, no sharing of other people\'s saves without asking.',
  '6. The moderators have the last word. If you disagree, message one of them rather than arguing in the channel.',
].join('\n')

export const PICK_PANEL = [
  '# Choose your club',
  'Tap **Choose my club** and pick men\'s, women\'s or a national team, then the league, then the club. Your club shows next to your name. You can change it any time.',
  '',
  'Tap **My languages** to say which languages you play in. It helps us find someone to check a translation.',
].join('\n')
