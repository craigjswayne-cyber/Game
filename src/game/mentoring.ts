import type { GameState, Personality, Player } from './model'
import { facLevel } from './model'

/**
 * ---- HOW WELL THE PAIR ACTUALLY GET ON ----
 *
 * Pairing an old pro with an academy kid used to be a switch: the kid grew
 * faster, the same amount, whoever the two men were, and after the one news item
 * announcing it nothing was ever said about it again (user: "the mentoring
 * section - provide updates in inbox and on the mentoring page. updates should be
 * down to how well they work together so base it on their character").
 *
 * Character decides it. A Leader teaching a Professional is a match made at the
 * training ground; a Mercenary teaching a Temperamental kid is two men who will
 * not be in the same room by Christmas. The score below is a pure function of
 * the two personalities plus the senior man's leadership and the age gap, so it
 * is the same every time it is read - no rng, and no drift between the number on
 * the page and the number the development code uses.
 */

/** How much the senior man has to give as a teacher. */
const TEACHER: Record<Personality, number> = {
  Leader: 1.0,
  Professional: 0.85,
  Loyal: 0.7,
  Ambitious: 0.5,
  Temperamental: 0.3,
  Mercenary: 0.2,
}

/**
 * Who can be taken under a wing.
 *
 * User: "all players under 21 can have a mentor to learn from." It used to be
 * academy men only, which meant promoting a prospect to the senior squad quietly
 * ended his education - the reward for progress was losing the thing that caused
 * it.
 *
 * ONE PREDICATE, USED BY BOTH SIDES. This is the whole reason it lives here
 * rather than being written twice. The Training screen decided who appeared in the
 * dropdown and season.ts decided who actually got the development bump, and they
 * were separate expressions of the same idea. Widening only the dropdown would
 * have produced a pairing the game displays, reports on every eight weeks, and
 * silently does nothing for.
 *
 * Academy men are 17-19, so the age test already covers all of them; the acad
 * clause is belt and braces against a future intake that arrives older.
 */
export const MENTEE_MAX_AGE = 20
export const canBeMentored = (p: { age: number; acad?: boolean }) =>
  p.age <= MENTEE_MAX_AGE || !!p.acad

/** A senior pro has to have been round the block. */
export const MENTOR_MIN_AGE = 28
export const canMentor = (p: { age: number; acad?: boolean }) =>
  !p.acad && p.age >= MENTOR_MIN_AGE

/** How often the pairing files a progress note (user: "every 8 weeks"). */
export const REPORT_EVERY = 8

/**
 * How many pairings the club can run at once (user: "More than 3 mentoring
 * slots should be available"). Four as standard, five with a Centre of
 * Excellence at level 3 or better - the building whose whole job is passing
 * the club on to the next lot.
 */
export function mentorCap(state: GameState): number {
  return 4 + (facLevel(state, 'academy') >= 3 ? 1 : 0)
}

/** How many kids one senior can take before he is spread too thin. Two is
 *  fine; there is no third slot, because two is already a stretch. */
export const MENTOR_MAX_KIDS = 2

/**
 * The attention tax on a senior with more than one kid (user: "Players can
 * mentor more than one player but dont overload then or they will moan").
 * One kid gets the man's full attention; two kids split the extras after
 * training between them, so each learns at three quarters speed. The moan
 * arrives with the eight-week reports below.
 */
export function mentorLoad(state: GameState, seniorId: number): number {
  const kids = (state.mentors ?? []).filter(mp => mp.senior === seniorId).length
  return kids >= 2 ? 0.75 : 1
}

/**
 * A pairing that has given everything it has to give ends itself (user:
 * "Mentoring should end if the player has achieved everything they can").
 * Three ways out, all deterministic and checked weekly:
 *
 *   - the kid has aged past the mentee window: he is a senior pro now
 *   - his ability has reached his ceiling: nothing left to teach
 *   - he has taken on his mentor's personality: the bigger prize, banked
 *
 * Each graduation is one news item, and the slot opens for the next kid.
 */
