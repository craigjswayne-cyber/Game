// Probe: a match interrupted and resumed is the same match.
//
// The reported problem was losing a live match to a reload. The fix replays the
// match from its pre-match save (src/game/resume.ts), and the failure mode of a
// replay is the worst kind there is: a desync is SILENT. Apply one command at the
// wrong tick and the match simply carries on with a different score. Nobody can
// tell, least of all the person playing it.
//
// So this probe does not check that a resume "works". It checks that the resumed
// match is INDISTINGUISHABLE from the match that was never interrupted:
//
//   the whole event stream, line for line
//   both scores
//   every player rating on both sides
//   the man of the match
//   and the save the match wrote as it went: tries, points, cards, bans, injuries
//
// It interrupts at several different points, including in the middle of the
// second half and at the 60' break, and it does it with the manager interfering -
// a team talk, substitutions, a tactical change and a touchline decision - because
// a replay with no commands in it proves only that ticks are deterministic, which
// replayprobe already proved.
import { newGame } from '../src/game/newgame'
import {
  applyPreTalk, applyTacticsChange, applyTeamTalk, beginMatch, makeSubstitution,
  resolveDecision, stepTick, type LiveCtx,
} from '../src/game/matchEngine'
import { weekRng } from '../src/game/season'
import { replayMatch, type MatchCmd, type MatchResume } from '../src/game/resume'
import type { GameState } from '../src/game/model'

let fails = 0
const bad = (m: string) => { fails++; console.error('FAIL: ' + m) }

/** Everything about a match that a player could notice. */
function signature(state: GameState, ctx: LiveCtx): string {
  const ev = ctx.events.map(e =>
    `${e.min}|${e.type}|${e.teamId}|${e.playerId ?? ''}|${e.homeScore}-${e.awayScore}|${e.text}`).join('\n')
  const rates = (m: Map<number, number>) =>
    [...m.entries()].sort((a, b) => a[0] - b[0]).map(([id, r]) => `${id}:${r.toFixed(4)}`).join(',')
  // the save as the match has left it so far: this is the half a serialised
  // context would have lost
  const ledger = Object.values(state.players)
    .filter(p => p.stats.tries || p.stats.points || p.stats.yc || p.stats.rc || p.bans || p.injury)
    .sort((a, b) => a.id - b.id)
    .map(p => `${p.id}:${p.stats.tries}/${p.stats.points}/${p.stats.yc}/${p.stats.rc}/${p.bans}/${p.injury?.weeks ?? 0}`)
    .join(',')
  return [
    ev, `H${ctx.home.score}`, `A${ctx.away.score}`,
    rates(ctx.home.ratings), rates(ctx.away.ratings),
    `motm:${ctx.motmId ?? '-'}`, `tick:${ctx.tick}`, `seg:${ctx.seg}`,
    `subs:${ctx.subsUsed}`, `talk:${ctx.talkUsed}`, ledger,
  ].join('#')
}

/**
 * Play a match to `stopAt` ticks with a manager who interferes, recording the
 * commands exactly as the store does. Returns the signature and the record.
 */
