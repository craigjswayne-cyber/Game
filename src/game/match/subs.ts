// The bench: replacements, front-row law, finishers, briefs and injury
// cover. Split out of matchEngine.ts, which re-exports the public parts.
import type { GameState, Player, Pos } from '../model'
import { XV_SLOTS } from '../model'
import { effAt } from '../attributes'
import { SPLIT_BY_ID, briefForSeat, isForward } from '../bench'
import { teamShort } from './selection'
import { cameOn, fieldChanged } from './field'
import { type SideCtx, layer } from './side'
import { type LiveCtx, pushLine } from './live'

/** AI (and injury-forced) bench management: tired starters are replaced. */
/** Best available bench replacement for the man leaving the pitch: judged at
 *  HIS shirt's position, so a felled prop gets the prop cover and not just
 *  whoever sits first on the bench. */
export function pickBenchSub(state: GameState, side: SideCtx, outId: number): Player | null {
  const bench = side.lineup.slice(15)
    .map(id => id != null ? state.players[id] : null)
    .filter((s): s is Player => !!s && !side.onPitch.has(s.id) && !s.injury && !side.ratings.has(s.id))
  if (!bench.length) return null
  const slot = side.lineup.indexOf(outId)
  if (slot >= 0 && slot < 15) {
    const pos = XV_SLOTS[slot].pos
    let best: Player | null = null
    let bestS = -1
    for (const s of bench) {
      const v = effAt(s, pos)
      if (v > bestS) { bestS = v; best = s }
    }
    return best
  }
  return bench[0]
}

const FRONT_ROW = ['LP', 'HK', 'TP'] as const
export function isFrontRower(p: Player | undefined | null): boolean {
  return !!p && FRONT_ROW.some(n => p.pos === n || p.alt.includes(n))
}

/**
 * ONLY THE FRONT ROW IS HARD TO REPLACE (owner, round 6: "he is a back rower
 * so I should be able to replace him with anyone ... Only front row players
 * should be harder to replace ... if a back has to play front row for example
 * then it would be uncontested scrums").
 *
 * Every other shirt takes any fit man on the bench, and a man out of position
 * pays the existing cover charge (forcedSwitchCost). Shirts 1, 2 and 3 want a
 * trained front-rower while one is available: an unused fit man on the bench,
 * or `alsoId` (the assistant's injury cover, who goes back to the bench if he
 * is swapped). When none is, anybody may take the shirt and Law 3 orders
 * uncontested scrums (checkFrontRow). True means "a non-front-rower may not
 * take this shirt now". Read-only, no draw.
 */
export function needsFrontRower(state: GameState, side: SideCtx, outId: number, alsoId?: number): boolean {
  const slot = side.lineup.indexOf(outId)
  if (slot < 0 || slot > 2) return false
  if (alsoId != null && isFrontRower(state.players[alsoId])) return true
  for (const id of side.lineup.slice(15)) {
    if (id == null || side.onPitch.has(id) || side.ratings.has(id) || side.binned.has(id)) continue
    const p = state.players[id]
    if (p && !p.injury && p.bans === 0 && isFrontRower(p)) return true
  }
  return false
}

/** A non-front-rower has gone into a front-row shirt because nobody trained
 *  was left: if the side can no longer cover all three positions, the
 *  referee orders uncontested scrums. The change was the law's own answer to
 *  the shortage, so nobody else leaves the field for it. */
export function frontRowGap(state: GameState, ctx: LiveCtx, side: SideCtx, min: number, lost: Player | undefined) {
  if (!lost || ctx.uncontested || liveFrontRowCover(state, side)) return
  const pretend: Player = isFrontRower(lost) ? lost : { ...lost, pos: 'LP' as Pos, alt: [] }
  checkFrontRow(state, ctx, side, min, pretend, 'hia')
}

/** Law 3 mid-match: can the side still put a trained loosehead, hooker and
 *  tighthead on the pitch? Counts the players on it plus the bench that has
 *  not been used; a man in the bin does not count until he is back. The
 *  kick-off test (frontRowCover) wants two of each across the 23 because a
 *  match has replacements to make; once it is running, one of each is enough
 *  to keep the scrum contested. */
