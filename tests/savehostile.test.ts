/**
 * ---- A STRANGER'S FILE, AND AN OLD ONE (1.9.4 persistence audit) ----
 *
 * Import reads whatever a player was sent, and migrate() is the one gate
 * between that file and the game. The bar is the one scripts/savefuzz.ts
 * sets: refused or healed are both fine, a throw is not, and nothing it
 * accepts may poison the world (or the page) afterwards. What this adds:
 *
 *   ids that are the names of Object.prototype's members ("__proto__",
 *   "constructor", "toString") are refused or dropped, never looked up as if
 *   they were clubs: a club called "__proto__" made `book[oppId] ??= {}`
 *   write the head-to-head record onto Object.prototype itself
 *   a players map holding a null, a key that is not an id, or a man filed
 *   under somebody else's id is pruned, not fatal and not a NaN id counter
 *   condition, sharpness, rust, a knock and an injury that are not numbers
 *   are healed, so the 1.9.4 condition spread never meets a NaN
 *   a save from before a league existed migrates to the same career on the
 *   second load as on the first (the injected clubs' wage budgets were left
 *   at the old transfer-scale figure until the next load healed them)
 */
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { isPlayable, migrate, readImport } from '../src/game/save'
import { peekPid, resetIds } from '../src/game/attributes'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { answerPress } from '../src/game/media'
import type { GameState } from '../src/game/model'

const BASE = JSON.stringify(newGame('leicester', 'Hostile', 4242))
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any
const raw = (): Raw => JSON.parse(BASE)

/** Object.prototype's own names, so a polluted one shows as an extra */
const PROTO_NAMES = Object.getOwnPropertyNames(Object.prototype).sort().join(',')
const pristineProto = () => Object.getOwnPropertyNames(Object.prototype).sort().join(',') === PROTO_NAMES

function play(g: GameState, weeks: number) {
  for (let w = 0; w < weeks; w++) {
    resetIds(Math.max(peekPid(), g.pidNext ?? 1))
    const fx = userFixtureThisWeek(g)
    if (fx) simMatch(g, fx, weekRng(g), true)
    for (const pi of g.press.filter(p => !p.answered)) answerPress(g, pi.id, 0)
    processWeekAndAdvance(g)
  }
}

/** the whole import gate, from the file's text to a career or a refusal */
function imported(s: Raw): GameState | null {
  return readImport(JSON.stringify(s))
}

describe('ids named after Object.prototype', () => {
  it('a club called __proto__ is refused, and nothing reaches Object.prototype', () => {
    // every mention of one club renamed, the way a crafted file would do it
    const s = JSON.parse(BASE.split('"bath"').join('"__proto__"'))
    expect(Object.hasOwn(s.clubs, '__proto__')).toBe(true)
    expect(imported(s)).toBeNull()
    const g = migrate(s)
    expect(isPlayable(g)).toBe(false)
    expect(pristineProto()).toBe(true)
  })

  it('clubs, competitions and the manager\'s club named constructor or toString are refused', () => {
    for (const name of ['constructor', 'toString', 'hasOwnProperty']) {
      const club = JSON.parse(BASE.split('"bath"').join(`"${name}"`))
      expect(imported(club), `club ${name}`).toBeNull()
      const comp = raw()
      comp.comps[name] = { ...comp.comps.prem, id: name }
      expect(imported(comp), `comp ${name}`).toBeNull()
      const me = raw()
      me.userClubId = name
      expect(() => migrate(me)).not.toThrow()
      expect(imported(me), `userClubId ${name}`).toBeNull()
    }
    expect(pristineProto()).toBe(true)
  })

  it('a string value of __proto__ anywhere in an import is refused', () => {
    const s = raw()
    s.dream = { id: 'league', clubId: '__proto__' }
    expect(imported(s)).toBeNull()
  })

  it('a man whose club is an inherited name becomes a free agent, and the career plays on', () => {
    const s = raw()
    const pid = s.clubs[s.userClubId].players[0]
    s.players[pid].clubId = 'hasOwnProperty'
    const fx = s.fixtures.find((f: Raw) => f.homeId === s.userClubId && !f.played)
    fx.awayId = 'constructor'
    const g = imported(s)!
    expect(g).not.toBeNull()
    expect(g.players[pid].clubId).toBeNull()
    expect(g.fixtures.some(f => f.id === fx.id)).toBe(false)
    expect(() => play(g, 3)).not.toThrow()
    expect(pristineProto()).toBe(true)
  }, 60_000)
})

describe('a damaged players map', () => {
  it('a null where a man was costs that man, not the career', () => {
    const s = raw()
    const k = Object.keys(s.players)[5]
    s.players[k] = null
    s.players[Object.keys(s.players)[6]] = 'nobody'
    const g = imported(s)!
    expect(g).not.toBeNull()
    expect(g.players[Number(k)]).toBeUndefined()
    expect(() => play(g, 2)).not.toThrow()
  }, 60_000)

  it('a key that is not an id, or a man filed under another id, is dropped and the id counter stays a number', () => {
    const s = raw()
    const ks = Object.keys(s.players)
    s.players.abc = s.players[ks[5]]
    delete s.players[ks[5]]
    // a duplicate: the same man under a second key
    s.players['99999'] = { ...s.players[ks[7]] }
    const g = imported(s)!
    expect(g).not.toBeNull()
    expect(Object.entries(g.players).every(([k, p]) => String(p.id) === k)).toBe(true)
    expect(Number.isFinite(peekPid())).toBe(true)
    play(g, 2)
    expect(Number.isFinite(g.pidNext)).toBe(true)
    expect(Object.keys(g.players).every(k => /^\d+$/.test(k))).toBe(true)
    // and a man whose id is itself not a number does not make the counter NaN
    const t = raw()
    t.players.xyz = { ...t.players[ks[9]], id: 'xyz' }
    resetIds(1)
    expect(imported(t)).not.toBeNull()
    expect(Number.isFinite(peekPid())).toBe(true)
  }, 60_000)
})