function playWithMeddling(seed: number, stopAt: number): { sig: string; rec: MatchResume; state: GameState } {
  const g: GameState = newGame('northampton', 'Resume Probe', seed)
  const fx = g.fixtures.find(f => f.week === g.week && (f.homeId === g.userClubId || f.awayId === g.userClubId))
    ?? g.fixtures.find(f => f.week === g.week)!

  const pre = JSON.parse(JSON.stringify(g)) as GameState
  const cmds: MatchCmd[] = []
  const ctx = beginMatch(g, fx, weekRng(g), true, g.userClubId)
  const preTalk = 'fire' as const
  applyPreTalk(g, ctx, preTalk)

  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  let talked = false
  let subs = 0

  for (let t = 0; t < stopAt && ctx.seg < 3; t++) {
    stepTick(g, ctx)
    // answer a touchline call the moment it appears, as the screen does
    if (ctx.decision) {
      const choice = t % 3 === 0 ? 'posts' : t % 3 === 1 ? 'corner' : 'tap'
      cmds.push({ at: ctx.tick, kind: 'decide', choice })
      resolveDecision(g, ctx, choice)
    }
    // a team talk at half-time
    if (!talked && ctx.awaiting === 'HT') {
      cmds.push({ at: ctx.tick, kind: 'talk', talk: 'calm' })
      applyTeamTalk(g, ctx, 'calm')
      talked = true
    }
    // two substitutions, at the first two stoppages after the 40th minute
    if (subs < 2 && ctx.awaiting && ctx.tick >= 10) {
      const off = [...mine.onPitch][subs + 1]
      const on = [...mine.benchIds].find(id => !mine.onPitch.has(id) && !mine.ratings.has(id))
      if (off != null && on != null) {
        cmds.push({ at: ctx.tick, kind: 'sub', outId: off, inId: on })
        makeSubstitution(g, ctx, off, on)
        subs++
      }
    }
    // a tactical shift on the hour
    if (ctx.tick === 15) {
      const tac = g.clubs[g.userClubId].tactic
      const dials = { style: 72, tempo: 64, kicking: 38, aggression: 55 }
      Object.assign(tac, dials)
      cmds.push({ at: ctx.tick, kind: 'dials', ...dials })
      // applyTacticsChange is what the store calls; replay does the same
      applyTacticsChange(g, ctx)
    }
    // and clear the break so play can go on, as pressing Resume does
    if (ctx.awaiting) ctx.awaiting = null
  }

  const rec: MatchResume = {
    v: 1, pre, fxId: fx.id, userSideId: g.userClubId, preTalk,
    mode: 'full', tick: ctx.tick, cursor: ctx.events.length, cmds,
    season: pre.season, week: pre.week, savedAt: 0,
  }
  return { sig: signature(g, ctx), rec, state: g }
}

console.log('interrupting a match with a meddling manager, then resuming it:\n')

for (const seed of [4242, 777, 31337]) {
  for (const stopAt of [4, 11, 16, 20]) {
    const live = playWithMeddling(seed, stopAt)
    // now the reload: the record is all that survived
    const restored = JSON.parse(JSON.stringify(live.rec)) as MatchResume
    const state = restored.pre
    const out = replayMatch(state, restored)
    if (!out) { bad(`seed ${seed} stop ${stopAt}: the resume refused to rebuild the match`); continue }
    const back = signature(state, out.ctx)
    const same = back === live.sig
    console.log(`  seed ${seed}, stopped after ${String(stopAt).padStart(2)} ticks ` +
      `(${out.ctx.events.length} lines, ${out.ctx.home.score}-${out.ctx.away.score}): ` +
      `${same ? 'identical' : 'DIFFERENT'}`)
    if (!same) {
      // say WHERE it diverged, because "different" is not a bug report
      const a = live.sig.split('#'), b = back.split('#')
      const names = ['events', 'home score', 'away score', 'home ratings', 'away ratings',
        'motm', 'tick', 'seg', 'subs used', 'talk used', 'the save ledger']
      for (let i = 0; i < a.length; i++) {
        if (a[i] === b[i]) continue
        if (i === 0) {
          const la = a[0].split('\n'), lb = b[0].split('\n')
          const at = la.findIndex((l, j) => l !== lb[j])
          bad(`seed ${seed} stop ${stopAt}: the commentary diverges at line ${at + 1} of ${la.length}\n` +
            `    was: ${la[at] ?? '(nothing)'}\n    now: ${lb[at] ?? '(nothing)'}`)
        } else {
          bad(`seed ${seed} stop ${stopAt}: ${names[i] ?? `field ${i}`} differs: "${a[i]}" became "${b[i]}"`)
        }
      }
    }
  }
}

// ---- and a record that should be refused rather than replayed ----
{
  const g: GameState = newGame('northampton', 'Resume Probe', 999)
  const live = playWithMeddling(999, 8)
  // the fixture has since been played: the record is stale and must be dropped
  const stale = JSON.parse(JSON.stringify(live.rec)) as MatchResume
  const fx = stale.pre.fixtures.find(f => f.id === stale.fxId)!
  fx.played = true
  console.log(`\na record whose fixture has already been played: ${replayMatch(stale.pre, stale) === null ? 'refused' : 'REPLAYED ANYWAY'}`)
  if (replayMatch(stale.pre, stale) !== null) bad('a stale resume record was replayed instead of refused')
  void g
}

if (fails) { console.error(`\nRESUME PROBE: ${fails} failures`); process.exit(1) }
console.log('\nRESUME PROBE PASSED: an interrupted match comes back the same match')
