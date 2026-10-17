// The national side over the summer: the touring party comes home, and the
// union reviews its head coach.
import { tIn } from '../i18n'
import { isleTour } from '../isles'
import { closeNatTenure, type GameState, type Player } from '../model'
import { clamp } from '../rng'

/** The Lions come home: the tour ends with the season itself, so the
 *  window's return week (end + 1) never exists on the calendar - the
 *  homecoming is processed here, before the blanket natSquad reset. */
export function lionsHomecoming(state: GameState) {
  const lionsHome = (state.natSquads?.['LIO'] ?? [])
    .map(id => state.players[id])
    .filter((p): p is Player => !!p && p.clubId === state.userClubId)
  if (lionsHome.length) {
    const comp = isleTour(state)
    const seriesWon = comp?.champion === 'LIO'
    for (const p of lionsHome) {
      p.morale = clamp(p.morale + 0.6, 1, 10)
      p.a.lea = clamp(p.a.lea + 1, 1, 20)
    }
    state.news.push({
      id: state.nextId++, week: 1, season: state.season + 1, type: 'intl', read: false,
      subject: `The tourists come home${seriesWon ? ' as series winners' : ''}`,
      body: [
        `Back in club colours after ${comp?.name ?? 'the Isles tour'}: ${lionsHome.map(p => p.name).join(', ')}.`,
        seriesWon
          ? `A series win in the luggage, and the kind of standing money cannot buy. Expect ${lionsHome.length === 1 ? 'him' : 'them'} to walk taller here too.`
          : `Win or lose, a tour changes a player - ${lionsHome.length === 1 ? 'he comes' : 'they come'} back a bigger presence in this dressing room.`,
      ].join(' '),
      k: seriesWon ? 'news.lionsHomeWon' : 'news.lionsHome',
      v: {
        tour: comp?.name ?? tIn('en', 'news.theLionsTour'),
        names: lionsHome.map(p => p.name).join(', '),
        him_k: lionsHome.length === 1 ? 'news.himOne' : 'news.himMany',
        come_k: lionsHome.length === 1 ? 'news.comesOne' : 'news.comeMany',
      },
      playerId: lionsHome[0].id,
    })
  }
}

/** The union's annual review: the Test job answers to somebody too. */
export function unionReview(state: GameState) {
  if (state.natTeam && state.natConfidence != null) {
    const nat = state.natTeam
    const natFx = state.fixtures.filter(f => f.played && (f.homeId === nat || f.awayId === nat) &&
      !state.clubs[f.homeId] && !state.clubs[f.awayId])
    let w = 0, l = 0
    for (const f of natFx) {
      const us = f.homeId === nat ? f.homeScore : f.awayScore
      const them = f.homeId === nat ? f.awayScore : f.homeScore
      if (us > them) w++
      else if (us < them) l++
    }
    const conf = Math.round(state.natConfidence)
    if (conf < 28) {
      closeNatTenure(state) // the record moves to the profile's history, not the bin
      state.news.push({
        id: state.nextId++, week: 1, season: state.season + 1, type: 'board', read: false,
        subject: `SACKED: ${nat} relieve you of the national job`,
        body: `The union's annual review was short. ${w} Test wins against ${l} defeats was not the trajectory they hired you for, and the ${nat} job is no longer yours. The club work continues - and unions have short memories when results turn.`,
        k: 'news.natSacked',
        v: {
          nat, w, l,
          wins_k: w === 1 ? 'count.winOne' : 'count.winMany',
          defeats_k: l === 1 ? 'count.defeatOne' : 'count.defeatMany',
        },
      })
    } else {
      state.news.push({
        id: state.nextId++, week: 1, season: state.season + 1, type: 'board', read: false,
        subject: `Union annual review: ${conf >= 70 ? 'glowing' : conf >= 45 ? 'satisfactory' : 'concerned'}`,
        body: [
          `The ${nat} union has completed its annual review of the national programme: ${w} Test wins, ${l} defeats this season. Confidence in the head coach stands at ${conf}%.`,
          conf >= 70 ? `They are already talking about extending your tenure.`
            : conf >= 45 ? `Steady as she goes - but unions measure everything in World Championships.`
            : `The knives are not out yet, but the drawer is open. The next window matters.`,
        ].join(' '),
        k: 'news.natReview',
        v: {
          nat, w, l, conf,
          wins_k: w === 1 ? 'count.winOne' : 'count.winMany',
          defeats_k: l === 1 ? 'count.defeatOne' : 'count.defeatMany',
          word_k: conf >= 70 ? 'news.natGlowing' : conf >= 45 ? 'news.natSatisfactory' : 'news.natConcerned',
          tail_k: conf >= 70 ? 'news.natTailGood' : conf >= 45 ? 'news.natTailOk' : 'news.natTailBad',
        },
      })
      // summers soften opinions a little, in both directions - but they do
      // not launder a losing record
      state.natConfidence = clamp(state.natConfidence * 0.9 + 55 * 0.1, 0, 100)
    }
  }
}