export function liveFrontRowCover(state: GameState, side: SideCtx): boolean {
  const pool: Player[] = []
  for (const id of side.onPitch) { const p = state.players[id]; if (p && !p.injury) pool.push(p) }
  // A REPLACED FRONT-ROWER STILL COUNTS (Law 3.35): a prop who came off at
  // the hour may return for a prop who is injured, binned or sent off, which
  // is why uncontested scrums are rare in the professional game. Only the
  // injured, the binned and the man on the pitch are out of the reckoning.
  for (const id of side.lineup.slice(15)) {
    if (id == null || side.onPitch.has(id) || side.binned.has(id) || side.sentOff?.has(id)) continue
    const p = state.players[id]
    if (p && !p.injury) pool.push(p)
  }
  const cover = { LP: 0, HK: 0, TP: 0 }
  let capable = 0
  for (const p of pool) {
    if (!isFrontRower(p)) continue
    capable += 1
    for (const n of FRONT_ROW) if (p.pos === n || p.alt.includes(n)) cover[n] += 1
  }
  return capable >= 3 && cover.LP >= 1 && cover.HK >= 1 && cover.TP >= 1
}

/** The best replaced, uninjured front-rower on the bench, for Law 3.35. */
function returningFrontRower(state: GameState, side: SideCtx): Player | null {
  let best: Player | null = null
  for (const id of side.lineup.slice(15)) {
    if (id == null || side.onPitch.has(id) || side.binned.has(id) || side.sentOff?.has(id) || !side.ratings.has(id)) continue
    const p = state.players[id]
    if (!p || p.injury || !isFrontRower(p)) continue
    if (!best || p.ca > best.ca) best = p
  }
  return best
}

/** Can the men on the pitch pack down a trained front row: a hooker and two
 *  props, three different men? A prop is a prop on either side here, as he
 *  is for the shirts (specialistGaps). Read-only, no draw. */
function pitchFrontRow(state: GameState, ids: Iterable<number>): boolean {
  const fr: Player[] = []
  for (const id of ids) { const p = state.players[id]; if (p && !p.injury && isFrontRower(p)) fr.push(p) }
  if (fr.length < 3) return false
  const hook = (p: Player) => p.pos === 'HK' || p.alt.includes('HK')
  const prop = (p: Player) => p.pos === 'LP' || p.pos === 'TP' || p.alt.includes('LP') || p.alt.includes('TP')
  for (const h of fr) {
    if (!hook(h)) continue
    if (fr.filter(p => p !== h && prop(p)).length >= 2) return true
  }
  return false
}

/**
 * LAW 3 WITH THE COVER ON THE BENCH (1.8.3, Laws 3.19 and 3.20).
 *
 * A front-rower is carded and a trained replacement is sitting on the bench.
 * This used to stop at "the cover exists": liveFrontRowCover counted the bench
 * man, so the scrum stayed contested, and nobody came on. The AI bench skipped
 * the empty shirt (aiAutoSubs replaces only a man who is out there) and the
 * manager could not fill it either (makeSubstitution refuses a binned man), so
 * the side scrummaged for ten minutes, or for the rest of the match, with a
 * card in the front row and a hooker on the bench.
 *
 * The law's answer: the side nominates another player to leave the field and
 * the front-row replacement comes on, so the scrum stays a contest and the
 * side is still a man down for the card. For a yellow it is undone when the
 * ten minutes end (simTick, the bin block): the carded man takes his shirt
 * back, the replacement goes back to the bench and the nominated man returns.
 * For a red it is for the match (RED-CARD-01: the sending-off is permanent).
 *
 * The replacement is the unused bench man who best fits the shirt (effAt), and
 * failing one a front-rower already replaced (Law 3.35), on the legs he left
 * with. The man who makes way is chosen as checkFrontRow chooses its man off:
 * the least valuable non-front-rower still out there by his mark so far. It is
 * the same for the manager's side and the AI's: forced, like an injury change,
 * so it spends none of the manager's replacements. No draw. Returns false when
 * nobody on the bench restores a whole front row, and Law 3 then orders
 * uncontested scrums as before.
 */
