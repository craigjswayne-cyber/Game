// Live control: the whistles, the manager's talks, substitutions, shirts and
// tactics changes mid-match. Split out of matchEngine.ts, which re-exports the
// public parts.
import type { GameState, Player } from '../model'
import { trustFactor } from '../model'
import { standing } from '../authority'
import { archetypeOf, loudestDial } from '../oppcoach'
import { HT_TONES, PRE_CARRY, PRE_TONES, hotShare, logPreTalk, roomVerdict, silenceReads, silenceWeight, talkFactor, talkReads, talkSetting, type HtTone, type PreTone, type TalkRead, type TalkSetting } from '../teamtalk'
import { t, tIn } from '../i18n'
import { hashString } from '../rng'
import { briefForSeat } from '../bench'
import { MAX_SUBS, paperOverall, teamShort } from './selection'
import { resolveDecision } from './scoring'
import { COVER_ATT, COVER_DEF, applyBrief, benchTank, forcedSwitchCost, frontRowGap, isFrontRower, needsFrontRower, pickBenchSub, sendOnForInjury } from './subs'
import { simTick } from './tick'
import { blowFullTime, blowHalfTime } from './finalize'
import { cameOn, fieldChanged, recomputeSideUnits } from './field'
import { type SideCtx, layer } from './side'
import { type LiveCtx, pushLine, userDials } from './live'

/**
 * Send on the manager's choice for one of his injured men (1.9.1, injWait).
 * `inId` null is "let the assistant pick". Free, like any injury replacement.
 * Returns '' when it is done, or why that man cannot go on.
 */
export function coverInjury(state: GameState, ctx: LiveCtx, hurtId: number, inId: number | null): string {
  const w = ctx.injWait?.find(x => x.hurtId === hurtId)
  const p = state.players[hurtId]
  if (!w || !p) return t('touch.notAvailable')
  const side = w.home ? ctx.home : ctx.away
  let chosen: Player | null = null
  if (inId != null) {
    const c = state.players[inId]
    const slot = side.lineup.indexOf(inId)
    if (!c || c.injury || c.bans > 0 || slot < 15 || side.onPitch.has(inId) || side.binned.has(inId) || side.sentOff?.has(inId)) return t('touch.notAvailable')
    // a man already replaced may only come back as a front-rower for a
    // front-rower, and only when the bench has nobody else (Law 3.35)
    if (side.ratings.has(inId) && !(isFrontRower(c) && isFrontRower(p) && !pickBenchSub(state, side, hurtId))) return t('touch.notAvailable')
    if (!isFrontRower(c) && needsFrontRower(state, side, hurtId)) return t('touch.frontRowOnly')
    chosen = c
  }
  ctx.injWait = ctx.injWait!.filter(x => x !== w)
  side.short -= 1
  sendOnForInjury(state, ctx, side, p, w.min, chosen)
  return ''
}

export function stepTick(state: GameState, ctx: LiveCtx): 'play' | 'HT' | 'BRK' | 'FT' {
  if (ctx.tick >= 20) return 'FT'
  // nobody may play on while a man is down and unanswered: a caller that
  // steps on anyway (skip to the break, a harness) gets the assistant's pick
  for (const w of [...(ctx.injWait ?? [])]) coverInjury(state, ctx, w.hurtId, null)
  // play has resumed: the last substitution has now been played and cannot be
  // taken back (16B), and no whistle is waiting on anything
  ctx.lastSub = null
  ctx.whistleAt = null
  // the dials the second half kicks off with, against the half-time read
  if (ctx.tick === 10 && ctx.htEv && !ctx.shDials) ctx.shDials = userDials(state, ctx)
  simTick(state, ctx, ctx.tick)
  ctx.tick += 1
  aiTacticShift(state, ctx)
  if (ctx.tick === 10) {
    ctx.seg = 1
    // THE WHISTLE WAITS FOR THE KICK. A penalty awarded in the closing minutes
    // is still to be taken, so the half has not ended: nothing is narrated and
    // the interval does not open until resolveDecision blows it. seg moves to
    // 1 either way - that only means "second half next", and it is what keeps
    // the decision panel on screen instead of the interval.
    if (ctx.decision) ctx.heldWhistle = 'HT'
    else blowHalfTime(state, ctx)
    return 'HT'
  }
  if (ctx.tick === 15) {
    ctx.seg = 2
    ctx.awaiting = 'BRK'
    pushLine(state, ctx, 60, 'BRK', null, 'comm.hourMark')
    return 'BRK'
  }
  if (ctx.tick === 20) {
    // Same at the end. seg stays at 2 while a call is outstanding, because
    // every caller reads seg === 3 as "finished" - the store settles knockout
    // ties on it, the screen shows the full-time panel on it - and the match
    // is not finished while a kick that can change the result is unanswered.
    if (ctx.decision) ctx.heldWhistle = 'FT'
    else blowFullTime(state, ctx)
    return 'FT'
  }
  return 'play'
}

