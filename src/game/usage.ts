/**
 * ---- THE FEEDBACK REPORT: WHAT GETS USED, KEPT ON THE PHONE ----
 *
 * The owner's question: which parts of the game do players use, and which do
 * they never find? The answer has to come without a network call, because the
 * game makes none (scripts/netprobe.ts). So this is the bug report's model
 * (game/bugreport.ts) applied to feature use:
 *
 *   - the game keeps a handful of COUNTERS on the device: screens opened, by
 *     screen name only, and a short fixed list of actions;
 *   - after the first in-game month a card offers the player a report built
 *     from them, shows him the whole of it, and it leaves the device only if
 *     he sends it himself (his mail app, or the clipboard for Discord).
 *
 * NOTHING IDENTIFYING IS COUNTED. Screen names, never their params (a param
 * can be a player id). No player, manager or club names, no save, no seed in
 * the report, no device id. The counts are device state in localStorage
 * (USAGE_KEY), beside the Pro funnel's rm-pro: never in the save, so no save
 * format changes, a new career carries on counting, and a reinstall clears it.
 *
 * NOTHING HERE TOUCHES THE SIMULATION. No rng, no GameState writes: the
 * fingerprint cannot move. And every counter is wrapped so that a storage
 * failure costs a count, never a crash.
 *
 * THE FIRST-SEASON RULE (1.9.0): the card is due once a season has been
 * finished on this device - its end-of-season review stamped (rollover.ts) -
 * and is seen the first time Home or the day room is safe after that review is
 * put away. It used to come after the first month (four in-game weeks), and
 * the reports that came back said "weeks 4, matches 1": a month in, a manager
 * has barely opened the game, so the report was mostly NEVER OPENED. Owner,
 * 1.9.0: "push the feedback report til the first season is completed so we
 * have enough data." It is offered automatically once, ever, on this device.
 */
import type { GameState } from './model'
import { leagueTier } from './model'

/** The actions worth counting. Each maps to a real thing the manager does,
 *  recorded where the store or the screen already does it. */
export const ACTIONS = [
  'tactics', 'playbook', 'training', 'bid', 'loan', 'renew', 'press',
  'talk', 'watched', 'instant', 'sub', 'liveTactics', 'advert', 'skin', 'lang', 'night',
  // 1.9.13: the office, retraining, the physio's load, the character filters
  'chat', 'retrain', 'physio', 'charFilter',
] as const
export type Action = typeof ACTIONS[number]

/** How each reads in the report (developer-facing, English like the bug report). */
const ACTION_NAMES: Record<Action, string> = {
  tactics: 'Tactics changed',
  playbook: 'Set-piece call chosen',
  training: 'Training focus changed',
  bid: 'Transfer bid made',
  loan: 'Loan made',
  renew: 'Contract renewal offered',
  press: 'Press question answered',
  talk: 'Team talk given',
  watched: 'Match watched',
  instant: 'Instant result',
  sub: 'Substitution in a match',
  liveTactics: 'Tactics changed in a match',
  advert: 'Rewarded advert watched',
  skin: 'Skin changed',
  lang: 'Language changed',
  night: 'Night mode switched',
  chat: 'Office chat',
  retrain: 'Retrain',
  physio: 'Physio load',
  charFilter: 'Character filter',
}

/** Readable names for the screens. A screen not listed here is reported by its
 *  id, which is a word from the code and never a param. */
const SCREEN_NAMES: Record<string, string> = {
  inbox: 'Inbox', squad: 'Team', report: 'Team report', tactics: 'Tactics', academy: 'Academy',
  training: 'Training and staff', medical: 'Medical', fixtures: 'Fixtures and results',
  finances: 'Finances', transfers: 'Transfers', infra: 'Infrastructure', club: 'Club info',
  supporter: 'Store', profile: 'Profile', press: 'Press room', legacy: 'Legacy',
  handbook: 'Handbook', settings: 'Settings', bug: 'Report a bug', about: 'About',
  saves: 'Save and load', tables: 'Competitions', jobs: 'Jobs', nations: 'Nations',
  dreamteam: 'Dream team', agency: 'Agency', history: 'History', offers: 'Offers',
  player: 'Player page', matchday: 'Match day', results: 'Week results', day: 'Day room',
  country: 'Test side', wire: 'Wire bulletin', draw: 'Draw', annual: 'Annual',
  seasonreview: 'Season review', newgame: 'New career', menu: 'Title screen',
}

