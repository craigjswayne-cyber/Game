// Backroom staff as people, not sliders (8-batch feedback): every coach is a
// named man with a badge - Bronze, Silver or Gold - and badges are earned on a
// coaching course with a real chance of failing it.
import { STAFF_INFO, fmtMoney, fmtWage, logDecision, type GameState, type StaffLevels, type StaffPerson } from './model'
import { t, tIn, type Vars } from './i18n'
import { mulberry32 } from './rng'
import { regenName } from './nations'

export type StaffRole = keyof StaffLevels

/** The badge names as ENGLISH, for the paperwork a career keeps: news bodies
 *  and the decision log are written once and read forever, so they must not
 *  change language under the manager. Screens use badgeLabel() instead. */
export const BADGE = ['Unbadged', 'Bronze', 'Silver', 'Gold']
export const badgeLabel = (tier: number) => t(`staff.badge${tier}`)
export const BADGE_COL = ['var(--text-muted)', 'var(--prop-tee-edge)', 'var(--text-secondary)', 'var(--gold)']

/** Pass rate for a coaching course. Hard number, straight from the brief. */
export const EXAM_PASS_PCT = 58
// There was a COURSE_WEEKS = 6 here. Nothing read it: courses resolve the day
// they are sat. A constant nobody uses, sitting next to a live one, is how the
// next reader concludes that a course still takes six weeks - which is exactly
// what staffprobe was still asserting.
/** A failed badge cannot be re-sat for four weeks - about a month. */
export const RETAKE_WEEKS = 4
export const courseFee = (tier: number) => 60_000 * tier

export interface StaffCandidate {
  name: string
  nat: string
  age: number
  tier: number
  wage: number
  /** compensation due to his current employer */
  fee: number
  /** club reputation he expects before he will listen */
  wants: number
  trait: string
}

const TRAITS = [
  'Man-manager', 'Sports scientist', 'Set-piece obsessive', 'Old-school hard yards',
  'Analyst at heart', 'Ex-international', 'Youth whisperer', 'Detail merchant',
  'Calm head', 'Motivator',
]

/** A stored trait, shown in the reader's language. The stored value stays
 *  English because it is the key relation() matches on and it is inside every
 *  save already. */
export const traitLabel = (trait: string) =>
  t(`staff.trait${trait.replace(/[^A-Za-z]+(.)/g, (_, c) => c.toUpperCase()).replace(/^./, c => c.toUpperCase())}`)

const NATS = ['ENG', 'WAL', 'IRE', 'SCO', 'FRA', 'NZL', 'AUS', 'RSA', 'ARG', 'ITA', 'FIJ']

/**
 * STAFF CHEMISTRY (25D-3, the Motorsport Manager idea the user picked out:
 * staff whose philosophies click or clash). Coaching is a room of strong
 * opinions, and some combinations feed each other while some fight:
 *
 *   CLICK: the numbers men sharpen each other, the people men make a dressing
 *   room hum, the forwards men build one programme instead of two, and kids
 *   listen harder to a man with caps when a youth specialist points them at
 *   him.
 *
 *   CLASH: GPS vests against hill runs, laptops against been-there-done-that,
 *   and a hype man against death-by-video-session.
 *
 * The score is a small, DETERMINISTIC development effect at the user's club
 * (devFactor reads it, like the assistant and the mentors) and a line of
 * colour on hire day. No rng anywhere: the same staff room always has the
 * same weather.
 */
const CLICKS: [string, string, string][] = [
  ['Analyst at heart', 'Detail merchant', 'staff.clickNumbers'],
  ['Man-manager', 'Motivator', 'staff.clickRoom'],
  ['Set-piece obsessive', 'Old-school hard yards', 'staff.clickScrum'],
  ['Youth whisperer', 'Ex-international', 'staff.clickCaps'],
]
const CLASHES: [string, string, string][] = [
  ['Old-school hard yards', 'Sports scientist', 'staff.clashGps'],
  ['Analyst at heart', 'Ex-international', 'staff.clashLaptop'],
  ['Detail merchant', 'Motivator', 'staff.clashVideo'],
]