/** The opposite number is not a statue: an AI side chasing the game opens
 *  up; an AI side protecting a lead late shuts up shop. Once per match. */
function aiTacticShift(state: GameState, ctx: LiveCtx) {
  for (const side of [ctx.home, ctx.away]) {
    if (side.isUser) continue
    const opp = side === ctx.home ? ctx.away : ctx.home
    const diff = side.score - opp.score
    const min = ctx.tick * 4
    const coach = state.clubs[side.teamId]?.coach
    const who = coach ?? `The ${teamShort(state, side.teamId)} coach`
    // THE REACTIVE DUGOUT (pillar 2): a reactive-archetype coach who is being
    // hurt reads the loudest thing the user is doing and counters it from the
    // touchline - at most twice, each counter a trade rather than a free
    // upgrade, and deterministic on the state of the match. He reads the
    // scoreboard and the picture in front of him, not the tendency file.
    if (opp.isUser && archetypeOf(side.teamId, state.clubs[side.teamId]?.rep ?? 78) === 'reactive' && (side.reacted ?? 0) < 2) {
      const window = (side.reacted ?? 0) === 0 ? ctx.tick >= 5 && diff <= -5 : ctx.tick >= 14 && diff <= -10
      if (window) {
        const loud = loudestDial(state.clubs[opp.teamId]?.tactic ?? { style: 50, tempo: 50, kicking: 50, aggression: 50 })
        if (loud) {
          side.reacted = (side.reacted ?? 0) + 1
          // `what` and `how` are the two halves of a sentence and each is a
          // key: a French coach cannot see the problem in English.
          const say = (what: string, how: string) => pushLine(state, ctx, min, 'SUB', side, 'comm.coachSees',
            { who, what_k: what, how_k: how, team: teamShort(state, side.teamId) })
          if (loud.dial === 'style' && loud.v > 50) {
            layer(side, 'defence', 1.05); layer(side, 'breakdown', 0.96)
            say('comm.seesWidth', 'comm.doesWidth')
          } else if (loud.dial === 'style') {
            layer(side, 'breakdown', 1.06); layer(side, 'defence', 0.97)
            say('comm.seesMiddle', 'comm.doesMiddle')
          } else if (loud.dial === 'kicking' && loud.v > 50) {
            layer(side, 'defence', 1.04); layer(side, 'attack', 0.97)
            say('comm.seesAerial', 'comm.doesAerial')
          } else if (loud.dial === 'tempo' && loud.v > 50) {
            layer(side, 'tempo', 0.92); layer(side, 'defence', 1.03)
            say('comm.seesPace', 'comm.doesPace')
          } else if (loud.dial === 'aggression' && loud.v > 50) {
            layer(side, 'card', 0.85); layer(side, 'breakdown', 1.03)
            say('comm.seesPhysical', 'comm.doesPhysical')
          } else {
            // a quiet, conservative habit: press it
            layer(side, 'tempo', 1.08); layer(side, 'defence', 0.98)
            say('comm.seesPassive', 'comm.doesPassive')
          }
        }
      }
    }
    if (side.shifted) continue
    if (ctx.tick >= 12 && diff <= -10) {
      side.shifted = true
      layer(side, 'attack', 1.06)
      layer(side, 'defence', 0.95)
      layer(side, 'tempo', 1.14)
      layer(side, 'card', 1.15)
      pushLine(state, ctx, min, 'SUB', side, 'comm.coachChases', { who, team: teamShort(state, side.teamId) })
    } else if (ctx.tick >= 16 && diff >= 10) {
      side.shifted = true
      layer(side, 'defence', 1.05)
      layer(side, 'attack', 0.94)
      layer(side, 'tempo', 0.88)
      pushLine(state, ctx, min, 'SUB', side, 'comm.coachManages', { who, team: teamShort(state, side.teamId) })
    }
  }
}

