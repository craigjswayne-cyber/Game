// ---- THE MANAGER'S DESK (1.8.2) ----
//
// Owner's brief: Home becomes a "Today" desk, so a week is a short chain of
// decisions and then Continue. Rows, top to bottom, each one line or a small
// card and each one a door to the screen that handles it:
//
//   1. needs your decision   everything that stands between the manager and
//                            the week turning (the same predicates Continue
//                            obeys: days.ts, country.ts, the offers gate)
//   2. upcoming match        opponent, competition, venue and the analyst's
//                            one line on it (oppreport.ts softSpot)
//   3. development           the week's most notable young man, or nothing
//   4. finance               balance and one headline
//   5. tactics               how the side plays and the season's priority
//   6. dressing room         one line of mood, in words
//   7. season position       place, points and the board's aim
//
// and, from the blueprint's rule that a decision should leave a question the
// manager wants answered, at most one "still to be answered" line: an open
// thread the memory already holds (memory.ts recall) that is live this week.
//
// RULES IT KEEPS
//
//   Pure. It reads the save and writes nothing: no rng, no cache filled in,
//   no id spent. The analyst's read is taken on a shallow copy so its cache
//   lands on the copy (analyst.ts files the read the first time it is asked).
//   scripts/deskprobe.ts holds all of that.
//
//   No new system. Every line is something another module already decided;
//   the desk only chooses which one to say.
//
//   Nothing hidden. No trait label, no culture figure, no rating or ceiling:
//   the dressing room is a word, a young man's month is a word, a projection
//   is "raised" or "lowered".
//
// The model is keys and values, not sentences, so the probe can render every
// row in every language and the screen renders it in the one it is in.

import type { Fixture, GameState, Player, PressItem } from './model'
import { absWeek, fmtMoney, fmtWage, trustKey } from './model'
import { ord, t } from './i18n'
import { deskBlock, deskGates, inInbox, nextStep, pressBlock } from './days'
import { natSquadHold } from './country'
import { isBoardroom, OFFICE_OUTLET } from './media'
import { roomKind } from './room'
import { leaguePos, sortTable } from './schedule'
import { userFixtureThisWeek, assistantFixtureThisWeek } from './season'
import { opponentIn, softSpot } from './oppreport'
import { devPhase } from './devproject'
import { TL } from './devproject'
import { userWageBudget } from './grants'
import { insolvencyRisk } from './insolvency'
import { rankedComps, type RotIntent } from './seasonplan'
import { recall } from './memory'
import { rivalCoach } from './rivalcoach'
import { demandedFinish } from './chairman'
import { objectiveById, type ObjectiveDef } from './objectives'
import { defSystemOf, PRESETS } from './tactics'
import type { Club } from './model'

/** A sentence as a key and its values. A value under a name ending `_k` is
 *  itself a key, `_m` is money, `_w` a weekly wage, `_o` an ordinal; the rest go in as they are. */
export interface DeskLine { k: string; v?: Record<string, string | number> }

/** Where a tap goes: a screen and its parameter, or the inbox queue. */
export interface DeskGo { screen: string; param?: string | number; inbox?: boolean }

export type DecisionKind =
  | 'annual' | 'offer' | 'press' | 'office' | 'split' | 'renew' | 'role' | 'injury' | 'acad'
  | 'board' | 'squad' | 'mail'

export interface DeskDecision {
  kind: DecisionKind
  line: DeskLine
  go: DeskGo
  /** the press item behind it, for the ones the desk can answer in place */
  pressId?: number
  /** the mail line's headline: the oldest unread story, the one a tap serves
   *  (store.openInbox reads the queue front to back) */
  newsId?: number
}

export interface DeskRow {
  id: 'match' | 'dev' | 'money' | 'tactics' | 'room' | 'season' | 'thread'
  /** the row's name, a key */
  label: string
  lines: DeskLine[]
  go: DeskGo
  /** alert colours the row's edge; nothing else does */
  alert?: boolean
}

export interface DeskMatch {
  fixtureId: number
  /** the manager's own match this week, as opposed to one further off */
  thisWeek: boolean
  /** a Test week: the assistant has this club game */
  assistant: boolean
  /** the analyst's one line, this week only */
  analyst: DeskLine | null
}

