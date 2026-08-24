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
  /** what taking it on actually means */
  blurbK: string
  /** offered only where it means something */
  applies: (ctx: DreamContext) => boolean
  progress: (state: GameState) => DreamProgress
}

/** The ambition in the reader's language. */
export const dreamTitle = (def: DreamDef, ctx: DreamContext): string => t(def.titleK, def.titleVars?.(ctx))
/** And phrased for the middle of a sentence. */
export const dreamTitleLower = (def: DreamDef, ctx: DreamContext): string => t(def.titleLowerK, def.titleVars?.(ctx))
/** Where the dream stands, in the reader's language. */
export const dreamNote = (p: { noteK: string; noteV?: Vars }): string => t(p.noteK, p.noteV)

/** The club the dream was declared about, which is not always where you work now. */
const dreamClub = (state: GameState): string => state.dream?.clubId ?? state.userClubId

/** Trophies of one competition, optionally at one club. */
const won = (state: GameState, compId: string, clubId?: string) =>
  state.mgr.trophies.filter(t =>
    t.compId === compId && (clubId == null || t.clubId == null || t.clubId === clubId)).length

/** Seasons the dream club has spent in a top-flight league under this manager. */
const topFlightSeasons = (state: GameState): number => {
  const club = dreamClub(state)
  return state.mgr.finishes.filter(f => LEAGUE_TIER[f.leagueId] === 1 && (f.clubId == null || f.clubId === club)).length
}

export const DREAMS: DreamDef[] = [
  {
    id: 'topflight',
    titleK: 'dream.topflight', titleLowerK: 'dream.topflightLower',
    titleVars: ctx => ({ club: ctx.clubName }),
    blurbK: 'dream.topflightBlurb',
    // only a club that is not already there can dream of getting there
    applies: ctx => (LEAGUE_TIER[ctx.leagueId] ?? 1) > 1,
    progress: state => {
      const seasons = topFlightSeasons(state)
      const club = state.clubs[dreamClub(state)]
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
    blurbK: 'dream.europeBlurb',
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
    titleVars: ctx => ({ club: ctx.clubName }),
    blurbK: 'dream.doubleBlurb',
    applies: ctx => (LEAGUE_TIER[ctx.leagueId] ?? 1) === 1,
    progress: state => {
      const club = dreamClub(state)
      const league = state.mgr.finishes.some(f => f.pos === 1 && (f.clubId == null || f.clubId === club)) ? 1 : 0
      const euro = won(state, 'cc', club) > 0 ? 1 : 0
      const have = league + euro
      return {
        at: have,
        goal: 2,
        noteK: have === 2 ? 'dream.doubleBoth'
          : have === 1 ? (league ? 'dream.doubleLeagueDone' : 'dream.doubleEuropeDone')
          : 'dream.doubleNeither',
        done: have === 2,
      }
    },
  },
  {
    id: 'dynasty',
    titleK: 'dream.dynasty', titleLowerK: 'dream.dynastyLower',
    blurbK: 'dream.dynastyBlurb',
    applies: () => true,
    progress: state => {
      // the longest run of consecutive title-winning seasons on the record
      const titles = state.mgr.finishes.filter(f => f.pos === 1).map(f => f.season).sort((a, b) => a - b)
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
    blurbK: 'dream.academyBlurb',
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
    titleK: 'dream.world', titleLowerK: 'dream.worldLower',
    blurbK: 'dream.worldBlurb',
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
    blurbK: 'dream.immortalBlurb',
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
]

/** The dreams worth offering a manager walking into this club. */
export function dreamsFor(ctx: DreamContext): DreamDef[] {
  return DREAMS.filter(d => d.applies(ctx))
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
