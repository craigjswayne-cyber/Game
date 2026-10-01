/**
 * ---- THE DREAM: the reason this save exists ----
 *
 * The design review's verdict on v1.0.1 was that the game has depth and no
 * ARC: forty systems, and nothing anywhere that says why you are playing THIS
 * career rather than any other. Board objectives are homework - assigned,
 * seasonal, forgotten in June. A Dream is the opposite: the manager names it
 * himself at the start, it sits on the Home screen for as long as the save
 * lives, and every May is measured against it.
 *
 * Five rules this file keeps:
 *
 *   1. A DREAM IS CHOSEN, NEVER ASSIGNED. The wizard offers the ones that make
 *      sense for the club you picked; the player takes one. That is the whole
 *      psychological trick - an assigned goal is a chore and a chosen one is an
 *      identity.
 *   2. PROGRESS IS COMPUTED, NEVER STORED. Every dream reads its own progress
 *      out of the save. Nothing to migrate, nothing to keep in sync, and an
 *      imported save from before dreams existed simply has none.
 *   3. IT IS HONEST WHEN IT IS GOING BADLY. The note says "still in the
 *      Championship", not "1 of 2 steps complete". A progress line that
 *      flatters is a progress line nobody believes.
 *   4. NO DREAM IS UNREACHABLE AND NONE IS FREE. Each one is several seasons of
 *      real work at the club it is offered to, and each one can actually be
 *      finished - a goal you cannot complete is a treadmill.
 *   5. THE ENGINE NEVER READS IT. A dream does not change a single simulated
 *      number: no bonus for chasing it, no penalty for ignoring it. It is a
 *      lens on the save, so it cannot move the fingerprint or the balance.
 */
import { LEAGUE_TIER } from './model'
import type { GameState } from './model'
import { t, tIn, type Vars } from './i18n'
import { W, genderOf, genderOfId, isWomensId, type Gender } from './gender'

/**
 * THE CONTINENTAL COMPETITION HAS A DIFFERENT NAME IN EACH WORLD, AND THE
 * DREAMS THAT NAME IT HAVE TO SAY THE RIGHT ONE.
 *
 * Both worlds build a competition with the id 'cc' - deliberately, so every
 * dream, award and trophy count can mean "the continental cup of this game" -
 * but the men's is the Continental Cup and the women's is the Hemispheric
 * Championship, and two dreams had the men's name written into their English.
 * A women's manager was offered "Win the Continental Cup" for a competition
 * her world does not call that, and "Win the league and Europe" for a
 * tournament that spans the Pacific and the Celtic provinces and has nothing
 * to do with Europe at all. Reported from a wizard screenshot at Loughborough.
 *
 * Returned as a KEY rather than a name, so the fragment is translated like
 * everything else: `{cup_k}` in a dream string is looked up in the reader's
 * language (i18n.ts fill()). Handing over the English name would put English
 * back inside a French sentence, which is the one thing this whole mechanism
 * exists to stop.
 */
const cupKey = (gender: Gender): string => (gender === 'w' ? 'dream.cupWomen' : 'dream.cupMen')

/** What the wizard knows when it offers the choice: no GameState exists yet. */
export interface DreamContext {
  clubId: string
  clubName: string
  leagueId: string
  rep: number
}

export interface DreamProgress {
  /** how far along, in the dream's own units */
  at: number
  /** how far there is to go */
  goal: number
  /** The honest state of it, as a key and the values that fill it. A note is
   *  a sentence and it is written into the season review, which is kept for
   *  the life of the career - so it travels as a key, and dreamNote() renders
   *  it in whatever language the reader has chosen this year. */
  noteK: string
  noteV?: Vars
  done: boolean
}

