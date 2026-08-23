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
  /** the honest state of it, in the manager's language */
  note: string
  done: boolean
}

export interface DreamDef {
  id: string
  /** the ambition, as the manager would say it out loud */
  title: (ctx: DreamContext) => string
  /** what taking it on actually means */
  blurb: string
  /** offered only where it means something */
  applies: (ctx: DreamContext) => boolean
  progress: (state: GameState) => DreamProgress
}

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
    title: ctx => `Take ${ctx.clubName} into the top flight`,
    blurb: 'Win promotion, then prove it was not a fluke by surviving a season up there. Two of the hardest years in the game, back to back.',
    // only a club that is not already there can dream of getting there
    applies: ctx => (LEAGUE_TIER[ctx.leagueId] ?? 1) > 1,
    progress: state => {
      const seasons = topFlightSeasons(state)
      const club = state.clubs[dreamClub(state)]
      const upNow = club && LEAGUE_TIER[club.leagueId] === 1
      return {
        at: Math.min(2, seasons),
        goal: 2,
        note: seasons >= 2 ? 'established in the top flight'
          : seasons === 1 ? 'one season up: survive another'
          : upNow ? 'promoted - now stay there'
          : `still in the ${club?.leagueId === 'champ' ? 'Championship' : 'lower leagues'}`,
        done: seasons >= 2,
      }
    },
  },
  {
    id: 'europe',
    title: () => 'Win the Continental Cup',
    blurb: 'The biggest prize in club rugby. Qualify, survive the pool, and win four knockout ties against the best sides on the continent.',
    applies: () => true,
    progress: state => {
      const n = won(state, 'cc')
      const chc = won(state, 'chc')
      return {
        at: Math.min(1, n),
        goal: 1,
        note: n > 0 ? `won it${n > 1 ? ` ${n} times` : ''}`
          : chc > 0 ? 'a Continental Shield on the shelf: the big one is still out there'
          : 'not yet',
        done: n > 0,
      }
    },
  },
  {
    id: 'double',
    title: ctx => `Win the league and Europe with ${ctx.clubName}`,
    blurb: 'The double that defines an era: your domestic title and the Continental Cup, both with this club. They need not be the same season.',
    applies: ctx => (LEAGUE_TIER[ctx.leagueId] ?? 1) === 1,
    progress: state => {
      const club = dreamClub(state)
      const league = state.mgr.finishes.some(f => f.pos === 1 && (f.clubId == null || f.clubId === club)) ? 1 : 0
      const euro = won(state, 'cc', club) > 0 ? 1 : 0
      const have = league + euro
      return {
        at: have,
        goal: 2,
        note: have === 2 ? 'both, and nobody can take either back'
          : have === 1 ? (league ? 'league won - Europe left' : 'Europe won - the league left')
          : 'neither yet',
        done: have === 2,
      }
    },
  },
  {
    id: 'dynasty',
    title: () => 'Win the league three seasons running',
    blurb: 'Anyone can have one good year. A dynasty is what happens when the whole league builds itself to stop you and cannot.',
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
        note: best >= 3 ? 'a dynasty, on the record'
          : best === 2 ? 'two in a row: one more'
          : best === 1 ? 'one title so far'
          : 'no titles yet',
        done: best >= 3,
      }
    },
  },
  {
    id: 'academy',
    title: () => 'Build a first team out of your own academy',
    blurb: 'Eight graduates of your own academy, all with senior rugby behind them, on the books at once. The slowest dream in the game and the one that outlives you.',
    applies: () => true,
    progress: state => {
      const club = state.clubs[state.userClubId]
      const n = (club?.players ?? [])
        .map(id => state.players[id])
        .filter(p => p && p.homegrown && !p.acad && p.stats.apps > 0).length
      return {
        at: Math.min(8, n),
        goal: 8,
        note: n >= 8 ? 'a team of your own making'
          : n === 0 ? 'no graduates in the senior squad yet'
          : `${n} graduate${n === 1 ? '' : 's'} with senior rugby behind them`,
        done: n >= 8,
      }
    },
  },
  {
    id: 'world',
    title: () => 'Coach a nation to the World Championship',
    blurb: 'Club rugby is the day job. Take a Test side as well, and win the tournament that only comes round every four years.',
    applies: () => true,
    progress: state => {
      const wc = won(state, 'wc')
      const hasJob = !!state.natTeam
      const everHad = hasJob || (state.natHistory?.length ?? 0) > 0
      return {
        at: wc > 0 ? 2 : everHad ? 1 : 0,
        goal: 2,
        note: wc > 0 ? 'champions of the world'
          : hasJob ? 'in the job: now win it'
          : everHad ? 'you have coached a Test side - get another job and finish it'
          : 'no international job yet',
        done: wc > 0,
      }
    },
  },
  {
    id: 'immortal',
    title: () => 'Retire with fifteen major trophies',
    blurb: 'No single miracle - a career of them. Fifteen pieces of silverware is Hall of Fame territory and takes most of a working life.',
    applies: () => true,
    progress: state => {
      const n = state.mgr.trophies.length
      return {
        at: Math.min(15, n),
        goal: 15,
        note: n === 0 ? 'the cabinet is empty' : `${n} in the cabinet`,
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
export function dreamState(state: GameState): { def: DreamDef; title: string; progress: DreamProgress } | null {
  const def = dreamById(state.dream?.id)
  if (!def) return null
  const club = state.clubs[state.dream!.clubId]
  const ctx: DreamContext = {
    clubId: state.dream!.clubId,
    clubName: club?.short ?? club?.name ?? 'your club',
    leagueId: club?.leagueId ?? 'prem',
    rep: club?.rep ?? 70,
  }
  return { def, title: def.title(ctx), progress: def.progress(state) }
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
  if (now.progress.done) return `THE DREAM IS DONE: ${now.title}. Whatever comes next is a bonus.`
  if (moved > 0) return `The dream moved this season: ${now.title} - ${now.progress.note}.`
  return `No closer to the dream: ${now.title} - ${now.progress.note}.`
}