export function mentorGraduations(state: GameState) {
  const pairs = state.mentors ?? []
  if (!pairs.length) return
  const keep: typeof pairs = []
  for (const mp of pairs) {
    const s = state.players[mp.senior]
    const k = state.players[mp.kid]
    // a missing man (sold, retired) just quietly frees the slot
    if (!s || !k) continue
    const aged = !canBeMentored(k)
    const ceiling = k.ca >= k.pa
    // pers0 guards the like-teaches-like pairings: adoption means he CHANGED
    // into his mentor, not that the two were always cut from the same cloth
    const adopted = mp.pers0 != null && k.pers === s.pers && k.pers !== mp.pers0
    if (!aged && !ceiling && !adopted) { keep.push(mp); continue }
    const why = adopted
      ? `He carries himself like ${s.name} now, which was the whole point.`
      : ceiling
        ? `The coaches agree there is nothing left on the syllabus - he is the player he was going to be.`
        : `At ${k.age} he is a senior pro in his own right, and senior pros do not get lifts to the ground.`
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'youth', read: false,
      subject: `🎓 ${k.name.split(' ').slice(-1)[0]} graduates from ${s.name.split(' ').slice(-1)[0]}'s wing`,
      body: `The pairing has run its course. ${why} ${s.name} shook his hand after training and the mentoring slot is free for the next one.`,
      playerId: k.id,
    })
  }
  if (keep.length !== pairs.length) state.mentors = keep
}

/** How much the kid takes in. */
const LEARNER: Record<Personality, number> = {
  Professional: 1.0,
  Loyal: 0.85,
  Leader: 0.8,
  Ambitious: 0.7,
  Temperamental: 0.4,
  Mercenary: 0.35,
}

/** Pairs that spark, and pairs that grate, over and above the two scores. */
function chemistry(senior: Personality, kid: Personality): number {
  if (senior === 'Leader' && (kid === 'Ambitious' || kid === 'Temperamental')) return 0.12
  if (senior === 'Professional' && kid === 'Professional') return 0.1
  if (senior === 'Loyal' && kid === 'Loyal') return 0.08
  if (senior === 'Mercenary' && kid === 'Loyal') return -0.12
  if (senior === 'Temperamental' && kid === 'Temperamental') return -0.15
  if (senior === 'Ambitious' && kid === 'Ambitious') return -0.08
  return 0
}

/**
 * 0 to 100: how well this pairing works.
 *
 * The two character scores carry most of it, the senior man's leadership adds a
 * little, and a wide age gap costs a little - a 36-year-old and an 18-year-old
 * have less in common than a 29-year-old and a 20-year-old.
 */
export function mentorFit(senior: Player, kid: Player): number {
  const t = TEACHER[senior.pers] ?? 0.5
  const l = LEARNER[kid.pers] ?? 0.5
  const lead = (senior.a.lea - 10) / 10 * 0.08
  const gap = Math.max(0, (senior.age - kid.age - 10)) * 0.008
  const raw = (t * 0.55 + l * 0.45) + chemistry(senior.pers, kid.pers) + lead - gap
  return Math.max(0, Math.min(100, Math.round(raw * 100)))
}

/**
 * The fit of an average pairing that actually occurs in the game.
 *
 * This constant is the whole reason mentorBoost is not one line, and getting it
 * from the right place took two goes. The obvious `0.4 + fit / 100 * 1.2` came
 * out at a mean of 1.152 - a fifteen percent speed-up to every academy in the
 * game that nobody asked for. Re-centring on the 36-combination character grid
 * (mean 63) got it to 1.055, still wrong, because a real squad is not a uniform
 * grid: senior pros skew Professional, Loyal and Leader and carry more
 * leadership than the grid's fixed 12, so real pairings average 70.5 across
 * 2,484 of them from six different clubs. That is the number, and
 * scripts/mentorprobe.ts measures both the grid and a real squad and fails if
 * either drifts from 1.0.
 */
const MEAN_FIT = 70.5

/**
 * The multiplier on the kid's extra development. 1.0 for an average pairing,
 * about 0.4 for the worst and about 1.34 for the best.
 *
 * ONE straight line through the average, not two meeting at it. Two lines was
 * the third wrong answer: pinning f(MEAN) = 1 is not the same as E[f] = 1, and
 * with a steeper slope above the mean than below it (0.020 a point against
 * 0.0085) the average pairing came out at 1.099 even though the average FIT was
 * exactly on the anchor. A single slope makes E[boost] = 1 + (E[fit] - MEAN) * k,
 * which is exactly 1 by construction whatever the shape of the distribution.
 *
 * k is set by the floor: the worst pairing in the world sits near 19, which is
 * 51.5 below the mean, so 0.6 / 51.5 puts it at 0.4.
 */
const PER_POINT = 0.6 / 51.5

