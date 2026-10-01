import type { Attrs, GameState, Personality, Player, Pos } from './model'
import { absWeek, facLevel } from './model'
import { attrWeight } from './attributes'
import { attrRoll, trainPoint } from './ageing'
import { clamp, type Rng } from './rng'
import { t, tIn } from './i18n'

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
    const whyKey = adopted ? 'news.mentAdopted' : ceiling ? 'news.mentCeiling' : 'news.mentAged'
    const why = tIn('en', whyKey, { senior: s.name, age: k.age })
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'youth', read: false,
      subject: `${k.name.split(' ').slice(-1)[0]} graduates from ${s.name.split(' ').slice(-1)[0]}'s wing`,
      body: `The pairing has run its course. ${why} ${s.name} shook his hand after training and the mentoring slot is free for the next one.`,
      k: 'news.mentGraduates',
      v: {
        kid: k.name.split(' ').slice(-1)[0], seniorLast: s.name.split(' ').slice(-1)[0],
        senior: s.name, age: k.age, why_k: whyKey,
      },
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

/** The key for a fit band. Screens pass it through t(); the news bodies below
 *  pass it through tIn('en', …), because a career's paperwork does not change
 *  language when the manager does. */
export function fitKey(fit: number): string {
  return fit >= 80 ? 'training.fitInseparable'
    : fit >= 66 ? 'training.fitWorkingWell'
    : fit >= 50 ? 'training.fitComingAlong'
    : fit >= 36 ? 'training.fitPolite'
    : fit >= 22 ? 'training.fitNotTaking'
    : 'training.fitWaste'
}

export const fitWord = (fit: number): string => t(fitKey(fit))

/** One line explaining WHY, so the number is not just a number. */
function reasonOf(senior: Player, kid: Player): { key: string; vars: Record<string, string | number> } {
  // `teach`, not `t`: t() is the translator
  const teach = TEACHER[senior.pers] ?? 0.5
  const l = LEARNER[kid.pers] ?? 0.5
  const chem = chemistry(senior.pers, kid.pers)
  const gap = senior.age - kid.age
  const last = senior.name.split(' ').slice(-1)[0]
  if (chem <= -0.1) return { key: 'training.reasonNever', vars: { sPers: senior.pers, kPers: kid.pers } }
  if (teach >= 0.85 && l >= 0.85) return { key: 'training.reasonBest', vars: { sPers: senior.pers.toLowerCase(), kPers: kid.pers.toLowerCase() } }
  if (teach < 0.4) return { key: 'training.reasonPoorTeacher', vars: { senior: last } }
  if (l < 0.45) return { key: 'training.reasonNotListening', vars: {} }
  if (gap >= 16) return { key: 'training.reasonAgeGap', vars: { gap } }
  if (senior.a.lea >= 15) return { key: 'training.reasonLeads', vars: { senior: last } }
  return { key: 'training.reasonSteady', vars: {} }
}

export function fitReason(senior: Player, kid: Player): string {
  const r = reasonOf(senior, kid)
  return t(r.key, r.vars)
}

/** The same line, pinned to English, for anything written into a save. */
export function fitReasonEn(senior: Player, kid: Player): string {
  const r = reasonOf(senior, kid)
  return tIn('en', r.key, r.vars)
}

/**
 * ---- WHAT A PAIRING ACTUALLY DOES (1.8.0) ----
 *
 * Owner: "We need to rethink how we select these and the impact this has."
 *
 * Before this, a paired kid had a 4.5% chance a week (times the fit) of +1 on
 * a RANDOM attribute - a prop could come out of a season under a hooker's wing
 * with better goal kicking - printed on top of his rating and then quietly
 * taken back by the summer's level pull (ageing.ts). The only lasting part was
 * a +6% on his summer growth roll (rollover.devFactor), which nobody could see.
 * The mentor's position, his experience and what he was actually good at did
 * not enter into it, and nothing recorded what the kid had gained.
 *
 * Now, user club only as before:
 *   WHAT HE TEACHES is what he has: the mentor's clearest edges over the kid,
 *     among the attributes the kid's own position leans on (mentorTeaches).
 *     A coached point is a training point (ageing.trainPoint): it goes where
 *     the mentor points it and is paid for from the kid's least needed
 *     surplus, so the kid becomes more of the player he is, not a bigger one.
 *   THE REAL GROWTH is a rating point, below his potential, at 2% a week times
 *     the pairing's rate: about one a season for an average pairing, about
 *     1.5 for the best and under half for the worst. The same order as the
 *     old printed points were worth, but real, and it stays.
 *   THE RATE is the fit (character and leadership, mentorBoost, unchanged and
 *     still mean-neutral), times the position link (same position 1.2, same
 *     unit 1.05, the other end of the pitch 0.85), times experience (up to
 *     +10% for an older, capped man), times the two-kids load.
 * The devFactor term and the slow take-over of the mentor's character are
 * untouched. Every coached point and rating point goes on the pair's ledger
 * (taught, grew) so the Team Report shows it happening.
 */

