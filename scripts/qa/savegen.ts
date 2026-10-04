// Build mid-career saves with THIS checkout's code, played the way the app's
// assistant plays a week (store.ts instantResult): the manager's match on its
// own dice (matchRng), the dressing room opened, two halves, the tactical
// findings and the evidence filed, the press answered, then the week turned.
// Written to be version-agnostic so the same file can be dropped into an older
// release's worktree (1.8.2-1.8.4) and produce that release's own saves:
// every newer hook is looked up at runtime and skipped when absent.
//
//   npx vite-node scripts/qa/savegen.ts -- <out.json> <weeks> [m|w] [seed]
import { writeFileSync } from 'node:fs'
import * as NG from '../../src/game/newgame'
import * as SEASON from '../../src/game/season'
import * as ME from '../../src/game/matchEngine'
import * as MEDIA from '../../src/game/media'
import * as MF from '../../src/game/matchfindings'
import type { GameState } from '../../src/game/model'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any
const args = process.argv.slice(2).filter(a => a !== '--')
const OUT = args[0] ?? 'save.json'
const WEEKS = Number(args[1] ?? 60)
const GENDER = (args[2] ?? 'm') as 'm' | 'w'
const SEED = Number(args[3] ?? 4242)

let EV: Any = {}
try { EV = await import('../../src/game/evidence') } catch { /* pre-1.8.3 */ }

export function playWeek(g: GameState): void {
  const S = SEASON as Any, M = ME as Any
  // the Annual is a UI gate only (Annual.tsx clears it on the button)
  if ((g as Any).annual) (g as Any).annual = undefined
  const fx = S.userMatchThisWeek ? S.userMatchThisWeek(g) : S.userFixtureThisWeek(g)
  if (fx) {
    const isClub = fx.homeId === g.userClubId || fx.awayId === g.userClubId
    const nat = (g as Any).natTeam
    const userTeamId = isClub ? g.userClubId
      : (nat && (fx.homeId === nat || fx.awayId === nat)) ? nat
      : (fx.homeId === 'LIO' || fx.awayId === 'LIO') ? 'LIO' : g.userClubId
    const forfeit = M.forfeitSide ? M.forfeitSide(g, fx) : null
    if (forfeit) M.settleForfeit(g, fx, forfeit)
    else {
      const ctx = M.beginMatch(g, fx, S.matchRng(g), true, userTeamId)
      ctx.assistantSubs = true
      if (M.openDressingRoom) M.openDressingRoom(g, ctx, null)
      M.playHalf(g, ctx)
      M.playHalf(g, ctx)
      ;(MF as Any).fileFindings?.(g, ctx)
      EV.fileEvidence?.(g, ctx)
    }
  }
  for (const pi of g.press.filter(p => !p.answered)) (MEDIA as Any).answerPress(g, pi.id, 0)
  g.newsFrom = g.nextId
  S.processWeekAndAdvance(g)
}

export function startCareer(gender: 'm' | 'w', seed: number): GameState {
  const N = NG as Any
  const club = gender === 'w' ? N.LEAGUE_DEFS('w')[0].clubs[0].id : 'leicester'
  return N.newGame(club, 'Save Gen', seed, undefined, 'coach', gender)
}

if (!process.env.SAVEGEN_LIB) {
  const g = startCareer(GENDER, SEED)
  const t0 = Date.now()
  for (let w = 0; w < WEEKS; w++) playWeek(g)
  writeFileSync(OUT, JSON.stringify({ meta: { slot: 'qa', season: g.season, week: g.week, savedAt: 0 }, state: g }))
  console.log(`${OUT}: ${GENDER} seed ${SEED} ${WEEKS} weeks -> season ${g.season} week ${g.week} unemployed=${!!g.unemployed} ${(Date.now() - t0) / 1000}s`)
}
