/**
 * ---- THE PRESS BAROMETER (1.8.0) ----
 *
 * Owner: "Press room should be a sentiment based barometer at the top - are
 * the press warm to you. If winning yes... losing they start to pile on the
 * pressure, winning too many on the bounce and they try to unsettle your squad
 * too. Answering their questions becomes important to the mood of your team
 * and the fans."
 *
 * One number per career, -100 (hostile) to +100 (adoring), read off real
 * results. Each competitive result moves it, and it moves further:
 *
 *   - against expectation. A defeat as favourites is a story; a defeat as
 *     underdogs is a Saturday. Expectation is the two clubs' reputations, the
 *     pundits' pre-season predictions where both sides have one, and home
 *     ground - the same things the game already uses to say who is fancied.
 *   - on a run. The third defeat in a row is written up harder than the first,
 *     and so is the third win.
 *   - in a derby, a little.
 *
 * Everything fades back toward neutral: a tenth of the old feeling goes with
 * every new result, a twentieth in a week without one, and half of it over the
 * summer. Nothing here draws on the shared rng.
 *
 * THE FLIP. Five straight wins and the pack stops writing about how good the
 * side is and starts looking for the crack: contract talk, rival interest, a
 * row over selection, complacency. That is `stir`, and the questions change
 * with it (media.ts). Talking the run up in public brings it a win closer.
 *
 * Answers move three things (answerPress, via applyMoodAnswer): the whole
 * squad's morale, the terraces, and this needle. All small - a tenth or three
 * of morale on a 1-10 scale, a point or two of fan mood, a few points here -
 * so a season of good answers is worth something and one answer is never a
 * result's worth.
 */
import type { Fixture, GameState, PressItem, PressMood, PressOption } from './model'
import { absWeek } from './model'
import { isDerby } from './rivalries'
import { clamp } from './rng'
import type { Vars } from './i18n'

export type Baro = 'hostile' | 'sceptical' | 'neutral' | 'warm' | 'adoring'

/** Where the words change. Three straight defeats from level lands in
 *  sceptical; hostile takes a real slump or a run of upsets. */
export function bandOf(v: number): Baro {
  return v <= -45 ? 'hostile' : v <= -15 ? 'sceptical' : v < 15 ? 'neutral' : v < 45 ? 'warm' : 'adoring'
}

/** One competitive result of the user's club, as the press read it. */
export interface Read {
  fx: Fixture
  abs: number
  us: number
  them: number
  res: 'W' | 'D' | 'L'
  /** -1 rank outsiders .. +1 heavy favourites */
  exp: number
  oppId: string
}

/**
 * Who was expected to win, -1 to +1 from the user's side.
 *
 * Reputation is the spine: twelve points of it is a whole class of club. The
 * pundits' predicted finish is averaged in when both sides were predicted
 * (league games), and playing at home is worth a little either way. A final
 * at a neutral ground has no home side.
 */
export function expectation(state: GameState, fx: Fixture): number {
  const me = state.userClubId
  const oppId = fx.homeId === me ? fx.awayId : fx.homeId
  const us = state.clubs[me], opp = state.clubs[oppId]
  if (!us || !opp) return 0
  let e = (us.rep - opp.rep) / 12
  const pu = state.preds?.[me], po = state.preds?.[oppId]
  if (pu != null && po != null) {
    const n = state.comps[us.leagueId]?.teamIds.length ?? 10
    e = (e + (po - pu) / Math.max(2, n / 2)) / 2
  }
  if (!fx.venue) e += fx.homeId === me ? 0.15 : -0.15
  return clamp(e, -1, 1)
}

/** The user's competitive results this season, oldest first. Friendlies and
 *  anything the club did not play in are not the press's business. */
export function userResults(state: GameState): Read[] {
  const me = state.userClubId
  return state.fixtures
    .filter(f => f.played && f.compId !== 'fr' && (f.homeId === me || f.awayId === me))
    .map(fx => {
      const us = fx.homeId === me ? fx.homeScore : fx.awayScore
      const them = fx.homeId === me ? fx.awayScore : fx.homeScore
      return {
        fx, abs: absWeek(state.season, fx.week), us, them,
        res: (us > them ? 'W' : us < them ? 'L' : 'D') as Read['res'],
        exp: expectation(state, fx),
        oppId: fx.homeId === me ? fx.awayId : fx.homeId,
      }
    })
    .sort((a, b) => a.abs - b.abs || a.fx.id - b.fx.id)
}