export interface Desk {
  decisions: DeskDecision[]
  /** unread stories in the inbox: part of the decisions when they hold, and
   *  a count on the row either way */
  unread: number
  match: DeskMatch | null
  rows: DeskRow[]
  thread: DeskRow | null
}

// ------------------------------------------------------------------ render

/** The line in the language on screen. */
export function deskText(l: DeskLine): string {
  const vars: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(l.v ?? {})) {
    if (k.endsWith('_k') && typeof v === 'string') vars[k.slice(0, -2)] = t(v)
    else if (k.endsWith('_m') && typeof v === 'number') vars[k.slice(0, -2)] = fmtMoney(v)
    else if (k.endsWith('_o') && typeof v === 'number') vars[k.slice(0, -2)] = ord(v)
    else if (k.endsWith('_w') && typeof v === 'number') vars[k.slice(0, -2)] = `${fmtWage(v)}${t('common.perWeek')}`
    else vars[k] = v
  }
  return t(l.k, vars)
}

// ------------------------------------------------------------- decisions

const playerName = (state: GameState, id: number | undefined) =>
  (id != null ? state.players[id]?.name : undefined) ?? ''

/** What kind of question a press item is, in the desk's own words. */
export function pressKind(q: PressItem): DecisionKind {
  if (isBoardroom(q)) return 'board'
  if (q.options.some(o => o.acad != null)) return 'acad'
  const room = roomKind(q)
  if (room) return room
  if (q.outlet === OFFICE_OUTLET) return 'office'
  return 'press'
}

/** Is this press item one that holds the week? The rule Continue keeps
 *  (days.ts pressBlock): unanswered, and with an answer to give. */
export const pressHolds = (q: PressItem) => !q.answered && (q.options?.length ?? 0) > 0

const unreadCount = (state: GameState) =>
  state.news.filter(n => !n.read && !n.cleared && inInbox(state, n)).length

/**
 * Everything that must be cleared before the week can turn: the same four
 * predicates continueWeek obeys (store.ts), in the order it obeys them.
 * Mail holds only on the way out of the week, but it does hold there, so it
 * is on the list whenever there is any.
 */
export function deskDecisions(state: GameState): DeskDecision[] {
  const out: DeskDecision[] = []
  if (state.annual) out.push({ kind: 'annual', line: { k: 'desk.dAnnual' }, go: { screen: 'annual' } })
  if (!state.unemployed) {
    for (const o of state.offers) {
      if (o.status !== 'pending' || !o.forUser) continue
      out.push({
        kind: 'offer', go: { screen: 'offers' },
        line: { k: 'desk.dOffer', v: { player: playerName(state, o.playerId), club: state.clubs[o.fromClubId]?.short ?? o.fromClubId, fee_m: o.fee } },
      })
    }
  }
  // newest first, as the press room lists them
  const waiting = state.press.filter(pressHolds).slice().reverse()
  const board = waiting.filter(isBoardroom)
  for (const q of waiting) {
    if (isBoardroom(q)) continue
    const kind = pressKind(q)
    const who = playerName(state, q.playerId)
    out.push({
      kind, pressId: q.id, go: { screen: 'press' },
      line: kind === 'press' ? { k: 'desk.dPress', v: { outlet: q.outlet } }
        : who ? { k: `desk.d_${kind}`, v: { player: who } }
        : { k: 'desk.d_officeNone' },
    })
  }
  if (board.length) {
    out.push({ kind: 'board', go: { screen: 'finances' }, line: { k: 'desk.dBoard', v: { n: board.length } } })
  }
  const sq = natSquadHold(state)
  if (sq) out.push({ kind: 'squad', go: { screen: 'country' }, line: { k: 'desk.dSquad', v: { n: sq.n } } })
  const unread = unreadCount(state)
  if (unread) {
    const first = state.news.filter(n => !n.read && !n.cleared && inInbox(state, n)).sort((a, b) => a.id - b.id)[0]
    out.push({ kind: 'mail', go: { screen: 'inbox', inbox: true }, line: { k: 'desk.dMail', v: { n: unread } }, newsId: first?.id })
  }
  return out
}

