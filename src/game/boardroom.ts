import type { GameState } from './model'
import { addWeeks100, fmtMoney, logDecision, MAX_FACILITY, FACILITY_INFO,
  stamp100, weeksBetween100, type FacilityId } from './model'
import { clamp } from './rng'
import { t, tIn } from './i18n'

/**
 * ---- THE BOARDROOM DOOR (owner, v1.8.3) ----
 *
 * "In the club section there needs to be a board request section - ask for
 * more time if the team is losing, you can ask for more money, ask for
 * facilities upgrades, ask for more staff budget. These should be rare to be
 * accepted except if the club have won a title or something particular. If
 * for example all facilities are done then this should always be denied as
 * max reached. If you keep asking the board and they reject - their faith in
 * you as a manager should be dented cause you arent listening."
 *
 * The four asks were scattered: transfer money lived on the Finances page,
 * facilities on Infrastructure, and time and the staff budget did not exist
 * at all. They are one room now, because a board is one room.
 *
 * THE RULES THIS FOLLOWS
 *
 *   RARE, and earned rather than random. Every ask needs a CASE - silverware,
 *   a run of wins, a board that already rates you. The case used to be shown
 *   before you knocked; it is shown after now (owner, v1.7.0), because four
 *   lines of gold telling you what would happen before anything had was the
 *   whole screen giving its answer away. `caseFor` is still computed the same
 *   way and still read by the UI - only later.
 *
 *   A THING THAT CANNOT BE GIVEN IS NOT A REFUSAL. A maxed estate is not the
 *   board saying no to you, it is there being nothing to ask for, so it costs
 *   nothing and carries no grudge. Everything else that gets turned down
 *   closes the door for a while, and knocking on a closed door is the thing
 *   that costs (pressBoard in season.ts).
 *
 *   EVERY YES DOES SOMETHING. Time moves the sack threshold, money moves the
 *   transfer budget, facilities pay for the next build outright, and the
 *   staff budget raises what the backroom may cost. A request that only
 *   prints a letter is a request nobody needs.
 */
export type BoardAsk = 'time' | 'funds' | 'facilities' | 'staff'

export const BOARD_ASKS: readonly BoardAsk[] = ['time', 'funds', 'facilities', 'staff'] as const

/** What the boardroom key is for each ask - two of them share the capital
 *  ledger with the estate, because to a board they are the same envelope. */
const LEDGER: Record<BoardAsk, 'capital' | 'funds' | 'time' | 'staff'> = {
  time: 'time', funds: 'funds', facilities: 'capital', staff: 'staff',
}

export interface AskState {
  id: BoardAsk
  /** false when there is nothing here to ask for at all */
  possible: boolean
  /** why it cannot be asked, when it cannot */
  blocked?: string
  /** 0..1, how good the case looks before you knock */
  odds: number
  /** the case, in the manager's own words */
  caseFor: string
}

/**
 * HOW GOOD THE CASE IS, before anybody knocks.
 *
 * Deterministic and rng-free, so the number on the button is the number the
 * board uses. Confidence carries most of it, silverware and a winning run are
 * the "something particular" the owner asked for, and each ask adds its own
 * test on top.
 */
function baseCase(state: GameState): number {
  const club = state.clubs[state.userClubId]
  if (!club) return 0
  let n = (club.boardConfidence - 45) / 100          // -0.45 .. +0.55
  // silverware this season or last is the thing that opens a chairman's door
  const wins = (state.mgr?.trophies ?? []).filter(h => h.season >= state.season - 1).length
  n += Math.min(0.30, wins * 0.18)
  // and a run of results, which is the case a manager can build himself
  const mine = state.fixtures
    .filter(f => f.played && (f.homeId === club.id || f.awayId === club.id) && f.compId !== 'fr')
    .slice(-6)
  let w = 0
  for (const f of mine) {
    const us = f.homeId === club.id ? (f.homeScore ?? 0) : (f.awayScore ?? 0)
    const them = f.homeId === club.id ? (f.awayScore ?? 0) : (f.homeScore ?? 0)
    if (us > them) w++
  }
  if (mine.length >= 3) n += (w / mine.length - 0.5) * 0.35
  return clamp(n, 0, 0.95)
}

/** The lowest facility the board could be asked to fund, or null if the
 *  estate is finished. */