/** Play through to the next natural stop (HT, 60' or FT).
 *  Any pending touchline decision is auto-resolved (take the points). */
export function playSegment(state: GameState, ctx: LiveCtx) {
  ctx.awaiting = null
  for (;;) {
    if (ctx.decision) resolveDecision(state, ctx, 'posts')
    const r = stepTick(state, ctx)
    if (ctx.decision) resolveDecision(state, ctx, 'posts')
    if (r !== 'play') { ctx.awaiting = null; break }
  }
}

/** Back-compat helper: plays to the next natural stop (used by full sims). */
export function playHalf(state: GameState, ctx: LiveCtx) {
  playSegment(state, ctx)
  if (ctx.seg === 2) playSegment(state, ctx) // second "half" = segments 2+3
}

/** The setting a talk is read against: how the two XVs compare on paper (the
 *  preview's numbers, no match-day fog), where, how big, and at the break the
 *  scoreline. The MatchDay preview builds the same thing from the same calls,
 *  so the room the manager reads is the room the engine hears. */
function talkSettingFor(state: GameState, ctx: LiveCtx, mine: SideCtx, opp: SideCtx, margin?: number): TalkSetting {
  return talkSetting(paperOverall(state, mine.teamId, mine.lineup), paperOverall(state, opp.teamId, opp.lineup),
    mine === ctx.home, !!ctx.fx.stage || ctx.derby, margin)
}

/** How much of the room is listening, 0..1: trust earned here times the
 *  standing a name brings (authority.ts). */
export function talkListen(state: GameState): number {
  return Math.max(0, Math.min(1, (trustFactor(state) - 0.45) / 0.55 * standing(state).talk))
}

/** Every line a tone can open with, chosen by a hash (never the match rng). */
const TALK_LINES = 2
function talkLine(state: GameState, ctx: LiveCtx, tone: string, half: 'pre' | 'ht', verdict: string): string {
  const n = (hashString(`${state.seed}:${ctx.fx.id}:${half}:${tone}`) % TALK_LINES) + 1
  return `${t(`tt.${half}_${tone}${n}`)} ${t(`tt.verdict_${verdict}`)}`
}

/** Fold a talk into the side: per-man multipliers, the cards a room pushed
 *  over the edge gives away, and the reaction kept for full time. `prior`
 *  is how much of an earlier talk's reaction is still in each man. */
function landTalk(state: GameState, ctx: LiveCtx, side: SideCtx, reads: TalkRead[], prior: number, fire: boolean, exp: number) {
  const f = new Map<number, number>()
  const rr = new Map<number, number>()
  for (const x of reads) {
    const r = (side.talkR?.get(x.pid) ?? 0) * prior + x.r
    rr.set(x.pid, r)
    f.set(x.pid, talkFactor(r, exp))
  }
  side.talkF = f
  side.talkR = rr
  // over the edge: complacent men and wound-up men give away cards
  const hot = hotShare(reads)
  layer(side, 'card', (fire ? 1.1 : 1) * (1 + hot * 1.1))
  recomputeSideUnits(state, ctx, side)
}

/** Pre-match dressing-room speech. One per match, chosen before kick-off.
 *  Every man in the 23 hears it and takes it his own way (teamtalk.ts). */
export function applyPreTalk(state: GameState, ctx: LiveCtx, kind: PreTone): string {
  if (ctx.preTalk) return t('touch.speechMade')
  ctx.preTalk = kind
  // an id from a build that offered a tone this one does not: heard as
  // nothing, which is what the old switch did with it
  if (!PRE_TONES.includes(kind)) return ''
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  const opp = mine === ctx.home ? ctx.away : ctx.home
  const s = talkSettingFor(state, ctx, mine, opp)
  const reads = talkReads(state, mine.lineup.slice(0, 23), s, kind, ctx.fx.id, talkListen(state))
  ctx.preReads = reads
  mine.talkShift = new Map(reads.map(x => [x.pid, x.after - x.before]))
  landTalk(state, ctx, mine, reads, 0, kind === 'fire', s.exp)
  return talkLine(state, ctx, kind, 'pre', roomVerdict(reads))
}