function frontRowCardCover(state: GameState, ctx: LiveCtx, side: SideCtx, min: number, lost: Player, cause: 'red' | 'yellow'): boolean {
  const shirt = side.lineup.indexOf(lost.id)
  if (shirt < 0 || shirt > 14) return false
  const pos = XV_SLOTS[shirt].pos
  const fresh: Player[] = []
  const used: Player[] = []
  for (const id of side.lineup.slice(15)) {
    if (id == null || side.onPitch.has(id) || side.binned.has(id) || side.sentOff?.has(id)) continue
    const p = state.players[id]
    if (!p || p.injury || p.bans > 0 || !isFrontRower(p)) continue
    if (!pitchFrontRow(state, [...side.onPitch, p.id])) continue
    ;(side.ratings.has(id) ? used : fresh).push(p)
  }
  let rep: Player | null = null
  for (const p of fresh) if (!rep || effAt(p, pos) > effAt(rep, pos)) rep = p
  const back = !rep
  if (!rep) for (const p of used) if (!rep || p.ca > rep.ca) rep = p
  if (!rep) return false
  const rest = [...side.onPitch].map(id => state.players[id]).filter((p): p is Player => !!p && !isFrontRower(p))
  if (!rest.length) return false
  let nom = rest[0]
  for (const p of rest) if ((side.ratings.get(p.id) ?? 6) < (side.ratings.get(nom.id) ?? 6)) nom = p
  // the replacement wears the carded man's shirt, and the carded man takes
  // the replacement's seat; the man who makes way keeps his shirt, off the
  // pitch, the way a Law 3.20 removal does
  const seat = side.lineup.indexOf(rep.id)
  side.lineup[shirt] = rep.id
  if (seat >= 0) side.lineup[seat] = lost.id
  side.onPitch.delete(nom.id)
  side.onPitch.add(rep.id)
  cameOn(side, rep.id, min)
  if (!back) {
    side.ratings.set(rep.id, 6)
    side.energy.set(rep.id, benchTank(rep))
  } else {
    side.energy.set(rep.id, Math.min(benchTank(rep), side.energy.get(rep.id) ?? benchTank(rep)))
  }
  if (cause === 'yellow') (side.frCover ??= []).push({ binned: lost.id, on: rep.id, off: nom.id, shirt, swap: true })
  else (side.sentOff ??= new Set()).add(lost.id)
  fieldChanged(state, ctx, side, min)
  pushLine(state, ctx, min, 'SUB', side, cause === 'yellow' ? 'comm.frontRowBinCover' : 'comm.frontRowRedCover',
    { team: teamShort(state, side.teamId), on: rep.name, player: nom.name, lost: lost.name }, rep.id)
  return true
}

/** The bin block's half of frontRowCardCover: the carded front-rower's ten
 *  minutes are up. He takes his shirt back from whoever wears it now (the
 *  replacement, or whoever replaced him), that man goes to the bench, and the
 *  man who made way comes back on. Returns true when it handled the man. */