function relation(a: string, b: string): { kind: 'click' | 'clash'; note: string } | null {
  for (const [x, y, note] of CLICKS) if ((a === x && b === y) || (a === y && b === x)) return { kind: 'click', note }
  for (const [x, y, note] of CLASHES) if ((a === x && b === y) || (a === y && b === x)) return { kind: 'clash', note }
  return null
}

/** Every click and clash in the user's staff room, named. The Coaching page
 *  reads this: without it the system is invisible the moment the hire-day
 *  letter scrolls out of the inbox, and a manager three seasons in has no
 *  way to know why his kids are coming on. */
export function staffChemPairs(state: GameState): { a: string; b: string; kind: 'click' | 'clash'; note: string }[] {
  const people = Object.values(state.staffPeople ?? {}).filter((p): p is StaffPerson => !!p)
  const out: { a: string; b: string; kind: 'click' | 'clash'; note: string }[] = []
  for (let i = 0; i < people.length; i++) {
    for (let j = i + 1; j < people.length; j++) {
      const r = relation(people[i].trait, people[j].trait)
      if (r) out.push({ a: people[i].name, b: people[j].name, kind: r.kind, note: r.note })
    }
  }
  return out
}

/** Net chemistry of the user's staff room: +1 per click, -1 per clash,
 *  counted over every pair of appointed coaches. */
export function staffChem(state: GameState): number {
  return staffChemPairs(state).reduce((s, r) => s + (r.kind === 'click' ? 1 : -1), 0)
}

function roleHash(role: string): number {
  let h = 2166136261
  for (let i = 0; i < role.length; i++) h = ((h ^ role.charCodeAt(i)) * 16777619) >>> 0
  return h >>> 0
}

/** The 58% roll: a deterministic gate, never a draw from the shared stream. */
function examRoll(seed: number, abs: number, role: string): number {
  let h = (seed ^ Math.imul(abs, 2654435761)) >>> 0
  h = (h ^ roleHash(role)) >>> 0
  // murmur3 fmix32: a single weak avalanche left the pass rate at 79%
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b) >>> 0
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35) >>> 0
  h ^= h >>> 16
  return (h >>> 0) % 100
}

/**
 * Three men on the market for a role. Derived from the save's seed, so the
 * shortlist is stable while you think about it and refreshes each season (or
 * whenever you appoint someone).
 */
export function staffCandidates(state: GameState, role: StaffRole): StaffCandidate[] {
  const club = state.clubs[state.userClubId]
  const rep = club?.rep ?? 60
  const rng = mulberry32((state.seed ^ roleHash(role) ^ Math.imul(state.season + 1, 7919) ^ Math.imul((state.staffSalt ?? 0) + 1, 104729)) >>> 0)
  const out: StaffCandidate[] = []
  for (let i = 0; i < 3; i++) {
    const roll = rng() * 100 + (rep - 70) * 0.8
    const tier = roll > 78 ? 3 : roll > 44 ? 2 : 1
    const nat = NATS[Math.floor(rng() * NATS.length)]
    const wage = Math.round((STAFF_INFO[role].wage * tier * (0.85 + rng() * 0.4)) / 100) * 100
    const fee = Math.round((wage * (8 + tier * 6)) / 1000) * 1000
    const wants = tier === 3 ? 74 + Math.floor(rng() * 8) : tier === 2 ? 60 + Math.floor(rng() * 8) : 0
    out.push({
      name: regenName(rng, nat),
      nat, age: 32 + Math.floor(rng() * 26), tier, wage, fee, wants,
      trait: TRAITS[Math.floor(rng() * TRAITS.length)],
    })
  }
  return out
}

/** Would he even take the call? */
export function staffInterest(state: GameState, c: StaffCandidate): 'keen' | 'persuadable' | 'no' {
  const rep = state.clubs[state.userClubId]?.rep ?? 60
  if (rep >= c.wants + 6) return 'keen'
  if (rep >= c.wants) return 'persuadable'
  return 'no'
}