export interface DreamDef {
  id: string
  /** The ambition, as the manager would say it out loud - a key, filled by
   *  titleVars where the wording names his club. */
  titleK: string
  /** The same ambition phrased for the middle of a sentence. The CV line used
   *  to lowercase the title, which is right in English and impossible anywhere
   *  else: lowercasing an English sentence gives a lowercase English one. */
  titleLowerK: string
  titleVars?: (ctx: DreamContext) => Vars
  /** NO LONGER OFFERED (owner, round 6: the wizard keeps the first eight).
   *  A retired dream is never put in front of a manager again, by the wizard
   *  or the Legacy refocus, but its definition stays: a save that already
   *  named it still reads its title and its progress. */
  retired?: true
  /** THE COMPETITIONS THIS DREAM CANNOT BE FINISHED WITHOUT.
   *
   *  Declared rather than left inside progress(), because a dependency hidden
   *  in a closure is a dependency nothing can check. The women's world builds
   *  no Continental Cup and no World Championship - newgame.ts gates all three
   *  behind `if (gender !== 'w')` - so "Win the Continental Cup" and "Win the
   *  league and Europe" and "Coach a nation to the World Championship" were
   *  offered to women's managers as career-defining ambitions that could never
   *  complete, counting trophies in a competition their world does not hold.
   *  Reported from a real wizard screenshot at a Championship club.
   *
   *  dreamsFor() now refuses to offer a dream whose competitions are absent,
   *  and scripts/worldparity.ts holds every world to it. */
  needs?: readonly string[]
  /** offered only where it means something */
  applies: (ctx: DreamContext) => boolean
  /** `clubId` is the club the ambition was named about; absent, the dream's */
  progress: (state: GameState, clubId?: string) => DreamProgress
}

/** The ambition in the reader's language. */
export const dreamTitle = (def: DreamDef, ctx: DreamContext): string => t(def.titleK, def.titleVars?.(ctx))
/** And phrased for the middle of a sentence. */
export const dreamTitleLower = (def: DreamDef, ctx: DreamContext): string => t(def.titleLowerK, def.titleVars?.(ctx))
/** Where the dream stands, in the reader's language. */
export const dreamNote = (p: { noteK: string; noteV?: Vars }): string => t(p.noteK, p.noteV)

/** The club the dream was declared about, which is not always where you work now. */
const dreamClub = (state: GameState, clubId?: string): string => clubId ?? state.dream?.clubId ?? state.userClubId

/** Trophies of one competition, optionally at one club. */
const won = (state: GameState, compId: string, clubId?: string) =>
  state.mgr.trophies.filter(t =>
    t.compId === compId && (clubId == null || t.clubId == null || t.clubId === clubId)).length

/**
 * Where a league sits, for the dreams. LEAGUE_TIER carries only the men's
 * pyramid, and the dreams read an unknown league as a top flight, so the
 * women's Championship and Division 2 were offered "do the double with {club}"
 * for a club that can never enter the continental cup: the women's leagues are
 * ringfenced, so it cannot go up, and the double has to be won with this club.
 */
const W_SECOND_TIER = [W + 'champ', W + 'e2']
const W_LEAGUES = [W + 'pwr', W + 'pac', W + 'e1', W + 'celt', ...W_SECOND_TIER]
const dreamTier = (leagueId: string): number => LEAGUE_TIER[leagueId] ?? (W_SECOND_TIER.includes(leagueId) ? 2 : 1)

/** The seasons the manager won a league title, at one club or anywhere. A
 *  league title is the league's trophy: in a play-off league that is the
 *  final, not first place in the table, so a side that topped the table and
 *  lost the final has not won the league. */
const leagueTitleSeasons = (state: GameState, clubId?: string): number[] =>
  [...new Set(state.mgr.trophies
    .filter(t => (LEAGUE_TIER[t.compId] != null || W_LEAGUES.includes(t.compId)) &&
      (clubId == null || t.clubId == null || t.clubId === clubId))
    .map(t => t.season))].sort((a, b) => a - b)

/** Seasons the dream club has spent in a top-flight league under this manager. */
const topFlightSeasons = (state: GameState, clubId?: string): number => {
  const club = dreamClub(state, clubId)
  return state.mgr.finishes.filter(f => LEAGUE_TIER[f.leagueId] === 1 && (f.clubId == null || f.clubId === club)).length
}