/**
 * What Continue will stop on right now, and the label it wears: the offers
 * gate, the press and the board, the national squad, then the mail on the way
 * out of the week, in the order continueWeek (store.ts) applies them. The
 * masthead's button and the desk's own read this one function, so the two
 * can never say different things.
 */
export function continueHold(state: GameState): { kind: string; n: number; label: string } | null {
  const bids = state.unemployed ? 0 : state.offers.filter(o => o.status === 'pending' && o.forUser).length
  if (bids) return { kind: 'offers', n: bids, label: bids === 1 ? t('dayroom.deskOffers') : t('dayroom.deskOffersN', { n: bids }) }
  const press = pressBlock(state)
  if (press) return press
  const owed = natSquadHold(state)
  if (owed) return { kind: 'squad', n: owed.n, label: t('dayroom.deskSquad', { n: owed.n }) }
  return deskGates(nextStep(state)) ? deskBlock(state) : null
}

// ------------------------------------------------------------------ match

function nextFixture(state: GameState): Fixture | undefined {
  const club = state.userClubId
  return userFixtureThisWeek(state) ?? state.fixtures
    .filter(f => !f.played && f.week >= state.week && (f.homeId === club || f.awayId === club))
    .sort((a, b) => a.week - b.week)[0]
}

const sureKey = (c: number) => (c >= 0.85 ? 'oppreport.sureHigh' : c >= 0.7 ? 'oppreport.sureMid' : 'oppreport.sureLow')

function deskMatch(state: GameState): DeskMatch | null {
  if (state.unemployed) return null
  const fx = nextFixture(state)
  if (!fx) return null
  const thisWeek = fx.week === state.week
  const aFx = assistantFixtureThisWeek(state)
  const assistant = !!aFx && aFx.id === fx.id
  let analyst: DeskLine | null = null
  if (thisWeek && !assistant && fx.compId !== 'fr') {
    const opp = opponentIn(state, fx)
    // a shallow copy: analystRead files its read on whatever it is handed
    const soft = opp ? softSpot({ ...state } as GameState, opp) : null
    if (soft) analyst = { k: 'oppreport.soft', v: { unit_k: `oppreport.u_${soft.unit}`, sure_k: sureKey(soft.confidence) } }
  }
  return { fixtureId: fx.id, thisWeek, assistant, analyst }
}

// ------------------------------------------------------------ development

const young = (state: GameState): Player[] => {
  const club = state.clubs[state.userClubId]
  if (!club) return []
  return club.players.map(id => state.players[id]).filter((p): p is Player => !!p && p.age <= 23 && !p.onLoan)
}

/** A breakthrough or a stall the staff wrote up in the last three weeks,
 *  or the young man having the best of a flying month. Nothing otherwise. */
function devRow(state: GameState): DeskRow | null {
  const now = absWeek(state.season, state.week)
  const recent = state.news
    .filter(n => (n.k === 'news.devBreakthrough' || n.k === 'news.devStalled' || n.k === 'news.devStalledMins') &&
      n.playerId != null && now - absWeek(n.season, n.week) <= 3 && state.players[n.playerId]?.clubId === state.userClubId)
    .sort((a, b) => b.id - a.id)[0]
  if (recent) {
    const k = recent.k === 'news.devBreakthrough' ? 'desk.devBreak' : 'desk.devStall'
    return { id: 'dev', label: 'desk.dev', lines: [{ k, v: { player: playerName(state, recent.playerId) } }], go: { screen: 'player', param: recent.playerId! } }
  }
  const flying = young(state)
    .filter(p => devPhase(state, p) === 'surge')
    .sort((a, b) => (b.ca - (b.ca0 ?? b.ca)) - (a.ca - (a.ca0 ?? a.ca)) || a.id - b.id)[0]
  if (flying) return { id: 'dev', label: 'desk.dev', lines: [{ k: 'desk.devFlying', v: { player: flying.name } }], go: { screen: 'player', param: flying.id } }
  return null
}

// ---------------------------------------------------------------- finance

