/**
 * ---- THE POST-MATCH FINDINGS (#181, the other half of the loop) ----
 *
 * After the manager's match, three to five findings in five categories -
 * tactical, physical, set-piece, player, strategic - read from numbers the
 * match has already produced: matchStats (possession, tackles, energy), the
 * unit battles the coach's verdict shows (coachfix.unitBattles, so the two
 * cards can never quote different percentages), the commentary events (late
 * points), the settled player marks, and whether the plan chosen before the
 * match was carried and whether its target was exploited, which the match's
 * evidence decides (evidence.ts planExploited).
 *
 * A reading of a finished match, so: no rng, nothing written into the engine,
 * and the same match always produces the same findings. The record kept on the
 * save is keys and values (oppreport.FindingsRecord), capped, and the next
 * report against the same side reads it back ("last time we met, their lineout
 * struggled").
 */
import type { GameState } from './model'
import { matchStats, type LiveCtx } from './matchEngine'
import { unitBattles } from './coachfix'
import { buildEvidence, planExploited, pointsAfter, sidesOf } from './evidence'
import { t } from './i18n'
import { noteMemory } from './memory'
import {
  currentPlan, keepFindings, planFollowed,
  type Finding, type FindingsRecord, type PlanVerdict, type ReportLine,
} from './oppreport'

/** Whether the manager's plan was followed goes into the manager's memory
 *  (memory.ts), as 'plan-followed' or 'plan-ignored'. */
function note(state: GameState, e: { kind: string; clubId?: string; payload?: Record<string, unknown> }): void {
  noteMemory(state, e)
}

/** The findings for a finished match, plus the record the save keeps. Null for
 *  a match the manager was not coaching. Pure: the same ctx reads the same. */