describe('condition, sharpness, rust, knocks and injuries that are not numbers (1.9.4)', () => {
  const BAD: unknown[] = [undefined, null, 'tired', '80', -40, 250, 1e999, -1e999, {}, []]

  it('every hostile value heals into range and four weeks play on', () => {
    const s = raw()
    const ids: number[] = s.clubs[s.userClubId].players
    ids.forEach((id, i) => {
      const p = s.players[id]
      const v = BAD[i % BAD.length]
      if (v === undefined) { delete p.cond; delete p.sharp; delete p.rust } else { p.cond = v; p.sharp = v; p.rust = v }
    })
    // knocks and injuries a bad copy could leave behind
    s.players[ids[0]].knock = 'strapped'
    s.players[ids[1]].knock = { dk: 'injury.hamstring', desc: 'x', until: 'soon', weeks: 'some', early: null, mins: 'lots' }
    s.players[ids[2]].knock = { dk: 'injury.hamstring', desc: 'x', until: s.week + 2, weeks: 'some', early: 'x', mins: 0 }
    s.players[ids[3]].injury = { desc: 'Hamstring', dk: 'injury.hamstring', until: 'never', weeks: 3 }
    s.players[ids[4]].injury = 'broken'
    // 1e999 and -1e999 were written out as null; in the file's text they
    // come back in as Infinity, which JSON.parse is happy to make
    const txt = JSON.stringify(s).replace('"cond":null', '"cond":1e999').replace('"sharp":null', '"sharp":-1e999').replace('"rust":null', '"rust":1e999')
    expect(txt.includes('1e999')).toBe(true)
    const g = readImport(txt)!
    expect(g).not.toBeNull()
    const range = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100
    for (const id of ids) {
      const p = g.players[id]
      expect(range(p.cond), `cond ${id} ${p.cond}`).toBe(true)
      expect(range(p.sharp), `sharp ${id} ${p.sharp}`).toBe(true)
      expect(typeof p.rust === 'number' && Number.isFinite(p.rust) && p.rust >= 0, `rust ${id} ${p.rust}`).toBe(true)
    }
    expect(g.players[ids[0]].knock).toBeUndefined()
    expect(g.players[ids[4]].injury).toBeNull()
    play(g, 4)
    for (const id of ids) {
      const p = g.players[id]
      if (!p) continue
      expect(range(p.cond), `after: cond ${id} ${p.cond}`).toBe(true)
      expect(range(p.sharp), `after: sharp ${id} ${p.sharp}`).toBe(true)
      if (p.injury) expect(Number.isFinite(p.injury.until), `after: injury ${id}`).toBe(true)
      if (p.knock) expect([p.knock.until, p.knock.weeks].every(Number.isFinite), `after: knock ${id}`).toBe(true)
    }
  }, 60_000)
})

describe('a save from before a league existed', () => {
  // the shape of a genuine pre-1.7.3 save (scripts/_legacy: one made by the
  // 1.6.5 build itself had no MRC clubs): the league and its men taken out
  function legacy(): Raw {
    const s = raw()
    for (const c of Object.values(s.clubs) as Raw[]) {
      if (c.leagueId !== 'mrc') continue
      for (const id of c.players) delete s.players[id]
      delete s.clubs[c.id]
    }
    delete s.comps.mrc
    s.fixtures = s.fixtures.filter((f: Raw) => f.compId !== 'mrc')
    return s
  }

  it('migrates to the same career on the second load as on the first', () => {
    resetIds(1)
    const once = migrate(legacy())
    const injected = Object.values(once.clubs).filter(c => c.leagueId === 'mrc')
    expect(injected.length).toBeGreaterThan(0)
    // a weekly figure, like every other club's, not budget * 0.9 + 2.5m
    for (const c of injected) {
      const bill = c.players.reduce((t, id) => t + (once.players[id]?.acad ? 0 : once.players[id]?.wage ?? 0), 0)
      expect(c.wageBudget, c.id).toBeLessThan(bill * 2)
    }
    const a = JSON.stringify(once)
    const twice = JSON.stringify(migrate(JSON.parse(a)))
    expect(twice === a).toBe(true)
  }, 60_000)
})

describe('round trips', () => {
  it('a played career is the same after one save and load as after five', () => {
    resetIds(1)
    const g = migrate(raw())
    play(g, 3)
    const one = JSON.stringify(migrate(JSON.parse(JSON.stringify(g))))
    let r = one
    for (let i = 0; i < 4; i++) r = JSON.stringify(migrate(JSON.parse(r)))
    expect(r === one).toBe(true)
  }, 60_000)
})
