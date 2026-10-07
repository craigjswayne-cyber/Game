/**
 * ---- THE SUMMER ACADEMY DECISION (1.8.1) ----
 *
 * Owner: "There should be a yearly academy intake with a decision at the end of
 * each season to sign or drop for those who join."
 *
 * The intake itself already happened every summer for every club: the class the
 * coach previews in week 30 arrives at the rollover, and topUpAcademy recruits
 * each academy back to its 27. What there was not was a decision. A scholar who
 * joined stayed until the age gate took him (rollover.ts: the last-year notice
 * at 20, the walk at 21), and the only way to act on him was to find the Promote
 * button on his page, which a manager with twenty-seven scholars never does.
 *
 * So at the end of every season the academy director brings each of them to the
 * office, one at a time, with a recommendation:
 *
 *   a FIRST-YEAR (he joined this season): offer the development contract that
 *     keeps him through to the age gate, at the academy wage the button names,
 *     or release him now;
 *   a lad AT THE GATE (20, so the summer makes him 21 and the development deal
 *     ends): offer his first professional contract, at the wage the button
 *     names, which promotes him to the first-team squad, or release him.
 *
 * They are office items, so they hold Continue the way every office decision
 * does (days.ts pressBlock) and are answered where the office is answered. They
 * are asked in the settle of the last ledger week, so they are on the desk for
 * the close season and all answered before the rollover.
 *
 * AI clubs take the same advice without being asked: at the rollover their
 * first-years the advice would release are released. Their age gate is their
 * own and is unchanged (graduate at 22, or early when ready).
 */
import type { Club, GameState, Player, PressItem, PressOption } from './model'
import { LEDGER_WEEKS, fmtMoney, logDecision } from './model'
import { firstProWage, playerWage } from './attributes'
import { tIn, type Vars } from './i18n'
import { OFFICE_OUTLET } from './media'
import { planAcademyLoan } from './room'
import { remember, rememberDeparture } from './memory'

/** Asked in the settle of the last ledger week: on the desk from week 46. */
export const ACAD_CALL_WEEK = LEDGER_WEEKS

export type AcadCall = 'first' | 'gate'

/** Which decision this man is owed this summer, if any. */
export function acadCall(state: GameState, p: Player | undefined): AcadCall | null {
  if (!p || !p.acad || p.demoted || p.onLoan || !p.clubId) return null
  if (p.age >= 20) return 'gate'
  if (p.acadJoined === state.season) return 'first'
  return null
}

/** The level of the squad a scholar is being measured against: the middle of
 *  the club's best twenty-three seniors. */
function squadLevel(state: GameState, club: Club): number {
  const cas = club.players
    .map(id => state.players[id])
    .filter((q): q is Player => !!q && (!q.acad || !!q.demoted))
    .map(q => q.ca)
    .sort((a, b) => b - a)
    .slice(0, 23)
  return cas.length ? cas[Math.floor(cas.length / 2)] : 60
}

/**
 * The academy director's advice: keep him or not.
 *
 * A first-year is worth keeping if his ceiling reaches within eight points of
 * the middle of this squad (a squad player one day). A lad at the gate is worth
 * a professional wage if his ceiling reaches within six and he is already within
 * sixteen of it now. The club's own level is the yardstick, so the same boy is
 * a keeper at a Championship side and a release at a Premiership one.
 */
export function acadAdvice(state: GameState, p: Player): boolean {
  const club = p.clubId ? state.clubs[p.clubId] : null
  if (!club) return false
  const lvl = squadLevel(state, club)
  return p.age >= 20 ? p.pa >= lvl - 6 && p.ca >= lvl - 16 : p.pa >= lvl - 8
}

/** The wage the button quotes: the academy scale for a first-year, the
 *  professional scale for a lad signing his first senior deal. */
export function acadCallWage(p: Player, call: AcadCall): number {
  return playerWage(p.ca, p.age, call === 'first')
}

const isCall = (q: PressItem) => q.options.some(o => o.acad != null)

/** Put this summer's decisions on the desk. Returns how many were asked. */
export function academyCalls(state: GameState): number {
  if (state.unemployed || state.week !== ACAD_CALL_WEEK) return 0
  const club = state.clubs[state.userClubId]
  if (!club) return 0
  // once a season, whatever else the week does
  if (state.press.some(q => q.season === state.season && isCall(q))) return 0
  let n = 0
  const men = club.players.map(id => state.players[id]).filter((p): p is Player => !!acadCall(state, p))
    .sort((a, b) => b.age - a.age || b.pa - a.pa)
  for (const p of men) {
    const call = acadCall(state, p)!
    const wage = acadCallWage(p, call)
    const keep = acadAdvice(state, p)
    const qk = call === 'gate' ? 'press.acadGateQ' : 'press.acadFirstQ'
    const qv: Vars = {
      player: p.name, pos: p.pos, age: p.age,
      adv_k: !keep ? 'press.acadAdviceRelease' : call === 'gate' ? 'press.acadAdvicePromote' : 'press.acadAdviceSign',
    }
    const yes = call === 'gate' ? 'promote' as const : 'sign' as const
    const option = (act: 'sign' | 'promote' | 'release' | 'loan'): PressOption => {
      const lk = act === 'release' ? 'press.acadRelease' : act === 'promote' ? 'press.acadPromote'
        : act === 'loan' ? (call === 'gate' ? 'room.acadLoanPro' : 'room.acadLoan') : 'press.acadSign'
      const lv: Vars = act === 'release' ? {} : { wage: fmtMoney(wage) }
      const rk = act === 'loan' ? (call === 'gate' ? 'room.acadLoanProR' : 'room.acadLoanR') : `${lk}R`
      const rv: Vars = { player: p.name }
      return {
        morale: 0, board: 0, acad: act, acadWage: act === 'release' ? undefined : wage,
        lk, lv, rk, rv, label: tIn('en', lk, lv), reaction: tIn('en', rk, rv),
      }
    }
    state.press.push({
      id: state.nextId++, week: state.week, season: state.season, outlet: OFFICE_OUTLET,
      question: tIn('en', qk, qv), qk, qv, playerId: p.id,
      // THREE ANSWERS (1.8.2, room.ts): keep him here, keep him and send him
      // out for a season of rugby elsewhere, or let him go
      options: [option(yes), option('loan'), option('release')],
      answered: false,
    })
    n++
  }
  return n
}