/** The main places a manager can go. Any with no visits is listed under
 *  NEVER OPENED, the owner's main question. The Store is added only where
 *  there is one. */
export const MAIN_SCREENS = [
  'squad', 'report', 'tactics', 'academy', 'training', 'medical', 'fixtures', 'finances',
  'transfers', 'infra', 'club', 'inbox', 'offers', 'profile', 'press', 'legacy', 'handbook',
  'settings', 'bug', 'about', 'saves', 'tables', 'jobs', 'nations', 'dreamteam', 'agency', 'history',
] as const


export interface Usage {
  v: 1
  screens: Record<string, number>
  acts: Partial<Record<Action, number>>
  /** competitive matches completed on this device */
  matches: number
  /** in-game weeks played on this device */
  weeks: number
  /** the last week counted, so a week is never counted twice */
  lastWeek: string
  /** seasons in which a competitive match was completed on this device */
  seasons: number
  /** the last season counted, so the same one is not counted twice */
  lastSeason: string
  /** seasons finished on this device: an end-of-season review was reached */
  finished: number
  /** the last season finished, so the same one is not counted twice */
  lastFinished: string
  /** the last few matches counted, so one match is never counted twice */
  seen: string[]
  /** the card has been put on screen (automatically or from the menu) */
  offered: boolean
  /** the match count when it was, so a Pro card never shares that flow; -1 never */
  offeredAt: number
  /** PLAY TIME (1.9.13): active seconds in all, by screen, and sessions. A
   *  stretch on one screen counts up to IDLE_CAP, so a phone left on a table
   *  is not an hour of Team; a gap over SESSION_GAP starts a new session. */
  secs: number
  time: Record<string, number>
  sessions: number
  /** when the last screen was opened or the last action taken (ms), and where */
  lastAt: number
  cur: string
  /** the season milestones the card has been offered at (FEEDBACK_AT) */
  offeredFor: number[]
}

export const USAGE_KEY = 'rm-use'

export const freshUsage = (): Usage => ({
  v: 1, screens: {}, acts: {}, matches: 0, weeks: 0, lastWeek: '', seasons: 0, lastSeason: '', finished: 0, lastFinished: '', seen: [], offered: false, offeredAt: -1,
  secs: 0, time: {}, sessions: 0, lastAt: 0, cur: '', offeredFor: [],
})

/** A stretch on one screen counts at most this long (an idle phone). */
export const IDLE_CAP = 5 * 60 * 1000
/** A gap longer than this between taps starts a new session. */
export const SESSION_GAP = 30 * 60 * 1000
/** OFFERED AGAIN AS A CAREER GROWS (owner, 1.9.13: "add it for the end of
 *  season 3, 5 and 10 and 20"): the first season, then these. Each once. */
export const FEEDBACK_AT = [1, 3, 5, 10, 20] as const

const int = (n: unknown, d: number) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : d)
const SCREEN_ID = /^[a-z]{1,20}$/
const MAX_SCREENS = 80

/** Read back whatever was stored, keeping what is sound and dropping the rest,
 *  so a mangled value heals rather than throws. */
