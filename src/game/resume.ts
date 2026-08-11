/**
 * ---- A LIVE MATCH SURVIVES A RELOAD ----
 *
 * The reported problem: "I was playing a game and I dragged my finger down and it
 * restarted the game." The pull-to-refresh gesture is fixed, but the underlying
 * fault was worse than the gesture. A live match lived only in the zustand store,
 * so any reload - a refresh, a phone killing a backgrounded tab, a browser update -
 * threw the match away. On a phone, where the browser reclaims tabs whenever it
 * likes, that is a game you cannot trust with an hour of your evening.
 *
 * ---- WHY THIS REPLAYS RATHER THAN SERIALISES ----
 *
 * The obvious approach is to write the live match state down. It does not work,
 * and the reason is worth recording: a match in progress has ALREADY CHANGED THE
 * SAVE. Tries, points, cards, red-card bans and injuries are written to the
 * players as they happen, not at full-time (matchEngine.ts, in the tick path).
 * Serialising the match context alone would restore the match and lose those; and
 * writing the whole 7MB save on every tick is not something to do to a phone
 * twenty times a match.
 *
 * So this replays. At kick-off the pre-match save is written down once, together
 * with the fixture and the pre-match talk. From then on the only thing recorded is
 * a short list: which tick the match has reached, and every decision the manager
 * made, tagged with the tick he made it on. On load, the pre-match save is
 * restored and the match is played forward through the same code with the same
 * inputs - so the tries, the cards, the injuries and the commentary all come back
 * because they are generated again, identically.
 *
 * That identity is not an assumption. It is the property scripts/replayprobe.ts
 * exists to hold: the same fixture played twice produces the same events, the same
 * scores, the same ratings and the same man of the match, and the first N ticks of
 * a match are a true prefix of the whole thing. The determinism fix that made it
 * true (a rating jitter that was reading a module-level counter) landed first for
 * exactly this reason.
 *
 * ---- THE FAILURE MODE TO FEAR ----
 *
 * A desync is silent. If a command is applied at the wrong tick the match simply
 * carries on with a different score, and nobody can tell it was ever wrong. That
 * is what scripts/resumeprobe.ts is for: it plays matches with scripted
 * interventions, cuts them off at several different points, resumes, and compares
 * the whole event stream against the match that was never interrupted.
 */
import type { Fixture, GameState } from './model'
import {
  applyPreTalk, applyTacticsChange, applyTeamTalk, beginMatch, makeSubstitution,
  resolveDecision, stepTick, swapInjuryCover, swapShirts, undoSubstitution, type LiveCtx,
} from './matchEngine'
import { weekRng } from './season'

/**
 * Everything the manager can do to a match in progress.
 *
 * The body and the timestamp are separate types on purpose: Omit<> over a
 * discriminated union collapses it to the keys the members share, so
 * `Omit<MatchCmd, 'at'>` would accept nothing but `kind`.
 */
export type MatchCmdBody =
  | { kind: 'decide'; choice: 'posts' | 'corner' | 'tap' }
  | { kind: 'talk'; talk: 'fire' | 'calm' | 'praise' | 'demand' }
  | { kind: 'sub'; outId: number; inId: number }
  | { kind: 'cover'; onId: number; inId: number }
  | { kind: 'undo' }
  | { kind: 'swap'; aId: number; bId: number }
  /** the tactic dials AS THEY WERE when he changed them: the pre-match save holds
   *  the old values, so replaying "he opened the tactics board" is not enough */
  | { kind: 'dials'; style: number; tempo: number; kicking: number; aggression: number }

/** A command with the tick it was issued on. */
export type MatchCmd = MatchCmdBody & { at: number }

export interface MatchResume {
  /** bumped when the shape changes, so a stale record is discarded not misread */
  v: 1
  /** the pre-match save, before beginMatch touched anything */
  pre: GameState
  fxId: number
  userSideId: string | null
  preTalk: 'calm' | 'fire' | 'underdog' | 'expect' | null
  mode: 'full' | 'highlights'
  /** how far the match has been simulated */
  tick: number
  /** how much of the commentary the manager had read */
  cursor: number
  cmds: MatchCmd[]
  /** for the "is this record about the save I just loaded" check */
  season: number
  week: number
  savedAt: number
}

/** The shape of a live match, rebuilt. */
export interface Resumed {
  ctx: LiveCtx
  fixture: Fixture
  preTalkMsg: string | null
  talkMsg: string | null
}

/**
 * Replay a recorded match on top of its own pre-match save.
 *
 * `state` must be the record's `pre` (already migrated and loaded). It is mutated,
 * exactly as playing the match the first time mutated it.
 */
export function replayMatch(state: GameState, rec: MatchResume): Resumed | null {
  const fx = state.fixtures.find(f => f.id === rec.fxId)
  if (!fx || fx.played) return null

  const ctx = beginMatch(state, fx, weekRng(state), true, rec.userSideId)
  const preTalkMsg = rec.preTalk ? applyPreTalk(state, ctx, rec.preTalk) : null
  let talkMsg: string | null = null

  // Commands are applied at the tick they were made on, in the order they were
  // made. A decision arises DURING a tick and is answered before the next one, so
  // "at tick t" means "after tick t was simulated, before tick t+1".
  const cmds = [...rec.cmds].sort((a, b) => a.at - b.at)
  let next = 0
  const applyUpTo = (t: number) => {
    while (next < cmds.length && cmds[next].at <= t) {
      const c = cmds[next++]
      switch (c.kind) {
        case 'decide':
          if (ctx.decision) resolveDecision(state, ctx, c.choice)
          break
        case 'talk':
          talkMsg = applyTeamTalk(state, ctx, c.talk)
          break
        case 'sub':
          makeSubstitution(state, ctx, c.outId, c.inId)
          break
        case 'cover':
          swapInjuryCover(state, ctx, c.onId, c.inId)
          break
        case 'undo':
          undoSubstitution(state, ctx)
          break
        case 'swap':
          swapShirts(state, ctx, c.aId, c.bId)
          break
        case 'dials': {
          const club = state.clubs[state.userClubId]
          if (club) {
            club.tactic.style = c.style
            club.tactic.tempo = c.tempo
            club.tactic.kicking = c.kicking
            club.tactic.aggression = c.aggression
            applyTacticsChange(state, ctx)
          }
          break
        }
      }
    }
  }

  // anything recorded before a ball was kicked
  applyUpTo(0)
  // then tick forward, answering each tick's decisions as they were answered
  const target = Math.max(0, Math.min(20, Math.floor(rec.tick)))
  let guard = 0
  while (ctx.tick < target && ctx.seg < 3 && guard++ < 40) {
    stepTick(state, ctx)
    applyUpTo(ctx.tick)
  }
  return { ctx, fixture: fx, preTalkMsg, talkMsg }
}

/** Is this record worth offering, for the save that was just loaded? */
export function resumeFits(rec: MatchResume | null | undefined, state: GameState): boolean {
  if (!rec || rec.v !== 1) return false
  if (rec.season !== state.season || rec.week !== state.week) return false
  const fx = state.fixtures.find(f => f.id === rec.fxId)
  // if the fixture has since been played, the match finished without this record
  return !!fx && !fx.played && rec.tick > 0
}