export const DREAMS: DreamDef[] = [
  {
    id: 'topflight',
    titleK: 'dream.topflight', titleLowerK: 'dream.topflightLower',
    titleVars: ctx => ({ club: ctx.clubName }),
    // only a club that is not already there can dream of getting there
    // Not offered in the women's world: its leagues are ringfenced (RELEGATES,
    // model.ts), so a club below the top flight has no road up to dream of.
    applies: ctx => (LEAGUE_TIER[ctx.leagueId] ?? 1) > 1,
    progress: (state, clubId) => {
      const seasons = topFlightSeasons(state, clubId)
      const club = state.clubs[dreamClub(state, clubId)]
      const upNow = club && LEAGUE_TIER[club.leagueId] === 1
      return {
        at: Math.min(2, seasons),
        goal: 2,
        noteK: seasons >= 2 ? 'dream.topflightEstablished'
          : seasons === 1 ? 'dream.topflightOneSeason'
          : upNow ? 'dream.topflightPromoted'
          : club?.leagueId === 'champ' ? 'dream.topflightStillChamp'
          : 'dream.topflightStillLower',
        done: seasons >= 2,
      }
    },
  },
  {
    id: 'europe',
    titleK: 'dream.europe', titleLowerK: 'dream.europeLower',
    titleVars: ctx => ({ cup_k: cupKey(genderOfId(ctx.clubId)) }),
    needs: ['cc'],
    applies: () => true,
    progress: state => {
      const n = won(state, 'cc')
      const chc = won(state, 'chc')
      return {
        at: Math.min(1, n),
        goal: 1,
        noteK: n > 1 ? 'dream.europeWonTimes' : n > 0 ? 'dream.europeWon'
          : chc > 0 ? 'dream.europeShieldOnly'
          : 'dream.europeNotYet',
        noteV: { n },
        done: n > 0,
      }
    },
  },
  {
    id: 'double',
    titleK: 'dream.double', titleLowerK: 'dream.doubleLower',
    titleVars: ctx => ({ club: ctx.clubName, cup_k: cupKey(genderOfId(ctx.clubId)) }),
    needs: ['cc'],
    applies: ctx => dreamTier(ctx.leagueId) === 1,
    progress: (state, clubId) => {
      const club = dreamClub(state, clubId)
      const league = leagueTitleSeasons(state, club).length > 0 ? 1 : 0
      const euro = won(state, 'cc', club) > 0 ? 1 : 0
      const have = league + euro
      return {
        at: have,
        goal: 2,
        noteK: have === 2 ? 'dream.doubleBoth'
          : have === 1 ? (league ? 'dream.doubleLeagueDone' : 'dream.doubleEuropeDone')
          : 'dream.doubleNeither',
        // the note names the cup too, and a note travels on its own into the
        // Home card - so it carries the fragment rather than relying on the
        // title's copy of it
        noteV: { cup_k: cupKey(genderOf(state)) },
        done: have === 2,
      }
    },
  },
  {
    id: 'dynasty',
    titleK: 'dream.dynasty', titleLowerK: 'dream.dynastyLower',
    applies: () => true,
    progress: state => {
      // the longest run of consecutive title-winning seasons on the record
      const titles = leagueTitleSeasons(state)
      let best = 0, run = 0, prev: number | null = null
      for (const s of titles) {
        run = prev != null && s === prev + 1 ? run + 1 : 1
        prev = s
        if (run > best) best = run
      }
      return {
        at: Math.min(3, best),
        goal: 3,
        noteK: best >= 3 ? 'dream.dynastyDone'
          : best === 2 ? 'dream.dynastyTwo'
          : best === 1 ? 'dream.dynastyOne'
          : 'dream.dynastyNone',
        done: best >= 3,
      }
    },
  },
  {
    id: 'academy',
    titleK: 'dream.academy', titleLowerK: 'dream.academyLower',
    applies: () => true,
    progress: state => {
      const club = state.clubs[state.userClubId]
      const n = (club?.players ?? [])
        .map(id => state.players[id])
        .filter(p => p && p.homegrown && !p.acad && p.stats.apps > 0).length
      return {
        at: Math.min(8, n),
        goal: 8,
        noteK: n >= 8 ? 'dream.academyDone'
          : n === 0 ? 'dream.academyNone'
          : 'dream.academySome',
        noteV: { n },
        done: n >= 8,
      }
    },
  },
  {
    id: 'world',
    needs: ['wc'],
    titleK: 'dream.world', titleLowerK: 'dream.worldLower',
    applies: () => true,
    progress: state => {
      const wc = won(state, 'wc')
      const hasJob = !!state.natTeam
      const everHad = hasJob || (state.natHistory?.length ?? 0) > 0
      return {
        at: wc > 0 ? 2 : everHad ? 1 : 0,
        goal: 2,
        noteK: wc > 0 ? 'dream.worldDone'
          : hasJob ? 'dream.worldInTheJob'
          : everHad ? 'dream.worldOnceHad'
          : 'dream.worldNoJob',
        done: wc > 0,
      }
    },
  },
  {
    id: 'immortal',
    titleK: 'dream.immortal', titleLowerK: 'dream.immortalLower',
    applies: () => true,
    progress: state => {
      const n = state.mgr.trophies.length
      return {
        at: Math.min(15, n),
        goal: 15,
        noteK: n === 0 ? 'dream.immortalEmpty' : 'dream.immortalCount',
        noteV: { n },
        done: n >= 15,
      }
    },
  },
  // ---- the career ambitions (arc, 1.8.2): offered beside the dreams above,
  // and a manager may name up to three at the start (ambitions.ts) ----
  {
    id: 'league',
    titleK: 'arc.dream.league', titleLowerK: 'arc.dream.leagueLower',
    applies: () => true,
    progress: state => {
      const n = leagueTitleSeasons(state).length
      return { at: Math.min(1, n), goal: 1, noteK: n ? 'arc.dream.leagueDone' : 'arc.dream.leagueNotYet', done: n > 0 }
    },
  },
  {
    id: 'bottom',
    retired: true,
    titleK: 'arc.dream.bottom', titleLowerK: 'arc.dream.bottomLower',
    titleVars: ctx => ({ club: ctx.clubName }),
    // a club with somewhere to climb from; the women's leagues are ringfenced
    applies: ctx => (LEAGUE_TIER[ctx.leagueId] ?? 1) > 1,
    progress: (state, clubId) => {
      const club = dreamClub(state, clubId)
      const rows = (state.arc?.conduct ?? []).filter(r => r.c === club)
      const now = LEAGUE_TIER[state.clubs[club]?.leagueId ?? ''] ?? 1
      const start = Math.max(now, ...rows.map(r => r.tier))
      const ups = Math.max(0, start - now)
      const settled = rows.some(r => r.tier === 1 && r.pos > 0 && r.n > 0 && r.pos <= r.n / 2) ? 1 : 0
      const goal = Math.max(1, start - 1) + 1
      const at = Math.min(goal, ups + settled)
      return {
        at, goal,
        noteK: at >= goal ? 'arc.dream.bottomDone' : now === 1 ? 'arc.dream.bottomTopFlight' : ups > 0 ? 'arc.dream.bottomClimbing' : 'arc.dream.bottomStart',
        noteV: { n: ups },
        done: at >= goal,
      }
    },
  },
  {
    id: 'legend',
    retired: true,
    titleK: 'arc.dream.legend', titleLowerK: 'arc.dream.legendLower',
    titleVars: ctx => ({ club: ctx.clubName }),
    applies: () => true,
    progress: (state, clubId) => {
      const club = dreamClub(state, clubId)
      const seasons = (state.arc?.conduct ?? []).filter(r => r.c === club).length
      const cups = state.mgr.trophies.filter(x => x.clubId === club).length
      const done = (state.legendOf ?? []).includes(club)
      return {
        at: done ? 11 : Math.min(8, seasons) + Math.min(3, cups), goal: 11,
        noteK: done ? 'arc.dream.legendDone' : 'arc.dream.legendSome',
        noteV: { n: seasons, cups },
        done,
      }
    },
  },
  {
    id: 'fallen',
    retired: true,
    titleK: 'arc.dream.fallen', titleLowerK: 'arc.dream.fallenLower',
    applies: () => true,
    progress: state => {
      // every job taken at a fallen giant, finished or not (chairman.ts profiles)
      const a = state.arc
      const jobs: { c: string; f: number }[] = []
      if (a?.cur?.prof === 'fallen') jobs.push({ c: a.cur.c, f: a.cur.f })
      for (const e of a?.eras ?? []) if (e.pf === 'fallen' && !jobs.some(j => j.c === e.c && j.f === e.f)) jobs.push({ c: e.c, f: e.f })
      let best = 0
      for (const j of jobs) {
        const rows = (a?.conduct ?? []).filter(r => r.c === j.c && r.s >= j.f && r.tier === 1 && r.pos > 0)
        let at = 1
        if (rows.some(r => r.n > 0 && r.pos <= r.n / 2)) at = 2
        if (rows.some(r => r.pos <= 4)) at = 3
        if (state.mgr.trophies.some(x => x.clubId === j.c && x.season >= j.f)) at = 4
        best = Math.max(best, at)
      }
      return {
        at: best, goal: 4,
        noteK: ['arc.dream.fallenNone', 'arc.dream.fallenTaken', 'arc.dream.fallenTopHalf', 'arc.dream.fallenTopFour', 'arc.dream.fallenDone'][best],
        done: best >= 4,
      }
    },
  },
  {
    id: 'intl',
    retired: true,
    titleK: 'arc.dream.intl', titleLowerK: 'arc.dream.intlLower',
    applies: () => true,
    progress: state => {
      const tests = (state.natHistory ?? []).reduce((s, x) => s + x.m, 0) + (state.natTeam ? state.natRecord?.m ?? 0 : 0)
      const had = !!state.natTeam || (state.natHistory?.length ?? 0) > 0
      const at = (had ? 1 : 0) + Math.min(10, tests)
      return {
        at, goal: 11,
        noteK: at >= 11 ? 'arc.dream.intlDone' : had ? 'arc.dream.intlSome' : 'arc.dream.intlNone',
        noteV: { n: tests },
        done: at >= 11,
      }
    },
  },
]