/**
 * WHY HE CANNOT BE APPOINTED TODAY, or null if he can be.
 *
 * User, live on a phone: "ive tried to hire a coach who is keen but no matter
 * what I press when in market he won't sign and no reason? like if I have no
 * money I should be told ive not got budget."
 *
 * He was right about the symptom and right about the cause. A candidate the
 * club could not pay the compensation for still showed as Keen, still offered
 * a live-looking Appoint button, and appointStaff's refusal - which has always
 * been a full sentence - was rendered into a banner at the TOP of the Backroom
 * Staff panel. scripts/hireprobe.mjs measured it at 786px above the thumb that
 * tapped the button, on a page scrolled down to the eighth role card. A reply
 * you cannot see is a dead button.
 *
 * So the reason moves in front of the decision. This is the ONE predicate: the
 * market row reads it to write the reason next to the man's name and to disable
 * his button, and appointStaff reads it to refuse. They cannot drift, which is
 * the whole point - a row that offers a button and a handler that refuses it is
 * how this bug is written a second time.
 *
 *   short - fits on the candidate row, next to the wage
 *   long  - the sentence shown when the refusal has to be spelled out
 */
export interface AppointBlock { short: string; long: string }

export function appointBlock(state: GameState, c: StaffCandidate): AppointBlock | null {
  const club = state.clubs[state.userClubId]
  // These are shown on the card the manager just tapped, so they are in his
  // language rather than the career's paperwork language.
  if (!club) return { short: t('staff.blockNoClub'), long: t('staff.blockNoClubLong') }
  if (staffInterest(state, c) === 'no') {
    return {
      short: t('staff.blockBiggerClub'),
      long: t('staff.blockBiggerClubLong', { name: c.name, badge: badgeLabel(c.tier).toLowerCase() }),
    }
  }
  if (club.balance < c.fee) {
    return {
      short: t('staff.blockNoBudget', { have: fmt(club.balance), need: fmt(c.fee) }),
      long: t('staff.blockNoBudgetLong', { name: c.name, need: fmt(c.fee), have: fmt(club.balance) }),
    }
  }
  return null
}

/** Appoint a candidate. Returns the line to show the manager. */
export function appointStaff(state: GameState, role: StaffRole, idx: number): string {
  const club = state.clubs[state.userClubId]
  const cands = staffCandidates(state, role)
  const c = cands[idx]
  if (!c) return t('staff.candGone')
  const block = appointBlock(state, c)
  if (block) return block.long
  const info = STAFF_INFO[role]
  const outgoing = state.staffPeople?.[role]
  club.balance -= c.fee
  state.staff[role] = c.tier
  state.staffSalt = (state.staffSalt ?? 0) + 1
  state.staffPeople = {
    ...(state.staffPeople ?? {}),
    [role]: {
      name: c.name, nat: c.nat, age: c.age, tier: c.tier, wage: c.wage,
      trait: c.trait, since: state.season, course: null,
    } as StaffPerson,
  }
  // hire-day chemistry beat: does the new man click or clash with anyone
  // already in the room? One line each, and the manager learns the pairs
  // the way MSM taught them - by reading the news, not a tooltip
  const chemLines: string[] = []
  const chemRows: Vars[] = []
  for (const [otherRole, other] of Object.entries(state.staffPeople)) {
    if (otherRole === role || !other) continue
    const r = relation(c.trait, other.trait)
    if (!r) continue
    chemLines.push(r.kind === 'click'
      ? `The staff room approves: he and ${other.name} click - ${tIn('en', r.note)}.`
      : `One cloud on the horizon: he and ${other.name} see the game very differently - ${tIn('en', r.note)}.`)
    chemRows.push({ k: r.kind === 'click' ? 'news.staffClick' : 'news.staffClash', other: other.name, note_k: r.note })
  }
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
    subject: `${c.name} appointed ${tIn('en', info.name)}`,
    body: `${club.name} have their man: ${c.name}, ${c.age}, a ${BADGE[c.tier].toLowerCase()}-badge ${tIn('en', info.name).toLowerCase()} known as a ${c.trait.toLowerCase()}. ${fmt(c.fee)} compensation, ${fmtWage(c.wage)} a week.${outgoing ? ` ${outgoing.name} leaves with the club's thanks.` : ''}${chemLines.length ? ` ${chemLines.join(' ')}` : ''}`,
    k: 'news.staffHired',
    v: {
      name: c.name, age: c.age, club: club.name, role_k: info.name,
      badge_k: `staff.badge${c.tier}`, trait_k: `traits.${c.trait}`,
      fee: fmt(c.fee), wage: fmtWage(c.wage),
      out_k: outgoing ? 'news.staffOut' : 'common.nothing', out: outgoing?.name ?? '',
      chem_k: chemRows.length ? 'news.staffChem' : 'common.nothing',
      rows_l: JSON.stringify(chemRows),
    },
  })
  logDecision(state, 'dec.appointedStaff', { name: c.name, role_k: info.name, badge_k: `staff.badge${c.tier}`, fee: fmt(c.fee), wage: fmtWage(c.wage), out_k: outgoing ? 'dec.andHeLeft' : 'common.nothing', out: outgoing?.name ?? '' }, true)
  return t('reply.staffAppointed', { name: c.name, role_k: info.name, fee: fmt(c.fee) })
}