export function frontRowCoverEnds(state: GameState, ctx: LiveCtx, s: SideCtx, id: number, min: number): boolean {
  const list = s.frCover
  const i = list ? list.findIndex(r => r.binned === id) : -1
  if (!list || i < 0) return false
  const r = list[i]
  list.splice(i, 1)
  const p = state.players[id]
  const nom = state.players[r.off]
  // THE COVER IS IN THE BIN HIMSELF: the replacement hooker took a card of
  // his own while he wore the shirt (frontrowcardprobe, after 1.8.16 gave the
  // TMO and the professional foul cards of their own). The man who made way
  // for him is owed his place back when the COVER's ten minutes end, not now,
  // or the side would have one more on the pitch than its cards allow.
  const cover = s.lineup[r.shirt]
  const coverSitting = r.swap && cover != null && cover !== id && s.binned.has(cover)
  if (r.swap && p && !p.injury) {
    const cur = s.lineup[r.shirt]
    const seat = s.lineup.indexOf(id)
    if (cur != null && cur !== id) {
      s.lineup[r.shirt] = id
      if (seat >= 0) s.lineup[seat] = cur
      s.onPitch.delete(cur)
      // the shirt's wearer is off for a head assessment: the man standing in
      // for HIM leaves now, and the assessed man, whatever the doctors say,
      // has no shirt to come back to (journeyprobe: sixteen on the pitch when
      // a binned front-rower returned during his cover's HIA)
      if (s.hia && s.hia.pid === cur) s.onPitch.delete(s.hia.subId)
    }
    s.onPitch.add(id)
    // a later card on the same shirt is settled by this return: its man
    // off is still owed his place, but the shirt is spoken for
    for (const o of list) if (o.shirt === r.shirt) o.swap = false
    pushLine(state, ctx, min, 'SUB', s, 'comm.frontRowBinBack',
      { team: teamShort(state, s.teamId), lost: p.name, on: cur != null ? state.players[cur]?.name ?? '' : '', player: nom?.name ?? '' }, id)
  }
  if (coverSitting) list.push({ binned: cover!, on: cover!, off: r.off, shirt: r.shirt, swap: false })
  else if (nom && !nom.injury && s.lineup.slice(0, 15).includes(nom.id) && !s.binned.has(nom.id)) s.onPitch.add(nom.id)
  return true
}

/**
 * A front-rower has just gone off. If nobody trained is left to take his
 * place the referee orders uncontested scrums from here: both packs are
 * levelled the way kick-off levels them, so the side with the better scrum
 * pays for the other's shortage.
 *
 * THE LAW AS IMPLEMENTED (World Rugby Law 3, uncontested scrums, and the
 * law application guidelines on it, 2017 and 2020). When uncontested scrums
 * are ordered because of a sending-off, a temporary suspension or an injury,
 * the player whose departure caused them cannot be replaced, so the team that
 * caused them plays a man fewer than it otherwise would:
 *
 *   injury   the injured front-rower is not replaced: whoever came on for
 *            him goes back off (or, with nobody on, the side's least-used man
 *            in the loose), and the side plays with fourteen
 *   red      the side is already a man down for the card, and loses a second
 *            man as well, so it plays with thirteen for the rest of the match
 *   yellow   a second man leaves with him for the ten minutes (thirteen), and
 *            both return together when the bin ends (simTick, the bin block),
 *            which is also when the scrum is contested again if the cover is back
 *   hia      a temporary replacement for a head injury assessment that becomes
 *            permanent is treated as the guidelines treat a blood replacement
 *            that becomes permanent: the side does not lose a player
 *
 * The man taken off is the least valuable non-front-rower still out there,
 * the one a coach would choose. The guidelines' exception for an injury
 * caused by foul play is not modelled: nothing in the engine injures a man by
 * foul play, so no injury qualifies for it.
 */
export function checkFrontRow(state: GameState, ctx: LiveCtx, side: SideCtx, min: number, lost: Player, cause: 'red' | 'yellow' | 'injury' | 'hia', replaced = true) {
  if (ctx.uncontested || !isFrontRower(lost)) return
  // a card with the cover on the bench: the cover comes on and another man
  // makes way (frontRowCardCover); a front row still whole on the pitch
  // needs nothing; and only when neither holds is it uncontested
  if (cause === 'red' || cause === 'yellow') {
    if (pitchFrontRow(state, side.onPitch)) return
    if (frontRowCardCover(state, ctx, side, min, lost, cause)) return
  } else if (liveFrontRowCover(state, side)) return
  const { home, away } = ctx
  const level = (home.units.scrum + away.units.scrum) / 2
  const homeF = level / Math.max(1, home.units.scrum)
  const awayF = level / Math.max(1, away.units.scrum)
  layer(home, 'scrum', homeF)
  layer(away, 'scrum', awayF)
  ctx.uncontested = true
  ctx.uncontestedUndo = cause === 'yellow' ? { home: homeF, away: awayF } : null
  pushLine(state, ctx, min, 'SUB', side, 'comm.uncontestedNow', { team: teamShort(state, side.teamId), player: lost.name }, lost.id)
  // an injured man nobody came on for has already left the side a man short
  if (cause === 'hia' || (cause === 'injury' && !replaced)) return
  // the man off: the least valuable non-front-rower still out there
  const rest = [...side.onPitch].map(id => state.players[id]).filter((p): p is Player => !!p && !isFrontRower(p))
  if (!rest.length) return
  let nom = rest[0]
  for (const p of rest) if ((side.ratings.get(p.id) ?? 6) < (side.ratings.get(nom.id) ?? 6)) nom = p
  side.onPitch.delete(nom.id)
  side.short += 1
  if (cause === 'yellow') side.lawOut = { id: nom.id, binned: lost.id }
  fieldChanged(state, ctx, side, min)
  pushLine(state, ctx, min, 'SUB', side, cause === 'injury' ? 'comm.uncontestedNoRep' : cause === 'yellow' ? 'comm.uncontestedBin' : 'comm.uncontestedShort',
    { team: teamShort(state, side.teamId), player: nom.name, lost: lost.name }, nom.id)
}