/** The four units of a side: a man teaches his own unit best. */
const UNITS: Pos[][] = [['LP', 'HK', 'TP'], ['LK', 'FL', 'N8'], ['SH', 'FH'], ['CE', 'WG', 'FB']]

export type PosLink = 'same' | 'related' | 'other'

/** How close the two men's jobs are: the same position (either man's
 *  alternatives count), the same unit, or neither. */
export function posLink(senior: Pick<Player, 'pos' | 'alt'>, kid: Pick<Player, 'pos' | 'alt'>): PosLink {
  if (senior.pos === kid.pos || (senior.alt ?? []).includes(kid.pos) || (kid.alt ?? []).includes(senior.pos)) return 'same'
  const unit = UNITS.find(u => u.includes(kid.pos))
  return unit?.includes(senior.pos) ? 'related' : 'other'
}

export const POS_RATE: Record<PosLink, number> = { same: 1.2, related: 1.05, other: 0.85 }

/** 0 to 1: how much a man has seen. Half of it is years past the mentoring
 *  age, half is Test caps - a 34-year-old with forty caps is the full set. */
export function mentorExperience(senior: Pick<Player, 'age' | 'caps'>): number {
  const yrs = clamp((senior.age - MENTOR_MIN_AGE) / 6, 0, 1)
  const caps = clamp((senior.caps ?? 0) / 40, 0, 1)
  return (yrs + caps) / 2
}

/**
 * The pairing's rate against an average one at full attention (1.0). The
 * load reads the pairs as they stand, so a preview of a senior who already
 * has another kid is quoted the three-quarter speed he would actually give.
 */
export function mentorRate(state: GameState, senior: Player, kid: Player): number {
  const others = (state.mentors ?? []).filter(mp => mp.senior === senior.id && mp.kid !== kid.id).length
  const load = others >= 1 ? 0.75 : 1
  return mentorBoost(senior, kid) * load * POS_RATE[posLink(senior, kid)] * (1 + 0.1 * mentorExperience(senior))
}

/**
 * ---- A PAIRING GROWS, IT IS NOT SWITCHED ON (1.8.2) ----
 *
 * Owner: "Mentoring should grow or flourish over time, not be an instant
 * success." Until now a pairing made on Monday ran at its full rate from its
 * first week, so the best part of a pairing was the moment it was made.
 *
 * Now the rate above is what the pairing is worth ONCE THE TWO KNOW EACH
 * OTHER, and the relationship has to get there. How close it has come is
 * mentorBond: 1 - e^(-weeks / pace), a curve that starts near nothing and
 * levels off. The pace is the pair's chemistry (pairChem: the character fit
 * and the position link, the things that decide whether two men click), so a
 * Leader with a Professional of his own position is most of the way there in a
 * couple of months, an average pair in a season's first third, and a pair that
 * does not click creeps up slowly to a low ceiling and stays there.
 *
 * How far it can come is the chemistry too (bondCeiling): a pair that clicks
 * settles above the old flat rate, one that does not stalls near half of it.
 *
 * THE SEASON STAYS WHAT IT WAS. RAMP_SCALE is set so an average ESTABLISHED
 * pairing (its second season) is worth what every pairing used to be worth,
 * about one rating point, and its first season, the ramp included, a fifth
 * less: across 1,858 real pairings at six clubs the old flat season was 0.85
 * rating points, the new first season 0.69 and the second 0.87.
 * scripts/mentorimpact.ts measures both. The instant front-loaded weeks are
 * what went.
 *
 * Weeks are calendar weeks since the pairing began (the ledger's `since`),
 * so the close season counts: two men who spent the summer in touch are
 * further on in August than two who have just met.
 */
export const RAMP_SCALE = 1.05

/** The pair's chemistry against an average pair (1.0): the character fit and
 *  how close their jobs are. This, not the load or his caps, decides how fast
 *  they click and how far. */
