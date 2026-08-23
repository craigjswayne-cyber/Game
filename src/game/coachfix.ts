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
 *
 *   READ AT FULL TIME, NEVER WRITTEN DOWN. Only the TAGS reach the save
 *     (game.fixHw, so next week can mark the homework); every sentence is
 *     rebuilt from them each time the card renders, which is why a verdict
 *     written in English can be re-read in French. See docs/i18n.md.
 */
import type { GameState, Tactic } from './model'
import { MAX_SUBS } from './matchEngine'
import type { LiveCtx, SideCtx } from './matchEngine'
import { t } from './i18n'

/** MAX_SUBS as a word for prose, so the advice can never disagree with the
 *  engine's cap again. Falls back to digits if the cap ever outgrows the list. */
const capWord = () => MAX_SUBS <= 10 ? t(`coachfix.num${MAX_SUBS}`) : String(MAX_SUBS)

export type UnitKey = 'scrum' | 'lineout' | 'breakdown'

export interface UnitBattle {
  key: UnitKey
  label: string
  /** share of the contest won, 22-78 */
  pct: number
  /** a token, not a phrase: 'dominated' | 'edged' | 'even' | 'shaded' | 'bullied'.
   *  The screen builds the whole half-sentence from it, because 'we edged it' and
   *  'ils l'ont emporté de peu' do not put the subject in the same place. */
  verdict: string
}

/** keys, not words - MatchDay calls t() on them */
const UNIT_LABEL: Record<UnitKey, string> = {
  scrum: 'matchday.h2hScrum', lineout: 'matchday.h2hLineout', breakdown: 'matchday.h2hBreakdown',
}
const UNIT_LOWER: Record<UnitKey, string> = {
  scrum: 'coachfix.unitScrumLower', lineout: 'coachfix.unitLineoutLower', breakdown: 'coachfix.unitBreakdownLower',
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
    const verdict = pct >= 57 ? 'dominated' : pct >= 52 ? 'edged' : pct > 48 ? 'even'
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
  setpiece: 'coachfix.fixSetpiece',
  discipline: 'coachfix.fixDiscipline',
  attack: 'coachfix.fixAttack',
  territory: 'coachfix.fixTerritory',
  kicking: 'coachfix.fixKicking',
  fitness: 'coachfix.fixFitness',
  admin: 'coachfix.fixAdmin',
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
    // (`tag`, not `t`: t() is the translator and a shadow here would be silent)
    fixed: prev.filter(tag => tag !== 'admin' && !open.has(tag)),
    missed: prev.filter(tag => tag !== 'admin' && open.has(tag)),
  }
}

