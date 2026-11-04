// Position retraining and the training load (owner, 1.9.9: "players can ask to
// retrain in positions occasionally or the manager can advise this. But it
// isn't always successful. Forwards / backs should rarely train in the
// opposite positions.")
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { absWeek, type GameState, type Player, type Pos } from '../src/game/model'
import {
  FORWARDS, LOAD, freePlaces, healRetrains, reachOf, retrainBlock, retrainOdds, retrainOf, retrainWeeks,
  settleRetrains, startRetrain,
} from '../src/game/retrain'
import { planCap } from '../src/game/season/training'
import { setPlan } from '../src/game/development'
import { answerPress } from '../src/game/media'
import { migrate } from '../src/game/save'

function setup() {
  const g = newGame('northampton', 'Retrain', 21)
  const club = g.clubs[g.userClubId]
  const seniors = club.players.map(id => g.players[id]).filter((p): p is Player => !!p && !p.acad)
  const flanker = seniors.find(p => p.pos === 'FL')!
  flanker.alt = []
  return { g, club, seniors, flanker }
}

/** Jump the clock to the week a retrain is due. */
function finish(g: GameState, id: number) {
  const r = retrainOf(g, id)!
  const at = r.start + r.weeks
  g.season = Math.floor(at / 48); g.week = at - g.season * 48
  if (absWeek(g.season, g.week) !== at) { g.week = at % 48; g.season = (at - g.week) / 48 }
}

describe('how far the move is', () => {
  it('a neighbour is likely, the same unit less so, the other unit rare', () => {
    const { g, flanker } = setup()
    expect(reachOf(flanker, 'N8')).toBe('near')
    expect(reachOf(flanker, 'TP')).toBe('unit')
    expect(reachOf(flanker, 'WG')).toBe('cross')
    const near = retrainOdds(g, flanker, 'N8', false)
    const unit = retrainOdds(g, flanker, 'TP', false)
    const cross = retrainOdds(g, flanker, 'WG', false)
    expect(near).toBeGreaterThan(unit)
    expect(unit).toBeGreaterThan(cross)
    expect(retrainWeeks(flanker, 'N8')).toBeLessThan(retrainWeeks(flanker, 'WG'))
  })
  it('no forward ever has better than one in eight at a back, whatever else is true', () => {
    const { g, seniors } = setup()
    g.staff.assistant = 3
    for (const p of seniors) {
      p.age = 20
      for (const to of ['LP', 'HK', 'TP', 'LK', 'FL', 'N8', 'SH', 'FH', 'CE', 'WG', 'FB'] as Pos[]) {
        if (FORWARDS.has(p.pos) !== FORWARDS.has(to)) expect(retrainOdds(g, p, to, true)).toBeLessThanOrEqual(0.12)
      }
    }
  })
  it('age and asking move the odds the right way', () => {
    const { g, flanker } = setup()
    flanker.age = 22
    const young = retrainOdds(g, flanker, 'TP', false)
    flanker.age = 32
    expect(retrainOdds(g, flanker, 'TP', false)).toBeLessThan(young)
    expect(retrainOdds(g, flanker, 'TP', true)).toBeGreaterThan(retrainOdds(g, flanker, 'TP', false))
  })
})

