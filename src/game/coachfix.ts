/**
 * ---- THE FIXES: what the assistant wants changed before next week ----
 *
 * User: "on coaches verdict it should outline what the two fixes would be etc so
 * the player can keep tweaking the tactics."
 *
 * The verdict said "Fine margins. Fix two moments and that is our game," which is
 * something a coach says on television, not something a manager can act on. It
 * named nothing, so the only way to improve was to guess which dial the engine
 * cared about. This turns the same match data into two specific instructions, and
 * every one of them points at a control that exists: a slider on the in-match
 * panel, a page on the Tactics screen, a shirt on Selection.
 *
 * Three rules the list obeys:
 *
 *   IT IS THE SAME NUMBERS THE SCREEN SHOWS. The unit percentages were computed
 *     inline in MatchDay and would have been recomputed here, which is how a
 *     verdict ends up saying 39% while the row above it says 44%. unitBattles is
 *     the one place that maths lives, and both read it.
 *
 *   NO RNG. Not the match stream, not a fresh one. This is a reading of a
 *     finished match, so the same match must always produce the same advice - and
 *     the live match rng is mid-stream at full time, so touching it would move
 *     every commentary line that follows.
 *
 *   ONE FIX PER SUBJECT. An empty tank at full time and an unused bench are the
 *     same complaint twice; a list of two that says one thing is a list of one.
 *     Candidates carry a tag and the best of each tag survives.
 */
import type { GameState, Tactic } from './model'
import type { LiveCtx, SideCtx } from './matchEngine'

export type UnitKey = 'scrum' | 'lineout' | 'breakdown'

export interface UnitBattle {
  key: UnitKey
  label: string
  /** share of the contest won, 22-78 */
  pct: number
  /** 'dominated' | 'edged it' | 'broke even' | 'shaded' | 'bullied' */
  verdict: string
}

const UNIT_LABEL: Record<UnitKey, string> = {
  scrum: 'Scrum', lineout: 'Lineout', breakdown: 'Breakdown',
}

/** The three set-piece contests, as percentages.
 *
 *  The per-fixture wobble is a hash of the fixture id, so the same edge reads
 *  differently week to week without ever being random. */
export function unitBattles(ctx: LiveCtx, mine: SideCtx, opp: SideCtx): UnitBattle[] {
  const keys: [UnitKey, number][] = [['scrum', 1], ['lineout', 2], ['breakdown', 3]]
  return keys.map(([key, salt]) => {
    const jit = ((((ctx.fx.id * 2654435761) >>> 0) + salt * 977) % 9) - 4
    const pct = Math.max(22, Math.min(78, Math.round(50 + (mine.units[key] - opp.units[key]) * 5.5 + jit)))
    const verdict = pct >= 57 ? 'dominated' : pct >= 52 ? 'edged it' : pct > 48 ? 'broke even'
      : pct > 43 ? 'shaded' : 'bullied'
    return { key, label: UNIT_LABEL[key], pct, verdict }
  })
}

export interface CoachFix {
  /** what happened, with the number that proves it */
  head: string
  /** the change, naming a real control */
  how: string
  /** which subject it belongs to, so the next verdict can mark the homework */
  tag: FixTag
}

export type FixTag = 'setpiece' | 'discipline' | 'attack' | 'territory' | 'kicking' | 'fitness' | 'admin'
type Tag = FixTag
interface Cand extends CoachFix { score: number }

/**
 * What to call each subject in a sentence.
 *
 * Deliberately the thing that was WRONG rather than the dial that fixes it: a
 * manager remembers being told his lineout was a shambles, not that candidate
 * tag 'setpiece' scored 4.4.
 */
export const FIX_LABEL: Record<FixTag, string> = {
  setpiece: 'the set piece',
  discipline: 'the discipline',
  attack: 'turning possession into points',
  territory: 'where the game was played',
  kicking: 'the goal kicking',
  fitness: 'using the bench',
  admin: 'sticking to one plan',
}