/** The run the latest result is part of: its kind and its length. */
export function trailingRun(reads: Read[]): { res: Read['res'] | null; n: number } {
  if (!reads.length) return { res: null, n: 0 }
  const res = reads[reads.length - 1].res
  let n = 0
  for (let i = reads.length - 1; i >= 0 && reads[i].res === res; i--) n++
  return { res, n }
}

/**
 * What one result does to the needle. `n` is how long the run is including
 * this result, so the first defeat is 1 and the third is 3.
 *
 *   win    +7, less as favourites (+4), more as outsiders (+10)
 *   defeat -7, more as favourites (-11), less as outsiders (-3)
 *   draw   read against expectation alone: a favourite's draw costs, an
 *          outsider's earns
 *
 * A run adds a quarter per result after the first, capped at double. A
 * twenty-point margin either way adds two; a derby is worth a quarter more.
 */
export function resultShift(r: Pick<Read, 'res' | 'exp' | 'us' | 'them'>, n: number, derby = false): number {
  let base = r.res === 'W' ? 7 - 3 * r.exp : r.res === 'L' ? -(7 + 4 * r.exp) : -3 * r.exp
  if (r.us - r.them >= 20) base += 2
  if (r.them - r.us >= 20) base -= 2
  const run = r.res === 'D' ? 1 : 1 + 0.25 * Math.min(Math.max(n, 1) - 1, 4)
  return base * run * (derby ? 1.25 : 1)
}

/** Wins in a row before the press turn to unsettling the squad. Five, and a
 *  win sooner for every time the manager talked the run up (never below three). */
export function stirAt(pm: Pick<PressMood, 'hype'> | undefined): number {
  return Math.max(3, 5 - (pm?.hype ?? 0))
}

const round1 = (x: number) => Math.round(x * 10) / 10

/** Fold everything since `at` into the needle. Pure: returns the new mood. */
function fold(state: GameState, prev: PressMood | undefined): PressMood {
  const now = absWeek(state.season, state.week)
  let pm: PressMood = prev
    ? { ...prev }
    : { v: 0, at: -1, club: state.userClubId, s: state.season }
  // a new job is a clean sheet: the last club's results were somebody else's
  if (pm.club !== state.userClubId) pm = { v: 0, at: now, club: state.userClubId, s: state.season }
  // the summer takes half of it away, and any hype with it
  if (pm.s !== state.season) { pm.v *= 0.5; pm.s = state.season; pm.hype = 0 }
  const reads = userResults(state)
  let v = pm.v
  let moved = false
  reads.forEach((r, i) => {
    if (r.abs <= pm.at) return
    let n = 0
    for (let j = i; j >= 0 && reads[j].res === r.res; j--) n++
    v = v * 0.9 + resultShift(r, n, !!r.fx.derby || isDerby(r.fx.homeId, r.fx.awayId))
    moved = true
  })
  if (!moved && now > pm.at && pm.at >= 0) v *= 0.95
  pm.v = clamp(round1(v), -100, 100)
  pm.at = Math.max(pm.at, now)
  const run = trailingRun(reads)
  if (run.res !== 'W') pm.hype = 0
  pm.stir = run.res === 'W' && run.n >= stirAt(pm)
  return pm
}

/** The weekly settle: called by generatePress before it asks anything, so the
 *  question it picks reads the press the manager is about to face. */
export function settlePressMood(state: GameState): PressMood {
  state.pressMood = fold(state, state.pressMood)
  return state.pressMood
}

/** The needle as the screen should draw it. A save from before the barometer
 *  has no stored mood yet, so it is read off the season so far without
 *  writing anything - the next weekly settle stores the same answer. */
export function currentMood(state: GameState): PressMood {
  return state.pressMood ?? fold(state, undefined)
}

/** The press room's family of question this week, or null when the pack has
 *  nothing to say about the manager himself. */
export type MoodRoom = 'stir' | 'hostile' | 'sceptical' | 'warm'
export function moodRoom(pm: PressMood): MoodRoom | null {
  if (pm.stir) return 'stir'
  const b = bandOf(pm.v)
  return b === 'hostile' ? 'hostile' : b === 'sceptical' ? 'sceptical' : b === 'warm' || b === 'adoring' ? 'warm' : null
}

/**
 * THE ONE-LINE REASON under the gauge, from the real results - never a
 * sentence the game made up. The run first (it is what the papers lead on),
 * then an upset, then simply the last result.
 */
