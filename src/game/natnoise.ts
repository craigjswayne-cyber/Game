/**
 * ---- THE NOISE AFTER A TEST (1.9.17) ----
 *
 * Owner, 22 Nov 2026: "after each international game there needs to be more
 * noise. More frustration if loss in press and social media, if winning it's
 * the opposite - it should feel more intense."
 *
 * Every Test the manager coaches files two stories in his inbox at the
 * whistle: what the press wrote and what the supporters posted. Which story
 * is read off the result itself - the margin, who was fancied (the world
 * rankings, through nattest.testConfDelta) and the run it belongs to - so a
 * narrow defeat to a better side is not written up like a hiding from a
 * weaker one, and a third straight defeat reads harder than the first.
 *
 * News only. It moves no rating, no morale and no confidence (the union's
 * view is natConfidence, the press's is pressmood.ts), and it draws no dice:
 * the one choice between two wordings is arithmetic on the fixture id.
 */
import type { Fixture, GameState } from './model'
import { tIn } from './i18n'
import { nationNameIn } from './nations'
import { testConfDelta } from './nattest'

export type TestTone = 'rout' | 'bigwin' | 'win' | 'draw' | 'narrow' | 'loss' | 'shock'

/** How the result reads, from the coach's side. */
export function testTone(state: GameState, mySide: string, oppId: string, us: number, them: number): TestTone {
  const d = testConfDelta(state, mySide, oppId, us, them)
  if (us > them) return us - them >= 20 ? 'rout' : d >= 4 ? 'bigwin' : 'win'
  if (us === them) return 'draw'
  if (d <= -7 || them - us >= 25) return 'shock'
  return d > -5 && them - us <= 7 ? 'narrow' : 'loss'
}

/** The run this Test completes: straight wins or straight defeats this season. */
export function testRun(state: GameState, mySide: string, fx: Fixture): { res: 'W' | 'D' | 'L'; n: number } {
  const mine = state.fixtures
    .filter(f => f.played && f.compId !== 'fr' && (f.homeId === mySide || f.awayId === mySide))
    .sort((a, b) => a.week - b.week || a.id - b.id)
  const resOf = (f: Fixture) => {
    const u = f.homeId === mySide ? f.homeScore : f.awayScore, t = f.homeId === mySide ? f.awayScore : f.homeScore
    return u > t ? 'W' as const : u < t ? 'L' as const : 'D' as const
  }
  const at = mine.findIndex(f => f.id === fx.id)
  const upTo = at >= 0 ? mine.slice(0, at + 1) : [...mine, fx]
  const res = resOf(upTo[upTo.length - 1])
  let n = 0
  for (let i = upTo.length - 1; i >= 0 && resOf(upTo[i]) === res; i--) n++
  return { res, n }
}

/** File the press and the supporters' reaction to the coach's Test. */
export function testNoise(state: GameState, fx: Fixture, mySide: string): void {
  const home = fx.homeId === mySide
  const oppId = home ? fx.awayId : fx.homeId
  const us = home ? fx.homeScore : fx.awayScore, them = home ? fx.awayScore : fx.homeScore
  const tone = testTone(state, mySide, oppId, us, them)
  const run = testRun(state, mySide, fx)
  // two wordings for the commonest results, so a Six Nations does not read
  // the same paragraph twice
  const alt = (tone === 'win' || tone === 'loss') && fx.id % 2 === 1 ? '2' : ''
  const streak = run.n >= 3 && run.res !== 'D' ? (run.res === 'W' ? 'runUp' : 'runDown') : null
  const v = { nat: nationNameIn('en', mySide), nat_n: mySide, opp: nationNameIn('en', oppId), opp_n: oppId, us, them, n: run.n }
  for (const k of [`news.tnPress_${streak ?? tone + alt}`, `news.tnSocial_${tone}${alt}`]) {
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
      subject: tIn('en', `${k}Subj`, v), body: tIn('en', k, v), k, v,
    })
  }
  // a run is the supporters' story too, after the night's own
  if (streak) {
    const k = `news.tnSocial_${streak}`
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
      subject: tIn('en', `${k}Subj`, v), body: tIn('en', k, v), k, v,
    })
  }
}