/**
 * Mark last week's homework.
 *
 * The audit's read was that the two fixes were a lecture rather than a loop: the
 * coach names two jobs, the manager does them or does not, and nothing ever
 * mentions it again. This is the other half. A subject the coach raised last time
 * and cannot raise now is FIXED - not because the manager necessarily did the
 * thing suggested, but because whatever he did, the number stopped screaming.
 * A subject still on the list is not.
 *
 * Never a reward or a penalty in the engine. The manager's league position is the
 * reward, and a board that hands out confidence for obeying its own coach would be
 * marking its own homework twice.
 */
export function gradeFixes(prev: readonly FixTag[], now: readonly FixTag[]): {
  fixed: FixTag[]
  missed: FixTag[]
} {
  const open = new Set(now)
  return {
    // 'admin' is the coach saying nothing broke, so it is never homework
    fixed: prev.filter(t => t !== 'admin' && !open.has(t)),
    missed: prev.filter(t => t !== 'admin' && open.has(t)),
  }
}

/** One line of English for a grade, or null when there is nothing to report. */
export function gradeLine(fixed: readonly FixTag[], missed: readonly FixTag[]): string | null {
  const list = (ts: readonly FixTag[]) => ts.map(t => FIX_LABEL[t]).join(' and ')
  // the labels are written to sit mid-sentence ("we asked about the set piece"),
  // so one that opens a sentence needs its capital. Caught by fixprobe reading
  // its own output: "two things. the set piece is sorted."
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  if (fixed.length && missed.length) {
    return `Last time we asked for two things. ${cap(list(fixed))} is sorted. ${cap(list(missed))} is not.`
  }
  if (fixed.length) {
    return fixed.length > 1
      ? `Both jobs from last time are done: ${list(fixed)}. That is a side that listens.`
      : `${cap(list(fixed))} is sorted since last time. Keep doing whatever that was.`
  }
  if (missed.length) {
    return missed.length > 1
      ? `${cap(list(missed))} were the jobs last time, and neither has moved.`
      : `We asked about ${list(missed)} last time, and here it is again.`
  }
  return null
}

/** The opposition's score at the hour, for spotting a side that empties. */
function scoreAt(ctx: LiveCtx, min: number, home: boolean): number {
  let last: { homeScore: number; awayScore: number } | null = null
  for (const e of ctx.events) {
    if (e.type === 'FT') continue
    if (e.min > min) break
    last = e
  }
  if (!last) return 0
  return home ? last.homeScore : last.awayScore
}

/**
 * Up to `want` things to change, worst first.
 *
 * Always returns something. A side that won by thirty still has a next opponent,
 * and "nothing to fix" teaches the manager that the panel is decoration.
 */
