// Backroom staff as people, not sliders (8-batch feedback): every coach is a
// named man with a badge - Bronze, Silver or Gold - and badges are earned on a
// coaching course with a real chance of failing it.
import { STAFF_INFO, logDecision, type GameState, type StaffLevels, type StaffPerson } from './model'
import { mulberry32 } from './rng'
import { regenName } from './nations'

export type StaffRole = keyof StaffLevels

export const BADGE = ['Unbadged', 'Bronze', 'Silver', 'Gold']
export const BADGE_COL = ['#8a8a8a', '#b07a4e', '#9aa6b2', '#c9a227']

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

const NATS = ['ENG', 'WAL', 'IRE', 'SCO', 'FRA', 'NZL', 'AUS', 'RSA', 'ARG', 'ITA', 'FIJ']

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

/** Appoint a candidate. Returns the line to show the manager. */
export function appointStaff(state: GameState, role: StaffRole, idx: number): string {
  const club = state.clubs[state.userClubId]
  const cands = staffCandidates(state, role)
  const c = cands[idx]
  if (!c) return 'That candidate is no longer available.'
  if (staffInterest(state, c) === 'no') {
    return `${c.name} thanked you for the call and stayed where he is. A ${BADGE[c.tier].toLowerCase()}-badge coach wants a bigger stage than this.`
  }
  if (club.balance < c.fee) {
    return `The compensation is ${fmt(c.fee)} and the club cannot cover it this week.`
  }
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
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
    subject: `${c.name} appointed ${info.name}`,
    body: `${club.name} have their man: ${c.name}, ${c.age}, a ${BADGE[c.tier].toLowerCase()}-badge ${info.name.toLowerCase()} known as a ${c.trait.toLowerCase()}. ${fmt(c.fee)} compensation, ${fmt(c.wage)} a week.${outgoing ? ` ${outgoing.name} leaves with the club's thanks.` : ''}`,
  })
  logDecision(state, `Appointed ${c.name} as ${info.name.toLowerCase()} (${BADGE[c.tier].toLowerCase()} badge): ${fmt(c.fee)} compensation, ${fmt(c.wage)} a week.${outgoing ? ` ${outgoing.name} left.` : ''}`, true)
  return `${c.name} is your new ${info.name.toLowerCase()}. ${fmt(c.fee)} compensation paid.`
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
export function sendToCourse(state: GameState, role: StaffRole): string {
  const club = state.clubs[state.userClubId]
  const p = state.staffPeople?.[role]
  const info = STAFF_INFO[role]
  if (!p) return `Appoint a ${info.name.toLowerCase()} first.`
  if (p.tier >= 3) return `${p.name} already holds his gold badge. There is nothing left to sit.`
  if (p.course) return `${p.name} is already on a course. The examiners will not be hurried.`
  const abs = state.season * 100 + state.week
  if ((p.retakeAt ?? 0) > abs) return `${p.name} cannot sit it again yet - he failed recently and the next intake is a few weeks off.`
  const fee = courseFee(p.tier)
  if (club.balance < fee) return `The course costs ${fmt(fee)} and the money is not there.`
  club.balance -= fee
  const toTier = p.tier + 1
  const badge = BADGE[toTier].toLowerCase()
  const passed = examRoll(state.seed, abs, role) < EXAM_PASS_PCT
  if (passed) {
    p.tier = Math.min(3, toTier)
    p.wage = Math.round((p.wage * 1.15) / 100) * 100
    p.passed = (p.passed ?? 0) + 1
    state.staff[role] = p.tier
    logDecision(state, `${p.name} passed his ${badge} badge: a better ${info.name.toLowerCase()}, and ${fmt(p.wage)} a week now.`, true)
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
      subject: `🎓 ${p.name} passes his ${badge} badge`,
      body: `A day of written work and an assessed session in front of examiners who have seen it all, and ${p.name} came through it. Framed certificate, handshake at the training ground, and a better ${info.name.toLowerCase()} than the club had this morning. His pay rises to ${fmt(p.wage)} a week.`,
    })
    return `${p.name} passed. He is ${badge}-badged from today, and on ${fmt(p.wage)} a week.`
  }
  p.failed = (p.failed ?? 0) + 1
  p.retakeAt = abs + RETAKE_WEEKS
  logDecision(state, `${p.name} failed his ${badge} badge. The ${fmt(fee)} is gone and he cannot resit for a month.`, false)
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
    subject: `${p.name} falls short of his ${badge} badge`,
    body: `The examiners wanted more from ${p.name} on the assessed session. He took it well, asked for the feedback in writing and pinned it above his desk. The ${fmt(fee)} is spent either way, and the next intake will not take him for a month.`,
  })
  return `${p.name} fell short. The ${fmt(fee)} is gone and he cannot sit it again for a month.`
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
      logDecision(state, `${p.name} passed his ${BADGE[p.tier].toLowerCase()} badge: a better ${info.name.toLowerCase()}, and ${fmt(p.wage)} a week now.`, true)
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
        subject: `🎓 ${p.name} passes his ${BADGE[p.tier].toLowerCase()} badge`,
        body: `Framed certificate, handshake at the training ground, and a better ${info.name.toLowerCase()} than the club had last month. ${p.name} is now ${BADGE[p.tier].toLowerCase()}-badged, and his pay rises to ${fmt(p.wage)} a week.`,
      })
    } else {
      p.failed = (p.failed ?? 0) + 1
      p.retakeAt = abs + RETAKE_WEEKS
      logDecision(state, `${p.name} failed his ${BADGE[toTier].toLowerCase()} badge. The course fee is gone and he resits in ten weeks.`, false)
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
        subject: `${p.name} falls short of his ${BADGE[toTier].toLowerCase()} badge`,
        body: `The examiners want more from ${p.name} on the assessed session. He took it well, asked for the feedback in writing and pinned it above his desk. He can sit it again in ten weeks.`,
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
 * The department you inherit. A Top 14 giant hands you a proper backroom;
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
    body: `${filled.length} of the eight coaching posts are filled: ${filled.map(k => `${state.staffPeople?.[k]?.name} (${STAFF_INFO[k].name.toLowerCase()}, ${BADGE[state.staff[k]].toLowerCase()})`).join(', ')}.${vacant.length ? ` Nobody holds the ${vacant.map(k => STAFF_INFO[k].name.toLowerCase()).join(' or ')} job - the market is open, and badges can be earned on a course.` : ' A full department, and every man in it can still go up a badge.'}`,
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

const fmt = (n: number) => n >= 1_000_000 ? `£${(n / 1e6).toFixed(1)}m` : n >= 1000 ? `£${Math.round(n / 1000)}k` : `£${n}`
