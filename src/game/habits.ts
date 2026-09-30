// ---- SECRET PLAYING HABITS (1.8.2 depth) ----
//
// Six things some men do on a pitch that no screen will ever name, derived
// from (seed, id) exactly as formtraits.ts derives the form tendencies:
// nothing stored, nothing drawn from the world's rng, the same save always
// the same men.
//
//   lc   runs the lineout: the throw and the jump are called by him, and a
//        pack with such a man in shirts 2 or 4 to 8 wins more of its own ball
//   ck   wants the kick when it matters: from the hour, with the scores
//        within a converted try, his goal kicking is better than his numbers
//        (and a kicker without it a touch worse, so the world's kicking is
//        unchanged)
//   pr   gives away penalties: every such man on the pitch widens the window
//        his side concedes in
//   sh   sure hands: fewer handling errors from the backs he plays among
//   dl   drifts out of the defensive line when it is stretched: a side with
//        such men leaks a little more in defence (not a card or a trait on
//        screen: the visible Hot Head signature trait is a separate thing)
//   md   relishes a heavy pitch: a little more in attack when it is wet
//
// EVERY EFFECT IS CENTRED ON THE WORLD. Each is written as a change from the
// average side, which carries about 15 x the rate of each habit, so a side
// with more than its share gains or pays and a side with fewer the reverse,
// and the world's penalties, cards, lineouts and handling are where they
// were. The habits move WHO wins those, not how many there are.
//
// OWNER RULE: these have no names on screen, in any language. The terse keys
// above appear in no dictionary string, and neither does any label for them
// (scripts/depthprobe.ts renders every string in six languages to hold that).
// What the club learns is at most a sentence in plain words, and only about
// its own men once the staff know them well (habitHint, the player screen).
import type { GameState, Player } from './model'
import { mulberry32 } from './rng'
import { readLevel } from './temperament'

export interface Habits { lc: boolean; ck: boolean; pr: boolean; sh: boolean; dl: boolean; md: boolean }

const roll = (seed: number, id: number, salt: number) =>
  mulberry32((seed ^ Math.imul(id, salt)) >>> 0)()

/** the share of men who carry each (its world rate) */
export const HABIT_RATE: Record<keyof Habits, number> = { lc: 0.12, ck: 0.2, pr: 0.1, sh: 0.12, dl: 0.1, md: 0.12 }

/** Salts differ from attributes.ts and formtraits.ts so no habit tracks a tendency. */
export function habits(seed: number, id: number): Habits {
  return {
    lc: roll(seed, id, 0x2545F491) < HABIT_RATE.lc,
    ck: roll(seed, id, 0x4F1BBCDD) < HABIT_RATE.ck,
    pr: roll(seed, id, 0x5851F42D) < HABIT_RATE.pr,
    sh: roll(seed, id, 0x3C6EF372) < HABIT_RATE.sh,
    dl: roll(seed, id, 0x7F4A7C15) < HABIT_RATE.dl,
    md: roll(seed, id, 0x1B873593) < HABIT_RATE.md,
  }
}

/** what the habits of the men on the pitch do to their side, as multipliers
 *  (all exactly 1 for a side of average men) */
export interface HabitFx { lineout: number; pen: number; defence: number; hands: number; mudAtk: number }

/** How big each is. The lineout is the unit's own scale; pen and defence are
 *  per man above or below the average side's count; hands per back; mud per
 *  man, at full wetness. Kept small: every one of them is a difference between
 *  two sides that the dice did not deal, and together at twice these sizes
 *  they thinned home advantage by two points (bandcheck, 53.4% to 51.4%). */
const K = { lineout: 0.03, pen: 0.025, defence: 0.008, hands: 0.08, mud: 0.015 }

/**
 * The habits of the men in the fifteen shirts (null for an empty one or a man
 * not on the pitch), for a match `wet` 0 (dry) to 1.2 (snow).
 */
export function habitFx(seed: number, shirts: (Player | null)[], wet: number): HabitFx {
  let callers = 0, pen = 0, drift = 0, hands = 0, mud = 0
  shirts.slice(0, 15).forEach((p, i) => {
    if (!p) return
    const h = habits(seed, p.id)
    // only a man in the lineout calls it: the hooker and the five behind him
    if (h.lc && (i === 1 || (i >= 3 && i <= 7))) callers++
    if (h.pr) pen++
    if (h.dl) drift++
    if (h.sh && i >= 8) hands++
    if (h.md) mud++
  })
  // the chance an average pack of six has a caller at all, so a side with one
  // gains what a side without one gives up
  const pCaller = 1 - (1 - HABIT_RATE.lc) ** 6
  return {
    lineout: 1 + K.lineout * ((callers > 0 ? 1 : 0) - pCaller),
    pen: 1 + K.pen * (Math.min(pen, 4) - 15 * HABIT_RATE.pr),
    defence: 1 - K.defence * (Math.min(drift, 3) - 15 * HABIT_RATE.dl),
    hands: Math.max(0.7, 1 - K.hands * (Math.min(hands, 3) - 7 * HABIT_RATE.sh)),
    mudAtk: wet > 0 ? 1 + K.mud * wet * (Math.min(mud, 3) - 15 * HABIT_RATE.md) : 1,
  }
}

/** A switch for the probes alone (scripts/depthprobe.ts plays the same
 *  matches with the habits and without them, to measure what they move).
 *  The game never turns it off. */
export const HABITS = { on: true }
export const HABITS_OFF: HabitFx = { lineout: 1, pen: 1, defence: 1, hands: 1, mudAtk: 1 }

/** The kicker's nerve when the match is on the line: from the hour, with the
 *  scores within seven. Zero at any other time. */
export function clutchKick(seed: number, kicker: Player | null, min: number, margin: number): number {
  if (!kicker || min < 60 || Math.abs(margin) > 7) return 0
  // centred: a fifth of kickers carry it, so +0.06 for them and -0.015 for the rest
  return habits(seed, kicker.id).ck ? 0.06 : -0.015
}

/**
 * What the staff can say about one of the manager's own men, and only once
 * they know him fully (temperament.ts readLevel 'full'): at most ONE line, an
 * i18n key in plain words. Nothing about another club's man, whatever the
 * scouts have filed, and nothing that names the habit.
 */
export function habitHint(state: GameState, p: Player): string | null {
  if (p.clubId !== state.userClubId || readLevel(state, p) !== 'full') return null
  const h = habits(state.seed, p.id)
  const fwd = ['HK', 'LK', 'FL', 'N8'].includes(p.pos)
  if (h.lc && fwd) return 'player.hintThrow'
  if (h.ck && p.a.goa >= 12) return 'player.hintTee'
  if (h.sh && !['LP', 'HK', 'TP', 'LK', 'FL', 'N8'].includes(p.pos)) return 'player.hintHold'
  if (h.md) return 'player.hintHeavy'
  if (h.pr) return 'player.hintWhistle'
  if (h.dl) return 'player.hintLine'
  return null
}