/** Is the decision still about somebody it can act on? */
export function acadCallLive(state: GameState, item: PressItem): boolean {
  const p = item.playerId != null ? state.players[item.playerId] : undefined
  return !!p && p.clubId === state.userClubId && !!p.acad && !p.demoted
}

/** Let him go: off the books, into the free-agent pool, no longer a scholar. */
function releaseScholar(state: GameState, club: Club, p: Player) {
  club.players = club.players.filter(id => id !== p.id)
  club.tactic.lineup = club.tactic.lineup.map(id => (id === p.id ? null : id))
  if (club.captain === p.id) club.captain = null
  if (club.vice === p.id) club.vice = null
  p.clubId = null
  p.acad = false
  p.transferListed = false
}

/** Carry out the answer. Called from media.answerPress. */
export function resolveAcadCall(state: GameState, item: PressItem, opt: PressOption): void {
  const p = item.playerId != null ? state.players[item.playerId] : undefined
  const club = state.clubs[state.userClubId]
  if (!p || !club || !opt.acad) return
  if (opt.acad === 'release') {
    // a lad let go is a lad the world can remind you of (memory.ts)
    rememberDeparture(state, p, 'released', club.id)
    remember(state, { kind: 'acad-let-go', playerId: p.id, clubId: club.id, payload: { name: p.name }, sal: 1 })
    releaseScholar(state, club, p)
    logDecision(state, 'dec.acadReleased', { player: p.name }, false)
    return
  }
  // a first deal is two seasons past this one: through the gate for a
  // first-year, and a proper first contract for a lad who signs at 20
  p.contractEnds = Math.max(p.contractEnds, state.season + 3)
  p.morale = Math.min(10, p.morale + 0.5)
  if (opt.acad === 'loan') {
    // kept, on the deal his call is owed, and out for next season: a gate lad
    // on his first professional wage, a first-year on the academy scale
    if (acadCall(state, p) === 'gate') {
      p.acad = false
      p.demoted = false
      p.homegrown = true
      p.gradClub ??= club.id
      p.gradS ??= state.season
      p.wage = opt.acadWage ?? playerWage(p.ca, p.age)
      armDebut(p)
    } else {
      p.wage = opt.acadWage ?? playerWage(p.ca, p.age, true)
    }
    planAcademyLoan(state, p)
    logDecision(state, 'room.decAcadLoan', { player: p.name }, true)
    return
  }
  remember(state, { kind: 'acad-kept', playerId: p.id, clubId: club.id, payload: { name: p.name }, sal: 1 })
  if (opt.acad === 'promote') {
    // the same promotion the Promote button on his page makes
    p.acad = false
    p.demoted = false
    p.homegrown = true
    p.gradClub ??= club.id
    p.gradS ??= state.season
    p.wage = opt.acadWage ?? firstProWage(p.ca, p.age)
    armDebut(p)
    p.morale = Math.min(10, p.morale + 0.5)
    logDecision(state, 'dec.acadPromoted', { player: p.name }, true)
  } else {
    p.wage = opt.acadWage ?? playerWage(p.ca, p.age, true)
    logDecision(state, 'dec.acadSigned', { player: p.name }, true)
  }
}

/**
 * The rollover's half. Run before the academy's own summer sweep (rollover.ts
 * calls closeAcademySeason first, which calls this).
 *
 * The manager's decisions are all answered by now in a normal career, because
 * they hold Continue. One that is not (a spell out of work, a harness driving
 * the engine directly) is withdrawn and the old rules stand: a first-year stays,
 * a lad at 21 walks. The AI's first-years are decided on the director's advice.
 */
export function settleAcadCalls(state: GameState): number {
  state.press = state.press.filter(q => q.answered || !isCall(q))
  let released = 0
  for (const club of Object.values(state.clubs)) {
    if (club.id === state.userClubId) continue
    for (const id of [...club.players]) {
      const p = state.players[id]
      if (!p || !p.acad || p.demoted || p.acadJoined !== state.season || p.age >= 20) continue
      if (acadAdvice(state, p)) continue
      releaseScholar(state, club, p)
      released++
    }
  }
  return released
}

/**
 * HIS FIRST SENIOR GAME IS AN ACADEMY DEBUT, HOWEVER HE WAS PROMOTED (1.8.4
 * career QA). Only the summer graduation armed it (rollover.ts), so a lad
 * promoted from his page or from this call played his first game as nobody's
 * debut: no academy-debut memory, and with it no graduates on the era card,
 * no youth reputation and no debuts for a chairman who asked for them - an
 * academy builder who promoted fifty men was known for none of it. The same
 * test the graduation makes: never a senior game, never a career row.
 */
export function armDebut(p: Player): void {
  if (p.stats.apps === 0 && p.career.length === 0) p.debutPending = 'academy'
}
