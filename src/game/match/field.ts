// Who is on the field: unit recomputes when the personnel change, the
// specialists' notes, minutes, the goal kicker and the tackle count. Split
// out of matchEngine.ts, which re-exports the public parts.
import type { GameState, Player } from '../model'
import { clamp, mulberry32, wpick } from '../rng'
import { specialistGaps, teamShort, teamUnits } from './selection'
import { colour } from './commentary'
import { type SideCtx, fieldLineup, personnelKey } from './side'
import { applyModifiers } from './setup'
import type { LiveCtx } from './live'

/** Rebuild a side's unit strengths from its current lineup, tactics and conditions. */
export function recomputeSideUnits(state: GameState, ctx: LiveCtx, side: SideCtx) {
  // same fixture, same day: the match-day wobble a recompute rebuilds is the
  // one kick-off dealt, because it is keyed on (seed, fixture, player)
  side.units = teamUnits(state, fieldLineup(side), { fxId: ctx.fx.id, big: !!ctx.fx.stage || ctx.derby, chemToday: ctx.chemToday, talk: side.talkF })
  applyModifiers(state, side, ctx.weather)
  if (ctx.derby) side.cardRisk *= 1.35
  side.unitsKey = personnelKey(side)
}

/**
 * ---- SOMEBODY CAME ON OR WENT OFF ----
 *
 * The one place a change of personnel is settled, for every side in the
 * world. Until this existed the units were rebuilt only by the manager's own
 * hand (a substitution, an undo, a shirt swap, a slider), so an AI side
 * played its whole afternoon on the fifteen it kicked off with: a
 * replacement's attributes never reached its scrum or its defence, an injury
 * cover never counted, and a sent-off captain went on leading. The manager's
 * own side had the same hole for everything he did not do himself - an
 * injury, an HIA, a card.
 *
 * Two jobs, both cheap and neither drawing on the match rng:
 *
 *  - the minutes. Each man's stint is opened when he appears in onPitch and
 *    closed when he leaves it, at the minute given. A man in the bin is not on
 *    the pitch and banks nothing for his ten minutes: the figure feeds the
 *    season's workload (the 1,300-minute red zone), and a man sitting on the
 *    bench by the touchline is resting, not playing.
 *
 *  - the units, rebuilt only when the personnel they are built from has
 *    actually changed (personnelKey), so calling this when nothing moved is
 *    free and a rebuild is never repeated. applyModifiers starts from a clean
 *    base, so a rebuild is idempotent: the tenth lands where the first did.
 *
 * Called straight after each change with the minute of it, and once at the
 * top of every tick as a net for anything that moved without saying so; a
 * stint the net catches is timed to that tick's minute instead.
 */
export function fieldChanged(state: GameState, ctx: LiveCtx, side: SideCtx, min: number) {
  const at = clamp(min, 0, 80)
  const since = (side.since ??= new Map())
  const played = (side.played ??= new Map())
  for (const [id, from] of since) {
    if (side.onPitch.has(id)) continue
    played.set(id, (played.get(id) ?? 0) + Math.max(0, at - from))
    since.delete(id)
  }
  for (const id of side.onPitch) if (!since.has(id)) since.set(id, at)
  if (side.unitsKey !== personnelKey(side)) { recomputeSideUnits(state, ctx, side); noteSpecialists(state, ctx, side) }
}

/** A man in a specialist shirt without the trade (specialistGaps) gets one
 *  line, the first time he is out there in it. Colour only: never drawn,
 *  never moves the clock. */
const SPEC_LINE: Record<number, string> = { 0: 'comm.specProp', 1: 'comm.specHook', 2: 'comm.specProp', 8: 'comm.specNine' }
export function noteSpecialists(state: GameState, ctx: LiveCtx, side: SideCtx) {
  if (!ctx.detail) return
  const xv = fieldLineup(side).slice(0, 15).map(id => (id != null && side.onPitch.has(id) ? state.players[id] : null))
  for (const i of specialistGaps(xv)) {
    // a makeshift prop matters only to a contested scrum
    if (ctx.uncontested && (i === 0 || i === 2)) continue
    const p = xv[i]!
    const said = (side.specSaid ??= new Set())
    if (said.has(p.id)) continue
    said.add(p.id)
    colour(state, ctx, side, SPEC_LINE[i], { player: p.name, team: teamShort(state, side.teamId) }, p.id)
  }
}

/** A man's minutes in this match so far: the stints he has finished and the
 *  one he is in, counted to `now`. */
export function minutesPlayed(side: SideCtx, id: number, now: number): number {
  const from = side.since?.get(id)
  return (side.played?.get(id) ?? 0) + (from != null ? Math.max(0, now - from) : 0)
}

