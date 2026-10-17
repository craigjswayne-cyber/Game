// The match stats sheet. Split out of matchEngine.ts (which re-exports it)
// and kept apart from the final whistle so evidence.ts can read it without an
// import cycle.
import type { MatchEvent } from '../model'
import type { SideCtx } from './side'
import type { LiveCtx } from './live'
import { sideEnergy } from './energy'

/**
 * VISITS TO THE 22, and the points a side came away with (1.8.1). One count
 * for the live stats and the Visits panel, read off the lines shown so far.
 * A visit starts on the first line of the side's own inside the opposition 22
 * after a line that was not; the other side's line, or its own further out,
 * ends it.
 *
 * A TRY IS ALWAYS A VISIT. scoreTry moves the ball back towards halfway for
 * the restart before the try line is written, so a try finished from a long
 * break was stamped outside the 22 and the store screenshot showed a try, 0
 * visits and 0.0 points per visit. The line is scored over, so a try line
 * counts as inside whatever its stamp says, and the conversion that follows
 * belongs to the same visit. The scoreboard is read as a high-water mark, so a
 * whistle line stamped with an older score cannot count the same points twice.
 */
export function visitsTo22(events: readonly MatchEvent[], homeId: string, home: boolean): { visits: number; pts: number } {
  let visits = 0, pts = 0, inside = false, best = 0
  for (const e of events) {
    const was = inside
    const ours = !!e.teamId && (e.teamId === homeId) === home
    // the conversion is stamped at the restart, so it neither opens nor
    // closes a visit: it is the second half of the try before it
    const con = ours && e.type === 'CON'
    if (e.fld != null && e.teamId && !con) {
      const up = home ? e.fld : 100 - e.fld
      const now = ours && (up >= 78 || e.type === 'TRY')
      if (now && !inside) visits++
      inside = now
    }
    const score = home ? e.homeScore : e.awayScore
    if (score != null && score > best) {
      if (inside || was || con) pts += score - best
      best = score
    }
  }
  return { visits, pts }
}

/**
 * Match statistics for the stats panel (scrums, lineouts and tackles joined
 * it for v1.1.9; the live strip that briefly drew them under the pitch was
 * removed the next morning at the owner's ask - the panel is the home).
 *
 * Possession, tries, penalties, cards and energy are MEASURED: the engine has
 * been keeping every one of them all along.
 *
 * (Tackles were derived too, until 1.8.0 counted them: countTackles.)
 *
 * The set pieces are DERIVED, and the difference is worth being
 * straight about. The engine does not simulate an individual scrum, so these
 * are computed from things it does simulate - how much ball each side has
 * actually had, and the two packs' real scrum, lineout and defence numbers.
 * A heavier pack wins more of its own feed and steals more of yours; a side
 * camped in its own half makes far more tackles. Every figure moves for a
 * reason a manager can point at, which is the bar a stats sheet has to clear.
 * What it is not is a ball-by-ball count, and saying so here because a number
 * on a stats sheet looks like a measurement and the next reader deserves to
 * know which kind it is. scripts/statsprobe.ts holds it to all of that.
 *
 * NO RNG. A pure function of state that already exists, so it can be called
 * on every render of a live match without the stream ever noticing.
 */
export function matchStats(ctx: LiveCtx) {
  const tot = ctx.home.poss + ctx.away.poss || 1
  const share = (s: SideCtx) => s.poss / tot
  // minutes of rugby actually played, not the clock's ambition
  const mins = Math.max(0, Math.min(80, ctx.lastMin || 0))
  // a pack's edge over the other, squashed into a sensible band: a dominant
  // scrum wins nearly all its own ball, a beaten one coughs up a quarter of
  // it, and nobody ever wins the lot
  const rate = (mine: number, theirs: number) => 0.86 + 0.11 * Math.tanh((mine - theirs) / 14)
  // about thirteen scrums and twenty-five lineouts across eighty minutes,
  // tilted a little towards whoever has been playing more
  const feeds = (s: SideCtx, perMin: number) =>
    Math.round(mins * perMin * (0.5 + (share(s) - 0.5) * 0.4))
  const setPiece = (s: SideCtx, perMin: number, mine: number, theirs: number): [number, number] => {
    const f = feeds(s, perMin)
    const won = Math.round(f * rate(mine, theirs))
    return [won, Math.max(0, f - won)]
  }
  // COUNTED since 1.9.0 (setPieceTick); a match begun on an older build has
  // no count and is estimated the old way
  const counted = !!(ctx.home.sp && ctx.away.sp)
  const [hsw, hsl] = counted ? [ctx.home.sp!.sw, ctx.home.sp!.sl] : setPiece(ctx.home, 0.16, ctx.home.units.scrum, ctx.away.units.scrum)
  const [asw, asl] = counted ? [ctx.away.sp!.sw, ctx.away.sp!.sl] : setPiece(ctx.away, 0.16, ctx.away.units.scrum, ctx.home.units.scrum)
  const [hlw, hll] = counted ? [ctx.home.sp!.lw, ctx.home.sp!.ll] : setPiece(ctx.home, 0.30, ctx.home.units.lineout, ctx.away.units.lineout)
  const [alw, all_] = counted ? [ctx.away.sp!.lw, ctx.away.sp!.ll] : setPiece(ctx.away, 0.30, ctx.away.units.lineout, ctx.home.units.lineout)
  // COUNTED, since 1.8.0 (countTackles): the sum of every man's tackles. A
  // match begun by an older build has no counts, and falls back to the
  // figure this used to work out from possession and the defence.
  const tackles = (s: SideCtx) => s.tackles
    ? [...s.tackles.values()].reduce((a, b) => a + b, 0)
    : Math.round(mins * (1 - share(s)) * 3.6 * (0.9 + s.units.defence / 900))
  return {
    possession: [Math.round((ctx.home.poss / tot) * 100), Math.round((ctx.away.poss / tot) * 100)] as [number, number],
    tries: [ctx.home.tries, ctx.away.tries] as [number, number],
    pens: [ctx.home.pens, ctx.away.pens] as [number, number],
    cards: [ctx.home.yellowUntil.size + ctx.home.sent, ctx.away.yellowUntil.size + ctx.away.sent] as [number, number],
    energy: [Math.round(sideEnergy(ctx.home)), Math.round(sideEnergy(ctx.away))] as [number, number],
    scrumsWon: [hsw, asw] as [number, number],
    scrumsLost: [hsl, asl] as [number, number],
    lineoutsWon: [hlw, alw] as [number, number],
    lineoutsLost: [hll, all_] as [number, number],
    tackles: [tackles(ctx.home), tackles(ctx.away)] as [number, number],
    /** [made, taken] for each side: conversions, penalties and drop goals */
    goalKicks: [[ctx.home.kicksMade ?? 0, ctx.home.kicksAt ?? 0], [ctx.away.kicksMade ?? 0, ctx.away.kicksAt ?? 0]] as [[number, number], [number, number]],
    /** kicks from hand put in, and how many of each side's were charged down */
    handKicks: [ctx.home.handKicks ?? 0, ctx.away.handKicks ?? 0] as [number, number],
    chargedDown: [ctx.home.chargedDown ?? 0, ctx.away.chargedDown ?? 0] as [number, number],
  }
}
