// The man in the other dugout, and why he is worth naming twice a season.
//
// WHAT ALREADY EXISTED, and what this file must not duplicate. newgame gives
// every AI club a named head coach in club.coach. jobs.ts sacks them on bad form,
// files the story, opens the vacancy and appoints a successor. media.ts already
// has a title rival's coach saying his side handles the big moments better.
//
// The first draft of this file did not check any of that. It invented a second
// name system - a pool of fictional names hashed off the club id - which would
// have had the club screen calling him one thing and the news calling him
// another. Deleted. Everything below reads club.coach.
//
// WHAT WAS ACTUALLY MISSING, and is the audit's point: the rival is a CLUB. There
// is a season-long rival tracker, a derby ledger and a title race, and no person
// attached to any of it for more than one press question. So the man never
// develops, never gloats, never cracks, and is never anybody in particular when
// the fixture comes round again.
//
// So: one identified rival per season, and a voice that moves with the table.
import { tIn, type Vars } from './i18n'
import { poss, type Club, type GameState } from './model'

/** Who is in the other dugout, or null for a club between coaches. */
export function bossOf(club: Club): string | null {
  return club.coach ?? null
}

/**
 * The manager the season is about.
 *
 * A club the user has bad blood with, in his own league, first: a rival you play
 * twice a year and already have a grudge with is a better story than whoever is
 * second in the table this week. Failing that, the strongest club in the league,
 * which is the honest answer when nobody has fallen out with you yet.
 *
 * Recomputed rather than stored. A rival who stops being near you should stop
 * being your rival, and a club between coaches is nobody's rival at all.
 */
export function rivalBoss(state: GameState): { club: Club; boss: string } | null {
  const me = state.clubs[state.userClubId]
  if (!me) return null
  const sameLeague = Object.values(state.clubs).filter(c =>
    c.id !== me.id && c.leagueId === me.leagueId && c.coach)
  if (!sameLeague.length) return null

  const bad = sameLeague.filter(c => (state.grudges ?? []).some(g =>
    ((g.a === me.id && g.b === c.id) || (g.a === c.id && g.b === me.id)) && g.until >= state.season))
  const pool = bad.length ? bad : sameLeague
  const club = pool.reduce((best, c) => (c.rep > best.rep ? c : best), pool[0])
  return { club, boss: club.coach as string }
}

/**
 * Deterministic voicing: the same beat wears different words week to week without
 * drawing on the shared rng. Copied from gossip.ts, and needed for exactly the
 * reason bossprobe found - the neutral line came out four times in a row, word for
 * word, in one season. A rival who says one sentence forever is a sign on a wall,
 * not a person.
 */
const voice = (state: GameState, salt: number, opts: string[]) =>
  opts[(state.season * 7 + state.week * 3 + salt) % opts.length]

/**
 * The rival's voice for this week, or null on a quiet week.
 *
 * Every gate is calendar and table arithmetic. Nothing here touches the shared
 * rng: a quote that moved the sim stream would change results by being generated,
 * which is the EK lesson, and a season-long talking head is exactly the sort of
 * feature that would do it quietly for months.
 *
 * Once every five weeks at most. He is meant to be a presence, not a pen pal, and
 * the inbox already carries a news pressure tripwire that would fail if he were.
 */
export function rivalBeat(state: GameState): { k: string; v: Vars } | null {
  const r = rivalBoss(state)
  if (!r) return null
  if (state.week % 5 !== 0) return null
  const me = state.clubs[state.userClubId]
  const comp = state.comps[me.leagueId]
  if (!comp || comp.type !== 'league') return null
  const mine = comp.table.find(t => t.teamId === me.id)
  const his = comp.table.find(t => t.teamId === r.club.id)
  if (!mine || !his || mine.p + his.p < 4) return null   // no opinions before any rugby

  const ahead = his.pts - mine.pts
  const runIn = state.week >= 30
  const base: Vars = {
    boss: r.boss, club: r.club.name, short: r.club.short,
    me: me.name, meShort: me.short, mePoss: poss(me.short),
  }

  if (runIn && Math.abs(ahead) <= 4) {
    const gap = Math.abs(ahead)
    return {
      k: 'news.bossTight',
      v: {
        ...base, n: gap,
        subj_k: voice(state, 3, ['news.bossTightSubjA', 'news.bossTightSubjB', 'news.bossTightSubjC']),
        who_k: ahead > 0 ? 'news.bossWeAhead' : ahead < 0 ? 'news.bossTheyAhead' : 'news.bossNothingIn',
        // the gap is quoted rather than hardcoded: the first draft said "Four
        // points between you" whether it was four, one or none
        gap_k: gap === 0 ? 'news.bossLevel' : 'news.bossPoints',
      },
    }
  }
  if (ahead >= 12) {
    return { k: 'news.bossNotLookingDown', v: { ...base, n: ahead } }
  }
  if (ahead <= -12) {
    return { k: 'news.bossPressure', v: { ...base, n: Math.abs(ahead) } }
  }
  return {
    k: voice(state, 2, ['news.bossSize1', 'news.bossSize2', 'news.bossSize3', 'news.bossSize4']),
    v: {
      ...base,
      subj_k: voice(state, 1, ['news.bossSizeSubj1', 'news.bossSizeSubj2', 'news.bossSizeSubj3', 'news.bossSizeSubj4']),
    },
  }
}

/**
 * The rival's arc closing at the end of a season, for the review.
 *
 * The sacking half is NOT here: jobs.ts already sacks AI coaches on bad form,
 * files the story and appoints the successor, so a second sacking path would mean
 * two stories about one man losing one job. What was missing was the accounting -
 * you finished above him or you did not - and the acknowledgement that the man
 * who spent October telling the press to judge him in May sometimes did not last
 * until May.
 */
export function rivalVerdict(state: GameState): { k: string; v: Vars } | null {
  const me = state.clubs[state.userClubId]
  const comp = state.comps[me?.leagueId ?? '']
  if (!me || !comp || comp.type !== 'league') return null
  const r = rivalBoss(state)
  const order = [...comp.table].sort((a, b) => b.pts - a.pts || (b.pf - b.pa) - (a.pf - a.pa))
  const myPos = order.findIndex(t => t.teamId === me.id) + 1
  if (!myPos) return null

  // no rival with a coach in post: the man who was there in October is gone
  if (!r) return { k: 'news.rivalGone', v: { meShort: me.short, pos_o: myPos } }

  const hisPos = order.findIndex(t => t.teamId === r.club.id) + 1
  if (!hisPos) return null
  const above = myPos < hisPos
  return {
    k: above ? 'news.rivalBelowYou' : 'news.rivalAboveYou',
    v: { boss: r.boss, meShort: me.short, mine: myPos, his: hisPos },
  }
}