/**
 * THE ASSISTANT'S BENCH IS AS GOOD AS THE ASSISTANT (1.8.1, autopilotprobe).
 *
 * When the manager hands the touchline over (an instant result, or a week he
 * simply lets the game settle), his assistant makes the changes. A week
 * settled without him used to make none at all, and since 1.8.1 simMatch
 * hands it to the assistant as the instant result always did - who then made
 * them exactly as an AI head coach does, the full four on the hour and every
 * rolling change for a spent man, whoever was on the staff. Measured on
 * autopilotprobe's 54 worlds, that line was worth 14 points a season to a
 * Northampton that never opened a screen (34.1 without it, 48.6 with it) and
 * seven titles in 54: pressing Continue had become a strategy.
 *
 * So the bench, like the team sheet (assistantJudgement), is as good as the
 * man he hired to run it. Up to level one he makes two changes on the hour
 * and nothing else; level two makes three and reads a tank running dry the
 * way a head coach does; level three is a head coach. A manager who makes his
 * own changes has the whole bench whatever his staff. Measured on the same 54
 * worlds (Northampton has a level-two assistant): 44.2 points a season, 3
 * titles, against the engaged manager's 52.3 and 12. Deterministic: no draw.
 */
export function assistantBench(state: GameState): { bulk: number; rolling: boolean } {
  const lvl = Math.min(3, Math.max(0, state.staff?.assistant ?? 0))
  return { bulk: [2, 2, 3, 4][lvl], rolling: lvl >= 2 }
}