export function buildFindings(state: GameState, ctx: LiveCtx): FindingsRecord | null {
  const s = sidesOf(ctx)
  if (!s) return null
  const { mine, opp } = s
  const homeIdx = mine === ctx.home ? 0 : 1
  const st = matchStats(ctx)
  const poss = st.possession[homeIdx]
  const margin = mine.score - opp.score
  const items: Finding[] = []

  // ---- tactical: what we did with the ball --------------------------------
  if (poss >= 55 && mine.tries <= 1) items.push({ cat: 'tactical', k: 'find.ballNoPoints', v: { poss }, tone: -1 })
  else if (poss <= 45 && margin > 0) items.push({ cat: 'tactical', k: 'find.wonWithout', v: { poss }, tone: 1 })
  else if (poss <= 45) items.push({ cat: 'tactical', k: 'find.starved', v: { poss }, tone: -1 })
  else if (mine.tries >= 4) items.push({ cat: 'tactical', k: 'find.clinical', v: { poss, n: mine.tries }, tone: 1 })
  else items.push({ cat: 'tactical', k: 'find.possLevel', v: { poss, n: mine.tries }, tone: 0 })

  // ---- physical: the last twenty and the tackle count ---------------------
  const ourLate = pointsAfter(ctx, mine, 60)
  const theirLate = pointsAfter(ctx, opp, 60)
  const made = st.tackles[homeIdx]
  const missed = mine.missed ? [...mine.missed.values()].reduce((a, b) => a + b, 0) : 0
  const missPct = made + missed > 0 ? Math.round((missed / (made + missed)) * 100) : 0
  const tank = st.energy[homeIdx], theirTank = st.energy[1 - homeIdx]
  if (theirLate - ourLate >= 7) items.push({ cat: 'physical', k: 'find.lateFade', v: { n: theirLate }, tone: -1 })
  else if (ourLate - theirLate >= 7) items.push({ cat: 'physical', k: 'find.lateStrong', v: { n: ourLate }, tone: 1 })
  else if (missPct >= 16) items.push({ cat: 'physical', k: 'find.missedTackles', v: { pct: missPct, n: missed }, tone: -1 })
  else if (Math.abs(tank - theirTank) >= 8) {
    items.push({ cat: 'physical', k: tank > theirTank ? 'find.fresher' : 'find.tired', v: { mine: tank, theirs: theirTank }, tone: tank > theirTank ? 1 : -1 })
  }

  // ---- set piece: the same percentages as the verdict card ----------------
  const units = unitBattles(ctx, mine, opp)
  const best = [...units].sort((a, b) => b.pct - a.pct)[0]
  const worst = [...units].sort((a, b) => a.pct - b.pct)[0]
  const loud = (best.pct - 50) >= (50 - worst.pct) ? best : worst
  if (loud.pct >= 56) items.push({ cat: 'setpiece', k: 'find.spWon', v: { unit_k: `oppreport.u_${loud.key}`, pct: loud.pct }, tone: 1 })
  else if (loud.pct <= 44) items.push({ cat: 'setpiece', k: 'find.spLost', v: { unit_k: `oppreport.u_${loud.key}`, pct: loud.pct }, tone: -1 })
  else items.push({ cat: 'setpiece', k: 'find.spEven', tone: 0 })
  // what to remember for next time: the set piece (not the breakdown, which is
  // not a plan's target) with the widest margin, if it was wide at all
  const sp = units.filter(u => u.key !== 'breakdown').sort((a, b) => Math.abs(b.pct - 50) - Math.abs(a.pct - 50))[0]
  const recall = sp && Math.abs(sp.pct - 50) >= 6 ? { unit: sp.key as 'scrum' | 'lineout', pct: sp.pct } : undefined

  // ---- player: the standout, and the one who had a day to forget ----------
  const marks = mine.finalR ?? mine.ratings
  const rated = [...marks.entries()].filter(([id]) => state.players[id]).sort((a, b) => b[1] - a[1])
  if (rated.length) {
    const [topId, top] = rated[0]
    const [lowId, low] = rated[rated.length - 1]
    if (low <= 5.6 && lowId !== topId) {
      items.push({ cat: 'player', k: 'find.playerBoth', v: { best: state.players[topId].name, r: top.toFixed(1), worst: state.players[lowId].name, r2: low.toFixed(1) }, tone: 0 })
    } else {
      items.push({ cat: 'player', k: 'find.playerBest', v: { best: state.players[topId].name, r: top.toFixed(1) }, tone: 1 })
    }
  }

  // ---- strategic: did the plan work? ---------------------------------------
  const plan = currentPlan(state, opp.teamId)
  let planRec: FindingsRecord['plan'] = null
  if (plan) {
    const followed = planFollowed(state, plan)
    // the target, judged on what the match was made of rather than on the
    // tries and the possession share standing in for it (1.8.3)
    const ev = buildEvidence(state, ctx)
    const exploited = !!ev && planExploited(plan.target, ev)
    const won = margin > 0
    const verdict: PlanVerdict = !followed ? 'failed'
      : exploited && won ? 'worked' : exploited || won ? 'partly' : 'failed'
    planRec = { id: plan.id, target: plan.target, followed, verdict }
    items.push({
      cat: 'strategic',
      k: !followed ? 'find.planDropped' : `find.plan_${verdict}`,
      v: { plan_k: `oppreport.plan_${plan.id}` },
      tone: !followed ? 0 : verdict === 'worked' ? 1 : verdict === 'partly' ? 0 : -1,
    })
  } else if (!state.clubs[opp.teamId]) {
    items.push({ cat: 'strategic', k: 'find.testWeek', tone: 0 })
  } else {
    items.push({ cat: 'strategic', k: 'find.noPlan', tone: 0 })
  }

  return {
    fxId: ctx.fx.id, season: state.season, week: state.week, oppId: opp.teamId,
    us: mine.score, them: opp.score, items: items.slice(0, 5), recall, plan: planRec,
  }
}

/**
 * File the findings once the whistle has gone. Called by the store on both
 * ways a match ends (watched and instant), before the week turns, and safe to
 * call twice: the record is kept once per fixture.
 */
export function fileFindings(state: GameState, ctx: LiveCtx): FindingsRecord | null {
  if (ctx.seg !== 3) return null
  const rec = buildFindings(state, ctx)
  if (!rec) return null
  const already = state.tacLoop?.findings.some(f => f.fxId === rec.fxId && f.season === rec.season)
  keepFindings(state, rec)
  if (!already && rec.plan) {
    note(state, {
      kind: rec.plan.followed ? 'plan_followed' : 'plan_ignored',
      clubId: rec.oppId,
      payload: { plan: rec.plan.id, target: rec.plan.target, verdict: rec.plan.verdict },
    })
  }
  return rec
}

/** A finding or report line in the screen's language. Values whose name ends
 *  in _k are keys themselves and are translated first. */
export function lineText(line: Finding | ReportLine): string {
  const vars: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(line.v ?? {})) {
    // under both names: {word} takes the line, {word_k} lets t() resolve it
    vars[k] = v
    if (k.endsWith('_k') && typeof v === 'string') vars[k.slice(0, -2)] = t(v)
  }
  return t(line.k, vars)
}
