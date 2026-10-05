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
 * THE MONTH-ONE RULE: the card is due once FIRST_MONTH_WEEKS in-game weeks
 * have been played on this device - a career that starts in week 1 sees it on
 * landing in week 5, the first time Home or the day room is safe. Weeks rather
 * than competitive matches, because a first season opens with pre-season
 * friendlies and byes: four competitive matches landed in week 10, two months
 * in. It is offered automatically once, ever, on this device.
 */

/** The actions worth counting. Each maps to a real thing the manager does,
 *  recorded where the store or the screen already does it. */
export const ACTIONS = [
  'tactics', 'playbook', 'training', 'bid', 'loan', 'renew', 'press',
  'talk', 'watched', 'instant', 'sub', 'liveTactics', 'advert', 'skin', 'lang', 'night',
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
}

/** Readable names for the screens. A screen not listed here is reported by its
 *  id, which is a word from the code and never a param. */
export const SCREEN_NAMES: Record<string, string> = {
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

export const FIRST_MONTH_WEEKS = 4

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
  /** the last few matches counted, so one match is never counted twice */
  seen: string[]
  /** the card has been put on screen (automatically or from the menu) */
  offered: boolean
  /** the match count when it was, so a Pro card never shares that flow; -1 never */
  offeredAt: number
}

export const USAGE_KEY = 'rm-use'

export const freshUsage = (): Usage => ({
  v: 1, screens: {}, acts: {}, matches: 0, weeks: 0, lastWeek: '', seasons: 0, lastSeason: '', seen: [], offered: false, offeredAt: -1,
})

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
      seen: Array.isArray(o.seen) ? o.seen.filter((k): k is string => typeof k === 'string').slice(-8) : [],
      offered: o.offered === true,
      offeredAt: typeof o.offeredAt === 'number' && Number.isFinite(o.offeredAt) ? Math.max(-1, Math.floor(o.offeredAt)) : -1,
    }
  } catch { return freshUsage() }
}

// ---- pure steps (the probe tests these without a browser) ----

export function withScreen(u: Usage, screen: string): Usage {
  if (!SCREEN_ID.test(screen)) return u
  if (!(screen in u.screens) && Object.keys(u.screens).length >= MAX_SCREENS) return u
  return { ...u, screens: { ...u.screens, [screen]: (u.screens[screen] ?? 0) + 1 } }
}

export function withAction(u: Usage, a: Action): Usage {
  if (!(ACTIONS as readonly string[]).includes(a)) return u
  return { ...u, acts: { ...u.acts, [a]: (u.acts[a] ?? 0) + 1 } }
}

/** One competitive match completed. `key` names the match, `season` the
 *  career's season; neither goes into the report. */
export function withMatch(u: Usage, key: string, season: string): Usage {
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
export function withWeek(u: Usage, key: string): Usage {
  if (key === u.lastWeek) return u
  return { ...u, weeks: u.weeks + 1, lastWeek: key }
}

/** Is the automatic card due? Once, after the first month. */
export const feedbackDue = (u: Usage): boolean => !u.offered && u.weeks >= FIRST_MONTH_WEEKS

export const withOffered = (u: Usage): Usage => ({ ...u, offered: true, offeredAt: u.offered ? u.offeredAt : u.matches })

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
  update(u => withScreen(u, screen))
}

/** An action was taken. `perVisit` counts it at most once per screen visit. */
export function noteUse(a: Action, perVisit = false): void {
  if (perVisit) {
    if (thisVisit.has(a)) return
    thisVisit.add(a)
  }
  update(u => withAction(u, a))
}

/** A week has turned (store.ts landOnNextWeek, every way a week ends). */
export function countWeek(key: string): void {
  update(u => withWeek(u, key))
}

/** A competitive match of the manager's was completed. */
export function countMatch(key: string, season: string): void {
  update(u => withMatch(u, key, season))
}

// ---- the report ----

export interface FeedbackInput {
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
  out += line('matches', `${u.matches} competitive`)
  out += '\n'

  const screens = Object.entries(u.screens).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
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