export function aiAutoSubs(state: GameState, ctx: LiveCtx, side: SideCtx, min: number) {
  // the user manages their own bench (except forced injury subs elsewhere),
  // unless they handed the match to the assistant
  if (side.isUser && !ctx.assistantSubs) return
  if (ctx.tick < 11) return
  const bulk = ctx.tick === 15 // the classic bench emptying, 61-64'
  // his assistant runs it at the assistant's level (assistantBench)
  const asst = side.isUser ? assistantBench(state) : null
  if (asst && !bulk && !asst.rolling) return
  let made = 0
  for (let slot = 0; slot < 15 && made < (bulk ? (asst?.bulk ?? 4) : 1); slot++) {
    const outId = side.lineup[slot]
    if (outId == null || !side.onPitch.has(outId)) continue
    const e = side.energy.get(outId) ?? 70
    if (!bulk && e > 32) continue
    if (bulk && e > 55) continue
    const pos = XV_SLOTS[slot].pos
    // best unused bench cover for the slot
    let best: Player | null = null
    let bestS = -1
    for (let b = 15; b < 23; b++) {
      const id = side.lineup[b]
      if (id == null) continue
      const p = state.players[id]
      if (!p || p.injury || side.ratings.has(id) || side.onPitch.has(id)) continue
      const s = effAt(p, pos)
      // A CHANGE FOR TIRED LEGS IS LIKE FOR LIKE. This took the best of
      // whatever was left, and once the bench prop had gone on for an injury
      // that could be a centre at tighthead. It cost nothing while an AI
      // side's units ignored its replacements; now that they read the men on
      // the pitch, a centre in the front row scrummages like one. A tired
      // specialist is kept on rather than swapped for a man who does not play
      // there (his own position, a listed alternative or the neighbouring
      // shirt, which is what effAt's 0.8 marks). Injuries still take whoever
      // is left: that change is forced.
      if (s < p.ca * 0.8) continue
      // nor one that leaves the scrum without its props (1.9.1). A hooker
      // reads as 0.8 at loosehead (the neighbouring shirt), so a tired prop
      // could make way for him while the other prop was in the bin and the
      // cover had come on: two hookers, one prop, a contested scrum
      // (frontrowcardprobe, montauban at 52')
      if (slot <= 2 && !pitchFrontRow(state, [...[...side.onPitch].filter(x => x !== outId), id])
        && pitchFrontRow(state, side.onPitch)) continue
      if (s > bestS) { bestS = s; best = p }
    }
    // nobody on the bench plays there: this shirt keeps its man, and the next
    // tired shirt may still have a like-for-like change waiting
    if (!best) continue
    side.onPitch.delete(outId)
    side.onPitch.add(best.id)
    cameOn(side, best.id, min)
    side.ratings.set(best.id, 6)
    side.energy.set(best.id, benchTank(state.players[best.id]))
    const benchSlot = side.lineup.indexOf(best.id)
    side.lineup[slot] = best.id
    if (benchSlot >= 0) side.lineup[benchSlot] = outId
    // the AI coach's bench plan is subject to the same laws (F4)
    applyBrief(state, side, best.id)
    forcedSwitchCost(state, ctx, side, outId, best, min)
    made++
  }
  // once for the lot, not once a man: nothing in the loop reads the units,
  // and the hour's bulk change used to rebuild them four times over
  if (made) fieldChanged(state, ctx, side, min)
}

/** The last twenty minutes belong to the bench (F4).
 *
 *  A 6-2 reshapes the closing quarter through the middle; a 4-4 reshapes it out
 *  wide. The two are deliberate mirror images so that a world picking both does
 *  not drift, and the orthodox 5-3 is exactly neutral so that doing nothing
 *  costs nothing.
 *
 *  It only pays out in proportion to how much of the bench is actually on the
 *  field. Naming a bomb squad and leaving it sitting changes nothing, which is
 *  what makes this an economy rather than another slider. */
export function applyFinishers(state: GameState, ctx: LiveCtx, side: SideCtx, min: number) {
  if (side.finisherDone) return
  side.finisherDone = true
  const def = SPLIT_BY_ID[side.split]
  if (!def || def.id === '5-3') return
  const on = [...side.onPitch].filter(id => side.benchIds.has(id)).length
  const k = Math.min(1, on / 3) // three of the eight is a full commitment
  if (k <= 0) return
  const lerp = (m: number) => 1 + (m - 1) * k
  layer(side, 'scrum', lerp(def.scrum))
  layer(side, 'breakdown', lerp(def.breakdown))
  layer(side, 'defence', lerp(def.defence))
  layer(side, 'attack', lerp(def.attack))
  // one line, and only when the plan is genuinely on the field. Deterministic:
  // no roll of the shared match rng decides whether the manager hears about it.
  if (ctx.detail && side.isUser && on >= 3) {
    pushLine(state, ctx, min, 'SUB', side, def.id === '6-2' ? 'comm.benchSixTwo' : 'comm.benchFiveThree',
      { team: teamShort(state, side.teamId) })
  }
}