/**
 * Put a coach in for his next badge. The examiners decide there and then.
 *
 * It used to be a six-week wait for a verdict that arrived as an inbox item,
 * which meant the one decision on the page had no visible consequence and you
 * had forgotten you made it by the time it landed (user: "the coaching staff
 * doing a course - the result should be instant - if they pass upgrade, if they
 * fail then they cant do it again for another month"). Pass and he is a better
 * coach before you leave the screen; fail and the fee is gone and he cannot sit
 * it again for four weeks.
 *
 * The roll is a deterministic gate on (seed, week, role) - never the shared rng -
 * so it cannot be re-rolled by looking at it twice, and the cooldown means it
 * cannot be re-rolled by trying again either.
 */

/** Why this coach cannot be put in for his badge today, or null if he can be.
 *
 *  The Assess button's twin of appointBlock, and it exists for the same reason:
 *  the button used to be live whatever the balance said, and the refusal was
 *  rendered into the same off-screen banner. One predicate, read by the screen
 *  to grey the button and write the reason under it, and by sendToCourse to
 *  refuse. */
export function courseBlock(state: GameState, role: StaffRole): AppointBlock | null {
  const club = state.clubs[state.userClubId]
  const p = state.staffPeople?.[role]
  const info = STAFF_INFO[role]
  const say = (short: string, long: string): AppointBlock => ({ short, long })
  if (!club) return say(t('staff.courseNoClub'), t('staff.courseNoClubLong'))
  if (!p) return say(t('staff.coursePostVacant'), t('staff.coursePostVacantLong', { role: t(info.name).toLowerCase() }))
  if (p.tier >= 3) return say(t('staff.courseGold'), t('staff.courseGoldLong', { name: p.name }))
  if (p.course) return say(t('staff.courseSitting'), t('staff.courseSittingLong', { name: p.name }))
  const abs = state.season * 100 + state.week
  if ((p.retakeAt ?? 0) > abs) {
    const wks = p.retakeAt! - abs
    return say(t(wks === 1 ? 'staff.courseResitsOne' : 'staff.courseResits', { n: wks }),
      t(wks === 1 ? 'staff.courseResitsLongOne' : 'staff.courseResitsLong', { name: p.name, n: wks }))
  }
  const fee = courseFee(p.tier)
  if (club.balance < fee) {
    return say(t('staff.courseNoBudget', { have: fmt(club.balance), need: fmt(fee) }),
      t('staff.courseNoBudgetLong', { need: fmt(fee), have: fmt(club.balance) }))
  }
  return null
}

