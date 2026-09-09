/**
 * ---- THE TEAM OF THE YEAR ----
 *
 * Owner: "every December a player of the year should be awarded by the global
 * governing body. It should be also a time to show off the dream team of the
 * year. Playes who have starred on the international stage. if you have a
 * player in your team on this - extra revenue should come in from shirt sales,
 * events and demand to sponsor them."
 *
 * HALF OF THAT ALREADY EXISTED, and finding out was the useful part. The World
 * Player of the Year has been in the game since long before this: rollover.ts
 * names a podium of three off the finished season, counts repeat winners, keeps
 * a roll of every past winner and tells you when one of them is yours. Building
 * a second one would have given the game two different players of the year in
 * the same season, and the first draft of this file did exactly that - under a
 * colliding news key that overwrote the real award's text in all five
 * languages.
 *
 * So this adds the half that was missing - the fifteen - to the awards night
 * that already exists, and the money the owner asked for on top.
 *
 * IT IS NOT IN DECEMBER, AND THAT IS A DELIBERATE CHOICE TO PUT TO THE OWNER.
 * The awards night lands with the season review, judging the season just
 * finished, because that is the only moment the numbers describe a whole
 * campaign. December would mean keeping last season's stats alive past the
 * rollover that clears them - a save-format change, not a scheduling one. A
 * Team of the Year picked in December off a half-played season would be a
 * different and worse award: three months of form with the run-in missing.
 *
 * WHO IS ELIGIBLE, AND THE HONEST LIMIT OF IT. The owner's line is "players who
 * have starred on the international stage", so the pool is players who hold caps
 * and have played enough club rugby this season to have been judged. What the
 * game does NOT have is a per-season count of international appearances - caps
 * are cumulative - so a man capped years ago and quiet since is eligible on the
 * same footing as this autumn's find. Ranking is therefore on THIS SEASON's
 * form, which is the number that actually separates them, with caps as the gate
 * rather than the score. A seasonCaps counter would sharpen this and is the
 * obvious next change; it is written down here rather than pretended away.
 *
 * NO RNG. Like the rest of the calendar beats added in v1.5, this is arithmetic
 * on the season's own numbers. A draw here would move the shared world stream
 * and every save in progress with it.
 */
import type { GameState, Player, Pos } from './model'
import { tIn, type Vars } from './i18n'

/** Enough club rugby to have been watched, not so much that it excludes a
 *  man who spent the autumn away with his country. */
const MIN_APPS = 6

/** The XV, in shirt order. Two locks, two flankers, two centres, two wings. */
const SHAPE: Pos[] = ['LP', 'HK', 'TP', 'LK', 'LK', 'FL', 'FL', 'N8', 'SH', 'FH', 'CE', 'CE', 'WG', 'WG', 'FB']

/**
 * THE SAME SUM THE PLAYER OF THE YEAR IS SCORED ON (rollover.ts): average
 * rating, a small nudge for tries, a bigger one for winning something.
 *
 * It has to be the same or the two honours contradict each other. The first
 * version of this file ranked on average rating alone, and across four test
 * seasons the World Player of the Year was left out of his own Team of the Year
 * three times - which is not a balance quirk, it is the awards night calling
 * one man the best in the world and then leaving him out of the fifteen.
 *
 * The tries weight stays small on purpose: tries already lift a match rating,
 * and any bigger and the fifteen is wingers with a token front row.
 */
const formOf = (state: GameState, p: Player): number => {
  if (p.stats.apps <= 0) return 0
  const cups = state.history.filter(h => h.season === state.season && h.champion === p.clubId).length
  return p.stats.ratingSum / p.stats.apps + p.stats.tries * 0.004 + cups * 0.15
}

/** Everyone the panel would even look at. */
function pool(state: GameState): Player[] {
  return Object.values(state.players).filter(p =>
    (p.caps ?? 0) > 0 && p.stats.apps >= MIN_APPS && !!p.clubId)
}

/**
 * The Team of the Year: the best man in each shirt, nobody twice.
 *
 * Filled in shirt order, which means a lock who would also have been the best
 * flanker is a lock, because that is the shirt he was picked in. The alternative
 * is a global optimisation that occasionally names a hooker at openside, and
 * nobody reading a Team of the Year wants to be told the panel was being clever.
 */
export function teamOfTheYear(state: GameState): Player[] {
  const ranked = pool(state).sort((a, b) => formOf(state, b) - formOf(state, a))
  const used = new Set<number>()
  const xv: Player[] = []
  for (const pos of SHAPE) {
    const man = ranked.find(p => p.pos === pos && !used.has(p.id))
    if (man) { used.add(man.id); xv.push(man) }
  }
  return xv
}

/**
 * What an honoured player is worth to the club that holds his registration.
 *
 * Owner: "extra revenue should come in from shirt sales, events and demand to
 * sponsor them." It scales with the club's own reach, because a shirt sells
 * into the crowd a club already has - the same name at a bigger club shifts
 * more of them, and pretending otherwise would make this a flat handout.
 * Player of the Year is worth roughly three of his team-mates.
 */
export function awardWindfall(rep: number, inXV: number, hasPotY: boolean): number {
  if (!inXV) return 0
  const perMan = 20_000 + Math.round(rep * 900)
  return perMan * (inXV + (hasPotY ? 2 : 0))
}

/**
 * Filed by the season review, straight after the World Player of the Year, so
 * the two honours describe the same season and read as one awards night.
 *
 * `winnerId` is that award's winner, handed in rather than recomputed: he is
 * worth more to his club than his team-mates in the fifteen, and the two lists
 * must never disagree about who won.
 */
export function runTeamOfTheYear(state: GameState, winnerId: number | null) {
  const xv = teamOfTheYear(state)
  if (xv.length < SHAPE.length) return          // too early in a young world

  const file = (k: string, v: Vars, playerId?: number) => {
    state.news.push({
      id: state.nextId++, week: 1, season: state.season + 1, type: 'award', read: false,
      subject: tIn('en', `${k}Subj`, v), body: tIn('en', k, v), k, v, playerId,
    })
  }

  const rows = xv.map((p, i) => ({
    k: 'news.totyLine', n: i + 1, name: p.name,
    club: state.clubs[p.clubId ?? '']?.short ?? '', pos: p.pos,
  }))
  file('news.toty', { rows_ll: JSON.stringify(rows) })

  // The club's share of it, if any of them are yours.
  const club = state.clubs[state.userClubId]
  if (!club) return
  const mine = xv.filter(p => p.clubId === club.id)
  if (!mine.length) return
  const hasWinner = winnerId != null && mine.some(p => p.id === winnerId)
  const cash = awardWindfall(club.rep, mine.length, hasWinner)
  club.budget += cash
  file('news.totyMine', {
    n: mine.length,
    names: mine.map(p => p.name).join(', '),
    money: cash,
  }, mine[0].id)
}
