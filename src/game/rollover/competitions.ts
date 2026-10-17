// The competitions rebuilt for a new season: promotion and relegation, the
// continental places, and every league, cup and Test calendar drawn again.
import { ensureAcademyLeague } from '../academy'
import { genderOf } from '../gender'
import { tIn, type Vars } from '../i18n'
import { RELEGATES, tieWinner, worldCupSeasonFor, type GameState } from '../model'
import { LEAGUE_DEFS } from '../newgame'
import type { Rng } from '../rng'
import { buildChampionsCup, buildInternationals, buildLeague, buildMrcCup, buildWomensContinentalCup, buildWomensInternationals, schedulePreseason, sortTable } from '../schedule'
import { applyAdminPenalties } from '../season/tables'

// The third entry is a KEY, not a name. It used to be the English phrase
// "the Championship", passed into the round-up as a variable - so a French
// reader got "Doncaster reste en bas, the Championship : Cinderford monte".
// The competition's name is a proper noun and does not translate; the
// article in front of it does.
export function swapDivisions(state: GameState) {
  const PYRAMID: [string, string, string][] = [
    ['prem', 'champ', 'news.pyrPrem'],
    ['champ', 'natl1', 'news.pyrChamp'],
    ['top14', 'prod2', 'news.pyrTop14'],
  ]
  // your own promotion or relegation is the story of the season and keeps its
  // own headline. The other divisions' movements are one round-up: three
  // near-identical "X up, Y down" items were three of the fourteen in the
  // final week of the year.
  const swaps: string[] = []
  const swapRows: Vars[] = []
  for (const [topId, lowId, topName] of PYRAMID) {
    // a ringfenced top flight swaps nobody (RELEGATES, model.ts: the English
    // Premier Division from 2026-27)
    if (!RELEGATES.includes(topId)) continue
    const topComp = state.comps[topId]
    const lowComp = state.comps[lowId]
    if (!topComp || !lowComp) continue
    const topOrder = sortTable(topComp.table).map(r => r.teamId)
    const down = topOrder[topOrder.length - 1]
    const up = lowComp.champion ?? sortTable(lowComp.table)[0]?.teamId
    if (!down || !up || down === up || !state.clubs[down] || !state.clubs[up]) continue
    // THE ENGLISH TRAPDOOR IS A GAME NOW (21A). The relegation playoff decided
    // this pair on the pitch: the swap only happens if the Championship
    // winner actually won it. A save that rolled over without the fixture
    // (or a playoff that somehow never played) falls back to the automatic
    // swap, which is what the game always did.
    if (topId === 'prem') {
      const bar = state.fixtures.find(f => f.compId === 'prem' && f.stage === 'BAR' && f.played)
      if (bar) {
        const winner = tieWinner(bar)
        if (winner === down) {
          const lineV = {
            k: 'news.barKept', kept: state.clubs[down].name, stay: state.clubs[up].name,
            hi: Math.max(bar.homeScore, bar.awayScore), lo: Math.min(bar.homeScore, bar.awayScore),
          }
          const line = tIn('en', lineV.k, lineV)
          if (down === state.userClubId || up === state.userClubId) {
            state.news.push({
              id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
              subject: down === state.userClubId
                ? `SURVIVED: ${state.clubs[down].short} win the playoff`
                : `SO CLOSE: ${state.clubs[up].short} lose the playoff`,
              body: `${line}.${down === state.userClubId ? ' The great escape, done on your own patch. The board exhales - now never come this close again.' : ' Champions of the second tier, beaten in one game for everything. The board keeps faith: win the league again and finish the job.'}`,
              k: down === state.userClubId ? 'news.barSurvived' : 'news.barSoClose',
              v: { ...lineV, line_k: lineV.k, short: state.clubs[down === state.userClubId ? down : up].short },
            })
          } else {
            swaps.push(line)
            swapRows.push(lineV)
          }
          continue
        }
      }
    }
    state.clubs[down].leagueId = lowId
    state.clubs[down].rep = Math.max(44, state.clubs[down].rep - 4)
    state.clubs[up].leagueId = topId
    state.clubs[up].rep = Math.min(88, state.clubs[up].rep + 5)
    if (up === state.userClubId) {
      state.celebration = {
        headline: tIn('en', 'cel.promoted', { short: state.clubs[up].short.toUpperCase() }),
        sub: tIn('en', 'cel.promotedSub', { comp_k: topName, manager: state.managerName }),
        icon: 'promoted',
        hk: 'cel.promoted', hv: { short: state.clubs[up].short.toUpperCase() },
        sk: 'cel.promotedSub', sv: { comp_k: topName, manager: state.managerName },
      }
    }
    const userInvolved = down === state.userClubId || up === state.userClubId
    if (!userInvolved) {
      swaps.push(`${tIn('en', topName)}: ${state.clubs[up].name} up, ${state.clubs[down].name} down`)
      swapRows.push({ k: 'news.swapRow', comp_k: topName, up: state.clubs[up].name, down: state.clubs[down].name })
      continue
    }
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
      subject: down === state.userClubId
        ? `RELEGATED: ${state.clubs[down].name} go down`
        : `PROMOTED: ${state.clubs[up].name} are going up!`,
      // i18n-exempt-start
      // The English the story is FILED as, next to the key below it. Stored
      // English is not display text - see NewsItem.body.
      body: (() => {
        const bar = topId === 'prem' ? state.fixtures.find(f => f.compId === 'prem' && f.stage === 'BAR' && f.played) : null
        const how = bar
          ? `${state.clubs[up].name} win the relegation play-off ${Math.max(bar.homeScore, bar.awayScore)}-${Math.min(bar.homeScore, bar.awayScore)} away from home and take the Premier Division place. ${state.clubs[down].name} lose it on their own ground and drop into the second tier.`
          : `${state.clubs[up].name} have won promotion to ${tIn('en', topName)}. ${state.clubs[down].name} finished bottom and drop into the second tier.`
        return `${how}${down === state.userClubId ? ' The board is wounded and the budget will feel it - win the league and bounce straight back.' : ''}${up === state.userClubId ? ' The big time. The board urges cool heads: survival is the first objective.' : ''}`
      })(),
      // i18n-exempt-end
      k: down === state.userClubId ? 'news.relegated' : 'news.promoted',
      v: (() => {
        const bar = topId === 'prem' ? state.fixtures.find(f => f.compId === 'prem' && f.stage === 'BAR' && f.played) : null
        return {
          up: state.clubs[up].name, down: state.clubs[down].name, comp_k: topName,
          how_k: bar ? 'news.upDownBar' : 'news.upDownAuto',
          hi: bar ? Math.max(bar.homeScore, bar.awayScore) : 0,
          lo: bar ? Math.min(bar.homeScore, bar.awayScore) : 0,
        }
      })(),
    })
  }
  if (swaps.length) {
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
      subject: `Up and down: the trapdoors swing across the leagues`,
      body: `${swaps.join('. ')}. Fortunes made and unmade in a single afternoon, and next season's fixture lists are redrawn accordingly.`,
      k: 'news.upAndDown', v: { rows_l: JSON.stringify(swapRows) },
    })
  }
}