/** The dreams worth offering a manager walking into this club. */
/**
 * WHICH COMPETITIONS A WORLD ACTUALLY HOLDS.
 *
 * The wizard offers dreams before a career exists, so it cannot look in
 * state.comps - there is no state yet. This is the same fact newgame.ts acts
 * on when it wraps the Continental Cup, the Continental Shield and the men's
 * internationals in `if (gender !== 'w')`, stated once where both can read it.
 *
 * Kept deliberately small: it answers "does this world have this competition",
 * nothing else. If the women's game gains a continental knockout, this is the
 * one place that has to learn about it, and three unwinnable dreams become
 * winnable on the same line.
 */
const WORLD_COMPS: Record<Gender, readonly string[]> = {
  m: ['cc', 'chc', 'wc'],
  // The women's game gained a Continental Cup of its own this release, built
  // from the four top tiers - England, France, the Pacific and the Celtic
  // provinces - which restores "Win the Continental Cup" and "Win the league
  // and Europe" to a world that had been offered both and could win neither.
  // No Shield ('chc'), because there is no second tier in it to feed one. The
  // World Championship ('wc') arrived in 1.6.4: sixteen nations every fourth
  // year from 2029, so the world-title dream is winnable in both games.
  w: ['cc', 'wc'],
}

export function worldHasComp(gender: Gender, compId: string): boolean {
  return WORLD_COMPS[gender].includes(compId)
}