export function sendToCourse(state: GameState, role: StaffRole): string {
  const block = courseBlock(state, role)
  if (block) return block.long
  const club = state.clubs[state.userClubId]
  const p = state.staffPeople![role]!
  const info = STAFF_INFO[role]
  const abs = state.season * 100 + state.week
  const fee = courseFee(p.tier)
  club.balance -= fee
  const toTier = p.tier + 1
  const badge = BADGE[toTier].toLowerCase()
  const passed = examRoll(state.seed, abs, role) < EXAM_PASS_PCT
  if (passed) {
    p.tier = Math.min(3, toTier)
    p.wage = Math.round((p.wage * 1.15) / 100) * 100
    p.passed = (p.passed ?? 0) + 1
    state.staff[role] = p.tier
    logDecision(state, 'dec.badgePassed', { name: p.name, badge_k: `staff.badge${p.tier}`, role_k: info.name, wage: fmtWage(p.wage) }, true)
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
      subject: `🎓 ${p.name} passes his ${badge} badge`,
      body: `A day of written work and an assessed session in front of examiners who have seen it all, and ${p.name} came through it. Framed certificate, handshake at the training ground, and a better ${tIn('en', info.name).toLowerCase()} than the club had this morning. His pay rises to ${fmtWage(p.wage)} a week.`,
      k: 'news.badgePass',
      v: { name: p.name, badge_k: `staff.badge${p.tier}`, role_k: info.name, wage: fmtWage(p.wage) },
    })
    return t('reply.badgePassed', { name: p.name, badge_k: `staff.badge${p.tier}`, wage: fmtWage(p.wage) })
  }
  p.failed = (p.failed ?? 0) + 1
  p.retakeAt = abs + RETAKE_WEEKS
  logDecision(state, 'dec.badgeFailedFee', { name: p.name, badge_k: `staff.badge${toTier}`, fee: fmt(fee) }, false)
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
    subject: `${p.name} falls short of his ${badge} badge`,
    body: `The examiners wanted more from ${p.name} on the assessed session. He took it well, asked for the feedback in writing and pinned it above his desk. The ${fmt(fee)} is spent either way, and the next intake will not take him for a month.`,
    k: 'news.badgeFail',
    v: { name: p.name, badge_k: `staff.badge${toTier}`, fee: fmt(fee) },
  })
  return t('reply.badgeFailed', { name: p.name, fee: fmt(fee) })
}


/**
 * Weekly: settle any course still in flight.
 *
 * Courses resolve instantly now, so nothing new ever sits in p.course - this
 * exists so a save written while the six-week wait was still a thing does not
 * strand a coach mid-course forever. It can go once no such saves are in use.
 */
export function resolveCourses(state: GameState) {
  if (!state.staffPeople) return
  const abs = state.season * 100 + state.week
  for (const key of Object.keys(state.staffPeople) as StaffRole[]) {
    const p = state.staffPeople[key]
    if (!p?.course || abs < p.course.done) continue
    const toTier = p.course.toTier
    const passed = examRoll(state.seed, p.course.done, key) < EXAM_PASS_PCT
    p.course = null
    const info = STAFF_INFO[key]
    if (passed) {
      p.tier = Math.min(3, toTier)
      p.wage = Math.round((p.wage * 1.15) / 100) * 100
      p.passed = (p.passed ?? 0) + 1
      state.staff[key] = p.tier
      logDecision(state, 'dec.badgePassed', { name: p.name, badge_k: `staff.badge${p.tier}`, role_k: info.name, wage: fmtWage(p.wage) }, true)
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
        subject: `🎓 ${p.name} passes his ${BADGE[p.tier].toLowerCase()} badge`,
        body: `Framed certificate, handshake at the training ground, and a better ${tIn('en', info.name).toLowerCase()} than the club had last month. ${p.name} is now ${BADGE[p.tier].toLowerCase()}-badged, and his pay rises to ${fmtWage(p.wage)} a week.`,
        k: 'news.badgePassAuto',
        v: { name: p.name, badge_k: `staff.badge${p.tier}`, role_k: info.name, wage: fmtWage(p.wage) },
      })
    } else {
      p.failed = (p.failed ?? 0) + 1
      p.retakeAt = abs + RETAKE_WEEKS
      logDecision(state, 'dec.badgeFailedCourse', { name: p.name, badge_k: `staff.badge${toTier}` }, false)
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
        subject: `${p.name} falls short of his ${BADGE[toTier].toLowerCase()} badge`,
        body: `The examiners want more from ${p.name} on the assessed session. He took it well, asked for the feedback in writing and pinned it above his desk. He can sit it again in four weeks.`,
        k: 'news.badgeFailAuto',
        v: { name: p.name, badge_k: `staff.badge${toTier}` },
      })
    }
  }
}

