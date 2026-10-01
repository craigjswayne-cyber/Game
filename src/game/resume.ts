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
 *
 * ---- A MATCH KICKED OFF IS A MATCH TO FINISH (1.8.2) ----
 *
 * Tester note 1.4: losing, closing the game and opening it again threw the
 * match away, because opening a career from the title cleared this record, and
 * a record at 0' was not offered at all. So a result could be rerolled. The
 * owner's decision was that it must not be. Now:
 *
 *   the record is offered from the moment play is pressed (resumeFits);
 *   every way into a career looks for it (store.setGame, store.resume), in its
 *     own slot, in any other slot the same career was copied or imported into,
 *     and inside the save itself (stampedSave: what Game Status writes to a
 *     slot or a file mid-match);
 *   there is no way to discard it: it goes only when the finished career has
 *     been written (store.dropResume);
 *   and Kick Off and the assistant refuse while a match is live or being found.
 *
 * The dice were never the problem: matchRng is a function of the career and
 * the week, so the same calls always give the same match. scripts/noscumprobe.ts
 * reopens a match through the real load path at every point a player might
 * pull the plug and holds the result to the match played straight through.
 */
import type { Fixture, GameState } from './model'
import {
  openDressingRoom, applyTacticsChange, applyTeamTalk, beginMatch, makeSubstitution, playSegment,
  resolveDecision, stepTick, swapInjuryCover, swapShirts, teamShort, undoSubstitution, type LiveCtx,
} from './matchEngine'
import { matchRng, weekRng } from './season'
import { tIn } from './i18n'

/**
 * Everything the manager can do to a match in progress.
 *
 * The body and the timestamp are separate types on purpose: Omit<> over a
 * discriminated union collapses it to the keys the members share, so
 * `Omit<MatchCmd, 'at'>` would accept nothing but `kind`.
 */
export type MatchCmdBody =
  | { kind: 'decide'; choice: 'posts' | 'corner' | 'tap' }
  | { kind: 'talk'; talk: import('./teamtalk').HtTone }
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
  /** 'match' when the match was played on its own dice (matchRng, 1.8.1);
   *  absent on older records, which replay on weekRng as they were played */
  stream?: 'match'
  fxId: number
  userSideId: string | null
  preTalk: import('./teamtalk').PreTone | null
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
  /** The career the record belongs to (1.6.3). Fixture ids are minted from
   *  the same counter in every career, so season, week and fixture id alone
   *  matched a record from one career against a different career in the same
   *  slot (scripts/qa/crossrec.ts), and a refresh restored the wrong manager's
   *  pre-match state over the real save. Absent on records written before
   *  1.6.3, which therefore never fit and are cleared. */
  seed?: number
  saveName?: string
  /** the other side's name, for the title screen's "your match against X is
   *  still going" line, which has no career loaded to look it up in (1.8.2) */
  opp?: string
}

/** A record without its pre-match state: what a save carries inside itself. */
export type LiveStamp = Omit<MatchResume, 'pre'>

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

  // a record written before 1.8.1 was played on the week's dice (matchRng)
  const ctx = beginMatch(state, fx, rec.stream === 'match' ? matchRng(state) : weekRng(state), true, rec.userSideId)
  const preTalkMsg = openDressingRoom(state, ctx, rec.preTalk)
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
    // PLAY WENT ON, SO THE INTERVAL WAS LEFT. The manager pressed Start Second
    // Half (store.startSecondHalf clears this) before the tick that follows a
    // break; the replay has to do the same or a match resumed at 48' comes
    // back showing the half-time panel over the second half (1.8.2).
    if (ctx.awaiting) ctx.awaiting = null
    stepTick(state, ctx)
    applyUpTo(ctx.tick)
  }
  return { ctx, fixture: fx, preTalkMsg, talkMsg }
}

/** Is this record worth offering, for the save that was just loaded? */
export function resumeFits(rec: MatchResume | null | undefined, state: GameState): boolean {
  if (!rec || rec.v !== 1) return false
  if (rec.seed !== state.seed || rec.saveName !== state.saveName) return false
  if (rec.season !== state.season || rec.week !== state.week) return false
  const fx = state.fixtures.find(f => f.id === rec.fxId)
  // if the fixture has since been played, the match finished without this record.
  //
  // FROM THE MOMENT PLAY IS PRESSED (1.8.2). This used to ask for tick > 0, so a
  // match reloaded before its first simulated minute was thrown away and could
  // be kicked off again with a different team talk, a different view or the
  // assistant in charge. A record exists because the manager kicked off; that is
  // the point after which the match is his to finish, not to restart.
  return !!fx && !fx.played && typeof rec.tick === 'number' && rec.tick >= 0
}

