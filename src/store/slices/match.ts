import { saveQueue } from '../saveQueue'
import { isSettling, landOnNextWeek, settleWeek, settleWeekAsync, slicedSettles } from '../week'
import { countForPro, nextHighlight, settleKnockout } from '../live'
import { onMatchDay } from '../nav'
import { t } from '../../game/i18n'
import { matchRng, userMatchThisWeek } from '../../game/season'
import { resultsParam } from '../../game/schedule'
import {
  openDressingRoom, applyTacticsChange, applyTeamTalk, beginMatch, makeSubstitution, swapInjuryCover, coverInjury, swapShirts, undoSubstitution,
  playHalf, resolveDecision, stepTick, teamName, forfeitSide, settleForfeit,
} from '../../game/matchEngine'
import { clearResume, getResume, migrate, peekResumes, putResume } from '../../game/save'
import {
  notePlayedOut, playOut, recordReach, replayMatch, resumeFits, sameCareer, stampedRecord, stampedSave,
  type LiveStamp, type MatchCmdBody, type MatchResume,
} from '../../game/resume'
import { fileFindings } from '../../game/matchfindings'
import { fileEvidence } from '../../game/evidence'
import { noteUse } from '../../game/usage'
import type { GetState, SetState, Store } from '../types'

export const matchSlice = (set: SetState, get: GetState) => ({
  liveMatch: null,
  matchRec: null,
  resuming: false,

  /**
   * Finish a match that was in progress when the page went away.
   *
   * Replays the recorded match on top of its own pre-match save, so the tries,
   * the cards and the injuries come back because they happen again. Returns true
   * if a match was found and played out (round 5: it is no longer put back
   * on screen; see the comment where it is played out).
   */
  resumeLiveMatch: async () => {
    const slot = get().saveSlot
    const g = get().game
    if (!g) return false
    // EVERY COPY OF THIS MATCH, WHEREVER IT IS (1.8.2). The record in this slot;
    // a record in any other slot the same career was saved into or imported
    // from; and the stamp inside the save itself, which is how a file exported
    // mid-match carries its match to another slot or another device.
    const peeks = await peekResumes<LiveStamp>().catch(() => [])
    if (get().game !== g) return false
    type Cand = { rec: LiveStamp; from: string | null; hasPre: boolean }
    const cands: Cand[] = []
    for (const p of peeks) {
      if (resumeFits(p.rec as MatchResume, g)) cands.push({ rec: p.rec, from: p.slot, hasPre: p.hasPre })
      // this career's own record for a match that has since been finished and
      // written: nothing left to hold. Another career's record is left alone,
      // unless it predates 1.6.3 and carries no career stamp, which can never
      // fit anything again.
      else if (p.slot === slot && (sameCareer(p.rec, g) || p.rec.seed == null)) void clearResume(slot).catch(() => {})
    }
    const stamped = stampedRecord(g)
    if (stamped && resumeFits(stamped, g)) cands.push({ rec: stamped, from: null, hasPre: true })
    delete g.liveRec
    if (!cands.length) return false
    // the copy that got furthest; this slot's own record wins a tie
    cands.sort((a, b) => recordReach(b.rec) - recordReach(a.rec)
      || Number(b.from === slot) - Number(a.from === slot))
    for (const c of cands) {
      let rec: MatchResume | null = c.from === null ? c.rec as MatchResume
        : c.hasPre ? await getResume<MatchResume>(c.from).catch(() => null) : null
      if (get().game !== g) return false
      // THE CALLS SURVIVED AND THE PRE-MATCH STATE DID NOT. Settle from the
      // career that was opened, which is the career as it stood before kick-off
      // (the career slot is never written mid-match), on the same dice and the
      // same recorded calls. Never a fresh match.
      if (!rec) rec = { ...(c.rec as LiveStamp), pre: structuredClone(g) }
      if (!resumeFits(rec, g)) continue
      const base = migrate(rec.pre)
      delete base.liveRec
      // kept untouched for a later copy to another slot or a file; the replay
      // below mutates `base`, exactly as the match mutated the career
      const clean = structuredClone(base)
      const out = replayMatch(base, rec)
      if (!out) continue
      const own: MatchResume = { ...rec, pre: clean }
      // THE RECORD GOES DOWN IN THIS SLOT BEFORE ANYTHING ELSE. If the
      // process dies between here and the finished career landing on disk,
      // the next open finds this record and plays the same match out to the
      // same whistle; nothing in between can be reopened as a fresh match.
      if (c.from !== slot) await putResume(slot, own, true).catch(() => {})
      if (get().game !== g) return false
      // PLAYED OUT, NOT PUT BACK ON SCREEN (round 5, owner: "When you load
      // into the game again it should always load into the Home page. If it
      // was during the match, the match needs to be completed."). The minute
      // it had reached is replayed above, with every call he made; from
      // there the assistant has it (resume.ts playOut). Then exactly what
      // finishMatch does, once: the findings, the week turned, the record
      // dropped only when the finished career is on disk.
      const fromMin = out.ctx.events[out.ctx.events.length - 1]?.min ?? 0
      playOut(base, out.ctx)
      // a tie level at the whistle is settled there, as the live match does
      settleKnockout(base, out.ctx)
      fileFindings(base, out.ctx)
      fileEvidence(base, out.ctx)
      notePlayedOut(base, out.fixture, fromMin)
      countForPro(base, out.fixture)
      base.newsFrom = base.nextId
      settleWeek(base, get)
      set(s => ({ game: base, matchRec: own, liveMatch: null, resuming: false, tick: s.tick + 1 }))
      get().dropResume()
      landOnNextWeek(base, set, get, [], true)
      return true
    }
    return false
  },

  ackResume: () => {
    const lm = get().liveMatch
    if (!lm) return
    const c = lm.ctx
    const canPlay = lm.cursor < c.events.length || (!c.awaiting && !c.decision && c.seg < 3)
    set(s => s.liveMatch ? { liveMatch: { ...s.liveMatch, resumed: false, playing: canPlay }, tick: s.tick + 1 } : {})
  },

  saveCopy: () => {
    const { game, liveMatch, matchRec } = get()
    if (!game) return null
    if (liveMatch && matchRec) {
      return stampedSave({ ...matchRec, tick: liveMatch.ctx.tick, cursor: liveMatch.cursor })
    }
    return game
  },

  /** From the MatchDay preview: take the field. The match simulates
   *  tick by tick as the ticker plays, so nothing is decided yet. */
  instantResult: (preTalk, review) => {
    if (isSettling()) return
    const g = get().game
    if (!g) return
    // a match already kicked off is finished, never started again (1.8.2)
    if (get().resuming || get().liveMatch) return
    if (!onMatchDay(get)) return
    // the Annual gate, same as kickOff: the assistant cannot start a season
    // the manager has not
    if (g.annual) {
      set(s => ({
        nav: s.nav[s.nav.length - 1]?.screen === 'annual' ? s.nav : [...s.nav, { screen: 'annual' as const }],
        tick: s.tick + 1,
      }))
      return
    }
    // the Test outranks the club game - same decision point as the day walk
    const fx = userMatchThisWeek(g)
    if (!fx) return
    const isClub = fx.homeId === g.userClubId || fx.awayId === g.userClubId
    const userTeamId = isClub
      ? g.userClubId
      : (fx.homeId === g.natTeam || fx.awayId === g.natTeam) ? g.natTeam!
      : (fx.homeId === 'LIO' || fx.awayId === 'LIO') ? 'LIO'
      : g.userClubId
    // a side that cannot raise ten is a walkover, not a match (1.6.4)
    const forfeit = forfeitSide(g, fx)
    if (forfeit) settleForfeit(g, fx, forfeit)
    else {
      noteUse('instant')
      if (preTalk) noteUse('talk')
      const ctx = beginMatch(g, fx, matchRng(g), true, userTeamId)
      // the assistant has the match, so the assistant makes the changes
      ctx.assistantSubs = true
      const preTalkMsg = openDressingRoom(g, ctx, preTalk)
      playHalf(g, ctx)
      playHalf(g, ctx)
      // STRAIGHT TO THE WHISTLE, NOT PAST IT (1.8.15). From the match screen
      // the assistant's result used to turn the week at once and land on the
      // round-up, so a manager who never watched never saw why it went the
      // way it did: the three causes, the coach's two fixes and last week's
      // homework all live on the full-time card. Now the button stops there,
      // the same card a watched match ends on, and Continue to Results turns
      // the week through finishMatch (which files the findings and the
      // evidence, as below). Callers without review keep the one-step path.
      if (review) {
        set(s => ({
          liveMatch: {
            ctx, fixture: fx, events: ctx.events, cursor: ctx.events.length, playing: false, speed: 1,
            mode: 'full', done: true, talkMsg: null, preTalkMsg,
          },
          tick: s.tick + 1,
        }))
        return
      }
      // the tactical loop's findings, before the week turns (#181)
      fileFindings(g, ctx)
      fileEvidence(g, ctx)
    }
    countForPro(g, fx)
    const resultsKey = resultsParam(fx.compId, g.week)
    // Exactly what finishMatch does, and for the same reason. This used to set
    // its own watermark aside and then push every new story of the week into the
    // Wire in one go, which meant a week played through the assistant was
    // revealed all at once while the same week watched on the pitch was revealed
    // a day at a time. Measured over a season of instant results: 30 bulletins
    // across 36 weeks, because the Wire had already read and cleared the stories
    // Monday to Friday were meant to carry. The day walk is the reveal now, both
    // ways round; the round-up still comes first, with Monday under it.
    g.newsFrom = g.nextId
    const landed = () => {
      set(s => ({ liveMatch: null, tick: s.tick + 1 }))
      get().dropResume()
      landOnNextWeek(g, set, get, [{ screen: 'results', param: resultsKey }])
    }
    if (slicedSettles()) return settleWeekAsync(g, get).then(landed)
    settleWeek(g, get)
    landed()
  },

  kickOff: (preTalk, mode) => {
    if (isSettling()) return
    const g = get().game
    if (!g) return
    if (get().resuming || get().liveMatch) return
    if (!onMatchDay(get)) return
    // THE ANNUAL GATE HOLDS HERE TOO (user: "i haven't pressed new season yet
    // but its restarted in the background"). Continue was gated, but a match
    // is its own door: the Team screen's MATCHDAY button reaches the new
    // season's friendly with the Annual still up, and finishMatch turns the
    // week - so three quick pre-season kick-offs played 2026-27 to week 4
    // behind a page whose whole promise is that nothing starts without the
    // button. Same reroute as Continue: the tap lands you on the Annual.
    if (g.annual) {
      set(s => ({
        nav: s.nav[s.nav.length - 1]?.screen === 'annual' ? s.nav : [...s.nav, { screen: 'annual' as const }],
        tick: s.tick + 1,
      }))
      return
    }
    // the Test outranks the club game - same decision point as the day walk
    const fx = userMatchThisWeek(g)
    if (!fx) return
    const isClub = fx.homeId === g.userClubId || fx.awayId === g.userClubId
    const userTeamId = isClub
      ? g.userClubId
      : (fx.homeId === g.natTeam || fx.awayId === g.natTeam) ? g.natTeam!
      : (fx.homeId === 'LIO' || fx.awayId === 'LIO') ? 'LIO'
      : g.userClubId
    // THE PRE-MATCH SAVE, TAKEN BEFORE THE ENGINE TOUCHES ANYTHING.
    //
    // beginMatch mutates: it may tidy a team sheet, and from the first tick the
    // engine writes tries, cards, bans and injuries onto the players. A resume
    // replays the match from here rather than trying to serialise it half-played
    // (see game/resume.ts). This is the one 7MB write per match; everything after
    // it is a short command list.
    // a side that cannot raise ten is a walkover, not a match to watch (1.6.4):
    // settle it and turn the week the way the assistant's result does
    const forfeit = forfeitSide(g, fx)
    if (forfeit) {
      settleForfeit(g, fx, forfeit)
      countForPro(g, fx)
      const resultsKey = resultsParam(fx.compId, g.week)
      g.newsFrom = g.nextId
      settleWeek(g, get)
      set(s => ({ liveMatch: null, tick: s.tick + 1 }))
      get().dropResume()
      landOnNextWeek(g, set, get, [{ screen: 'results', param: resultsKey }])
      return
    }
    noteUse('watched')
    if (preTalk) noteUse('talk')
    // structuredClone, not a JSON round trip (1.9.1): the same copy IndexedDB
    // would make, at a fraction of the main-thread time on a 7MB career
    const pre = structuredClone(g)
    const ctx = beginMatch(g, fx, matchRng(g), true, userTeamId)
    // he is watching, so his injuries wait for his pick (1.9.1)
    ctx.manualInj = true
    // spoken or not, the room is opened once (teamtalk.ts, SAYING NOTHING)
    const preTalkMsg = openDressingRoom(g, ctx, preTalk)
    const rec: MatchResume = {
      v: 1, pre, stream: 'match', inj: 'manual', fxId: fx.id, userSideId: userTeamId, preTalk: preTalk ?? null,
      mode: mode ?? 'full', tick: 0, cursor: 0, cmds: [],
      season: g.season, week: g.week, savedAt: Date.now(),
      seed: g.seed, saveName: g.saveName,
      opp: teamName(g, fx.homeId === userTeamId ? fx.awayId : fx.homeId),
    }
    set(s => ({
      liveMatch: {
        ctx, fixture: fx, events: ctx.events, cursor: 0, playing: true, speed: 1,
        mode: mode ?? 'full', done: false, talkMsg: null, preTalkMsg,
      },
      matchRec: rec,
      tick: s.tick + 1,
    }))
    // the one write that carries the 7MB state; every later write is the
    // short record (save.ts putResume, 1.6.3)
    //
    // AFTER THE MATCH SCREEN HAS PAINTED (1.9.1 performance re-audit). put()
    // copies the whole career on the main thread, and in the kick-off tap it
    // sat between the button and the match appearing. One frame later the
    // screen is up; the record written then is the latest one, so a line the
    // ticker has already noted is not overwritten by the kick-off copy.
    const slot = get().saveSlot
    const writePre = () => { const latest = get().matchRec; if (latest) void putResume(slot, latest, true).catch(() => {}) }
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(writePre, 0))
    else writePre()
  },

  /** Note a decision the manager made, against the tick he made it on, and put
   *  the short record back on disk. Never writes the 7MB half. */
  noteCmd: (cmd: MatchCmdBody) => {
    const { matchRec: resume, liveMatch, saveSlot } = get()
    if (!resume || !liveMatch) return
    const rec: MatchResume = {
      ...resume,
      tick: liveMatch.ctx.tick,
      cursor: liveMatch.cursor,
      cmds: [...resume.cmds, { ...cmd, at: liveMatch.ctx.tick }],
    }
    set({ matchRec: rec })
    void putResume(saveSlot, rec).catch(() => {})
  },

  /** How far the match has got. Called as the clock moves, so it writes only the
   *  small record and never more than once a tick. */
  noteProgress: () => {
    const { matchRec: resume, liveMatch, saveSlot } = get()
    if (!resume || !liveMatch) return
    if (resume.tick === liveMatch.ctx.tick && resume.cursor === liveMatch.cursor) return
    const rec: MatchResume = { ...resume, tick: liveMatch.ctx.tick, cursor: liveMatch.cursor }
    set({ matchRec: rec })
    void putResume(saveSlot, rec).catch(() => {})
  },

  /** The match is over: the record must not outlive it, and must not die
   *  before it either.
   *
   *  ONLY ONCE THE FINISHED CAREER IS ON DISK (1.8.2). This used to clear the
   *  record at once and leave the career itself to the save queue's idle timer,
   *  so for 600ms after Continue the disk held the pre-match save and no match
   *  in progress: close the game in that window and the match came back
   *  unplayed, to be kicked off again. Now the career is written first and the
   *  record goes only when that write has landed. A failed write keeps the
   *  record, and the next open replays the same match to the same whistle. */
  dropResume: () => {
    const slot = get().saveSlot
    set({ matchRec: null })
    if (!get().game) { void clearResume(slot).catch(() => {}); return }
    void (async () => {
      // after whatever set() the caller makes next, since the queue will not
      // write while a live match is in the store
      await Promise.resolve()
      // the record is the only copy of the match until the finished career is
      // on disk: a held or failed write keeps it (1.9.1 re-audit, N1)
      const wrote = await saveQueue.flush()
      const s = get()
      if (!wrote || s.liveMatch || s.saveFail || s.saveSlot !== slot) return
      await clearResume(slot)
    })().catch(() => {})
  },

  /** One heartbeat of the live match: reveal the next event, or simulate
   *  the next 4 minutes when the ticker has caught up. */
  advanceLive: () => {
    const { game, liveMatch } = get()
    if (!game || !liveMatch || !liveMatch.playing) return
    const { ctx } = liveMatch
    let cursor = liveMatch.cursor
    if (cursor < ctx.events.length) {
      // Highlights mode (F5): run straight to the next moment that matters
      // rather than reading out every ruck. The filler lines are still in the
      // log, so the full commentary is there at full-time for anyone who wants
      // it - this only changes what the ticker stops on.
      const step = liveMatch.mode === 'highlights'
        ? nextHighlight(ctx.events, cursor, liveMatch.fixture.homeId)
        : cursor + 1
      // NO TICK FOR A REVEAL (1.9.1). The line was simulated already, so the
      // career has not changed: only the screens that read liveMatch need to
      // draw, not the whole app shell under them, once per commentary line.
      set(s => s.liveMatch ? { liveMatch: { ...s.liveMatch, cursor: step } } : {})
      // THE REVEAL IS PROGRESS TOO. This branch used to return without writing
      // the record, so while the ticker read out a simulation burst the screen
      // ran ahead of what was on disk - and a reload mid-reveal came back a
      // try and a minute short of what the manager was looking at (main run
      // 32856568841: reloadprobe, 33-25 on screen, 33-20 after the refresh).
      // The record is small and noteProgress already runs once per simulated
      // tick, so once per revealed event is the same accepted cost.
      get().noteProgress()
      return
    }
    // a man down and waiting for the manager's pick holds the clock too (1.9.1)
    if (ctx.awaiting || ctx.seg === 3 || ctx.decision || ctx.injWait?.length) {
      set(s => s.liveMatch ? { liveMatch: { ...s.liveMatch, playing: false, done: ctx.seg === 3 }, tick: s.tick + 1 } : {})
      return
    }
    // simulate until something new happens, a decision is needed, or a break
    let r: ReturnType<typeof stepTick> = 'play'
    while (ctx.events.length <= cursor && r === 'play' && !ctx.decision && !ctx.injWait?.length) {
      r = stepTick(game, ctx)
    }
    // NOT WHILE A KICK IS STILL IN THE MANAGER'S HANDS. A cup tie level at
    // the whistle with a kickable penalty pending is not a draw yet: decide()
    // settles it once the answer is in (releaseaudit.ts, 1.2b).
    if (r === 'FT' && !ctx.decision) settleKnockout(game, ctx)
    if (ctx.events.length > cursor) cursor += 1
    // the match view follows liveMatch; the app shell around it shows nothing
    // a simulated minute changes, so it is not redrawn for one (1.9.1)
    set(s => s.liveMatch ? { liveMatch: { ...s.liveMatch, cursor } } : {})
    // where the match has got to, so a reload comes back to the same minute
    get().noteProgress()
  },

  simAhead: () => {
    const { game, liveMatch } = get()
    if (!game || !liveMatch) return
    const { ctx, cursor } = liveMatch
    if (cursor < ctx.events.length || ctx.awaiting || ctx.seg === 3 || ctx.decision || ctx.injWait?.length) return
    // the same loop advanceLive runs, stopping short of revealing the line
    let r: ReturnType<typeof stepTick> = 'play'
    while (ctx.events.length <= cursor && r === 'play' && !ctx.decision && !ctx.injWait?.length) r = stepTick(game, ctx)
    if (r === 'FT' && !ctx.decision) settleKnockout(game, ctx)
    set(s => s.liveMatch ? { liveMatch: { ...s.liveMatch } } : {})
    get().noteProgress()
  },

  /** Fast-forward the rest of the current period (to HT, 60' or FT).
   *  Pending penalty calls default to taking the points. */
  skipToBreak: () => {
    const { game, liveMatch } = get()
    if (!game || !liveMatch) return
    const { ctx } = liveMatch
    let r: ReturnType<typeof stepTick> = 'play'
    // EVERY DECISION THIS TAKES ON THE MANAGER'S BEHALF IS STILL A DECISION, and a
    // resume has to make the same ones. Skipping ahead answers each kickable
    // penalty with 'posts'; if those went unrecorded the replay would stop at the
    // first one waiting for an answer that never came, and the match would drift.
    let took = 0
    const noted = (choice: 'posts') => { took++; get().noteCmd({ kind: 'decide', choice }) }
    while (!ctx.awaiting && ctx.seg < 3) {
      if (ctx.decision) { noted('posts'); resolveDecision(game, ctx, 'posts') }
      r = stepTick(game, ctx)
      if (ctx.decision) { noted('posts'); resolveDecision(game, ctx, 'posts') }
      if (r !== 'play') break
    }
    if (r === 'FT' && !ctx.decision) settleKnockout(game, ctx)
    set(s => s.liveMatch ? {
      liveMatch: { ...s.liveMatch, cursor: ctx.events.length, playing: false, done: ctx.seg === 3, skipTook: took },
      tick: s.tick + 1,
    } : {})
    get().noteProgress()
  },

  /** The touchline call on a kickable penalty. */
  decide: (choice) => {
    const { game, liveMatch } = get()
    if (!game || !liveMatch || !liveMatch.ctx.decision) return ''
    get().noteCmd({ kind: 'decide', choice })
    const msg = resolveDecision(game, liveMatch.ctx, choice)
    // the last kick of the match has been taken: a tie can now be settled
    if (liveMatch.ctx.seg === 3) settleKnockout(game, liveMatch.ctx)
    set(s => s.liveMatch ? {
      liveMatch: { ...s.liveMatch, playing: true },
      tick: s.tick + 1,
    } : {})
    return msg
  },

  teamTalk: (kind) => {
    const { game, liveMatch } = get()
    if (!game || !liveMatch || liveMatch.ctx.awaiting !== 'HT') return
    get().noteCmd({ kind: 'talk', talk: kind })
    noteUse('talk')
    const msg = applyTeamTalk(game, liveMatch.ctx, kind)
    set(s => ({ liveMatch: s.liveMatch ? { ...s.liveMatch, talkMsg: msg } : null, tick: s.tick + 1 }))
  },

  halfTimeSub: (outId, inId) => {
    const { game, liveMatch } = get()
    if (!game || !liveMatch || liveMatch.ctx.seg >= 3) return t('touch.playResumed')
    // The cursor has to follow the new commentary line, or the panel you made
    // the change from disappears underneath you.
    //
    // makeSubstitution pushes a "change from the bench" event, and liveMatch.events
    // IS ctx.events - the same array. So the push made events.length one greater
    // than the cursor, MatchDay's `caughtUp` went false, and with it atHalfTime,
    // panelActive and the whole half-time panel: one sub and you were thrown back
    // to the pitch view with the interval over. That is the bug behind "the quick
    // sub doesn't work well" - it was never the dropdowns, it was that a second
    // change was impossible because the room closed after the first.
    const wasCaughtUp = liveMatch.cursor >= liveMatch.ctx.events.length
    get().noteCmd({ kind: 'sub', outId, inId })
    noteUse('sub')
    const msg = makeSubstitution(game, liveMatch.ctx, outId, inId)
    set(s => ({
      liveMatch: s.liveMatch && wasCaughtUp
        ? { ...s.liveMatch, cursor: s.liveMatch.ctx.events.length }
        : s.liveMatch,
      tick: s.tick + 1,
    }))
    return msg
  },

  injuryCover: (onId, inId) => {
    const { game, liveMatch } = get()
    if (!game || !liveMatch || liveMatch.ctx.seg >= 3) return t('touch.playResumed')
    get().noteCmd({ kind: 'cover', onId, inId })
    const msg = swapInjuryCover(game, liveMatch.ctx, onId, inId)
    set(s => ({ tick: s.tick + 1 }))
    return msg
  },

  injuryPick: (hurtId, inId) => {
    const { game, liveMatch } = get()
    if (!game || !liveMatch || liveMatch.ctx.seg >= 3) return t('touch.playResumed')
    const wasCaughtUp = liveMatch.cursor >= liveMatch.ctx.events.length
    const msg = coverInjury(game, liveMatch.ctx, hurtId, inId)
    // only a change that happened is a command: a refused tap replays as nothing
    if (!msg) get().noteCmd({ kind: 'inj', hurtId, inId })
    set(s => ({
      liveMatch: s.liveMatch && wasCaughtUp && !msg
        ? { ...s.liveMatch, cursor: s.liveMatch.ctx.events.length }
        : s.liveMatch,
      tick: s.tick + 1,
    }))
    return msg
  },

  undoSub: () => {
    const { game, liveMatch } = get()
    if (!game || !liveMatch || liveMatch.ctx.seg >= 3) return t('touch.playResumed')
    // same cursor discipline as halfTimeSub: the undo pushes its own line
    const wasCaughtUp = liveMatch.cursor >= liveMatch.ctx.events.length
    get().noteCmd({ kind: 'undo' })
    const msg = undoSubstitution(game, liveMatch.ctx)
    set(s => ({
      liveMatch: s.liveMatch && wasCaughtUp
        ? { ...s.liveMatch, cursor: s.liveMatch.ctx.events.length }
        : s.liveMatch,
      tick: s.tick + 1,
    }))
    return msg
  },

  swapPositions: (aId, bId) => {
    const { game, liveMatch } = get()
    if (!game || !liveMatch || liveMatch.ctx.seg >= 3) return t('touch.playResumed')
    const wasCaughtUp = liveMatch.cursor >= liveMatch.ctx.events.length
    get().noteCmd({ kind: 'swap', aId, bId })
    const msg = swapShirts(game, liveMatch.ctx, aId, bId)
    set(s => ({
      liveMatch: s.liveMatch && wasCaughtUp
        ? { ...s.liveMatch, cursor: s.liveMatch.ctx.events.length }
        : s.liveMatch,
      tick: s.tick + 1,
    }))
    return msg
  },

  /** Re-read the tactic sliders mid-match - allowed at any stoppage. */
  liveTactics: () => {
    const { game, liveMatch } = get()
    if (!game || !liveMatch || liveMatch.ctx.seg >= 3) return
    if (liveMatch.ctx.userSideId !== game.userClubId) return // Test match: no club tactic board
    // the dial VALUES, not the fact that he opened the board: the pre-match save
    // still holds whatever they were before he moved them
    const t = game.clubs[game.userClubId].tactic
    get().noteCmd({ kind: 'dials', style: t.style, tempo: t.tempo, kicking: t.kicking, aggression: t.aggression })
    noteUse('liveTactics')
    applyTacticsChange(game, liveMatch.ctx)
    set(s => ({ tick: s.tick + 1 }))
  },

  /** Resume after an interval: HT -> third quarter, 60' -> final quarter. */
  startSecondHalf: () => {
    const { game, liveMatch } = get()
    if (!game || !liveMatch || liveMatch.ctx.seg >= 3) return
    liveMatch.ctx.awaiting = null
    set(s => ({
      liveMatch: s.liveMatch ? { ...s.liveMatch, playing: true, done: false, skipTook: 0 } : null,
      tick: s.tick + 1,
    }))
  },

  matchCursor: (cursor, playing) => {
    set(s => s.liveMatch ? ({ liveMatch: { ...s.liveMatch, cursor, playing } }) : {})
    // the ticker can move without the clock moving, and a reload should come back
    // to the line he had read, not just the minute
    get().noteProgress()
  },

  matchMode: (mode) => {
    const { game, liveMatch } = get()
    if (!liveMatch) return
    // remembered for the competition too, so switching mid-match is also a
    // standing answer for next week rather than a one-off. Written here, not
    // inside the set() updater, which must not change anything it is handed.
    if (game) game.viewPref = { ...(game.viewPref ?? {}), [liveMatch.fixture.compId]: mode }
    set(s => (s.liveMatch ? { liveMatch: { ...s.liveMatch, mode }, tick: s.tick + 1 } : {}))
    // viewPref is on GameState and is meant to be a STANDING answer - the
    // comment above says so - but nothing wrote it, so "remembered for the
    // competition" lasted until the next reload. Named by the external audit.
    void get().persist()
  },

  /** After FT: process the rest of the week and return home. */
  finishMatch: () => {
    if (isSettling()) return
    const g = get().game
    const live = get().liveMatch
    // ONE TAP, ONE WEEK (1.8.15). Two taps landing in one frame on Continue to
    // Results each called this, and the second, with the match already gone,
    // turned a second week. Instant Result now ends on this button too.
    if (!g || !live) return
    const resultsKey = live ? resultsParam(live.fixture.compId, g.week) : null
    // the tactical loop's findings and the evidence, before the week turns (#181)
    if (live) {
      fileFindings(g, live.ctx)
      fileEvidence(g, live.ctx)
      countForPro(g, live.fixture)
    }
    g.newsFrom = g.nextId
    const landed = () => {
      set(s => ({ liveMatch: null, tick: s.tick + 1 }))
      get().dropResume()
      // The full-time round-up still comes first - that is the moment you want
      // straight after your own final whistle - and Monday's bulletin sits under
      // it, so backing out of the round-up puts you at the start of the new week
      // rather than nowhere.
      landOnNextWeek(g, set, get, resultsKey ? [{ screen: 'results', param: resultsKey }] : [])
    }
    if (slicedSettles()) return settleWeekAsync(g, get).then(landed)
    settleWeek(g, get)
    landed()
  },
} satisfies Partial<Store>)