/**
 * ---- WHO TAKES THE KICK ----
 *
 * units.kickerId is the side's first choice: the named kicker, or the best
 * boot in the XV. It is a name on a sheet, and it used to be the only thing
 * read, so a kicker who had been sent off, sin-binned or replaced went on
 * taking the side's kicks from the stand and being credited with the points.
 *
 * Now the kick goes to the first choice if he is on the pitch; failing him,
 * to the next of the manager's named kickers who is out there; failing them,
 * to the best goal kicker on the field. Nothing is stored, so a first choice
 * back from the bin takes the tee again at the next kick. A tie for the best
 * boot goes to the man who has been out there longest. At kick-off the first
 * choice is always on, so the pick there is exactly the one it always was.
 */
export function goalKicker(state: GameState, side: SideCtx): Player | null {
  const first = side.units.kickerId
  if (first != null && side.onPitch.has(first)) return state.players[first] ?? null
  for (const id of state.clubs[side.teamId]?.tactic.kickers ?? []) {
    if (id != null && side.onPitch.has(id) && !state.players[id]?.injury) return state.players[id] ?? null
  }
  let best: Player | null = null
  let goal = 5
  for (const id of side.onPitch) {
    const p = state.players[id]
    if (p && !p.injury && p.a.goa > goal) { goal = p.a.goa; best = p }
  }
  return best
}

/** How a side's tackling is shared across the XV by shirt: flankers make the
 *  most, then the locks, hooker, No. 8 and centres; the back three the fewest.
 *  From the tackle counts of top-flight games. */
const SLOT_TACKLES = [7, 10, 7, 11, 11, 13, 14, 11, 7, 8, 4, 10, 10, 4, 3]

/**
 * ---- EVERY TACKLE, COUNTED AND NAMED (1.8.0) ----
 *
 * Owner, 27 Sep 2026: "track the tackles accurately? How do we do that?" The
 * engine plays a match in twenty four-minute ticks and never simulated a
 * single tackle: the stats panel's figure was worked out afterwards from
 * possession, and the first per-player column shared that figure out by
 * shirt. Now each tick the engine plays the tackles: a side makes about 4
 * attempts a minute for every minute the other side has the ball (the ball
 * each side actually won this tick, dh and da), a better defence gets through
 * more, and every attempt goes to a man on the pitch - weighted by his shirt,
 * his tackling and how much he has left in his legs. His tackling decides
 * whether he makes it or misses it. A man in the bin, off injured or not yet
 * on makes none, because he is not in onPitch.
 *
 * ITS OWN DICE. The draws come from a stream seeded by the fixture and the
 * tick, never from the match's rng, so counting tackles cannot move a single
 * score, card or injury, and a resumed match counts them exactly as before.
 */
export function countTackles(state: GameState, ctx: LiveCtx, tick: number, dh: number, da: number) {
  const total = dh + da
  if (total <= 0) return
  const rng = mulberry32((((ctx.fx.id | 0) * 7919) ^ (tick * 104729) ^ ((state.season | 0) * 31)) >>> 0)
  for (const [def, attPoss] of [[ctx.home, da], [ctx.away, dh]] as [SideCtx, number][]) {
    const men = [...def.onPitch].map(id => state.players[id]).filter((p): p is Player => !!p)
    if (!men.length) continue
    // 4 minutes a tick, 4 attempts a minute without the ball: about 160 a
    // match at even possession, 140 of them made, a top-flight side's count
    const expected = 4 * 4 * (attPoss / total) * (0.9 + def.units.defence / 900)
    const n = Math.floor(expected) + (rng() < expected % 1 ? 1 : 0)
    const weights = men.map(p => {
      const slot = def.lineup.indexOf(p.id)
      const shirt = slot >= 0 && slot < 15 ? SLOT_TACKLES[slot] : 8
      return shirt * (0.7 + 0.6 * p.a.tac / 20) * (0.6 + 0.4 * (def.energy.get(p.id) ?? 80) / 100)
    })
    const made = (def.tackles ??= new Map()), miss = (def.missed ??= new Map())
    for (let i = 0; i < n; i++) {
      const p = wpick(rng, men, weights)
      const hold = clamp(0.8 + (p.a.tac - 12) * 0.012, 0.62, 0.96)
      if (rng() < hold) made.set(p.id, (made.get(p.id) ?? 0) + 1)
      else miss.set(p.id, (miss.get(p.id) ?? 0) + 1)
    }
  }
}

/** A commentary line that names a man for a hit is a tackle he made. */
export const TACKLE_LINES = new Set(['comm.flavPac5', 'comm.flav8', 'comm.flav12', 'comm.flav15'])

export function cameOn(side: SideCtx, id: number, min: number) {
  (side.onAt ??= new Map()).set(id, min)
}
