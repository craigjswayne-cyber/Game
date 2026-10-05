/**
 * ---- THE CAREER ARC, AS DATA ----
 *
 * The owner's "mastery" brief: give a manager reasons to keep one save alive
 * for ten or twenty seasons, because the world has come to understand what
 * kind of manager he is and what kind of club he has built. Emergent, never a
 * stat sheet. This file is only the shape of that understanding and the few
 * helpers every part of it shares; the parts live next door:
 *
 *   rivalcoach.ts  the men in the other dugout, as people who last: your
 *                  record against each, their moves, sackings and returns,
 *                  the players they take from you, and the one who becomes
 *                  your rival
 *   repute.ts      what the game says you are known for, read from what you
 *                  have actually done season after season, and the identity
 *                  that hardens into a club's reputation
 *   chairman.ts    what kind of job a club is, and the kind of man in its
 *                  chair: what he demands, praises and punishes
 *   ambitions.ts   the one to three ambitions named at the start of a career,
 *                  their progress and their milestones
 *   erastory.ts    the story of each era, told when you leave a club and
 *                  every fifth season you stay
 *   arc.ts         the hooks the season, the rollover and the job market call
 *
 * ONE FIELD ON THE SAVE (GameState.arc), created on first touch, so a save
 * from before any of this simply grows one the first time it is played.
 * Every list in it is capped.
 *
 * NOTHING HERE DRAWS FROM AN RNG, and nothing here files a story with a
 * whole id: stories wait in `queue` and take a fraction (heldnews.ts), so no
 * fixture anywhere changes its dice because a manager has a reputation.
 */
import type { GameState } from './model'
import type { Gender } from './gender'
import { tIn, type Vars } from './i18n'
import { fileHeldNews } from './heldnews'

/** A switch for scripts/careerarcprobe.ts ONLY: with it on every hook is a
 *  no-op, so the probe can play the same world with and without the arc and
 *  prove the AI's results never noticed. Nothing in the game sets it. */
export const ARC_OFF = { on: false }

/** One spell of a coach at one club. x: how it ended (s sacked, l left). */
export interface Stint { c: string; f: number; t?: number; x?: 's' | 'l' }

/** A head coach in another dugout, remembered as a person. */
export interface Coach {
  id: number
  /** the name, which is how the world knows him */
  n: string
  g?: Gender
  /** his idea of the game (philosophy.ts id): it travels with him */
  ph?: string
  /** the club he is at now; absent while he is out of work */
  at?: string
  st: Stint[]
  /** his record against the manager, from the manager's side */
  w: number; d: number; l: number
  /** how much the two of you have been through; cools every summer */
  heat: number
  /** close meetings, knockout meetings, titles decided between you, players taken */
  cl: number; ko: number; ti: number; po: number
  /** absolute week he went out of work */
  out?: number
  /** the season you last met */
  last?: number
}

/** A season of the manager's conduct, written at the year end. */
export interface Conduct {
  s: number
  c: string
  /** league tier, finish, clubs in the league */
  tier: number; pos: number; n: number
  m: number; w: number; d: number; l: number
  /** points for and against, per match, and the league's per-match average */
  pf: number; pa: number; lg: number
  /** academy debuts given, share of senior minutes to homegrown men (0-100) */
  deb: number; hg: number
  /** fees paid and the annual wage bill */
  buy: number; wages: number
  /** fees received for his men (1.8.5): absent on a row written before */
  sell?: number
  /** hard calls (requests refused, seniors dropped, staff sacked) and kind ones
   *  (promises kept, requests granted), and promises broken */
  hard: number; kind: number; broke: number
  /** average squad morale at the end, and how many ideas of rugby the side played */
  mor: number; pats: number
  /** ---- 1.8.5 career QA: what the manager chose, beside what happened ----
   *  Every field below is absent on a row written before, and the readers
   *  fall back to the old rule for such a row (repute.ts).
   *
   *  yd: academy debuts given to men of 20 or under, which is a manager
   *  picking a boy, not the age gate topping up the squad; u21 and u21l: the
   *  share of senior appearances (0-100) to men of 21 or under, here and in
   *  the rest of the league; hgl: the league's homegrown share, so a squad
   *  that is homegrown because everybody's is reads as nothing special */
  yd?: number; u21?: number; u21l?: number; hgl?: number
  /** distinct game plans used, live matches where the dials moved, half-time
   *  answers to the hurting cause (the right lever moved) and how many of
   *  those the second half bore out (evidence.ts halfFollow) */
  pl?: number; chg?: number; ansN?: number; ans?: number
  /** signings he went for that the salary cap or an embargo refused (men) */
  capb?: number; embb?: number
  /** the wage bill as a share of the wage budget (0-100), and the balance's
   *  move over the season, injections aside */
  wr?: number; bk?: number
  /** the league's median wage share of budget, the same way (0-100) */
  wrl?: number
}