export function pairChem(senior: Player, kid: Player): number {
  return mentorBoost(senior, kid) * POS_RATE[posLink(senior, kid)]
}

/** Weeks for the relationship to come about two thirds of the way. Five for
 *  the best pairs, nine for an average one, twenty for one that is not
 *  clicking. */
export function bondPace(chem: number): number {
  return clamp(9 / Math.pow(Math.max(0.1, chem), 1.5), 5, 20)
}

/** 0 to 1: how far the relationship has come after `weeks` together. */
export function mentorBond(senior: Player, kid: Player, weeks: number): number {
  if (weeks <= 0) return 0
  return 1 - Math.exp(-weeks / bondPace(pairChem(senior, kid)))
}

/**
 * How far this relationship can go, against an average one (about 0.95 across
 * real squads): a pair that does not click tops out near half, one that sparks
 * goes past the old flat rate. This is the stall and the flourish; the pace
 * above is only how soon they get there.
 */
export function bondCeiling(chem: number): number {
  return clamp(0.4 + 0.6 * chem, 0.55, 1.15)
}

/** The multiplier the week's rolls take from the relationship: nothing on day
 *  one, rising to RAMP_SCALE times the pair's ceiling once they are settled. */
export function mentorRamp(senior: Player, kid: Player, weeks: number): number {
  return RAMP_SCALE * bondCeiling(pairChem(senior, kid)) * mentorBond(senior, kid, weeks)
}

/** Weeks a pairing has run, counting the week it is in as one. */
export function pairWeeks(state: GameState, mp: { since?: number }): number {
  return mp.since == null ? 0 : Math.max(0, absWeek(state.season, state.week) - mp.since) + 1
}

/**
 * ---- A PAIRING IS A GAMBLE FOR ITS FIRST MONTH (owner, round 4) ----
 *
 * Owner: "You shouldn't know how a mentorship is going to work for at least
 * one month. You shouldn't be able to see things like 'inseparable' until
 * that month. So it's a gamble whether it works."
 *
 * Nothing about the mechanics changes: the fit, the ramp and the rolls are
 * exactly what they were. What changes is what the manager is TOLD. For the
 * first REVEAL_WEEKS calendar weeks of a pairing the screen says only that it
 * is too early to tell, the picker shows no fit or forecast at all, and no
 * report says how the two are getting on. After that the card says how it is
 * going in plain words. scripts/mentorreveal.ts holds this, news included.
 */
export const REVEAL_WEEKS = 4

/** Whether the manager may yet know how this pairing is going. A pairing from
 *  before the ledger (no `since`) is an old one, so it is known. */
export function pairRevealed(state: GameState, mp: { since?: number }): boolean {
  return mp.since == null || absWeek(state.season, state.week) - mp.since >= REVEAL_WEEKS
}

export type MentorStage = 'early' | 'growing' | 'flourishing' | 'settled' | 'stalled'
/** Below this chemistry a pairing does not click: it creeps to a low ceiling. */
export const STALL_CHEM = 0.75
/** At or above it, a settled pairing is a flourishing one. */
export const FLOURISH_CHEM = 1.15

/**
 * Where the relationship is, in a word for the page and the reports:
 * early days for the first six weeks, whoever the two are; then not clicking
 * for a pair without the chemistry, growing while the bond is still coming,
 * and flourishing or settled once it has come.
 */
export function mentorStage(senior: Player, kid: Player, weeks: number): MentorStage {
  if (weeks < 6) return 'early'
  const chem = pairChem(senior, kid)
  if (chem < STALL_CHEM) return 'stalled'
  if (mentorBond(senior, kid, weeks) < 0.8) return 'growing'
  return chem >= FLOURISH_CHEM ? 'flourishing' : 'settled'
}

export const STAGE_KEY: Record<MentorStage, string> = {
  early: 'training.stageEarly', growing: 'training.stageGrowing', flourishing: 'training.stageFlourishing',
  settled: 'training.stageSettled', stalled: 'training.stageStalled',
}

/** Weekly chances at a rate of 1.0. */
export const COACHED_PER_WEEK = 0.045
export const GROWTH_PER_WEEK = 0.02
/** roughly the weeks a season's training loop runs, for "a season" estimates */
const SEASON_TRAINING_WEEKS = 44

/**
 * What the senior can pass on to this kid: up to three attributes where the
 * senior is clearly better (two points or more) and the kid's position
 * actually uses them (template weight 0.5 or more), biggest useful edge first.
 */