function moneyRow(state: GameState): DeskRow | null {
  const club = state.clubs[state.userClubId]
  if (!club || state.unemployed) return null
  const wages = club.players.reduce((s, id) => s + (state.players[id]?.wage ?? 0), 0)
  const room = userWageBudget(state, club) - wages
  const risk = insolvencyRisk(state, club)
  const head: DeskLine = risk !== 'none' ? { k: 'desk.moneyAdmin' }
    : club.balance < 0 ? { k: 'home.inTheRed' }
    : room <= 0 ? { k: 'desk.moneyWagesFull' }
    : { k: 'desk.moneyRoom', v: { room_w: room } }
  return {
    id: 'money', label: 'home.dashFinances', go: { screen: 'finances' }, alert: risk !== 'none' || club.balance < 0,
    lines: [{ k: 'desk.money', v: { bal_m: club.balance } }, head],
  }
}

// ---------------------------------------------------------------- tactics

/** How the side plays, as two names the Tactics screen already uses: the
 *  nearest one-tap plan to the with-ball dials, and the defensive system the
 *  without-ball dials describe. */
function deskTactics(_state: GameState, club: Club): { atk: string; def: string } {
  const tac = club.tactic
  let atk = PRESETS[PRESETS.length - 1]
  let best = Infinity
  for (const pr of PRESETS) {
    const v = pr.values
    const d = (v.style - tac.style) ** 2 + (v.tempo - tac.tempo) ** 2 + (v.kicking - tac.kicking) ** 2 + (v.aggression - tac.aggression) ** 2
    if (d < best) { best = d; atk = pr }
  }
  return { atk: atk.name, def: defSystemOf(tac.defLine ?? 50, tac.defWidth ?? 50).name }
}

const ROT_KEY: Record<RotIntent, string> = {
  strongest: 'selection.rotStrongest', balanced: 'selection.rotBalanced', protect: 'selection.rotProtect',
}

function tacticsRow(state: GameState): DeskRow | null {
  const club = state.clubs[state.userClubId]
  if (!club || state.unemployed) return null
  const s = deskTactics(state, club)
  const lines: DeskLine[] = [{ k: 'desk.tactics', v: { atk_k: s.atk, def_k: s.def } }]
  const plan = state.seasonPlan
  const first = plan ? rankedComps(state)[0] : undefined
  if (plan && first && state.comps[first]) {
    lines.push({ k: 'desk.priority', v: { comp: state.comps[first].name, rot_k: ROT_KEY[plan.rot] } })
  }
  return { id: 'tactics', label: 'groups.tactics', lines, go: { screen: 'tactics' } }
}

// ---------------------------------------------------------- dressing room

function roomRow(state: GameState): DeskRow | null {
  const club = state.clubs[state.userClubId]
  if (!club || state.unemployed) return null
  const squad = club.players.map(id => state.players[id]).filter((p): p is Player => !!p && !p.acad)
  const low = squad.filter(p => p.morale <= 4.5).length
  const trust = trustKey(Math.max(0, Math.min(100, state.mgrTrust ?? 30)))
  return {
    id: 'room', label: 'desk.room', go: { screen: 'squad' }, alert: low >= 4,
    lines: [{ k: low ? 'desk.roomLow' : 'desk.roomFine', v: { word_k: trust, n: low } }],
  }
}

// -------------------------------------------------------- season position

function seasonRow(state: GameState): DeskRow | null {
  const club = state.clubs[state.userClubId]
  if (!club || state.unemployed) return null
  const comp = state.comps[club.leagueId]
  if (!comp) return null
  const n = comp.table.length || 14
  const aim = demandedFinish(state, club.id, n)
  const pos = leaguePos(comp.table, club.id)
  // the board's side objectives, counted the way the Finances board card
  // lists them (the list itself lives there, beside the aim)
  const objs = (state.objectives ?? []).map(objectiveById).filter((o): o is ObjectiveDef => !!o && o.applies(state))
  const obj: DeskLine[] = objs.length ? [{ k: 'desk.objectives', v: { met: objs.filter(o => o.met(state)).length, total: objs.length } }] : []
  if (!pos) return { id: 'season', label: 'desk.season', go: { screen: 'tables' }, lines: [{ k: 'desk.seasonAim', v: { aim_k: aim.text } }, ...obj] }
  const row = sortTable(comp.table).find(r => r.teamId === club.id)
  const gap = pos - aim.pos
  return {
    id: 'season', label: 'desk.season', go: { screen: 'tables' }, alert: gap >= 3,
    lines: [
      { k: 'desk.seasonPos', v: { pos_o: pos, pts: row?.pts ?? 0 } },
      gap <= 0 ? { k: 'desk.seasonOn' } : { k: 'desk.seasonShort', v: { n: gap } },
      ...obj,
    ],
  }
}