/**
 * THE DRESSING ROOM, SPOKEN IN OR NOT (owner, round 6). Every way the manager
 * takes the field (kick-off, Instant Result, a resumed match) comes through
 * here, so the habit is counted once per match whichever door he used: a tone
 * is the talk above, and nothing is nothing - unless it has become a habit,
 * when the room takes the silence as a small knock of its own (teamtalk.ts,
 * SAYING NOTHING). The log is written after the room is read, so the moods the
 * preview showed are the moods the engine heard. No draws.
 */
export function openDressingRoom(state: GameState, ctx: LiveCtx, kind: PreTone | null | undefined): string | null {
  if (ctx.preTalk) return null
  if (kind) {
    const msg = applyPreTalk(state, ctx, kind)
    state.preTalkLog = logPreTalk(state.preTalkLog, true)
    return msg
  }
  // this silence counted with the ones before it, past the two a room forgives
  const k = silenceWeight(logPreTalk(state.preTalkLog, false))
  let msg: string | null = null
  if (k > 0) {
    const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
    const opp = mine === ctx.home ? ctx.away : ctx.home
    const s = talkSettingFor(state, ctx, mine, opp)
    const reads = silenceReads(state, mine.lineup.slice(0, 23), s, ctx.fx.id, talkListen(state), k)
    ctx.preReads = reads
    mine.talkShift = new Map(reads.map(x => [x.pid, x.after - x.before]))
    landTalk(state, ctx, mine, reads, 0, false, s.exp)
    // the assistant says it once, plainly; the reactions say the rest
    const n = (hashString(`${state.seed}:${ctx.fx.id}:pre:silent`) % TALK_LINES) + 1
    msg = t(`tt.pre_silent${n}`)
  }
  state.preTalkLog = logPreTalk(state.preTalkLog, false)
  return msg
}

/** Half-time team talk for the user's side. One per match. Read against the
 *  scoreline, and against whatever the pre-match talk left in each man; part
 *  of the pre-match reaction is still in the legs (PRE_CARRY). */
export function applyTeamTalk(state: GameState, ctx: LiveCtx, kind: HtTone): string {
  if (ctx.talkUsed) return t('touch.talkGiven')
  ctx.talkUsed = true
  if (!HT_TONES.includes(kind)) return ''
  ctx.htTone = kind
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  const opp = mine === ctx.home ? ctx.away : ctx.home
  const s = talkSettingFor(state, ctx, mine, opp, mine.score - opp.score)
  // the men still in it: anyone already replaced has nothing left to give
  const ids = mine.lineup.slice(0, 23).filter((id): id is number => id != null && (mine.onPitch.has(id) || !mine.ratings.has(id)))
  const reads = talkReads(state, ids, s, kind, ctx.fx.id, talkListen(state), mine.talkShift)
  ctx.htReads = reads
  landTalk(state, ctx, mine, reads, PRE_CARRY, kind === 'fire', s.exp)
  return talkLine(state, ctx, kind, 'ht', roomVerdict(reads))
}