export function nextBuild(state: GameState): FacilityId | null {
  const club = state.clubs[state.userClubId]
  if (!club) return null
  let best: FacilityId | null = null
  let low = MAX_FACILITY
  for (const fid of Object.keys(FACILITY_INFO) as FacilityId[]) {
    const lvl = club.facilities?.[fid] ?? 0
    if (lvl < low) { low = lvl; best = fid }
  }
  return low >= MAX_FACILITY ? null : best
}

/**
 * Is the door still shut on this ledger?
 *
 * Eight weeks from the refusal, measured with weeksBetween100 rather than by
 * subtracting the stamps: a stamp is season*100 + week, so week 2 of next
 * season minus week 46 of this one is -44 raw and +4 in weeks, and the raw
 * answer would re-open every door across a season boundary and shut every one
 * across the turn of the year. deniedAt is always in the past, so the
 * difference is negative and the window is the last eight weeks of it.
 *
 * The `warned` flag is deliberately NOT consulted. It was, and it quietly
 * disarmed the whole escalation: pressBoard sets it on the first push, so the
 * door read as open again and the second push went back through the ordinary
 * refusal instead of reaching the sack. What counts the pushes is rec.strikes,
 * which pressBoard owns; this function only answers whether the door is shut.
 */
function doorShut(state: GameState, key: 'capital' | 'funds' | 'time' | 'staff', abs: number): boolean {
  const rec = state.boardAsks?.[key]
  return !!rec && weeksBetween100(rec.deniedAt, abs) > -8
}

/** Everything the manager could put to the board today, and how it looks. */
export function boardRequests(state: GameState): AskState[] {
  const club = state.clubs[state.userClubId]
  const abs = stamp100(state)
  const out: AskState[] = []
  for (const id of BOARD_ASKS) {
    const cooling = doorShut(state, LEDGER[id], abs)
    let possible = true
    let blocked: string | undefined
    let odds = baseCase(state)

    if (id === 'facilities') {
      // THE ONE THAT IS NEVER A JUDGEMENT. Nothing left to build is a fact
      // about the estate, not an opinion about the manager.
      if (!nextBuild(state)) { possible = false; blocked = t('board.blockEstateMax') }
      else if (state.facilityBuild || state.stadiumBuild) { possible = false; blocked = t('board.blockBuilders') }
    } else if (id === 'time') {
      // a board does not give time to a manager who is not under pressure
      if (club && club.boardConfidence > 45) { possible = false; blocked = t('board.blockNotStruggling') }
      else if ((state.boardGrace ?? 0) > abs) { possible = false; blocked = t('board.blockAlreadyTime') }
      // TIME IS THE ONE ASK baseCase CANNOT PRICE. Its two big terms are
      // current confidence and the last six results, and a manager asking for
      // time has neither by definition - so baseCase handed the man who most
      // needs it the worst case in the room, and the ask could never be
      // granted to anybody. It is scored on CREDIT instead: silverware in the
      // last two seasons is the "something particular" the owner named,
      // seasons served are worth a little, confidence is worth a quarter of
      // what it is worth elsewhere, and the calendar matters - a board will
      // wait in September and will not in March.
      else if (club) {
        const wins = (state.mgr?.trophies ?? []).filter(h => h.season >= state.season - 1).length
        const tenure = state.mgr?.finishes?.length ?? 0
        odds = clamp(Math.min(0.30, wins * 0.30) + Math.min(0.10, tenure * 0.04)
          + 0.18 - state.week / 110 + (club.boardConfidence - 45) / 260, 0, 0.9)
      }
    } else if (id === 'funds') {
      if (state.fundsAskedSeason === state.season) { possible = false; blocked = t('board.blockFundsSeason') }
    } else if (id === 'staff') {
      if (state.staffAskedSeason === state.season) { possible = false; blocked = t('board.blockStaffSeason') }
    }

    if (possible && cooling) {
      // the door is shut but knocking is allowed, and the button says so
      odds = 0
    }
    out.push({
      id, possible, blocked, odds,
      caseFor: t(odds >= 0.6 ? 'board.caseStrong' : odds >= 0.35 ? 'board.caseFair'
        : odds > 0 ? 'board.caseThin' : 'board.caseShut'),
    })
  }
  return out
}