/** One line of English for a grade, or null when there is nothing to report. */
export function gradeLine(fixed: readonly FixTag[], missed: readonly FixTag[]): string | null {
  // `tag`, not `t`: t() is the translator
  const list = (ts: readonly FixTag[]) => ts.map(tag => t(FIX_LABEL[tag])).join(t('coachfix.gradeJoin'))
  // the labels are written to sit mid-sentence ("we asked about the set piece"),
  // so one that opens a sentence needs its capital. Caught by fixprobe reading
  // its own output: "two things. the set piece is sorted."
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  if (fixed.length && missed.length) {
    return t('coachfix.gradeBoth', { fixed: cap(list(fixed)), missed: cap(list(missed)) })
  }
  if (fixed.length) {
    return fixed.length > 1
      ? t('coachfix.gradeAllDone', { fixed: list(fixed) })
      : t('coachfix.gradeOneDone', { fixed: cap(list(fixed)) })
  }
  if (missed.length) {
    return missed.length > 1
      ? t('coachfix.gradeBothMissed', { missed: cap(list(missed)) })
      : t('coachfix.gradeOneMissed', { missed: list(missed) })
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
      scrum: 'coachfix.howScrum', lineout: 'coachfix.howLineout', breakdown: 'coachfix.howBreakdown',
    }
    c.push({
      tag: 'setpiece', score: (50 - worst.pct) * 2.2,
      head: t('coachfix.spHead', {
        unit: t(worst.label), pct: worst.pct,
        verdict: t(worst.verdict === 'bullied' ? 'coachfix.spBullied' : 'coachfix.spShaded'),
      }),
      how: t(how[worst.key]),
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
    const who = first?.name
    c.push({
      tag: 'discipline', score: reds * 62 + yellows * 24,
      head: reds
        ? (who ? t('coachfix.discRedWho', { player: who }) : t('coachfix.discRed'))
        : yellows === 1
          ? (who ? t('coachfix.discYcWho', { player: who }) : t('coachfix.discYc'))
          : t('coachfix.discYcMany', { n: yellows, mins: yellows * 10 }),
      how: tactic && tactic.aggression >= 55
        ? t('coachfix.discHowHigh', { n: tactic.aggression })
        : t('coachfix.discHowLow'),
    })
  }

  // ---- all the ball, none of the points --------------------------------------
  if (poss >= 53 && mine.tries <= 1) {
    c.push({
      tag: 'attack', score: (poss - 50) * 1.4 + (2 - mine.tries) * 9,
      head: t(mine.tries === 1 ? 'coachfix.attHeadOne' : 'coachfix.attHeadNone', { poss }),
      how: tactic && tactic.style <= 45
        ? t('coachfix.attHowNarrow', { n: tactic.style })
        : t('coachfix.attHowWide'),
    })
  }

  // ---- starved of it instead -------------------------------------------------
  if (poss <= 44) {
    c.push({
      tag: 'territory', score: (48 - poss) * 1.8,
      head: t('coachfix.terrHead', { poss }),
      how: tactic && tactic.kicking >= 55
        ? t('coachfix.terrHowKick', { n: tactic.kicking })
        : t('coachfix.terrHowElse'),
    })
  }

  // ---- the last twenty ------------------------------------------------------
  const oppAt60 = scoreAt(ctx, 60, !isHome)
  const lateAgainst = opp.score - oppAt60
  if (lateAgainst >= 10) {
    c.push({
      tag: 'fitness', score: lateAgainst * 2.4,
      head: t('coachfix.lateHead', { n: lateAgainst }),
      how: ctx.subsUsed <= 2
        ? t('coachfix.lateHowFew', {
          changes: ctx.subsUsed === 0 ? t('coachfix.lateNone') : t('coachfix.lateSome', { n: ctx.subsUsed }),
        })
        : t('coachfix.lateHowMany'),
    })
  }

  // ---- the tee ---------------------------------------------------------------
  const myTries = ctx.events.filter(e => e.type === 'TRY' && e.teamId === mine.teamId).length
  const myCons = ctx.events.filter(e => e.type === 'CON' && e.teamId === mine.teamId).length
  const missed = Math.max(0, myTries - myCons)
  if (missed >= 2 || (missed === 1 && Math.abs(margin) <= 2)) {
    c.push({
      tag: 'kicking', score: missed * 11 + (Math.abs(margin) <= 2 ? 12 : 0),
      head: missed === 1 ? t('coachfix.teeHeadOne') : t('coachfix.teeHeadMany', { n: missed }),
      how: t('coachfix.teeHow'),
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
  // Three or more used, against a bench of eight rather than the old five: the
  // complaint is about a manager who HAS gone to his bench and is still being
  // out-run, not about one who has barely started.
  if (ctx.subsUsed >= 3 && theirTank - tank >= 20) {
    c.push({
      tag: 'fitness', score: (theirTank - tank) * 1.1,
      head: t('coachfix.tankHead', { subs: ctx.subsUsed, mine: Math.round(tank), theirs: Math.round(theirTank) }),
      how: t('coachfix.tankHow'),
    })
  }

  // ---- the bench you paid for -----------------------------------------------
  // The count comes from MAX_SUBS, not prose. This line said "out of five" for
  // two rounds after the bench grew to eight (F4), because the number lived in a
  // sentence where no compiler could see it. Found by the RC battery, not a
  // player, which is pure luck: the advice was telling a manager he had five
  // changes when three more sat behind them.
  // AND THE ADVICE HAS TO MATCH THE MEASUREMENT. This told the manager to empty
  // the bench - all eight changes - and emptying the bench measured 2.5 points a
  // match WORSE than making none. A hint system that recommends a loss is worse
  // than no hint system, because the player trusts it. The engine's freshness
  // band has been widened so the changes are worth making; the number it names
  // is now the number that wins.
  if (ctx.subsUsed < 2) {
    c.push({
      // the score stays where it was: this candidate shares its 'fitness' tag
      // with the late-points complaint and loses the seat to it whenever the
      // opposition scored after the hour, so dropping it made the bench line
      // stop surfacing at all (fixprobe, eight matches, never seen)
      tag: 'fitness', score: 16 - ctx.subsUsed * 5,
      // the head keeps 'out of ${CAP_WORD}' deliberately: the cap derives from
      // MAX_SUBS so the sentence cannot drift from the real bench size the way
      // 'out of five' did for two rounds after the bench grew to eight, and
      // scripts/fixprobe.ts holds it there by reading the sentence back
      head: t(ctx.subsUsed === 0 ? 'coachfix.benchHeadNone' : 'coachfix.benchHeadOne', { cap: capWord() }),
      how: t('coachfix.benchHow', { cap: capWord() }),
    })
  }

  // ---- the admin nobody has done, which is always worth saying --------------
  if (tactic) {
    const roles = (tactic.roles ?? []).filter(Boolean).length
    if (roles < 4) {
      c.push({
        tag: 'admin', score: 9 - roles,
        head: roles === 0 ? t('coachfix.rolesHeadNone') : t('coachfix.rolesHeadSome', { n: roles }),
        how: t('coachfix.rolesHow'),
      })
    }
    if (!(tactic.kickers ?? []).filter(Boolean).length) {
      c.push({
        tag: 'kicking', score: 7,
        head: t('coachfix.kickOrderHead'),
        how: t('coachfix.kickOrderHow'),
      })
    }
    if (!tactic.bench) {
      c.push({
        tag: 'admin', score: 6,
        head: t('coachfix.splitHead'),
        how: t('coachfix.splitHow'),
      })
    }
  }

  // ---- and if the side genuinely did its job, say what to protect -----------
  c.push(margin > 0 ? {
    tag: 'admin', score: 3,
    head: t('coachfix.wonHead'),
    how: t('coachfix.wonHow', {
      unit: t(UNIT_LOWER[units.slice().sort((a, b) => b.pct - a.pct)[0].key]),
    }),
  } : {
    tag: 'admin', score: 3,
    head: t('coachfix.lostHead'),
    how: t('coachfix.lostHow'),
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