/** The job in progress, for the era summary. */
export interface CurEra {
  c: string
  f: number
  /** where it started: tier, finish (or the pundits' tip), league size, league id, balance */
  tier0: number; pos0: number; n0: number; lg0: string; bal0: number
  m: number; w: number; d: number; l: number
  gw?: { o: string; us: number; them: number; s: number }
  wd?: { o: string; us: number; them: number; s: number }
  rs?: { n: string; fee: number; s: number }
  /** appearances per player in this job, the top dozen */
  top: Record<number, { n: string; a: number }>
  /** academy players this job gave a debut */
  grads: number[]
  /** the club was in trouble when he arrived */
  trouble?: boolean
  /** the kinds of rugby played this season (tendency patterns) */
  pats?: string[]
  /** the kind of job it was when he took it (chairman.ts JobProfile) */
  prof?: string
  /** this season's game plans (hashed), live matches with the dials moved,
   *  half-time answers and the ones that worked, and the men the cap or an
   *  embargo refused him (1.8.5). Reset each summer with pats. */
  plans?: number[]
  chg?: number; ansN?: number; ans?: number
  capb?: number[]; embb?: number[]
}

/** A finished era, or a five-season milestone of one still going. */
export interface Era {
  c: string
  cn: string
  f: number
  t: number
  m: number; w: number; d: number; l: number
  /** trophies, as competition ids */
  tr: string[]
  /** academy players he gave a debut who have played Test rugby */
  intl: number
  /** academy players he gave a debut (1.8.4; absent on an era told before) */
  gr?: number
  /** the biggest fee and the worst defeat carry their season (1.8.4), so the
   *  era's turning points can place them (turning.ts) */
  rs?: { n: string; fee: number; s?: number }
  gp?: { n: string; a: number }
  gw?: { o: string; us: number; them: number }
  wd?: { o: string; us: number; them: number; s?: number }
  /** the rival coach's name, and the identity label the club held */
  rv?: string
  id?: string
  /** the one sentence, as a key and its values */
  sk: string
  sv: Vars
  /** why it was told: s sacked, w walked, m moved, 5 a fifth season */
  why: 's' | 'w' | 'm' | '5'
  /** the kind of job it was when he took it */
  pf?: string
}

/** One ambition named at the start: its club, and the milestones reached. */
export interface Ambition {
  id: string
  clubId: string
  season: number
  /** the last percentage announced */
  pct?: number
  /** milestones reached: season and percentage */
  log?: { s: number; p: number }[]
}

export interface CareerArc {
  coaches: Coach[]
  cn: number
  /** the coach id of the manager's rival, and the season it became one */
  rival?: number
  rivalS?: number
  conduct: Conduct[]
  cur?: CurEra
  eras: Era[]
  /** clubs turned round from trouble */
  turned: string[]
  /** the season each was turned (1.8.4); absent for a club turned before */
  turnedAt?: Record<string, number>
  /** traits already announced, so each is told once */
  told: string[]
  /** identity runs at the current club: label -> seasons held in a row */
  idc?: string
  idRun: Record<string, number>
  /** the reputation an identity has hardened into, and seasons it has gone unheld */
  repute?: { c: string; l: string; s: number; miss: number }
  /** a new owner in the chair: the chairman is a different man (salt per club) */
  chairSalt: Record<string, number>
  /** the last memory entry read for poaching, and the pre-contracts already read */
  memSeen: number
  pcSeen: number[]
  /** the week's kinds of rugby, sampled for the innovator's read */
  said: Record<string, number>
  /** stories waiting for an id. Empty between weeks. */
  queue?: Omit<import('./model').NewsItem, 'id'>[]
}

export const ARC_CAPS = { coaches: 48, conduct: 30, eras: 16, told: 16, top: 12, grads: 40, stints: 6, plans: 24 } as const
/** a conduct row's optional facts (1.8.5): dropped when unreadable */
const OPT_ROW = ['yd', 'u21', 'u21l', 'hgl', 'pl', 'chg', 'ansN', 'ans', 'capb', 'embb', 'wr', 'bk', 'wrl'] as const