describe('a retrain in the department', () => {
  it('takes a personal-plan place, and a full book refuses it', () => {
    const { g, seniors, flanker } = setup()
    const before = freePlaces(g)
    expect(startRetrain(g, flanker.id, 'N8', false)).toBe(true)
    expect(freePlaces(g)).toBe(before - 1)
    // fill the rest with plans
    for (const p of seniors.filter(x => x.id !== flanker.id).slice(0, planCap(g))) setPlan(g, p.id, 'attack')
    expect(freePlaces(g)).toBe(0)
    const other = seniors.find(p => p.id !== flanker.id && !(g.plans ?? []).some(x => x.id === p.id))!
    const to = (['FB', 'WG', 'TP'] as Pos[]).find(x => x !== other.pos && !other.alt.includes(x))!
    expect(retrainBlock(g, other, to)).toBe('training.retrainWhyFull')
    // and a man retraining cannot also be put on a plan
    expect(setPlan(g, flanker.id, 'defence')).toBe(false)
  })
  it('a man told to retrain, not asking, takes it a little badly', () => {
    const { g, flanker } = setup()
    flanker.morale = 6
    startRetrain(g, flanker.id, 'N8', false)
    expect(flanker.morale).toBeCloseTo(5.5)
  })
  it('lands at the end: the shirt is his, or it is not and cannot be tried again this season', () => {
    let won = 0, lost = 0
    for (let seed = 1; seed <= 40 && (won === 0 || lost === 0); seed++) {
      const { g, flanker } = setup()
      g.seed = seed
      startRetrain(g, flanker.id, 'TP', true)
      finish(g, flanker.id)
      settleRetrains(g)
      expect(retrainOf(g, flanker.id)).toBeNull()
      if (flanker.alt.includes('TP')) {
        won++
        expect(g.news.at(-1)?.k).toBe('news.retrainDone')
      } else {
        lost++
        expect(g.news.at(-1)?.k).toBe('news.retrainFail')
        expect(retrainBlock(g, flanker, 'TP')).toBe('training.retrainWhyFailed')
      }
    }
    expect(won).toBeGreaterThan(0)
    expect(lost).toBeGreaterThan(0)
  })
  it('is the same result for the same seed (a hash, not the season rng)', () => {
    const run = () => {
      const { g, flanker } = setup()
      startRetrain(g, flanker.id, 'TP', true)
      finish(g, flanker.id); settleRetrains(g)
      return flanker.alt.includes('TP')
    }
    expect(run()).toBe(run())
  })
})

describe('the office answer starts it', () => {
  it('"start on it in training" puts him on a real retrain', () => {
    const { g, flanker } = setup()
    g.press.push({
      id: g.nextId++, week: g.week, season: g.season, outlet: 'office', question: 'q', qk: 'talk.positionQ3',
      qv: {}, playerId: flanker.id, answered: false, topic: 'position',
      options: [{ label: 'learn', lk: 'talk.positionLearn', morale: 0, board: 0, reaction: '', tb: 'learn', retrain: 'N8' }],
    } as GameState['press'][number])
    answerPress(g, g.press.at(-1)!.id, 0)
    expect(retrainOf(g, flanker.id)?.to).toBe('N8')
    expect(retrainOf(g, flanker.id)?.asked).toBe(true)
  })
})

describe('the training load', () => {
  it('normal is the week every save always had, and the others trade', () => {
    expect(LOAD.normal).toEqual({ grow: 1, inj: 1, rec: 0 })
    expect(LOAD.hard.grow).toBeGreaterThan(1)
    expect(LOAD.hard.inj).toBeGreaterThan(1)
    expect(LOAD.hard.rec).toBeLessThan(0)
    expect(LOAD.light.grow).toBeLessThan(1)
    expect(LOAD.light.inj).toBeLessThan(1)
    expect(LOAD.light.rec).toBeGreaterThan(0)
  })
})

describe('a damaged save', () => {
  it('keeps only retrains the week can read, and a load it knows', () => {
    const { g, flanker } = setup()
    ;(g as unknown as Record<string, unknown>).retrains = [{ id: flanker.id, to: 'N8', start: 10, weeks: 8, odds: 0.7, asked: true }, { id: 'x', to: 'ZZ' }, null]
    ;(g as unknown as Record<string, unknown>).trainLoad = 'brutal'
    ;(g as unknown as Record<string, unknown>).trainLog = { season: 0, week: 1, load: 'brutal', pts: 1, inj: 0 }
    healRetrains(g)
    expect(g.retrains).toHaveLength(1)
    expect(g.trainLoad).toBeUndefined()
    expect(g.trainLog).toBeUndefined()
    expect(() => migrate(g)).not.toThrow()
  })
})