/** The threshold a case has to clear. Deliberately high - the owner asked for
 *  these to be RARE, so an ordinary mid-table season gets nothing. */
const BAR: Record<BoardAsk, number> = { time: 0.30, funds: 0.55, facilities: 0.62, staff: 0.58 }

export function askBoard(state: GameState, id: BoardAsk, pressBoard: (s: GameState, k: 'capital' | 'funds' | 'time' | 'staff') => string): string {
  const club = state.clubs[state.userClubId]
  if (!club) return ''
  const abs = stamp100(state)
  const here = boardRequests(state).find(a => a.id === id)!
  // nothing to give: a plain no, no cooldown, no grudge, nothing spent
  if (!here.possible) return here.blocked ?? ''

  const key = LEDGER[id]
  // knocking on a door the board just closed is the thing that costs
  if (doorShut(state, key, abs)) return pressBoard(state, key)

  const granted = here.odds >= BAR[id]
  if (!granted) {
    ;(state.boardAsks ??= {})[key] = { deniedAt: abs, strikes: 0 }
    logDecision(state, 'dec.boardNo', { ask_k: `board.ask_${id}` }, false)
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
      // EVERY STORY NEEDS ITS OWN Subj SIBLING. newsSubject (model.ts) builds
      // an inbox headline as `k + 'Subj'`, and these eight keys are assembled
      // at runtime from the ask's id - so nothing that reads this file as text
      // can see them, and the generic news.boardNoSubj they used to share was
      // never the key that got asked for. The result reached a real inbox:
      // "news.boardNo_facilitiesSubj" as a headline, in all six languages.
      // Same fault as news.trainInjuryOne, same week. boardroomprobe now files
      // all eight and reads the headline back.
      subject: tIn('en', `news.boardNo_${id}Subj`),
      body: tIn('en', `news.boardNo_${id}`),
      k: `news.boardNo_${id}`, v: {},
    })
    return t(`reply.boardNo_${id}`)
  }

  // ---- a yes, and every one of them moves something ----
  delete state.boardAsks?.[key]
  let reply = ''
  if (id === 'time') {
    // the sack check is suspended while the grace runs, and the chairman
    // says so out loud rather than the manager having to infer it
    state.boardGrace = addWeeks100(abs, 10)
    club.boardConfidence = clamp(Math.max(club.boardConfidence, 26), 0, 100)
    reply = t('reply.boardYes_time', { n: 10 })
  } else if (id === 'funds') {
    state.fundsAskedSeason = state.season
    const add = Math.round((club.budgetAtOpen ?? club.budget) * 0.22 / 1000) * 1000
    club.budget += add
    reply = t('reply.boardYes_funds', { amount: fmtMoney(add) })
  } else if (id === 'facilities') {
    // the board does not merely approve it, it PAYS for it - which is what
    // separates this from the per-facility ask on the Infrastructure page
    const fid = nextBuild(state)!
    ;(state.boardGrant ??= []).push(fid)
    reply = t('reply.boardYes_facilities', { facility: t(FACILITY_INFO[fid].name) })
  } else {
    // A POT, NOT AN ALLOWANCE. This was a weekly figure, and a weekly figure
    // was the wrong shape twice over: nothing in the game charges a weekly
    // staff budget (hiring, courses and severance are all one-off fees
    // against the balance), so it moved nothing at all, and at 3% of the
    // transfer budget a week it would have been £105k a week at Leicester -
    // thirty times the club's modelled weekly margin, which would have
    // undone the economy the ground rebalance was built to hold. It is a
    // ring-fenced fund now, spent on the backroom before the club's own
    // money is (backroomFund in staff.ts).
    state.staffAskedSeason = state.season
    const add = Math.round((club.budgetAtOpen ?? club.budget) * 0.18 / 1000) * 1000
    state.staffRoom = (state.staffRoom ?? 0) + add
    reply = t('reply.boardYes_staff', { amount: fmtMoney(add) })
  }
  logDecision(state, 'dec.boardYes', { ask_k: `board.ask_${id}` }, true)
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
    subject: tIn('en', `news.boardYes_${id}Subj`),
    body: tIn('en', `news.boardYes_${id}`),
    k: `news.boardYes_${id}`, v: {},
  })
  return reply
}