export function mentorTeaches(senior: Player, kid: Player): (keyof Attrs)[] {
  const edge = (k: keyof Attrs) => (senior.a[k] - kid.a[k]) * attrWeight(kid.pos, k)
  return (Object.keys(kid.a) as (keyof Attrs)[])
    .filter(k => k !== 'lea' && attrWeight(kid.pos, k) >= 0.5 && senior.a[k] - kid.a[k] >= 2)
    .sort((a, b) => edge(b) - edge(a))
    .slice(0, 3)
}

/** The expected effect over a season, for the screen: rating points and
 *  coached attribute points. Growth stops at his potential, so a kid close to
 *  it is quoted only the room he has. */
export function mentorForecast(state: GameState, senior: Player, kid: Player) {
  const rate = mentorRate(state, senior, kid)
  const teaches = mentorTeaches(senior, kid)
  // the next season of the relationship as it stands: a pairing not yet made
  // starts from nothing, a running one from its own week
  const mp = (state.mentors ?? []).find(x => x.kid === kid.id && x.senior === senior.id)
  const w0 = mp ? pairWeeks(state, mp) : 0
  let ramp = 0
  for (let i = 1; i <= SEASON_TRAINING_WEEKS; i++) ramp += mentorRamp(senior, kid, w0 + i)
  const rating = Math.min(Math.max(0, kid.pa - kid.ca), GROWTH_PER_WEEK * rate * ramp)
  const coached = teaches.length ? COACHED_PER_WEEK * rate * ramp : 0
  return {
    rate, teaches, rating, coached, link: posLink(senior, kid), exp: mentorExperience(senior),
    weeks: w0, stage: mentorStage(senior, kid, w0), bond: mentorBond(senior, kid, w0),
  }
}

/**
 * One week of a pairing, for a kid at the user's club (season.weeklyTraining).
 * Replaces the old random-attribute roll and spends its draws in the same
 * order (the coached roll, its pick, the character roll) plus one for the
 * growth roll, so the rest of the week moves as little as it can.
 */
export function mentorWeek(state: GameState, p: Player, rng: Rng) {
  const pair = (state.mentors ?? []).find(mp => mp.kid === p.id)
  if (!pair) return
  const senior = state.players[pair.senior]
  if (!senior) return
  // a pairing from an older save opens its ledger on its first week here
  if (pair.since == null) { pair.since = absWeek(state.season, state.week); pair.ca0 = p.ca }
  // the pairing's worth once settled, times how far the two have come
  const rate = mentorRate(state, senior, p) * mentorRamp(senior, p, pairWeeks(state, pair))
  if (rng() < COACHED_PER_WEEK * rate) {
    const teaches = mentorTeaches(senior, p)
    const pick = rng()
    const k = teaches.length ? teaches[Math.floor(pick * teaches.length)] : null
    // the last points are the hardest (E6): the same deterministic roll as training
    if (k && trainPoint(p, k, teaches, attrRoll(state.seed, p.id, absWeek(state.season, state.week), k))) {
      pair.taught = { ...(pair.taught ?? {}), [k]: (pair.taught?.[k] ?? 0) + 1 }
    }
  }
  if (p.ca < p.pa && rng() < GROWTH_PER_WEEK * rate) {
    p.ca += 1
    pair.grew = (pair.grew ?? 0) + 1
  }
  if (rng() < 0.008 && p.pers !== senior.pers) {
    p.pers = senior.pers
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'youth', read: false,
      subject: `${p.name.split(' ').slice(-1)[0]} is turning into his mentor`,
      body: `The coaches have noticed it in the little things - the extras after training, the way he talks in the huddle. ${p.name} is starting to carry himself like ${senior.name}. Character: now ${senior.pers.toLowerCase()}.`,
      k: 'news.becomesMentor',
      v: { player: p.name, last: p.name.split(' ').slice(-1)[0], mentor: senior.name },
      playerId: p.id,
    })
  }
}

/** Why a pairing cannot be made, or null. One predicate for the screen and
 *  startMentoring, so a button is never live for a pairing that would fail. */
export function pairBlock(state: GameState, senior: Player, kid: Player): 'ineligible' | 'taken' | 'full' | 'cap' | null {
  const pairs = state.mentors ?? []
  if (!canMentor(senior) || !canBeMentored(kid) || senior.id === kid.id) return 'ineligible'
  if (pairs.some(mp => mp.kid === kid.id)) return 'taken'
  if (pairs.filter(mp => mp.senior === senior.id).length >= MENTOR_MAX_KIDS) return 'full'
  if (pairs.length >= mentorCap(state)) return 'cap'
  return null
}