export function parseUsage(raw: string | null): Usage {
  if (!raw) return freshUsage()
  try {
    const o = JSON.parse(raw) as Partial<Usage>
    if (!o || typeof o !== 'object' || Array.isArray(o)) return freshUsage()
    const screens: Record<string, number> = {}
    if (o.screens && typeof o.screens === 'object' && !Array.isArray(o.screens)) {
      for (const [k, v] of Object.entries(o.screens).slice(0, MAX_SCREENS)) {
        if (SCREEN_ID.test(k) && typeof v === 'number' && Number.isFinite(v) && v > 0) screens[k] = Math.floor(v)
      }
    }
    const acts: Partial<Record<Action, number>> = {}
    if (o.acts && typeof o.acts === 'object' && !Array.isArray(o.acts)) {
      for (const a of ACTIONS) {
        const v = (o.acts as Record<string, unknown>)[a]
        if (typeof v === 'number' && Number.isFinite(v) && v > 0) acts[a] = Math.floor(v)
      }
    }
    return {
      v: 1,
      screens,
      acts,
      matches: int(o.matches, 0),
      weeks: int(o.weeks, 0),
      lastWeek: typeof o.lastWeek === 'string' ? o.lastWeek.slice(0, 40) : '',
      seasons: int(o.seasons, 0),
      lastSeason: typeof o.lastSeason === 'string' ? o.lastSeason.slice(0, 40) : '',
      finished: int(o.finished, 0),
      lastFinished: typeof o.lastFinished === 'string' ? o.lastFinished.slice(0, 40) : '',
      seen: Array.isArray(o.seen) ? o.seen.filter((k): k is string => typeof k === 'string').slice(-8) : [],
      offered: o.offered === true,
      offeredAt: typeof o.offeredAt === 'number' && Number.isFinite(o.offeredAt) ? Math.max(-1, Math.floor(o.offeredAt)) : -1,
      secs: int(o.secs, 0),
      time: (() => {
        const t: Record<string, number> = {}
        if (o.time && typeof o.time === 'object' && !Array.isArray(o.time)) {
          for (const [k, v] of Object.entries(o.time).slice(0, MAX_SCREENS)) {
            if (SCREEN_ID.test(k) && typeof v === 'number' && Number.isFinite(v) && v > 0) t[k] = Math.floor(v)
          }
        }
        return t
      })(),
      sessions: int(o.sessions, 0),
      lastAt: int(o.lastAt, 0),
      cur: typeof o.cur === 'string' && SCREEN_ID.test(o.cur) ? o.cur : '',
      // a ledger from before 1.9.13 that was offered had its first-season card
      offeredFor: Array.isArray(o.offeredFor)
        ? [...new Set(o.offeredFor.filter((n): n is number => typeof n === 'number' && (FEEDBACK_AT as readonly number[]).includes(n)))]
        : o.offered === true ? [1] : [],
    }
  } catch { return freshUsage() }
}

// ---- pure steps (the probe tests these without a browser) ----

/** The time since the last tap, onto the screen it was spent on; a long gap
 *  closes the session and opens the next. `now` is passed in so the probe can
 *  drive it. */
export function withTime(u: Usage, now: number, screen?: string): Usage {
  const gap = u.lastAt > 0 ? now - u.lastAt : Infinity
  let { secs, time, sessions } = u
  if (gap >= 0 && gap < SESSION_GAP) {
    const add = Math.round(Math.min(gap, IDLE_CAP) / 1000)
    if (add > 0 && u.cur) { secs += add; time = { ...time, [u.cur]: (time[u.cur] ?? 0) + add } }
  } else sessions += 1
  const cur = screen && SCREEN_ID.test(screen) ? screen : u.cur
  return { ...u, secs, time, sessions, lastAt: now, cur }
}

function withScreen(u: Usage, screen: string): Usage {
  if (!SCREEN_ID.test(screen)) return u
  if (!(screen in u.screens) && Object.keys(u.screens).length >= MAX_SCREENS) return u
  return { ...u, screens: { ...u.screens, [screen]: (u.screens[screen] ?? 0) + 1 } }
}

function withAction(u: Usage, a: Action): Usage {
  if (!(ACTIONS as readonly string[]).includes(a)) return u
  return { ...u, acts: { ...u.acts, [a]: (u.acts[a] ?? 0) + 1 } }
}

/** One competitive match completed. `key` names the match, `season` the
 *  career's season; neither goes into the report. */
function withMatch(u: Usage, key: string, season: string): Usage {
  if (u.seen.includes(key)) return u
  const newSeason = season !== u.lastSeason
  return {
    ...u,
    matches: u.matches + 1,
    seasons: u.seasons + (newSeason ? 1 : 0),
    lastSeason: season,
    seen: [...u.seen, key].slice(-8),
  }
}

/** One in-game week played. `key` names the new week; it is not reported. */
function withWeek(u: Usage, key: string): Usage {
  if (key === u.lastWeek) return u
  return { ...u, weeks: u.weeks + 1, lastWeek: key }
}

/** One season finished. `key` names it; it is not reported. */
function withFinished(u: Usage, key: string): Usage {
  if (key === u.lastFinished) return u
  return { ...u, finished: u.finished + 1, lastFinished: key }
}

/** The milestone the card is due at now, or null: the latest one reached and
 *  not yet offered (a career that jumps from one season to four is asked once,
 *  at three, not twice). */
export function dueMilestone(u: Usage): number | null {
  const reached = FEEDBACK_AT.filter(m => u.finished >= m)
  const top = reached[reached.length - 1]
  return top != null && !u.offeredFor.includes(top) ? top : null
}