// ------------------------------------------------------ still to be answered

/**
 * One open thread the career is carrying that this week touches, or none.
 * In order: a man you let go lining up against you, your rival in the other
 * dugout, a promise falling due, a man you rushed back, a projection the
 * staff have just revised.
 */
function threadRow(state: GameState): DeskRow | null {
  if (state.unemployed) return null
  const club = state.clubs[state.userClubId]
  if (!club) return null
  const fx = userFixtureThisWeek(state)
  const opp = fx && !assistantFixtureThisWeek(state) ? opponentIn(state, fx) : null
  if (opp && state.clubs[opp]) {
    const gone = recall(state, { kind: ['sold', 'released', 'let-go'] })
      .filter(e => e.playerId != null && state.players[e.playerId]?.clubId === opp)
      .sort((a, b) => b.sal - a.sal || b.id - a.id)[0]
    if (gone) {
      return {
        id: 'thread', label: 'desk.thread', go: { screen: 'player', param: gone.playerId! },
        lines: [{ k: 'desk.tFormer', v: { player: playerName(state, gone.playerId), club: state.clubs[opp].short } }],
      }
    }
    const rc = rivalCoach(state)
    if (rc && rc.at === opp) {
      return {
        id: 'thread', label: 'desk.thread', go: { screen: 'club', param: opp },
        lines: [{ k: 'desk.tRival', v: { coach: rc.n, w: rc.w, d: rc.d, l: rc.l } }],
      }
    }
  }
  const due = (state.pledges ?? [])
    .filter(pl => pl.season === state.season && pl.due >= state.week &&
      state.players[pl.playerId]?.clubId === club.id)
    .sort((a, b) => a.due - b.due || a.playerId - b.playerId)[0]
  if (due) {
    return {
      id: 'thread', label: 'desk.thread', go: { screen: 'player', param: due.playerId },
      lines: [{ k: `desk.tPromise_${due.kind}`, v: { player: playerName(state, due.playerId), n: due.due - state.week } }],
    }
  }
  const now = absWeek(state.season, state.week)
  const rushed = recall(state, { kind: 'rushed-back', sinceSeason: state.season })
    .filter(e => e.playerId != null && state.players[e.playerId]?.clubId === club.id && now - absWeek(e.season, e.week) <= 4)
    .sort((a, b) => b.id - a.id)[0]
  if (rushed) {
    return {
      id: 'thread', label: 'desk.thread', go: { screen: 'player', param: rushed.playerId! },
      lines: [{ k: 'desk.tRushed', v: { player: playerName(state, rushed.playerId) } }],
    }
  }
  if (state.week <= 6) {
    for (const p of young(state).sort((a, b) => a.id - b.id)) {
      const last = p.tl?.[p.tl.length - 1]
      if (!last || last[0] !== state.season - 1) continue
      if (last[2] & (TL.up | TL.down)) {
        return {
          id: 'thread', label: 'desk.thread', go: { screen: 'player', param: p.id },
          lines: [{ k: last[2] & TL.up ? 'desk.tProjUp' : 'desk.tProjDown', v: { player: p.name } }],
        }
      }
    }
  }
  return null
}

// ------------------------------------------------------------------ the desk

export function buildDesk(state: GameState): Desk {
  const decisions = deskDecisions(state)
  const rows = [devRow(state), moneyRow(state), tacticsRow(state), roomRow(state), seasonRow(state)]
    .filter((r): r is DeskRow => !!r)
  return {
    decisions,
    unread: unreadCount(state),
    match: deskMatch(state),
    rows,
    thread: threadRow(state),
  }
}