/** Start a pairing with its ledger open. The one place a pair is made, so the
 *  screen and the probes build the same record. Returns why not, or null. */
export function startMentoring(state: GameState, seniorId: number, kidId: number): string | null {
  const s = state.players[seniorId]
  const k = state.players[kidId]
  if (!s || !k) return 'ineligible'
  const no = pairBlock(state, s, k)
  if (no) return no
  // pers0: what he was when the pairing began, so graduation can see him
  // change (mentorGraduations)
  state.mentors = [...(state.mentors ?? []), { senior: seniorId, kid: kidId, pers0: k.pers, since: absWeek(state.season, state.week), ca0: k.ca, taught: {}, grew: 0 }]
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'youth', read: true,
    subject: `${s.name} takes ${k.name.split(' ').slice(-1)[0]} under his wing`,
    body: `The old pro and the academy kid: ${s.name} will mentor ${k.name} for the season - extras after training, lifts to the ground, the lot. This is how clubs pass themselves on.`,
    k: 'news.mentorStart',
    v: { mentor: s.name, player: k.name, last: k.name.split(' ').slice(-1)[0] },
    playerId: k.id,
  })
  return null
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
    // THE REPORT FOLLOWS THE RELATIONSHIP (1.8.2), not the fit alone: a pair
    // is early days until it has had time, then growing, flourishing, settled
    // or not clicking (mentorStage). Settled is fine, and fine is not news.
    const weeks = pairWeeks(state, mp)
    const stage = mentorStage(s, k, weeks)
    const base = { last, seniorLast: s.name.split(' ').slice(-1)[0], kid: k.name, senior: s.name, stage_k: STAGE_KEY[stage] }
    // nothing that says how the two are getting on before the month is up
    // (pairRevealed); the early-days note says only that it is early
    if (stage !== 'early' && !pairRevealed(state, mp)) continue
    if (stage === 'early') {
      // once, on the first report day after the pairing was made
      if (weeks > REPORT_EVERY) continue
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'youth', read: false,
        subject: tIn('en', 'news.mentEarlySubj', base),
        body: tIn('en', 'news.mentEarly', base),
        k: 'news.mentEarly', v: base,
        playerId: k.id,
      })
    } else if (stage === 'growing') {
      // a pairing on the up is worth a line; a slow one that will stall says so below
      if (pairChem(s, k) < 1) continue
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'youth', read: false,
        subject: tIn('en', 'news.mentGrowingSubj', base),
        body: tIn('en', 'news.mentGrowing', base),
        k: 'news.mentGrowing', v: base,
        playerId: k.id,
      })
    } else if (stage === 'flourishing') {
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'youth', read: false,
        subject: `${last} is thriving under ${s.name.split(' ').slice(-1)[0]}`,
        body: `${tIn('en', fitKey(fit))}. ${fitReasonEn(s, k)} The academy coach says ${k.name} has started doing the unglamorous parts without being asked, `
          + `which is the bit you cannot coach. He is developing faster for it.`,
        k: 'news.mentThriving',
        v: {
          last, seniorLast: s.name.split(' ').slice(-1)[0], kid: k.name,
          fit_k: fitKey(fit), reason_k: reasonOf(s, k).key, ...reasonOf(s, k).vars, stage_k: base.stage_k,
        },
        playerId: k.id,
      })
    } else if (stage === 'stalled') {
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'youth', read: false,
        subject: `The ${s.name.split(' ').slice(-1)[0]} and ${last} pairing is not taking`,
        body: `${tIn('en', fitKey(fit))}. ${fitReasonEn(s, k)} ${k.name} is getting very little out of it. `
          + `Nothing has gone wrong between them; it simply is not working, and the season is long enough for a fresh start to pay.`,
        k: 'news.mentFailing',
        v: {
          last, seniorLast: s.name.split(' ').slice(-1)[0], kid: k.name,
          fit_k: fitKey(fit), reason_k: reasonOf(s, k).key, ...reasonOf(s, k).vars, stage_k: base.stage_k,
        },
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
      subject: tIn('en', 'news.mentorSpreadSubj', { last }),
      body: tIn('en', 'news.mentorSpread', { name: s.name }),
      k: 'news.mentorSpread', v: { name: s.name, last },
      playerId: s.id,
    })
  }
}