export function coachFixes(
  game: GameState, ctx: LiveCtx, mine: SideCtx, opp: SideCtx, tactic: Tactic | null, want = 2,
): CoachFix[] {
  const c: Cand[] = []
  const units = unitBattles(ctx, mine, opp)
  const isHome = mine === ctx.home
  const poss = Math.round((mine.poss / (ctx.home.poss + ctx.away.poss || 1)) * 100)
  const margin = mine.score - opp.score

  // ---- the set piece: the worst of the three, if it actually lost ------------
  const worst = [...units].sort((a, b) => a.pct - b.pct)[0]
  if (worst && worst.pct < 49) {
    const how: Record<UnitKey, string> = {
      scrum: 'Pick a heavier front row on Selection, or give a prop the scrummager role on Tactics. A dial cannot lift a light tight five.',
      lineout: 'Get a second genuine jumper into the back five on Selection, and change the lineout call on Set Piece so they stop reading it.',
      breakdown: 'A jackal flanker on Selection, or push Physicality up. Contested ball is won by bodies arriving, not by shape.',
    }
    c.push({
      tag: 'setpiece', score: (50 - worst.pct) * 2.2,
      head: `${worst.label}: ${worst.pct}% won, and they ${worst.verdict === 'bullied' ? 'bullied us there' : 'shaded it'}.`,
      how: how[worst.key],
    })
  }

  // ---- discipline: cards are the most expensive thing on this list -----------
  const cards = ctx.events.filter(e => (e.type === 'YC' || e.type === 'RC') && e.teamId === mine.teamId)
  const reds = cards.filter(e => e.type === 'RC').length
  const yellows = cards.length - reds
  if (cards.length) {
    // name him. "Ten minutes a man short" is a statistic; "Curtis Langdon spent
    // ten minutes in the bin" is a selection decision the manager can make.
    const first = cards[0].playerId != null ? game.players[cards[0].playerId] : null
    const who = first ? `${first.name} ` : ''
    c.push({
      tag: 'discipline', score: reds * 62 + yellows * 24,
      head: reds
        ? `${who ? `${who}sent off` : 'A red card'}, and fourteen men for the rest of it.`
        : yellows === 1
          ? `${who ? `${who}binned: ten` : 'Ten'} minutes a man short.`
          : `${yellows} yellows, ${yellows * 10} minutes a man short.`,
      how: tactic && tactic.aggression >= 55
        ? `Physicality is at ${tactic.aggression}. Pull it under fifty and the same pack concedes fewer.`
        : 'Drop Physicality a notch and put a leader on culture in the leadership group. Cards are a habit, not luck.',
    })
  }

  // ---- all the ball, none of the points --------------------------------------
  if (poss >= 53 && mine.tries <= 1) {
    c.push({
      tag: 'attack', score: (poss - 50) * 1.4 + (2 - mine.tries) * 9,
      head: `${poss}% of the ball and ${mine.tries === 1 ? 'one try' : 'no tries'}.`,
      how: tactic && tactic.style <= 45
        ? `Style is at ${tactic.style}, which keeps it in the pack. Push it past sixty and the backs will see it.`
        : 'Give the 10 the playmaker role on Tactics and drill a different attacking call. Possession without width is just carrying.',
    })
  }

  // ---- starved of it instead -------------------------------------------------
  if (poss <= 44) {
    c.push({
      tag: 'territory', score: (48 - poss) * 1.8,
      head: `We only had ${poss}% of the ball.`,
      how: tactic && tactic.kicking >= 55
        ? `Kicking is at ${tactic.kicking}, so we hand it back on purpose. Bring it down and keep the ball in hand.`
        : 'Lower Tempo so phases last, and set the exit to counter on Set Piece rather than kicking it to their fullback.',
    })
  }

  // ---- the last twenty ------------------------------------------------------
  const oppAt60 = scoreAt(ctx, 60, !isHome)
  const lateAgainst = opp.score - oppAt60
  if (lateAgainst >= 10) {
    c.push({
      tag: 'fitness', score: lateAgainst * 2.4,
      head: `They scored ${lateAgainst} of their points after the hour.`,
      how: ctx.subsUsed <= 2
        ? `You made ${ctx.subsUsed === 0 ? 'no changes' : `${ctx.subsUsed} change${ctx.subsUsed === 1 ? '' : 's'}`}. Tap Match-Day Squad at the hour: eight fresh bodies is a weapon you have already paid for.`
        : 'Drop Tempo so the pack is not running on fumes at sixty, and brief two finishers on the Bench page.',
    })
  }

  // ---- the tee ---------------------------------------------------------------
  const myTries = ctx.events.filter(e => e.type === 'TRY' && e.teamId === mine.teamId).length
  const myCons = ctx.events.filter(e => e.type === 'CON' && e.teamId === mine.teamId).length
  const missed = Math.max(0, myTries - myCons)
  if (missed >= 2 || (missed === 1 && Math.abs(margin) <= 2)) {
    c.push({
      tag: 'kicking', score: missed * 11 + (Math.abs(margin) <= 2 ? 12 : 0),
      head: `${missed === 1 ? 'A conversion' : `${missed} conversions`} missed off the tee.`,
      how: 'Name your kicking order on Set Piece rather than leaving it to whoever has the best boot on the pitch. A slump is only yours to answer if you chose the man.',
    })
  }

  // ---- the tank at full time, RELATIVE TO THEIRS -----------------------------
  //
  // This one took two goes, and both misses are worth recording because they are
  // the same mistake at different sizes.
  //
  // The first cut read the absolute number, and eighty minutes drains everyone:
  // "the fifteen finished on 2% in the tank" was true in all fourteen matches the
  // probe played and sat at the top of every list. The second cut compared it to
  // the opposition's tank, which was better but still fired twelve times in
  // fourteen, because a side that empties its bench is ALWAYS fresher at the end
  // than one that does not. It was measuring the bench, and the bench already has
  // its own entry two blocks down.
  //
  // So this only speaks when the manager HAS emptied his bench and the gap is
  // still stark. Then it is a genuine third finding: not "use your replacements"
  // but "your squad cannot last eighty minutes."
  const tankOf = (side: SideCtx) => {
    const on = [...side.onPitch]
    return on.length ? on.reduce((s, id) => s + (side.energy.get(id) ?? 100), 0) / on.length : 100
  }
  const tank = tankOf(mine)
  const theirTank = tankOf(opp)
  if (ctx.subsUsed >= 3 && theirTank - tank >= 20) {
    c.push({
      tag: 'fitness', score: (theirTank - tank) * 1.1,
      head: `Even after ${ctx.subsUsed} changes we finished on ${Math.round(tank)}% to their ${Math.round(theirTank)}%.`,
      how: 'Lower Tempo, or set the week to fitness on Prep. This is a conditioning problem rather than a tactical one, and the gym level on Club Infrastructure is the long answer.',
    })
  }

  // ---- the bench you paid for -----------------------------------------------
  if (ctx.subsUsed <= 1) {
    c.push({
      tag: 'fitness', score: 16 - ctx.subsUsed * 5,
      head: `${ctx.subsUsed === 0 ? 'No replacements' : 'One replacement'} used out of five.`,
      how: 'Tap Match-Day Squad at the hour. Five changes are free and a fresh front row in the last twenty wins tight games on its own.',
    })
  }

  // ---- the admin nobody has done, which is always worth saying --------------
  if (tactic) {
    const roles = (tactic.roles ?? []).filter(Boolean).length
    if (roles < 4) {
      c.push({
        tag: 'admin', score: 9 - roles,
        head: roles === 0 ? 'Not one shirt has a role set.'
          : `Only ${roles} shirt${roles === 1 ? ' has' : 's have'} a role set.`,
        how: 'Tap a shirt on Tactics. A scrummager, a jackal and a playmaker are three small edges you are currently not taking.',
      })
    }
    if (!(tactic.kickers ?? []).filter(Boolean).length) {
      c.push({
        tag: 'kicking', score: 7,
        head: 'No kicking order named.',
        how: 'Set your first and second kicker on Set Piece. The automatic pick hands the tee to a different man every week.',
      })
    }
    if (!tactic.bench) {
      c.push({
        tag: 'admin', score: 6,
        head: 'The bench split is on automatic.',
        how: 'Choose 5-3, 6-2 or 4-4 on the Bench page. Six forwards wins a scrum war, four and four covers an injury anywhere.',
      })
    }
  }

  // ---- and if the side genuinely did its job, say what to protect -----------
  c.push(margin > 0 ? {
    tag: 'admin', score: 3,
    head: 'Nothing broke, so the work is making it repeatable.',
    how: `Leave the dials alone and pick the same shape again. The strongest unit was the ${units.slice().sort((a, b) => b.pct - a.pct)[0].label.toLowerCase()} - build next week around it.`,
  } : {
    tag: 'admin', score: 3,
    head: 'Beaten without one number screaming about it.',
    how: 'Run one preset for a fortnight rather than a new plan every Saturday. The engine rewards a side that knows its own game.',
  })

  // best of each subject, then the two worst problems on the list
  const byTag = new Map<Tag, Cand>()
  for (const cand of c) {
    const held = byTag.get(cand.tag)
    if (!held || cand.score > held.score) byTag.set(cand.tag, cand)
  }
  return [...byTag.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, want)
    .map(({ head, how, tag }) => ({ head, how, tag }))
}