/** Is the automatic card due? After seasons 1, 3, 5, 10 and 20, each once. */
export const feedbackDue = (u: Usage): boolean => dueMilestone(u) != null

export const withOffered = (u: Usage): Usage => {
  const m = dueMilestone(u)
  const reached = FEEDBACK_AT.filter(x => u.finished >= x)
  return {
    ...u, offered: true, offeredAt: u.offered ? u.offeredAt : u.matches,
    // seen now: every milestone reached so far is answered, so the menu's own
    // way in does not leave an automatic card queued behind it
    offeredFor: [...new Set([...u.offeredFor, ...(m != null ? [m] : []), ...reached])],
  }
}

// ---- the device ledger ----

export function readUsage(): Usage {
  try { return parseUsage(globalThis.localStorage?.getItem(USAGE_KEY) ?? null) } catch { return freshUsage() }
}

/** TRUE ONLY IF IT STUCK, as the Pro funnel's writeFunnel: the card asks this
 *  before it opens and stays shut on a false. */
export function writeUsage(u: Usage): boolean {
  try {
    const s = JSON.stringify(u)
    globalThis.localStorage?.setItem(USAGE_KEY, s)
    return globalThis.localStorage?.getItem(USAGE_KEY) === s
  } catch { return false }
}

function update(fn: (u: Usage) => Usage): void {
  try {
    const u = readUsage()
    const n = fn(u)
    if (n !== u) writeUsage(n)
  } catch { /* a lost count, never a crash */ }
}

/** Actions already counted on this screen visit, for the ones that count once
 *  per visit (a slider dragged is one tactics change, not forty). */
let thisVisit = new Set<Action>()

/** A screen was opened. Called from bugreport.noteScreen on every navigation. */
export function countScreen(screen: string): void {
  thisVisit = new Set()
  const now = Date.now()
  update(u => withScreen(withTime(u, now, screen), screen))
}

/** An action was taken. `perVisit` counts it at most once per screen visit. */
export function noteUse(a: Action, perVisit = false): void {
  if (perVisit) {
    if (thisVisit.has(a)) return
    thisVisit.add(a)
  }
  const now = Date.now()
  update(u => withAction(withTime(u, now), a))
}

/** A week has turned (store.ts landOnNextWeek, every way a week ends). */
export function countWeek(key: string): void {
  update(u => withWeek(u, key))
}

/** A season was finished: its end-of-season review was stamped (store.ts
 *  landOnNextWeek, on the Monday the review opens over). */
export function countFinished(key: string): void {
  update(u => withFinished(u, key))
}

/** A competitive match of the manager's was completed. */
export function countMatch(key: string, season: string): void {
  update(u => withMatch(u, key, season))
}

// ---- the report ----

/** THE CAREER, IN NUMBERS (1.9.13): read off the save on screen when the
 *  report is built. Results, finishes by tier, silverware, the board and the
 *  terraces, the books. No name, club or league is in it. */
export interface CareerSnap {
  w: number; d: number; l: number
  /** the last five league finishes, oldest first: position and tier */
  fin: { pos: number; tier: number }[]
  trophies: number
  clubs: number
  board: number
  fans: number
  debt: boolean
  squad: number
  pro: boolean
}

export function careerSnap(g: GameState, pro: boolean): CareerSnap {
  const m = g.mgr
  const club = g.clubs[g.userClubId]
  const clubs = new Set([...(m.finishes ?? []).map(f => f.clubId).filter(Boolean), g.userClubId])
  return {
    w: m.w ?? 0, d: m.d ?? 0, l: m.l ?? 0,
    fin: (m.finishes ?? []).slice(-5).map(f => ({ pos: f.pos, tier: leagueTier(f.leagueId) })),
    trophies: (m.trophies ?? []).length,
    clubs: clubs.size,
    board: Math.round(club?.boardConfidence ?? 0),
    fans: Math.round(g.fanMood ?? 60),
    debt: (club?.balance ?? 0) < 0,
    squad: club ? club.players.filter(id => g.players[id] && !g.players[id].acad).length : 0,
    pro,
  }
}

/** The device's settings that change how the game is played and felt. */
export interface PrefsSnap { haptics: boolean; sound: boolean; night: boolean; text: number }