/** Substitution for the user's side (MAX_SUBS tactical subs), any time play is stopped. */
export function makeSubstitution(state: GameState, ctx: LiveCtx, outId: number, inId: number): string {
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  if (ctx.seg === 3) return t('touch.matchOver')
  if (ctx.subsUsed >= MAX_SUBS) return t('touch.allSubsUsed', { n: MAX_SUBS })
  const slotOut = mine.lineup.indexOf(outId)
  const slotIn = mine.lineup.indexOf(inId)
  const pin = state.players[inId]
  const pout = state.players[outId]
  if (slotOut < 0 || slotOut > 14 || !pout) return t('touch.notInStartingXV')
  // Law 3: a side may not replace a sin-binned player during his ten minutes
  if (mine.binned.has(outId)) return t('touch.inTheBin')
  // AND A MAN WHO IS NOT OUT THERE CANNOT BE REPLACED AT ALL.
  //
  // A sending-off and a Law 3.20 removal both leave a shirt in the starting XV
  // with nobody wearing it, and every check above passed for that shirt: the
  // number is in the lineup, the man exists, the bench is fit. So taking it off
  // deleted a player who was not on the pitch (a no-op) and added one who now
  // was, and a side that should have finished with fourteen men finished with
  // fifteen - carrying its full strength through the twenty minutes the red
  // card was supposed to cost it.
  //
  // Found by scripts/journeyprobe.ts counting the men on the pitch at full time
  // against the men the card accounted for.
  if (!mine.onPitch.has(outId)) return t('touch.notOnPitch')
  // A MAN WHO HAS BEEN REPLACED DOES NOT COME BACK ON (1.8.1). Anybody with
  // a mark has played; he was only refused here while still on the pitch, so
  // a starter taken off could return as a tactical change with a fresh bench
  // tank. The MatchDay screen never offered him, but the rule belongs in the
  // engine, where every caller meets it. The sin bin and the HIA bring men
  // back through their own paths, not this one.
  if (!pin || pin.injury || mine.ratings.has(inId)) return t('touch.notAvailable')
  // only a man on the bench, and only one who is allowed to play (1.6.3: the
  // call accepted any id, so a suspended man or a man not in the 23 could come
  // on if a caller named him, scripts/qa/banned.ts)
  // (a Test side's whole bench is on national duty by definition, so the
  // call-up check only applies when the side being coached is a club)
  if (slotIn < 15 || pin.bans > 0 || (pin.natSquad && !!state.clubs[mine.teamId])) return t('touch.notAvailable')
  // shirts 1 to 3 take a trained front-rower while there is one on the bench
  if (!isFrontRower(pin) && needsFrontRower(state, mine, outId)) return t('touch.frontRowOnly')
  mine.lineup[slotOut] = inId
  if (slotIn >= 0) mine.lineup[slotIn] = outId
  mine.onPitch.delete(outId)
  mine.onPitch.add(inId)
  cameOn(mine, inId, Math.min(79, Math.max(1, ctx.lastMin)))
  if (!mine.ratings.has(inId)) mine.ratings.set(inId, 6)
  mine.energy.set(inId, benchTank(pin))
  ctx.subsUsed += 1
  fieldChanged(state, ctx, mine, ctx.lastMin)
  const min = Math.min(79, Math.max(1, ctx.lastMin))
  // the brief he was given, and the bill if the shirt does not fit him (F4)
  const briefsBefore = mine.briefsUsed ?? 0
  const coverBefore = !!mine.coverBlown
  const brief = applyBrief(state, mine, inId)
  forcedSwitchCost(state, ctx, mine, outId, pin, min)
  // nobody trained was left for the front-row shirt: uncontested from here
  if (slotOut <= 2 && !isFrontRower(pin)) frontRowGap(state, ctx, mine, min, pout)
  // remembered until play resumes, so this exact change can be taken back
  ctx.lastSub = {
    outId, inId,
    briefed: (mine.briefsUsed ?? 0) > briefsBefore,
    blewCover: !coverBefore && !!mine.coverBlown,
  }
  pushLine(state, ctx, min, 'SUB', mine, 'comm.subFromBench',
    { on: pin.name, off: pout.name, brief_k: brief ?? 'common.nothing' }, pin.id)
  return t('touch.willComeOn', { on: pin.name, off: pout.name })
}

/** Override the man the assistant sent on to cover an injury.
 *
 *  The engine has to fill the hole itself the instant a man breaks down: the
 *  same code runs for the fourteen AI sides and for Instant Result, where
 *  nobody is watching. So for a serious injury the UI stops the clock, shows the
 *  match-day squad and lets this undo the assistant's pick.
 *
 *  It is free. The injury forced the change, so charging a tactical replacement
 *  for disagreeing about who covers would be a punishment for paying attention.
 *  Only legal while the replacement has not yet played a minute, which is why
 *  the UI only offers it at the moment of the injury. */