/** Weekly staff wage bill: real salaries where a real man holds the job. */
export function staffWageBill(state: GameState): number {
  return (Object.keys(STAFF_INFO) as StaffRole[])
    .reduce((s, k) => s + (state.staffPeople?.[k]?.wage ?? state.staff[k] * STAFF_INFO[k].wage), 0)
}

/**
 * The department you inherit. An Elite 14 giant hands you a proper backroom;
 * a Championship club hands you a physio with a bad knee and good intentions.
 * Deterministic per club, so the same job always looks the same.
 */
export function inheritStaff(state: GameState, quiet = false) {
  const club = state.clubs[state.userClubId]
  if (!club) return
  const rep = club.rep
  const base = rep >= 80 ? 2 : rep >= 62 ? 1 : 0
  const rng = mulberry32((state.seed ^ roleHash(club.id) ^ 0x1d7a) >>> 0)
  state.staffPeople = {}
  for (const key of Object.keys(STAFF_INFO) as StaffRole[]) {
    const r = rng()
    const tier = Math.max(0, Math.min(3, base + (r < 0.22 ? 1 : r < 0.5 ? -1 : 0)))
    state.staff[key] = tier
  }
  seedStaffPeople(state)
  if (quiet) return
  const filled = (Object.keys(STAFF_INFO) as StaffRole[]).filter(k => state.staff[k] > 0)
  const vacant = (Object.keys(STAFF_INFO) as StaffRole[]).filter(k => state.staff[k] === 0)
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
    subject: 'The backroom staff you have inherited',
    body: `${filled.length} of the eight coaching posts are filled: ${filled.map(k => `${state.staffPeople?.[k]?.name} (${tIn('en', STAFF_INFO[k].name).toLowerCase()})`).join(', ')}.${vacant.length ? ` The ${vacant.map(k => tIn('en', STAFF_INFO[k].name).toLowerCase()).join(' and ')} job${vacant.length > 1 ? 's are' : ' is'} vacant.` : ''} Badges and hiring are on the Coaching page.`,
    k: vacant.length ? 'news.inheritedStaffVacant' : 'news.inheritedStaff',
    v: {
      n: vacant.length, filled: filled.length,
      men_l: JSON.stringify(filled.map(k => ({
        k: 'news.inheritedMan', name: state.staffPeople?.[k]?.name ?? '', role_k: STAFF_INFO[k].name,
      }))),
      jobs_l: JSON.stringify(vacant.map(k => ({ k: 'news.inheritedRole', role_k: STAFF_INFO[k].name }))),
    },
  })
}

/** Give existing saves a named face for every level they already paid for. */
export function seedStaffPeople(state: GameState) {
  state.staffPeople ??= {}
  for (const key of Object.keys(STAFF_INFO) as StaffRole[]) {
    const lvl = state.staff[key]
    if (lvl <= 0 || state.staffPeople[key]) continue
    const rng = mulberry32((state.seed ^ roleHash(key) ^ 0x5f3a) >>> 0)
    const nat = NATS[Math.floor(rng() * NATS.length)]
    state.staffPeople[key] = {
      name: regenName(rng, nat), nat, age: 36 + Math.floor(rng() * 20), tier: lvl,
      wage: lvl * STAFF_INFO[key].wage, trait: TRAITS[Math.floor(rng() * TRAITS.length)],
      since: state.season, course: null,
    }
  }
}

// one ladder for the whole game: fees and balances read as money, a weekly
// wage reads as a wage (see model.fmtWage and scripts/moneyfmt.ts)
const fmt = fmtMoney