interface FeedbackInput {
  /** the career on screen, when there is one (careerSnap) */
  career?: CareerSnap
  prefs?: PrefsSnap
  usage: Usage
  version: string
  platform: string
  lang: string
  tablet: boolean
  /** 'm' or 'w' from the career on screen, or null with none loaded */
  gender: string | null
  /** whether this build has a Store, so it can be listed as never opened */
  store: boolean
}

const line = (label: string, value: string | number): string => `${label.padEnd(10)}${value}\n`

/** The report, as the player sees it and as the developer reads it. English,
 *  like the bug report: it is read by one person, at the studio. Compact, so
 *  the whole thing fits a mail body (MAILTO_LIMIT). */
export function buildFeedbackReport(i: FeedbackInput): string {
  const u = i.usage
  let out = 'PHASE: RUGBY MANAGER - FEEDBACK REPORT\n\n'
  out += line('version', i.version)
  out += line('platform', i.platform)
  out += line('language', i.lang)
  out += line('device', i.tablet ? 'tablet' : 'phone')
  out += line('game', i.gender === 'w' ? "women's" : i.gender === 'm' ? "men's" : 'no career loaded')
  out += line('weeks', u.weeks)
  out += line('seasons', u.seasons)
  out += line('finished', `${u.finished} season${u.finished === 1 ? '' : 's'}`)
  out += line('matches', `${u.matches} competitive`)
  out += '\n'

  // PLAY TIME AND WHERE IT WENT (1.9.13): opens say where a player went, the
  // minutes say whether they stayed. Top five only, to fit a mail body.
  const hm = (sec: number) => { const mins = Math.round(sec / 60); return mins >= 600 ? `${Math.round(mins / 60)}h` : mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}` : `${mins}m` }
  out += 'PLAY TIME\n'
  out += u.sessions ? `${hm(u.secs)} over ${u.sessions} session${u.sessions === 1 ? '' : 's'}, ${hm(u.secs / u.sessions)} average\n` : 'not measured yet\n'
  const timed = Object.entries(u.time).filter(([, v]) => v >= 60).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 5)
  if (timed.length) out += 'most time: ' + timed.map(([k, v]) => `${SCREEN_NAMES[k] ?? k} ${hm(v)}`).join(', ') + '\n'
  out += '\n'

  if (i.career) {
    const c = i.career
    out += 'CAREER\n'
    out += `record ${c.w}-${c.d}-${c.l}, trophies ${c.trophies}, clubs ${c.clubs}\n`
    if (c.fin.length) out += 'finishes (pos/tier) ' + c.fin.map(f => `${f.pos}/${f.tier}`).join(', ') + '\n'
    out += `board ${c.board}, fans ${c.fans}, ${c.debt ? 'in debt' : 'in credit'}, squad ${c.squad}, ${c.pro ? 'Pro' : 'free'}\n\n`
  }
  if (i.prefs) {
    const p = i.prefs
    out += 'SETTINGS\n'
    out += `haptics ${p.haptics ? 'on' : 'off'}, sound ${p.sound ? 'on' : 'off'}, night ${p.night ? 'on' : 'off'}, text ${Math.round(p.text * 100)}%\n\n`
  }

  const screens = Object.entries(u.screens).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
  out += 'SCREENS OPENED\n'
  out += screens.length ? screens.map(([k, n]) => `${SCREEN_NAMES[k] ?? k} ${n}`).join(', ') + '\n\n' : 'none yet\n\n'

  const never = neverOpened(u, i.store)
  out += 'NEVER OPENED\n'
  out += never.length ? never.map(k => SCREEN_NAMES[k] ?? k).join(', ') + '\n\n' : 'none, every main screen was opened\n\n'

  out += 'ACTIONS\n'
  out += ACTIONS.map(a => `${ACTION_NAMES[a]} ${u.acts[a] ?? 0}`).join(', ') + '\n\n'

  out += 'Counts only. No names, no save, nothing else. Built on the device and\n'
  out += 'sent by the player.\n'
  return out
}

/** The main screens with no visits, in menu order. */
export function neverOpened(u: Usage, store: boolean): string[] {
  const list: string[] = [...MAIN_SCREENS]
  if (store) list.push('supporter')
  return list.filter(k => !(u.screens[k] > 0))
}

export const FEEDBACK_SUBJECT = 'PHASE: Rugby Manager - feedback report'
