// ---- TWO COACHES WHO STOP GETTING ON (owner, round 4) ----
//
// "Remove coaches not getting on [from the staff screen]; it should be secret
// in the game, so you should get the odd news story about the 2 specific
// coaches falling out until one is let go. It should impact the squad but you
// shouldn't see it so specifically in the staff section. Generally coaches
// should get on, but the occasional one should be impactful to the squad
// environment until released."
//
// So the staff room has no weather report any more. Coaches get on. Now and
// then (roughly once every season or two at the manager's club) two named
// coaches fall out, and while they are at odds the squad feels it: morale
// settles a little lower and the week's training takes a little less. The
// manager hears about it only through the odd short story naming the pair,
// two or three over its life, and it ends when one of them goes - released,
// replaced, or, left long enough, walking out on their own.
//
// Nothing here draws from the shared rng: every choice is a hash of the
// save's seed and the week, so the world is the same world whether or not a
// rift is running, and the same save always falls out the same way.
import { STAFF_INFO, absWeek, type GameState, type StaffLevels } from './model'
import { moveHash } from './moves'
import { tIn, type Vars } from './i18n'

type Role = keyof StaffLevels

export interface StaffRift {
  clubId: string
  a: Role
  b: Role
  aName: string
  bName: string
  /** absWeek the pair fell out */
  since: number
  /** stories written so far (the falling-out itself is the first) */
  told: number
  /** absWeek of the next story, or of the walkout once the stories are told */
  next: number
}

/** Chance, each eligible week, that two coaches fall out. With the cooldown
 *  and the life of a rift this is about one every season or two (coachriftprobe). */
export const RIFT_WEEKLY = 0.021
/** Quiet weeks after a rift ends, and at the start of a career, before another can start. */
export const RIFT_COOLDOWN = 16
/** Left alone this long, one of the two walks out. */
export const RIFT_WALKOUT = 34
/** The squad-environment cost while a rift runs, read by the weekly morale
 *  drift (target), the week's growth and focus rolls (multiplier) and the
 *  summer development factor. */
export const RIFT_MORALE = 0.4
export const RIFT_TRAINING = 0.1
export const RIFT_DEV = 0.02

const SALT = 0x726966 // 'rif'

const nowAbs = (s: GameState) => absWeek(s.season, s.week)

function stillThere(state: GameState, r: StaffRift): { a: boolean; b: boolean } {
  const pa = state.staffPeople?.[r.a]
  const pb = state.staffPeople?.[r.b]
  return { a: !!pa && pa.name === r.aName, b: !!pb && pb.name === r.bName }
}

/** 1 while a rift is running at the manager's club, else 0. */
export function riftDrag(state: GameState): number {
  const r = state.staffRift
  if (!r || state.unemployed || r.clubId !== state.userClubId) return 0
  const there = stillThere(state, r)
  return there.a && there.b ? 1 : 0
}

function push(state: GameState, k: string, v: Vars) {
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
    subject: tIn('en', `${k}Subj`, v), body: tIn('en', k, v), k, v,
  })
}

/** Close a rift whose pair has been broken up. The manager released or
 *  replaced one of them, so the line says the air has cleared. Called the
 *  moment a coach is sacked or replaced, and by the weekly tick. */
export function settleRift(state: GameState) {
  const r = state.staffRift
  if (!r) return
  if (state.unemployed || r.clubId !== state.userClubId) {
    // a new job: the old club's quarrel is not his any more
    state.staffRift = null
    state.staffRiftNext = nowAbs(state) + RIFT_COOLDOWN
    return
  }
  const there = stillThere(state, r)
  if (there.a && there.b) return
  const gone = !there.a ? r.aName : r.bName
  push(state, 'news.riftLifted', { gone })
  state.staffRift = null
  state.staffRiftNext = nowAbs(state) + RIFT_COOLDOWN
}

const STORIES = ['news.riftHeated', 'news.riftEarly', 'news.riftCold']

/** Weekly: start, tell and end the falling-out. */
export function staffRiftWeek(state: GameState) {
  settleRift(state)
  if (state.unemployed) return
  const now = nowAbs(state)
  const r = state.staffRift
  if (r) {
    if (now < r.next) return
    if (r.told < STORIES.length) {
      push(state, STORIES[r.told], { a: r.aName, b: r.bName })
      r.told++
      r.next = r.told < STORIES.length
        ? r.since + (r.told === 1 ? 6 + Math.floor(moveHash(state.seed, r.since, SALT, 1) * 5) : 16 + Math.floor(moveHash(state.seed, r.since, SALT, 2) * 6))
        : r.since + RIFT_WALKOUT
      return
    }
    // left alone long enough, the junior of the two walks out
    const pa = state.staffPeople?.[r.a]
    const pb = state.staffPeople?.[r.b]
    const leaves: Role = (pa?.tier ?? 0) < (pb?.tier ?? 0) ? r.a : r.b
    const name = leaves === r.a ? r.aName : r.bName
    const other = leaves === r.a ? r.bName : r.aName
    state.staff[leaves] = 0
    state.staffSalt = (state.staffSalt ?? 0) + 1
    const people = { ...(state.staffPeople ?? {}) }
    delete people[leaves]
    state.staffPeople = people
    push(state, 'news.riftWalkout', { gone: name, other })
    state.staffRift = null
    state.staffRiftNext = now + RIFT_COOLDOWN
    return
  }
  if (state.staffRiftNext == null) { state.staffRiftNext = now + RIFT_COOLDOWN; return }
  if (now < state.staffRiftNext) return
  if (moveHash(state.seed, now, SALT) >= RIFT_WEEKLY) return
  const roles = (Object.keys(STAFF_INFO) as Role[]).filter(k => state.staffPeople?.[k]?.name)
  if (roles.length < 3) return
  const i = Math.floor(moveHash(state.seed, now, SALT, 3) * roles.length)
  const j = (i + 1 + Math.floor(moveHash(state.seed, now, SALT, 4) * (roles.length - 1))) % roles.length
  const a = roles[i], b = roles[j]
  const rift: StaffRift = {
    clubId: state.userClubId, a, b,
    aName: state.staffPeople![a]!.name, bName: state.staffPeople![b]!.name,
    since: now, told: 0, next: now,
  }
  state.staffRift = rift
  // the falling-out is the first story, the week it happens
  push(state, STORIES[0], { a: rift.aName, b: rift.bName })
  rift.told = 1
  rift.next = now + 6 + Math.floor(moveHash(state.seed, now, SALT, 1) * 5)
}

/** A save's rift, made safe: anything malformed is dropped. */
export function migrateRift(r: unknown): StaffRift | null {
  if (!r || typeof r !== 'object') return null
  const x = r as Partial<StaffRift>
  const roles = Object.keys(STAFF_INFO)
  if (typeof x.clubId !== 'string' || !roles.includes(x.a as string) || !roles.includes(x.b as string) ||
    typeof x.aName !== 'string' || typeof x.bName !== 'string' ||
    !Number.isFinite(x.since) || !Number.isFinite(x.told) || !Number.isFinite(x.next)) return null
  return x as StaffRift
}
