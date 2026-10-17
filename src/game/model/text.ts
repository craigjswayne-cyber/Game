// Stored text in the reader's language: a key wins, the English it was
// filed in is the fallback for a save from before the key existed.
import { t } from '../i18n'
import type { Decision, GameState, MatchEvent, NewsItem, PressItem, PressOption } from './types'

/** A commentary line in the reader's language, or the English it was called in
 *  if this event predates the key. */
export const eventText = (e: MatchEvent): string => (e.k ? t(e.k, e.v) : e.text)

/** The byline a story carries on screen, or null for the game's own voice.
 *  A proper name, the same in every language, so it is a constant rather than
 *  a dictionary entry. The company name, ruck.co.uk (owner, 1.8.9: "It should
 *  also be ruck.co.uk as the company name"); the wordmark sits at the foot of
 *  the story (ui/Byline.tsx RuckMark). */
const RUCK_BYLINE = 'RUCK.CO.UK'
export const newsByline = (n: NewsItem): string | null => (n.src === 'ruck' ? RUCK_BYLINE : null)

/** A line of the manager's own history, in the reader's language - or in the
 *  English it was recorded in, on a save written before decisions carried a
 *  key. A career keeps forty of these and lives for years, so the fallback is
 *  not a stopgap. */
export const decisionText = (d: Decision): string => (d.k ? t(d.k, d.v) : d.text)

/** The press room in the reader's language.
 *
 *  Same shape as eventText and decisionText: a key wins, the stored English is
 *  the fallback for an item written before the key existed. A press item is
 *  saved once and read for weeks, so the coverage list has to re-render rather
 *  than keep whatever language the button was pressed in. */
export const pressQuestion = (p: PressItem): string => (p.qk ? t(p.qk, p.qv) : p.question)
export const pressLabel = (o: PressOption): string => (o.lk ? t(o.lk, o.lv) : o.label)
export const pressAnswer = (p: PressItem): string => (p.alk ? t(p.alk, p.alv) : p.answerLabel ?? '')
export const pressReaction = (p: PressItem): string => (p.rk ? t(p.rk, p.rv) : p.reaction ?? '')

/**
 * Possessive for a name that may already end in s.
 *
 * Found by reading the wire probe's sample output: "Crusaders's media team have
 * posted it", "Saracens's head coach has made him his number one target". Rugby
 * club names are overwhelmingly plural in form - Saracens, Harlequins, Crusaders,
 * Brumbies, Ospreys, Scarlets, Hurricanes, Falcons - so the naive apostrophe-s
 * hits a large fraction of the league and reads as a typo rather than as a style
 * choice. A plural takes the bare apostrophe.
 */
export const poss = (name: string) => name.endsWith('s') ? `${name}'` : `${name}'s`

/** What the reader sees, in the reader's language.
 *
 *  Every screen that shows a story goes through these two and nothing reads
 *  `.subject` or `.body` directly any more. A story filed with a key renders it
 *  now, in whatever language the manager is reading in this minute; one without
 *  falls back to the English it was filed in, which is what a save from before
 *  this change - or a story the engine assembled by appending to another - has.
 *
 *  The fallback is not a stopgap to be removed later. Careers are on the device
 *  and live for years, and a save begun on the release that shipped this will
 *  still be opened in v2. */

/** A story filed before the icon pass (owner, 27 Sep 2026: "use icons instead
 *  of emojis") still has an emoji at the front of its English in an old save;
 *  the reader loses it with the space after it. Flags (regional-indicator
 *  pairs, and the black flag England, Scotland and Wales build on) stay, and
 *  so do the typographic ★ ☆ ✓ ✕ ✗. */
const OLD_EMOJI = /(?!\u{1F3F4}[\u{E0020}-\u{E007F}])[\u{1F000}-\u{1F1E5}\u{1F200}-\u{1FFFF}\u{2600}-\u{2604}\u{2607}-\u{2712}\u{2714}\u{2716}\u{2718}-\u{27BF}\u{2B50}\u{2B55}\u{23E9}-\u{23F3}]\u{FE0F}? ?/gu
const noEmoji = (s: string): string => s.replace(OLD_EMOJI, '')

export const newsBody = (n: NewsItem): string => (n.k ? t(n.k, n.v) : noEmoji(n.body))
export const newsSubject = (n: NewsItem): string => (n.k ? t(n.k + 'Subj', n.v) : noEmoji(n.subject))

/** What is wrong with him, in the reader's language - or in the English it was
 *  recorded in, on a save written before injuries carried a key. */
export const injuryDesc = (inj: { desc: string; dk?: string }): string => (inj.dk ? t(inj.dk) : inj.desc)

/** The two halves of the celebration banner, in the reader's language - or in
 *  the English they were filed in, on a save from before they carried keys. */
type Cel = NonNullable<GameState['celebration']>
export const celebrationHeadline = (c: Cel): string => (c.hk ? t(c.hk, c.hv) : c.headline)
export const celebrationSub = (c: Cel): string => (c.sk ? t(c.sk, c.sv) : c.sub)