/** Note a signing the cap or an embargo refused (ai.ts): once per man a season. */
export function noteBlocked(state: GameState, playerId: number, why: 'cap' | 'emb'): void {
  if (ARC_OFF.on || state.unemployed) return
  const cur = state.arc?.cur
  if (!cur || cur.c !== state.userClubId) return
  const k = why === 'cap' ? 'capb' : 'embb'
  const list = (cur[k] ??= [])
  if (!list.includes(playerId)) list.push(playerId)
  if (list.length > ARC_CAPS.plans) list.splice(0, list.length - ARC_CAPS.plans)
}

/** Note a live match's touchline work (evidence.ts fileEvidence): whether the
 *  dials moved, and a half-time answer to the hurting cause and whether it worked. */
export function noteMatchWork(state: GameState, moved: boolean, answered: boolean, worked: boolean): void {
  if (ARC_OFF.on || state.unemployed) return
  const cur = state.arc?.cur
  if (!cur || cur.c !== state.userClubId) return
  if (moved) cur.chg = (cur.chg ?? 0) + 1
  if (answered) cur.ansN = (cur.ansN ?? 0) + 1
  if (answered && worked) cur.ans = (cur.ans ?? 0) + 1
}

/** The arc, created on first touch. */
export function arcOf(state: GameState): CareerArc {
  const a = (state.arc ??= {} as CareerArc)
  if (!Array.isArray(a.coaches)) a.coaches = []
  if (!Number.isFinite(a.cn)) a.cn = a.coaches.reduce((n, c) => Math.max(n, c.id), 0) + 1
  if (!Array.isArray(a.conduct)) a.conduct = []
  if (!Array.isArray(a.eras)) a.eras = []
  if (!Array.isArray(a.turned)) a.turned = []
  if (!Array.isArray(a.told)) a.told = []
  if (!a.idRun || typeof a.idRun !== 'object') a.idRun = {}
  if (!a.chairSalt || typeof a.chairSalt !== 'object') a.chairSalt = {}
  if (!Number.isFinite(a.memSeen)) a.memSeen = 0
  if (!Array.isArray(a.pcSeen)) a.pcSeen = []
  if (!a.said || typeof a.said !== 'object') a.said = {}
  return a
}

/** True the first time a thing is said this season, false after. */
export function onceArc(state: GameState, key: string): boolean {
  const a = arcOf(state)
  if (a.said[key] === state.season) return false
  a.said[key] = state.season
  return true
}

/** Hold a story by key until the week settle ends (see heldnews.ts). */
export function arcFile(
  state: GameState, k: string, v: Vars,
  opts: { type?: 'general' | 'award' | 'gossip' | 'board'; playerId?: number; summer?: boolean } = {},
): void {
  if (ARC_OFF.on) return
  ;(arcOf(state).queue ??= []).push({
    week: opts.summer ? 1 : state.week,
    season: opts.summer ? state.season + 1 : state.season,
    type: opts.type ?? 'general',
    read: false,
    subject: tIn('en', `${k}Subj`, v),
    body: tIn('en', k, v),
    k, v, playerId: opts.playerId,
  })
}

/** File the held stories, with ids that never spend state.nextId. */
export function flushArcNews(state: GameState): void {
  const q = state.arc?.queue
  if (!q?.length) return
  fileHeldNews(state, q.filter(n => !!n && typeof n === 'object' && typeof n.k === 'string'))
  state.arc!.queue = []
}