export function swapInjuryCover(state: GameState, ctx: LiveCtx, onId: number, inId: number): string {
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  if (ctx.seg === 3) return t('touch.matchOver')
  if (mine.hia && mine.hia.subId === onId) return swapHiaCover(state, ctx, mine, onId, inId)
  const slotOn = mine.lineup.indexOf(onId)
  const slotIn = mine.lineup.indexOf(inId)
  const pon = state.players[onId]
  const pin = state.players[inId]
  if (slotOn < 0 || slotOn > 14 || !pon || !mine.onPitch.has(onId)) return t('touch.notOnPitch')
  if (!pin || pin.injury || mine.onPitch.has(inId) || mine.ratings.has(inId)) return t('touch.notAvailable')
  /**
   * HE CANNOT BE ERASED ONCE HE HAS PLAYED (coverswap, 1.8.0).
   *
   * The rewrite at the bottom of this function corrects ONE line - the one
   * that said he came on - on the stated assumption that the override arrives
   * at the same stoppage, before a tick has run. Nothing enforced that
   * assumption. A cover who had been on for ten minutes and scored could be
   * taken back off, out of the lineup and out of onPitch, while his try stayed
   * in the match record under his name: a permanent, saved account of a man
   * scoring in a game he did not play in.
   *
   * The window closes the moment he does something. Anything after his own
   * substitution line that carries his id is him doing something.
   */
  const evs = ctx.events
  let subIdx = -1
  for (let i = evs.length - 1; i >= 0; i--) {
    if (evs[i].k === 'comm.subComesOn' && evs[i].playerId === onId) { subIdx = i; break }
  }
  // THE STOPPAGE'S OWN LINES ARE NOT HIM PLAYING (owner, round 6). A back-rower
  // went down with no back-rower on the bench, the assistant sent a back on, and
  // the engine wrote "playing out of position" under the substitution, at the
  // same stoppage, carrying the new man's id. That line read as "he has done
  // something", so every other name the manager tapped was refused as too late:
  // the one injury he most needed to answer was the one he could not. The
  // stoppage ends where the engine says it does (lastInj.upTo); only a line
  // after that is the cover playing.
  const inj = mine.lastInj && mine.lastInj.coverId === onId ? mine.lastInj : null
  if (subIdx >= 0) {
    for (let i = Math.max(subIdx + 1, inj ? inj.upTo : 0); i < evs.length; i++) {
      if (evs[i].playerId === onId) return t('touch.tooLateToUndo')
    }
  }
  // the front row wants a trained front-rower while there is one (needsFrontRower):
  // the assistant's own pick counts, because a swap sends him back to the bench
  if (!isFrontRower(pin) && needsFrontRower(state, mine, onId, onId)) return t('touch.frontRowOnly')
  // and the stoppage's "out of position" line named the man who is now going
  // back to the bench: it is the record, so it goes with him (the charge is
  // refunded and re-tested below, and a new line is written if it still applies)
  if (inj) {
    for (let i = inj.upTo - 1; i > subIdx && i >= 0; i--) {
      if (evs[i].k === 'comm.outOfCover' && evs[i].playerId === onId) { evs.splice(i, 1); inj.upTo -= 1 }
    }
  }
  mine.lineup[slotOn] = inId
  if (slotIn >= 0) mine.lineup[slotIn] = onId
  mine.onPitch.delete(onId)
  mine.onPitch.add(inId)
  cameOn(mine, inId, mine.onAt?.get(onId) ?? Math.min(79, Math.max(1, ctx.lastMin)))
  // He never actually got on, so he goes back to being a bench option rather
  // than carrying a rating for a cameo that did not happen.
  mine.ratings.delete(onId)
  mine.energy.delete(onId)
  mine.ratings.set(inId, 6)
  mine.energy.set(inId, benchTank(pin))
  // and the minutes he was on the pitch are the other man's, from the same
  // moment, because as far as the match is concerned it was always him
  const from = mine.since?.get(onId)
  if (from != null) { mine.since!.delete(onId); mine.since!.set(inId, from) }
  fieldChanged(state, ctx, mine, ctx.lastMin)
  const min = Math.min(79, Math.max(1, ctx.lastMin))
  // A better cover pick can undo the shortage the assistant walked into, so the
  // bill charged a moment ago is refunded exactly and then re-tested (F4). Only
  // the cover charge is reversed: briefs and the bench reshape stand.
  if (mine.coverBlown) {
    mine.coverBlown = false
    // 1/0.96 here for months against a 0.937 charge: every refund left a
    // permanent 2.4% defensive hole the comment above swore did not exist.
    // The constants are the single source of truth now (audit 16D).
    layer(mine, 'attack', 1 / COVER_ATT)
    layer(mine, 'defence', 1 / COVER_DEF)
  }
  const brief = applyBrief(state, mine, inId)
  forcedSwitchCost(state, ctx, mine, onId, pin, min)
  // nobody trained was left for a front-row shirt: uncontested from here
  if (slotOn <= 2 && !isFrontRower(pin)) frontRowGap(state, ctx, mine, min, inj ? state.players[inj.hurtId] : pon)
  if (inj) inj.coverId = inId
  // THE MAN WHO NEVER GOT ON IS NOT IN THE COMMENTARY (owner, from a real
  // match: "I overrode the suggestion and chose someone else but the
  // commentary still mentioned the original player").
  //
  // The assistant's pick was written into the ticker the instant the injury
  // happened, and that line is not a display list - it is the match record,
  // saved with the fixture and read back on the report screen. Appending "change
  // of plan" under it left a running account of a substitution that did not
  // happen, in the record, for ever. The override is made at the same stoppage
  // and before a tick has run, so the honest thing is that the earlier line
  // names the man who actually came on. Searched from the end, because the
  // assistant may have made an earlier change in the same match.
  const line = [...ctx.events].reverse().find(e => e.k === 'comm.subComesOn' && e.playerId === onId)
  if (line) {
    line.playerId = pin.id
    line.v = { ...line.v, player: pin.name, brief_k: brief ?? 'common.nothing' }
    line.text = tIn('en', 'comm.subComesOn', line.v as Record<string, string | number>)
  } else {
    // no line to correct - a resumed save, or a change made before one was
    // written - so say it as it happens instead
    pushLine(state, ctx, min, 'SUB', mine, 'comm.subChangeOfPlan',
      { on: pin.name, off: pon.name, brief_k: brief ?? 'common.nothing' }, pin.id)
  }
  return t('touch.takesShirtInstead', { on: pin.name, off: pon.name })
}