export function dreamsFor(ctx: DreamContext): DreamDef[] {
  // the club id carries the world: "w:bristol" is the women's Bristol
  const gender: Gender = isWomensId(ctx.clubId) ? 'w' : 'm'
  return DREAMS.filter(d => !d.retired &&
    d.applies(ctx) && (d.needs ?? []).every(c => worldHasComp(gender, c)))
}

export function dreamById(id: string | undefined): DreamDef | undefined {
  return id ? DREAMS.find(d => d.id === id) : undefined
}

/** The live state of the save's dream, or null when there is not one. */
export function dreamState(state: GameState): {
  def: DreamDef; ctx: DreamContext; title: string; titleK: string; titleV?: Vars; progress: DreamProgress
} | null {
  const def = dreamById(state.dream?.id)
  if (!def) return null
  const club = state.clubs[state.dream!.clubId]
  const ctx: DreamContext = {
    clubId: state.dream!.clubId,
    clubName: club?.short ?? club?.name ?? 'your club',
    leagueId: club?.leagueId ?? 'prem',
    rep: club?.rep ?? 70,
  }
  // Both the key and the English are returned: the season review keeps a copy
  // of this for the life of the career, and stored English is what an old save
  // reads back when it was written before dreams carried keys.
  return {
    def, ctx,
    title: tIn('en', def.titleK, def.titleVars?.(ctx)),
    titleK: def.titleK,
    titleV: def.titleVars?.(ctx),
    progress: def.progress(state),
  }
}

/** 0-100 for a progress bar, never past either end. */
export const dreamPct = (p: DreamProgress): number =>
  Math.max(0, Math.min(100, Math.round((p.at / Math.max(1, p.goal)) * 100)))

/**
 * The May verdict: what the season did for the dream.
 *
 * Written into the season review, so a career that is drifting says so once a
 * year in plain words rather than letting the player find out in season nine.
 */
export function dreamVerdict(state: GameState, before: DreamProgress | null): string | null {
  const now = dreamState(state)
  if (!now) return null
  const moved = before ? now.progress.at - before.at : 0
  const v = { title_k: now.titleK, ...(now.titleV ?? {}), note_k: now.progress.noteK, ...(now.progress.noteV ?? {}) }
  if (now.progress.done) return t('dream.verdictDone', v)
  if (moved > 0) return t('dream.verdictMoved', v)
  return t('dream.verdictStalled', v)
}