/**
 * ---- THE TANK A REPLACEMENT CARRIES ON ----
 *
 * User: "a player who had low energy before the game who was on the bench
 * suddenly had 100% when coming on from the bench."
 *
 * SIX places put a man on the pitch - the AI coach's rotation, an injury
 * replacement, an HIA, the manager's own substitution, a positional swap and a
 * reversal - and five of them wrote `Math.max(60, cond)`. The sixth was not a
 * substitution site at all: applyBrief's 'impact' case ran immediately
 * afterwards and wrote a flat `100`, wiping the figure the substitution had
 * just worked out. A man at 45% came on with a full tank because of what his
 * bench seat had been told to do.
 *
 * The second half of that bug is the more interesting one, and it is why this
 * is a bonus rather than a set: writing 100 absolute REWARDED EXHAUSTION. A
 * fresh replacement on 95 gained 5; a spent one floored at 60 gained 40. The
 * optimal play was to brief your most knackered forward as the impact man,
 * which is the opposite of what a bench is for.
 *
 * So: one function decides what a replacement is worth, every site calls it,
 * and a brief adds a bounded top-up on TOP of it instead of replacing it.
 *
 * The 60 floor is deliberate and stays: a replacement has spent the hour
 * sitting down, so he is fresher than his training-ground condition says. It
 * is a floor on the tank he brings, not a claim that he is fit.
 */
export function benchTank(p: Player | null | undefined): number {
  return Math.max(60, Math.min(100, p?.cond ?? 85))
}

/** What a bench brief adds to that tank. Bounded, and applied to whatever the
 *  man actually had, so it can never again be worth more to the tired. */
const IMPACT_TOPUP = 8

/** What the man was told as he pulled the shirt on (F4).
 *
 *  Capped at three briefed replacements a side: eight stacking instructions
 *  would be a bigger swing than any tactic in the game, and a bench is not a
 *  cheat code. Returns the phrase to hang on the substitution line, or null. */
/** The one-line note that comes with a bench instruction, as a KEY - it is
 *  appended to the substitution's commentary, so it has to travel the same way
 *  the commentary does. */
export function applyBrief(state: GameState, side: SideCtx, inId: number): string | null {
  const club = state.clubs[side.teamId]
  const seat = side.seatOf.get(inId)
  if (!club || seat == null) return null
  const brief = briefForSeat(club, seat)
  if (brief === 'orders') return null
  if ((side.briefsUsed ?? 0) >= 3) return null
  side.briefsUsed = (side.briefsUsed ?? 0) + 1
  switch (brief) {
    case 'impact':
      layer(side, 'attack', 1.025)
      layer(side, 'defence', 0.99)
      // a top-up on what he brought, never a reset to full (see benchTank)
      side.energy.set(inId, Math.min(100, (side.energy.get(inId) ?? benchTank(state.players[inId])) + IMPACT_TOPUP))
      return 'comm.briefImpact'
    case 'shore':
      layer(side, 'defence', 1.025)
      layer(side, 'attack', 0.99)
      layer(side, 'card', 0.96)
      return 'comm.briefShore'
    case 'manage':
      layer(side, 'kicking', 1.03)
      layer(side, 'attack', 0.995)
      layer(side, 'tempo', 0.97)
      return 'comm.briefManage'
    default:
      return null
  }
}

/** The bill for a man in the wrong half of the team, and it has to be paid on
 *  both sides of the ledger.
 *
 *  The first cut charged attack 0.92 and defence 0.96, which read as a fair
 *  trade and was not: it took 0.4 points a game off the whole world, because
 *  attack carries weight 0.55 in the attacking ratio while defence carries 0.7
 *  in the defending one. Neutrality needs 0.55 * attackLoss == 0.7 * defenceLoss,
 *  so the defensive hole has to be the deeper of the two - which is also the
 *  truer picture. A flanker at 13 does not stop scoring the same way he stops
 *  carrying; he leaks. */
export const COVER_ATT = 0.92
export const COVER_DEF = 0.937

/** The cost of a thin bench: a man in the wrong half of the team.
 *
 *  This is the bill a 6-2 can be presented with. Lose a centre once both your
 *  backs have been used and a flanker finishes the game in the 13 shirt, and no
 *  amount of shove makes up for it. Charged once, to any side, so the risk is
 *  the same law for everybody. */
