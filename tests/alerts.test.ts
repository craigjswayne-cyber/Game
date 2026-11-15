// The dressing room in the inbox (owner, 1.9.13, from FM27 Mobile): alerts.ts.
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { DROUGHT_GAMES, dressingRoomAlerts, noteTryRun } from '../src/game/alerts'
import type { GameState, Player } from '../src/game/model'

function setup(): { g: GameState; ps: Player[] } {
  const g = newGame('northampton', 'Alerts', 12)
  const ps = g.clubs[g.userClubId].players.map(id => g.players[id]).filter((p): p is Player => !!p && !p.acad)
  for (const p of ps) { p.morale = 7; p.ratings = [7, 7, 7, 7]; p.dry = 0; p.alerted = undefined; p.injury = undefined }
  g.news = []
  return { g, ps }
}
const alerts = (g: GameState) => g.news.filter(n => /^news\.(tryDrought|moraleLow|formSlump)$/.test(n.k ?? ''))

describe('dressing-room alerts', () => {
  it('counts a scorer\'s games without a try, and a try ends the run', () => {
    const { ps } = setup()
    const p = ps[0]
    p.stats.tries = 3; p.tryMark = 3; p.dry = 0
    noteTryRun(p); noteTryRun(p)
    expect(p.dry).toBe(2)
    p.stats.tries = 4
    noteTryRun(p)
    expect(p.dry).toBe(0)
  })
  it('names a try drought once per spell', () => {
    const { g, ps } = setup()
    const w = ps.find(p => p.pos === 'WG')!
    w.stats.tries = 3; w.dry = DROUGHT_GAMES
    dressingRoomAlerts(g)
    expect(alerts(g).map(n => n.k)).toEqual(['news.tryDrought'])
    expect(alerts(g)[0].playerId).toBe(w.id)
    dressingRoomAlerts(g)
    expect(alerts(g)).toHaveLength(1)
  })
  it('names a regular who is low, and again only after he has recovered and dipped', () => {
    const { g, ps } = setup()
    const p = ps[0]
    p.status = 'key'; p.morale = 3
    dressingRoomAlerts(g)
    expect(alerts(g).map(n => n.k)).toEqual(['news.moraleLow'])
    dressingRoomAlerts(g)
    expect(alerts(g)).toHaveLength(1)
    p.morale = 6; dressingRoomAlerts(g)
    p.morale = 3; dressingRoomAlerts(g)
    expect(alerts(g)).toHaveLength(2)
  })
  it('names a slump, and never more than two alerts in a week', () => {
    const { g, ps } = setup()
    for (const p of ps.slice(0, 5)) { p.status = 'key'; p.ratings = [7.5, 6.8, 6.2, 5.6, 5.2]; p.stats.apps = 10; p.stats.ratingSum = 68 }
    dressingRoomAlerts(g)
    expect(alerts(g)).toHaveLength(2)
    expect(alerts(g).every(n => n.k === 'news.formSlump')).toBe(true)
  })
})