/** The same career, whatever else has happened to it since. */
export function sameCareer(rec: { seed?: number; saveName?: string } | null | undefined, state: GameState): boolean {
  return !!rec && rec.seed === state.seed && rec.saveName === state.saveName
}

/** How far a record has got, for choosing the furthest of several copies of
 *  the same match (one per slot it was saved into, and one inside a save). */
export function recordReach(rec: Pick<MatchResume, 'cmds' | 'tick' | 'cursor'>): number {
  return (rec.cmds?.length ?? 0) * 1e6 + (rec.tick ?? 0) * 1e3 + Math.min(999, rec.cursor ?? 0)
}

/**
 * ---- A SAVE WRITTEN MID-MATCH CARRIES THE MATCH (1.8.2) ----
 *
 * The game in memory during a match is neither the pre-match save nor the
 * finished one: the engine has already written tries, cards and injuries onto
 * the players. The Game Status screen's save-to-slot, Export and Share used to
 * write it as it stood, and the copy reopened as an unplayed fixture on a squad
 * already carrying half a match of injuries, to be kicked off again from zero.
 *
 * What they write instead is the pre-match save with the match stamped inside
 * it: the fixture, the talk, the view and every call the manager has made so
 * far. Opened anywhere, on this device or another, the stamp is replayed and
 * the match carries on from the same minute with the same result.
 */
export function stampedSave(rec: MatchResume): GameState {
  const { pre, ...small } = rec
  return { ...pre, liveRec: JSON.parse(JSON.stringify(small)) as LiveStamp }
}

/** The record a stamped save carries, with the save itself as its pre-match
 *  state, or null if it carries none. */
export function stampedRecord(state: GameState): MatchResume | null {
  const stamp = state.liveRec
  if (!stamp || typeof stamp !== 'object' || stamp.v !== 1) return null
  const pre = JSON.parse(JSON.stringify(state)) as GameState
  delete pre.liveRec
  return { ...stamp, pre }
}

/**
 * ---- A MATCH LEFT RUNNING IS PLAYED OUT ON THE WAY BACK IN (round 5) ----
 *
 * Owner: "When you load into the game again it should always load into the
 * Home page. If it was during the match, the match needs to be completed."
 *
 * So a match that comes back from a record is no longer put back on the
 * screen. It is replayed to the minute it had reached (replayMatch, with
 * every call the manager made, at the tick he made it), and from there the
 * assistant has it, exactly as he has a match handed to him before kick-off
 * (store.instantResult, season.simMatch): he makes the changes from the bench,
 * every kickable penalty goes to the posts, and the intervals pass without a
 * talk. Nothing here draws on anything but the match's own dice (matchRng,
 * carried in ctx), so a record reopened twice plays out to the same result
 * twice, and a record reopened at the kick-off plays out to exactly the
 * assistant's instant result.
 *
 * The caller settles a knockout tie at the whistle and turns the week, once:
 * see store.resumeLiveMatch.
 */
export function playOut(state: GameState, ctx: LiveCtx): void {
  // nobody is on the touchline any more
  ctx.assistantSubs = true
  let guard = 0
  while (ctx.seg < 3 && guard++ < 12) playSegment(state, ctx)
  // a last kick still in the manager's hands at the whistle
  if (ctx.decision) resolveDecision(state, ctx, 'posts')
  ctx.awaiting = null
}

/** The inbox's word on it: the match was left running and has been finished.
 *  Filed in English with its key, like every story (model.ts NewsItem). */
export function notePlayedOut(state: GameState, fx: Fixture, fromMin: number): void {
  const v = {
    home: teamShort(state, fx.homeId), away: teamShort(state, fx.awayId),
    hs: fx.homeScore ?? 0, as: fx.awayScore ?? 0, min: Math.max(0, Math.min(80, Math.round(fromMin))),
  }
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
    subject: tIn('en', 'news.playedOutSubj', v), body: tIn('en', 'news.playedOut', v),
    k: 'news.playedOut', v,
  })
}