export function pressWhy(state: GameState, pm = currentMood(state)): { k: string; v?: Vars } {
  const reads = userResults(state)
  if (!reads.length) return { k: 'world.prBaroWhyNone' }
  const run = trailingRun(reads)
  if (pm.stir) return { k: 'world.prBaroWhyStir', v: { n: run.n } }
  if (run.n >= 2 && run.res === 'L') return { k: 'world.prBaroWhyLosses', v: { n: run.n } }
  if (run.n >= 2 && run.res === 'W') return { k: 'world.prBaroWhyWins', v: { n: run.n } }
  if (run.n >= 2 && run.res === 'D') return { k: 'world.prBaroWhyDraws', v: { n: run.n } }
  const r = reads[reads.length - 1]
  const v = { opp: state.clubs[r.oppId]?.short ?? r.oppId, us: r.us, them: r.them }
  if (r.res === 'L' && r.exp >= 0.25) return { k: 'world.prBaroWhyUpsetL', v }
  if (r.res === 'W' && r.exp <= -0.25) return { k: 'world.prBaroWhyUpsetW', v }
  return { k: r.res === 'W' ? 'world.prBaroWhyWon' : r.res === 'L' ? 'world.prBaroWhyLost' : 'world.prBaroWhyDrew', v }
}

/**
 * What an answer does beyond the man it names, and the record of it for the
 * screen. Called from answerPress for every public answer. The option's own
 * `board` and `fans` are applied there as they always were; this adds the
 * squad-wide morale (`squad`), the needle (`press`) and the hype, and writes
 * all of it onto the item as `fx` so the coverage card can say, in words,
 * what the answer did.
 */
export function applyMoodAnswer(state: GameState, item: PressItem, opt: PressOption, playerDelta = 0): void {
  const fx: NonNullable<PressItem['fx']> = {}
  if (opt.squad) {
    const club = state.clubs[state.userClubId]
    for (const id of club?.players ?? []) {
      const p = state.players[id]
      if (p && !p.onLoan) p.morale = clamp(p.morale + opt.squad, 1, 10)
    }
    fx.squad = opt.squad
  }
  if (opt.press) {
    const pm = settleIfMissing(state)
    pm.v = clamp(round1(pm.v + opt.press), -100, 100)
    fx.press = opt.press
  }
  if (opt.hype) {
    const pm = settleIfMissing(state)
    pm.hype = (pm.hype ?? 0) + opt.hype
    const run = trailingRun(userResults(state))
    pm.stir = run.res === 'W' && run.n >= stirAt(pm)
    fx.hype = true
  }
  if (opt.fans) fx.fans = opt.fans
  if (opt.board) fx.board = opt.board
  // what actually landed on the man, after his temperament and any unsettling
  if (item.playerId != null && playerDelta) fx.player = round1(playerDelta)
  if (Object.keys(fx).length) item.fx = fx
}

function settleIfMissing(state: GameState): PressMood {
  return state.pressMood ?? settlePressMood(state)
}

/** The plain-words effect lines for an answered item, as keys. A tenth of a
 *  point is below what anyone in the building would notice, so it is not
 *  reported; the thresholds match the scale each number lives on. */
export function effectLines(item: PressItem, player?: string): { k: string; tone: 'good' | 'bad' | 'mixed'; v?: Vars }[] {
  const fx = item.fx
  if (!fx) return []
  const out: { k: string; tone: 'good' | 'bad' | 'mixed'; v?: Vars }[] = []
  if (fx.squad != null && Math.abs(fx.squad) >= 0.1) out.push(fx.squad > 0 ? { k: 'world.prFxSquadUp', tone: 'good' } : { k: 'world.prFxSquadDown', tone: 'bad' })
  if (fx.player != null && player && Math.abs(fx.player) >= 0.3) out.push(fx.player > 0 ? { k: 'world.prFxPlayerUp', tone: 'good', v: { player } } : { k: 'world.prFxPlayerDown', tone: 'bad', v: { player } })
  if (fx.fans != null && Math.abs(fx.fans) >= 0.1) out.push(fx.fans > 0 ? { k: 'world.prFxFansUp', tone: 'good' } : { k: 'world.prFxFansDown', tone: 'bad' })
  if (fx.press != null && Math.abs(fx.press) >= 1) out.push(fx.press > 0 ? { k: 'world.prFxPressUp', tone: 'good' } : { k: 'world.prFxPressDown', tone: 'bad' })
  if (fx.board != null && Math.abs(fx.board) >= 0.2) out.push(fx.board > 0 ? { k: 'world.prFxBoardUp', tone: 'good' } : { k: 'world.prFxBoardDown', tone: 'bad' })
  if (fx.hype) out.push({ k: 'world.prFxHype', tone: 'mixed' })
  return out
}