export function mentorBoost(senior: Player, kid: Player): number {
  const fit = mentorFit(senior, kid)
  return Math.max(0.4, Math.min(1.6, 1 + (fit - MEAN_FIT) * PER_POINT))
}

export function fitWord(fit: number): string {
  return fit >= 80 ? 'Inseparable'
    : fit >= 66 ? 'Working well'
    : fit >= 50 ? 'Coming along'
    : fit >= 36 ? 'Polite, no more'
    : fit >= 22 ? 'Not taking'
    : 'A waste of both their time'
}

/** One line explaining WHY, so the number is not just a number. */
export function fitReason(senior: Player, kid: Player): string {
  const t = TEACHER[senior.pers] ?? 0.5
  const l = LEARNER[kid.pers] ?? 0.5
  const chem = chemistry(senior.pers, kid.pers)
  const gap = senior.age - kid.age
  if (chem <= -0.1) return `${senior.pers} and ${kid.pers} was never going to work.`
  if (t >= 0.85 && l >= 0.85) return `A ${senior.pers.toLowerCase()} teaching a ${kid.pers.toLowerCase()}: he could not have picked a better example.`
  if (t < 0.4) return `${senior.name.split(' ').slice(-1)[0]} is a fine player and an indifferent teacher.`
  if (l < 0.45) return `The kid is not listening as closely as he might.`
  if (gap >= 16) return `${gap} years between them, and it shows in what they talk about.`
  if (senior.a.lea >= 15) return `${senior.name.split(' ').slice(-1)[0]} leads by example and the boy has noticed.`
  return `Steady enough: extras after training, and the odd word that lands.`
}

/**
 * The mentoring beat: a note on how each pairing is going.
 *
 * Filed every REPORT_EVERY weeks so it is a progress report rather than a nag,
 * and only for pairings that have something to say - a middling one that is
 * neither working nor failing produces nothing, because "it is fine" is not news.
 * Deterministic: the week decides when, the fit decides what.
 *
 * A failing pairing names the way out. The End button has always been on the
 * pairing row, but a manager who is told "this is not working" and not told what
 * to do about it has been given a problem rather than a decision.
 */
export function mentorReports(state: GameState) {
  const pairs = state.mentors ?? []
  if (!pairs.length) return
  if (state.week % REPORT_EVERY !== 0) return
  for (const mp of pairs) {
    const s = state.players[mp.senior]
    const k = state.players[mp.kid]
    if (!s || !k) continue
    const fit = mentorFit(s, k)
    const last = k.name.split(' ').slice(-1)[0]
    if (fit >= 66) {
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'youth', read: false,
        subject: `🎓 ${last} is thriving under ${s.name.split(' ').slice(-1)[0]}`,
        body: `${fitWord(fit)}. ${fitReason(s, k)} The academy coach says ${k.name} has started doing the unglamorous parts without being asked, `
          + `which is the bit you cannot coach. He is developing faster for it.`,
        playerId: k.id,
      })
    } else if (fit < 36) {
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'youth', read: false,
        subject: `The ${s.name.split(' ').slice(-1)[0]} and ${last} pairing is not taking`,
        body: `${fitWord(fit)}. ${fitReason(s, k)} ${k.name} is getting very little out of it. `
          + `Nothing has gone wrong between them; it simply is not working. `
          + `End the pairing on the Training and Staff screen and put him with somebody else - there is an End button on the row, and the season is long enough for a fresh start to pay.`,
        playerId: k.id,
      })
    }
  }
  // THE MOAN. A senior with two kids is doing two men's unpaid work, and every
  // report day he says so - not mutiny, just the truth about the arithmetic.
  // The manager who wants full-speed mentoring gives one kid to somebody else.
  const kidsOf = new Map<number, number>()
  for (const mp of pairs) kidsOf.set(mp.senior, (kidsOf.get(mp.senior) ?? 0) + 1)
  for (const [sid, n] of kidsOf) {
    if (n < 2) continue
    const s = state.players[sid]
    if (!s) continue
    const last = s.name.split(' ').slice(-1)[0]
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'youth', read: false,
      subject: `${last} is spread a bit thin`,
      body: `${s.name} has two kids under his wing and he mentioned it after training - politely, but he mentioned it. `
        + `The extras get split two ways, so each lad is learning at about three-quarter speed. `
        + `Move one of them to another senior pro on the Training and Staff screen, or accept the slower pace.`,
      playerId: s.id,
    })
  }
}