/** A stable number from a string, for choices that must not use an rng. */
export function arcHash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/** save.ts: make an arc whole on load. Nothing is invented; damaged rows go. */
export function migrateArc(s: GameState): void {
  const raw = s.arc as unknown
  if (raw == null) return
  if (typeof raw !== 'object' || Array.isArray(raw)) { delete s.arc; return }
  const a = arcOf(s)
  const num = (x: unknown) => typeof x === 'number' && Number.isFinite(x)
  a.coaches = a.coaches.filter(c => !!c && typeof c === 'object' && num(c.id) && typeof c.n === 'string' && c.n.length > 0)
  for (const c of a.coaches) {
    for (const k of ['w', 'd', 'l', 'heat', 'cl', 'ko', 'ti', 'po'] as const) if (!num(c[k])) c[k] = 0
    c.st = Array.isArray(c.st) ? c.st.filter(x => !!x && typeof x.c === 'string' && num(x.f)).slice(-ARC_CAPS.stints) : []
    if (c.at != null && (typeof c.at !== 'string' || !s.clubs[c.at])) delete c.at
  }
  const ids = new Set<number>()
  a.coaches = a.coaches.filter(c => (ids.has(c.id) ? false : (ids.add(c.id), true)))
  a.cn = Math.max(a.cn, a.coaches.reduce((n, c) => Math.max(n, c.id), 0) + 1)
  if (a.rival != null && !a.coaches.some(c => c.id === a.rival)) { delete a.rival; delete a.rivalS }
  a.conduct = a.conduct.filter(r => !!r && typeof r === 'object' && num(r.s) && typeof r.c === 'string').slice(-ARC_CAPS.conduct)
  for (const r of a.conduct) {
    for (const k of ['tier', 'pos', 'n', 'm', 'w', 'd', 'l', 'pf', 'pa', 'lg', 'deb', 'hg', 'buy', 'wages', 'hard', 'kind', 'broke', 'mor', 'pats'] as const) {
      if (!num(r[k])) r[k] = 0
    }
    if (r.sell != null && !num(r.sell)) delete r.sell
    for (const k of OPT_ROW) if (r[k] != null && !num(r[k])) delete r[k]
  }
  a.eras = a.eras.filter(e => !!e && typeof e === 'object' && typeof e.c === 'string' && typeof e.sk === 'string' && num(e.f)).slice(-ARC_CAPS.eras)
  for (const e of a.eras) {
    if (!Array.isArray(e.tr)) e.tr = []
    if (!e.sv || typeof e.sv !== 'object') e.sv = {}
    for (const k of ['m', 'w', 'd', 'l', 'intl', 't'] as const) if (!num(e[k])) e[k] = 0
    // 1.8.4's optional facts: absent on an older era, and dropped when unreadable
    if (e.gr != null && !num(e.gr)) delete e.gr
    if (e.rs && e.rs.s != null && !num(e.rs.s)) delete e.rs.s
    if (e.wd && e.wd.s != null && !num(e.wd.s)) delete e.wd.s
  }
  const cur = a.cur as unknown
  if (cur != null && (typeof cur !== 'object' || typeof a.cur!.c !== 'string' || !num(a.cur!.f))) delete a.cur
  if (a.cur) {
    for (const k of ['tier0', 'pos0', 'n0', 'bal0', 'm', 'w', 'd', 'l'] as const) if (!num(a.cur[k])) a.cur[k] = 0
    if (typeof a.cur.lg0 !== 'string') a.cur.lg0 = ''
    if (!a.cur.top || typeof a.cur.top !== 'object') a.cur.top = {}
    a.cur.grads = Array.isArray(a.cur.grads) ? a.cur.grads.filter(num).slice(-ARC_CAPS.grads) : []
    if (a.cur.pats != null && !Array.isArray(a.cur.pats)) a.cur.pats = []
    for (const k of ['plans', 'capb', 'embb'] as const) {
      const v = a.cur[k] as unknown
      if (v != null) a.cur[k] = Array.isArray(v) ? v.filter(num).slice(-ARC_CAPS.plans) : []
    }
    for (const k of ['chg', 'ansN', 'ans'] as const) if (a.cur[k] != null && !num(a.cur[k])) delete a.cur[k]
  }
  a.turned = a.turned.filter(x => typeof x === 'string')
  if (a.turnedAt != null) {
    const ok = typeof a.turnedAt === 'object' && !Array.isArray(a.turnedAt)
    a.turnedAt = ok ? Object.fromEntries(Object.entries(a.turnedAt).filter(([c, v]) => a.turned.includes(c) && typeof v === 'number' && Number.isFinite(v))) : {}
  }
  a.told = a.told.filter(x => typeof x === 'string').slice(-ARC_CAPS.told)
  a.pcSeen = a.pcSeen.filter(num).slice(-60)
  if (a.repute != null && (typeof a.repute !== 'object' || typeof a.repute.l !== 'string' || typeof a.repute.c !== 'string')) delete a.repute
  if (a.repute && !num(a.repute.miss)) a.repute.miss = 0
  if (a.queue != null && !Array.isArray(a.queue)) a.queue = []
  if (a.queue) a.queue = a.queue.filter(n => !!n && typeof n === 'object' && typeof n.k === 'string')
}