/** A HEAD ASSESSMENT'S STAND-IN, CHANGED (1.9.2, owner: "Make sure its clear
 *  that the manager always has to decide who to pick from the bench"). The
 *  assessed man keeps his name on the shirt while the doctors work, so his
 *  stand-in has no shirt of his own (fieldLineup puts him in it for the
 *  engine): the change is who is on the pitch, not who is in the lineup. The
 *  man picked here is the one who gives the shirt back if the assessment is
 *  passed, or keeps it if it is failed. Free, and only at the stoppage. */
function swapHiaCover(state: GameState, ctx: LiveCtx, mine: SideCtx, onId: number, inId: number): string {
  const h = mine.hia!
  const pon = state.players[onId]
  const pin = state.players[inId]
  const hurt = state.players[h.pid]
  if (!pon || !mine.onPitch.has(onId)) return t('touch.notOnPitch')
  if (!pin || pin.injury || mine.onPitch.has(inId) || mine.ratings.has(inId) || mine.lineup.indexOf(inId) < 15) return t('touch.notAvailable')
  if (h.upTo == null || h.atTick == null || ctx.tick !== h.atTick) return t('touch.tooLateToUndo')
  for (let i = h.upTo; i < ctx.events.length; i++) {
    if (ctx.events[i].playerId === onId) return t('touch.tooLateToUndo')
  }
  // a front-rower stands in for a front-rower while one is on the bench
  if (hurt && isFrontRower(hurt) && isFrontRower(pon) && !isFrontRower(pin)) return t('touch.frontRowOnly')
  mine.onPitch.delete(onId)
  mine.onPitch.add(inId)
  cameOn(mine, inId, mine.onAt?.get(onId) ?? Math.min(79, Math.max(1, ctx.lastMin)))
  mine.ratings.delete(onId)
  mine.energy.delete(onId)
  mine.ratings.set(inId, 6)
  mine.energy.set(inId, benchTank(pin))
  const from = mine.since?.get(onId)
  if (from != null) { mine.since!.delete(onId); mine.since!.set(inId, from) }
  h.subId = inId
  // the assessment line named the assistant's pick: it is the record, so it
  // names the man who actually went on
  const hl = [...ctx.events].reverse().find(e => (e.k === 'comm.hiaLedAway' || e.k === 'comm.hiaMouthguard') && e.v?.sub === pon.name)
  if (hl?.k) {
    hl.v = { ...hl.v, sub: pin.name }
    hl.text = tIn('en', hl.k, hl.v as Record<string, string | number>)
  }
  fieldChanged(state, ctx, mine, ctx.lastMin)
  return t('touch.takesShirtInstead', { on: pin.name, off: pon.name })
}

/** Take back the last tactical substitution, at the same stoppage it was made
 *  (16B, user: "i made a substitution but selected the wrong player, i couldnt
 *  undo it and I lost the player"). The replacement never played a second, so
 *  he goes back to being a bench option - same treatment as swapping injury
 *  cover - and the change gives back everything it took: the replacement slot,
 *  the brief it spent, the cover charge it blew. Play resuming closes the
 *  window: a man who has played a tick cannot be un-played. */