export function forcedSwitchCost(state: GameState, ctx: LiveCtx, side: SideCtx, outId: number, inP: Player, min: number) {
  if (side.coverBlown) return
  const out = state.players[outId]
  if (!out) return
  const slot = side.lineup.indexOf(inP.id)
  const shirtPos: Pos | null = slot >= 0 && slot < 15 ? XV_SLOTS[slot].pos : null
  if (!shirtPos) return
  // a natural fit, or a recognised alternative position, is not a crisis
  if (inP.pos === shirtPos || inP.alt.includes(shirtPos)) return
  if (isForward(inP.pos) === isForward(shirtPos)) return
  side.coverBlown = true
  layer(side, 'attack', COVER_ATT)
  layer(side, 'defence', COVER_DEF)
  if (ctx.detail) {
    pushLine(state, ctx, min, 'SUB', side, 'comm.outOfCover',
      { team: teamShort(state, side.teamId), player: inP.name, pos: inP.pos, shirt: shirtPos }, inP.id)
  }
}

/** Who could come on for an injured man: the best fit man left on the bench,
 *  or with the bench spent a replaced front-rower for a front-rower (Law
 *  3.35). Null when nobody can. Read-only, no draw. */
export function injuryCoverFor(state: GameState, side: SideCtx, p: Player): Player | null {
  return pickBenchSub(state, side, p.id) ?? (isFrontRower(p) ? returningFrontRower(state, side) : null)
}

/**
 * Put a replacement on for an injured man, or play on a man short when nobody
 * is left. `chosen` is the manager's pick (coverInjury); null is the
 * assistant's, which is every AI side's and every match nobody is watching.
 */
export function sendOnForInjury(state: GameState, ctx: LiveCtx, side: SideCtx, p: Player, min: number, chosen: Player | null) {
  // with the bench spent, a replaced front-rower may come back for an
  // injured one (Law 3.35) - on the legs he left with, not fresh ones
  const back = chosen ? (side.ratings.has(chosen.id) ? chosen : null)
    : pickBenchSub(state, side, p.id) == null && isFrontRower(p) ? returningFrontRower(state, side) : null
  const sub = chosen ?? back ?? pickBenchSub(state, side, p.id)
  if (sub) {
    side.onPitch.add(sub.id)
    cameOn(side, sub.id, min)
    if (!back) side.ratings.set(sub.id, 6)
    side.energy.set(sub.id, back ? Math.min(benchTank(sub), side.energy.get(sub.id) ?? benchTank(sub)) : benchTank(sub))
    const slot = side.lineup.indexOf(p.id)
    const bSlot = side.lineup.indexOf(sub.id)
    if (slot >= 0 && slot < 15) {
      side.lineup[slot] = sub.id
      if (bSlot >= 0) side.lineup[bSlot] = p.id
    }
    if (back) {
      pushLine(state, ctx, min, 'SUB', side, 'comm.frontRowReturns', { player: sub.name }, sub.id)
    } else {
      const brief = applyBrief(state, side, sub.id)
      pushLine(state, ctx, min, 'SUB', side, 'comm.subComesOn',
        { player: sub.name, brief_k: brief ?? 'common.nothing' }, sub.id)
    }
    // and if the bench had nobody who plays there, the side pays (F4)
    forcedSwitchCost(state, ctx, side, p.id, sub, min)
  } else {
    // NOBODY LEFT TO SEND ON. The bench is spent, so the side finishes
    // the match a man down - and until this line existed, that cost it
    // nothing at all. The commentary said fourteen; numF, which is the
    // only place the missing man is charged for, counted yellows, red
    // cards and Law 3.20 and knew nothing about an uncovered injury.
    // So a side could play twenty minutes with fourteen men and be
    // exactly as strong as one with fifteen.
    //
    // Found by scripts/journeyprobe.ts reconciling the men on the pitch
    // against the men the card accounted for, in a Bristol side that
    // lost a man at 72 minutes with an empty bench. Charged as `short`
    // because that is what short means: a player the side had to do
    // without, and not a card in anybody's record.
    side.short += 1
  }
  checkFrontRow(state, ctx, side, min, p, 'injury', !!sub)
  fieldChanged(state, ctx, side, min)
  side.lastInj = { hurtId: p.id, coverId: sub && !back ? sub.id : null, upTo: ctx.events.length }
}
