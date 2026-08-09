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
export function rivalBeat(state: GameState): { subject: string; body: string } | null {
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

  if (runIn && Math.abs(ahead) <= 4) {
    const gap = Math.abs(ahead)
    return {
      subject: voice(state, 3, [
        `🎙 ${r.boss}: "It goes to the last day"`,
        `🎙 ${r.boss} on the run-in: "We are better in the tight five"`,
        `🎙 ${r.boss} makes it personal`,
      ]),
      // the gap is quoted rather than hardcoded: the first draft said "Four points
      // between you" whether it was four, one or none
      body: `${r.club.name}'s ${r.boss} was asked about you this morning and did not bother pretending. `
        + `"${ahead > 0 ? 'We are ahead' : ahead < 0 ? 'They are ahead' : 'There is nothing in it'}, `
        + `with everything still to play for. I have watched every game they have played this year. They are good. `
        + `We are better in the tight five, and I think that is what decides it." `
        + `${gap === 0 ? 'Level on points' : `${gap} point${gap === 1 ? '' : 's'} between you`}, and he has just `
        + `made it personal.`,
    }
  }
  if (ahead >= 12) {
    return {
      subject: `🎙 ${r.boss} on the gap: "We are not looking down"`,
      body: `${r.boss} has been enjoying himself. "Somebody asked whether I keep an eye on ${me.name}. I keep an `
        + `eye on the table, and the table says what it says." That is ${ahead} points of table he is inviting you `
        + `to look at. Pin it up somewhere useful.`,
    }
  }
  if (ahead <= -12) {
    return {
      subject: `🎙 ${r.boss} under pressure: "Judge me in May"`,
      body: `A rough morning for ${r.club.short}, where ${r.boss} was asked twice whether he still has the dressing `
        + `room. "Judge me in May." He was then asked about the ${Math.abs(ahead)}-point gap to ${me.short} and `
        + `moved on to the next question. Boards read those transcripts too.`,
    }
  }
  return {
    subject: voice(state, 1, [
      `🎙 ${r.boss} sizes you up`,
      `🎙 ${r.boss} asked about ${me.short}: "Organised"`,
      `🎙 ${r.boss} keeps one eye on ${me.short}`,
      `🎙 ${r.boss} plays it straight about ${me.short}`,
    ]),
    body: voice(state, 2, [
      `${r.boss} was polite about ${me.name} and meant almost none of it. "A well-coached side. Organised. They `
        + `know exactly what they are, which is a compliment, whatever anybody hears in it." Nothing between you in `
        + `the table, and not much between you in the press room either.`,
      `Asked to name the side he least wants to draw, ${r.boss} went somewhere else entirely. "I would not give `
        + `anybody that headline." Pressed on ${me.short} specifically, he said they were "hard to play against on `
        + `their day", which is a sentence with a trapdoor in it.`,
      `${r.boss} says he has stopped watching the table. "It is August somewhere in my head. I will look in April." `
        + `He then named ${poss(me.short)} last three results from memory, in order, which rather gave the game away.`,
      `A short one from ${r.boss} this morning. "${me.short}? Good club, good crowd, good coach." Three compliments `
        + `and not one word about their rugby. He knows exactly what he is doing.`,
    ]),
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
export function rivalVerdict(state: GameState): { subject: string; body: string } | null {
  const me = state.clubs[state.userClubId]
  const comp = state.comps[me?.leagueId ?? '']
  if (!me || !comp || comp.type !== 'league') return null
  const r = rivalBoss(state)
  const order = [...comp.table].sort((a, b) => b.pts - a.pts || (b.pf - b.pa) - (a.pf - a.pa))
  const myPos = order.findIndex(t => t.teamId === me.id) + 1
  if (!myPos) return null

  // no rival with a coach in post: the man who was there in October is gone
  if (!r) {
    return {
      subject: `📋 Your rival did not last the season`,
      body: `Whatever else the year did, it took the other dugout with it: the man who spent the autumn talking `
        + `about ${me.short} is not in a job any more, and his club will appoint somebody new before you play them `
        + `again. You finished ${myPos}${myPos === 1 ? 'st' : myPos === 2 ? 'nd' : myPos === 3 ? 'rd' : 'th'}. `
        + `Somebody else gets to have an opinion about that next year.`,
    }
  }
  const hisPos = order.findIndex(t => t.teamId === r.club.id) + 1
  if (!hisPos) return null
  const above = myPos < hisPos
  return {
    subject: above
      ? `📋 You finished above ${r.boss}`
      : `📋 ${r.boss} finished above you`,
    body: above
      ? `${myPos} against ${hisPos}. ${r.boss} spent the season telling anybody who asked what he made of `
        + `${me.short}, and the table has answered him. He is still in a job, he will still have plenty to say, and `
        + `you now have a full year of it to look forward to from the right side of the argument.`
      : `${hisPos} against ${myPos}. ${r.boss} was right, or at least the table says he was, which in this job is `
        + `the same thing until next May. He will not have forgotten a word of it and neither should you.`,
  }
}