/** Continental Cup and Shield places for next season, from the final league
 *  standings. */
export function cupQualifiers(state: GameState): { euroSlots: string[]; chcSlots: string[] } {
  const euroSlots: string[] = []
  const slotMap: Record<string, number> = { prem: 5, top14: 6, urc: 5 }
  for (const [leagueId, slots] of Object.entries(slotMap)) {
    const comp = state.comps[leagueId]
    if (comp) euroSlots.push(...sortTable(comp.table).map(r => r.teamId).slice(0, slots))
  }
  // Continental Shield slots come from the same final standings - this must run
  // BEFORE the season wipe (it once read the rebuilt, zeroed tables, handing
  // out places at random and double-booking Continental Cup clubs)
  const chcSlots: string[] = []
  const euroSet = new Set(euroSlots.slice(0, 16))
  const chcMap: Record<string, [number, number]> = { champ: [0, 2], prem: [5, 9], top14: [6, 11], urc: [5, 10] }
  for (const [leagueId, [from, to]] of Object.entries(chcMap)) {
    const comp = state.comps[leagueId]
    if (comp) chcSlots.push(...sortTable(comp.table).map(t => t.teamId).slice(from, to).filter(id => !euroSet.has(id)))
  }
  // a filtered slot leaves the draw short: top up with the best of the rest
  if (chcSlots.length < 16) {
    const taken = new Set([...euroSet, ...chcSlots])
    const rest = Object.values(state.clubs)
      .filter(c => ['prem', 'top14', 'urc', 'champ'].includes(c.leagueId) && !taken.has(c.id))
      .sort((a, b) => b.rep - a.rep)
    while (chcSlots.length < 16 && rest.length) chcSlots.push(rest.shift()!.id)
  }
  return { euroSlots, chcSlots }
}