export function undoSubstitution(state: GameState, ctx: LiveCtx): string {
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  const u = ctx.lastSub
  if (!u) return t('touch.nothingToUndo')
  if (ctx.seg === 3) return t('touch.matchOver')
  const { outId, inId } = u
  const slotIn = mine.lineup.indexOf(inId)
  const slotOut = mine.lineup.indexOf(outId)
  const pout = state.players[outId]
  const pin = state.players[inId]
  if (slotIn < 0 || slotIn > 14 || !pout || pout.injury) { ctx.lastSub = null; return t('touch.tooLateToUndo') }
  mine.lineup[slotIn] = outId
  if (slotOut >= 0) mine.lineup[slotOut] = inId
  mine.onPitch.delete(inId)
  mine.onPitch.add(outId)
  mine.onAt?.delete(inId)
  // he never actually got on, so he carries no rating for a cameo that did
  // not happen and burns no replacement
  mine.ratings.delete(inId)
  mine.energy.delete(inId)
  ctx.subsUsed -= 1
  if (u.briefed) {
    const club = state.clubs[mine.teamId]
    const seat = mine.seatOf.get(inId)
    const b = club && seat != null ? briefForSeat(club, seat) : 'orders'
    if (b === 'impact') { layer(mine, 'attack', 1 / 1.025); layer(mine, 'defence', 1 / 0.99) }
    else if (b === 'shore') { layer(mine, 'defence', 1 / 1.025); layer(mine, 'attack', 1 / 0.99); layer(mine, 'card', 1 / 0.96) }
    else if (b === 'manage') { layer(mine, 'kicking', 1 / 1.03); layer(mine, 'attack', 1 / 0.995); layer(mine, 'tempo', 1 / 0.97) }
    mine.briefsUsed = Math.max(0, (mine.briefsUsed ?? 1) - 1)
  }
  if (u.blewCover && mine.coverBlown) {
    mine.coverBlown = false
    layer(mine, 'attack', 1 / COVER_ATT)
    layer(mine, 'defence', 1 / COVER_DEF)
  }
  // he never played a second, so his stint closes empty (play has not
  // resumed, so the clock has not moved since he came on)
  fieldChanged(state, ctx, mine, ctx.lastMin)
  ctx.lastSub = null
  const min = Math.min(79, Math.max(1, ctx.lastMin))
  pushLine(state, ctx, min, 'SUB', mine, pin ? 'comm.subUndoneNamed' : 'comm.subUndone',
    { off: pout.name, on: pin?.name ?? '' }, pout.id)
  return t('touch.staysOn', { player: pout.name })
}

/** Swap two on-pitch men's shirts (16B, user: "i want to be able to swap
 *  players positions if they are in the 15. so swap the 12 and 13 over").
 *  A positional switch, not a replacement: costs nothing, burns nothing, and
 *  the units are rebuilt so the shape change genuinely reaches the pitch. */
export function swapShirts(state: GameState, ctx: LiveCtx, aId: number, bId: number): string {
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  if (ctx.seg === 3) return t('touch.matchOver')
  const ai = mine.lineup.indexOf(aId)
  const bi = mine.lineup.indexOf(bId)
  const pa = state.players[aId]
  const pb = state.players[bId]
  if (ai < 0 || ai > 14 || bi < 0 || bi > 14 || !pa || !pb) return t('touch.bothInXV')
  if (!mine.onPitch.has(aId) || !mine.onPitch.has(bId)) return t('touch.bothOnPitch')
  mine.lineup[ai] = bId
  mine.lineup[bi] = aId
  // a switch after an undo would otherwise resurrect a stale record
  ctx.lastSub = null
  recomputeSideUnits(state, ctx, mine)
  const min = Math.min(79, Math.max(1, ctx.lastMin))
  pushLine(state, ctx, min, 'SUB', mine, 'comm.shirtSwap',
    { team: teamShort(state, mine.teamId), a: pa.name, b: pb.name }, pa.id)
  return t('touch.swapPositions', { a: pa.name, b: pb.name })
}

/** Apply the user's (possibly changed) tactic sliders mid-match. */
export function applyTacticsChange(state: GameState, ctx: LiveCtx) {
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  recomputeSideUnits(state, ctx, mine)
}