/** Every competition rebuilt for the new season. Returns whether it is a
 *  World Championship season in this world. */
export function rebuildCompetitions(state: GameState, rng: Rng, euroSlots: string[], chcSlots: string[]): boolean {
  state.comps = {}

  // LEAGUE_DEFS takes the world's gender: a women's career rebuilding its
  // competitions in August must rebuild the women's ones. Without it the
  // season rollover would quietly replace them with the men's leagues, and
  // every club in the save would find itself in a competition that does not
  // contain it.
  for (const def of LEAGUE_DEFS(genderOf(state))) {
    const teamIds = Object.values(state.clubs).filter(c => c.leagueId === def.id).map(c => c.id)
    state.comps[def.id] = buildLeague(
      { id: def.id, name: def.name, short: def.short, teams: teamIds, double: def.double, playoffTeams: def.playoffTeams, shields: def.shields },
      rng, state,
    )
  }
  // minus ten before a ball is kicked, for anyone who went under in the summer
  for (const comp of Object.values(state.comps)) applyAdminPenalties(comp, state)
  // The men's cups and the men's Test calendar, rebuilt each August. Skipped in
  // the women's world for the same reason newGame skips them: they are shaped
  // around competitions the women's game does not have, and building them there
  // creates empty comps wearing men's ids inside a women's save. The women's
  // cups and internationals arrive with their own calendar.
  //
  // wcYear is false in the women's world rather than skipped, because it also
  // gates the "a World Championship season" story further down. A women's
  // career must not be told to plan around a men's World Cup it cannot see.
  // each world on its own four-year cycle (1.6.4): the men's tournament in
  // 2027, 2031 and on, the women's in 2029, 2033 and on
  const wcYear = worldCupSeasonFor(state)
  if (genderOf(state) !== 'w') {
    state.comps['cc'] = buildChampionsCup(euroSlots.slice(0, 16), rng, state)
    state.comps['chc'] = buildChampionsCup(chcSlots.slice(0, 16), rng, state, { id: 'chc', name: 'Continental Shield', short: 'Continental Shield' })
    buildInternationals(rng, state, wcYear)
    // the American clubs' cup, after their league (1.9.1, calendar.ts): its
    // own draw stream, so nothing above it moves
    const mrcCup = buildMrcCup(Object.values(state.clubs).filter(c => c.leagueId === 'mrc').map(c => c.id), state)
    if (mrcCup) state.comps[mrcCup.id] = mrcCup
  } else {
    // The women's world gets its own continental cup, drawn the same way it was
    // drawn in August of year one. This used to be built only in newGame, so a
    // women's career had the competition for a single season and then found it
    // gone at the rollover - along with the two ambitions that name it, in the
    // middle of a save that had already been offered them.
    state.comps['cc'] = buildWomensContinentalCup(rng, state)
    buildWomensInternationals(rng, state, wcYear)
  }
  schedulePreseason(state, rng)
  // and a fresh A League for whichever league the manager is in NOW - a summer
  // move to the Elite 14 gets him the Espoirs rather than last year's Premier Division
  state.academy = undefined
  ensureAcademyLeague(state)
  return wcYear
}
