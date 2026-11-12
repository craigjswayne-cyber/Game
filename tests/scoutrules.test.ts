// The scouting overhaul, part one (1.9.12): what can be learned from where.
// Measured on 1.9.11: the whole of the manager's own league had a full file
// by week 24 for nothing, and three weeks on the shortlist bought what the
// chief scout's six-figure brief did. Each source now has a ceiling, the full
// file is the scout's own work, and a file nobody keeps up goes stale.
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import {
  FREE_CAP, LEAGUE_CAP, MATCH_CAP, baseKnowledge, bumpKnowledge, fadeKnowledge, knowledge, persKnown,
  scoutOpponent, scoutWatchList, toggleScoutWatch, watchSlots, weeklyScouting,
} from '../src/game/scout'
import type { GameState, Player } from '../src/game/model'

const world = () => newGame('northampton', 'Scout', 7)
const abroad = (g: GameState): Player => {
  const lg = g.clubs[g.userClubId].leagueId
  return Object.values(g.players).find(p => p.clubId && g.clubs[p.clubId]?.leagueId !== lg && !p.intl && p.ca < 80 && !p.acad)!
}
const rival = (g: GameState): Player => {
  const lg = g.clubs[g.userClubId].leagueId
  return Object.values(g.players).find(p => p.clubId && p.clubId !== g.userClubId && g.clubs[p.clubId]?.leagueId === lg && !p.intl && !p.acad)!
}

describe('each way of learning about a man has a ceiling', () => {
  it('a cap never lowers a better file, and never passes itself', () => {
    const g = world(); const p = abroad(g)
    p.sc = 90; bumpKnowledge(p, 20, FREE_CAP); expect(p.sc).toBe(90)
    p.sc = 70; bumpKnowledge(p, 20, FREE_CAP); expect(p.sc).toBe(FREE_CAP)
    p.sc = 70; bumpKnowledge(p, 50); expect(p.sc).toBe(100)
  })

  it('the shortlist reaches a proper report and stops there', () => {
    const g = world(); const p = abroad(g)
    g.shortlist = [p.id]
    for (let w = 0; w < 12; w++) weeklyScouting(g)
    expect(knowledge(g, p)).toBe(FREE_CAP)
    expect(persKnown(g, p)).toBe(false)
  })

  it('your own league is read, not finished, by the end of a season', () => {
    const g = world()
    const lg = g.clubs[g.userClubId].leagueId
    while (g.season === 0) processWeekAndAdvance(g)
    const men = Object.values(g.players).filter(p => p.clubId && p.clubId !== g.userClubId && g.clubs[p.clubId]?.leagueId === lg && !p.acad)
    const rated = men.filter(p => (p.sc ?? 0) >= 55).length / men.length
    const full = men.filter(p => (p.sc ?? 0) >= 90).length / men.length
    expect(rated).toBeGreaterThan(0.95)
    // it was 100% on 1.9.11
    expect(full).toBeLessThan(0.05)
  })

  it('playing against a side teaches less than it did, and not the full file', () => {
    const g = world(); const p = rival(g)
    p.sc = 60
    scoutOpponent(g, p.clubId!); expect(p.sc).toBe(66)
    for (let i = 0; i < 10; i++) scoutOpponent(g, p.clubId!)
    expect(p.sc).toBe(MATCH_CAP)
  })

  it('a league under the scout\'s watch is read closer than the shortlist, short of the full file', () => {
    const g = world(); const p = abroad(g)
    g.scoutFocus = g.clubs[p.clubId!].leagueId
    for (let w = 0; w < 40; w++) weeklyScouting(g)
    expect(knowledge(g, p)).toBe(LEAGUE_CAP)
  })
})

describe('the scout\'s own watch', () => {
  it('has a slot for each badge, three at most', () => {
    const g = world()
    for (const [lvl, n] of [[0, 0], [1, 1], [2, 2], [3, 3], [4, 3]] as const) { g.staff.scout = lvl; expect(watchSlots(g)).toBe(n) }
  })

  it('takes a man to the full file, files the verdict, and frees the slot', () => {
    const g = world(); g.staff.scout = 1; const p = abroad(g)
    expect(toggleScoutWatch(g, p.id).ok).toBe(true)
    expect(scoutWatchList(g)).toEqual([p.id])
    const other = rival(g)
    const full = toggleScoutWatch(g, other.id)
    expect(full.ok).toBe(false); expect(full.k).toBe('reply.watchFull')
    let weeks = 0
    while (scoutWatchList(g).includes(p.id) && weeks < 30) { weeklyScouting(g); weeks++ }
    expect(knowledge(g, p)).toBe(100)
    expect(persKnown(g, p)).toBe(true)
    expect(weeks).toBeGreaterThanOrEqual(5)   // from a name, with one badge
    expect(weeks).toBeLessThanOrEqual(8)
    expect(g.scoutRecs?.some(r => r.playerId === p.id && r.src === 'watch')).toBe(true)
    expect(toggleScoutWatch(g, other.id).ok).toBe(true)
  })

  it('needs a chief scout, and is not for your own men', () => {
    const g = world(); const p = abroad(g)
    g.staff.scout = 0
    expect(toggleScoutWatch(g, p.id)).toMatchObject({ ok: false, k: 'reply.noChiefScout' })
    g.staff.scout = 2
    const own = g.players[g.clubs[g.userClubId].players[0]]
    expect(toggleScoutWatch(g, own.id).ok).toBe(false)
  })
})

describe('a file nobody keeps up goes stale', () => {
  it('fades towards what the club would know anyway, faster for a young man', () => {
    const g = world(); const p = abroad(g)
    const base = baseKnowledge(g, p)
    p.age = 28; p.sc = 100
    for (let w = 0; w < 48; w++) fadeKnowledge(p, base)
    expect(p.sc).toBeCloseTo(100 - 48 * 0.3, 5)
    p.age = 20; p.sc = 100
    for (let w = 0; w < 48; w++) fadeKnowledge(p, base)
    expect(p.sc).toBeCloseTo(100 - 48 * 0.5, 5)
    p.sc = base + 0.1
    fadeKnowledge(p, base); expect(p.sc).toBe(base)
    fadeKnowledge(p, base); expect(p.sc).toBe(base)
  })

  it('a man on the shortlist or under watch does not fade, and your own league keeps its report', () => {
    const g = world(); const a = abroad(g), r = rival(g)
    a.sc = 74; r.sc = 100
    g.shortlist = [a.id]
    for (let w = 0; w < 20; w++) weeklyScouting(g)
    expect(a.sc).toBe(74)
    expect(r.sc).toBeLessThan(100)
    for (let w = 0; w < 200; w++) weeklyScouting(g)
    expect(r.sc).toBe(FREE_CAP)
    g.shortlist = []
    for (let w = 0; w < 400; w++) weeklyScouting(g)
    expect(a.sc).toBe(baseKnowledge(g, a))
  })
})

// ---- part two: a brief with a specification, and how sure the scout was ----
import { briefPool, briefWorth, commissionScout, resolveCommission } from '../src/game/commission'
import { askingPrice } from '../src/game/transferRules'
import { judgementSpread, scoutRecord, surenessOf } from '../src/game/scoutrecs'

describe('a brief with a specification', () => {
  it('looks only among men who fit it', () => {
    const g = world()
    const all = briefPool(g, { pos: 'LK', leagueId: null })
    const young = briefPool(g, { pos: 'LK', leagueId: null, maxAge: 23 })
    const cheap = briefPool(g, { pos: 'LK', leagueId: null, maxFee: 300_000 })
    expect(young.length).toBeGreaterThan(0)
    expect(young.length).toBeLessThan(all.length)
    expect(young.every(p => p.age <= 23)).toBe(true)
    expect(cheap.length).toBeGreaterThan(0)
    expect(cheap.every(p => askingPrice(g, p) <= 300_000)).toBe(true)
  })

  it('"now" ranks the finished man first and "future" the one with room to grow', () => {
    const g = world()
    const ready = { ...abroad(g), ca: 84, pa: 85, age: 29 } as Player
    const raw = { ...abroad(g), ca: 68, pa: 88, age: 20 } as Player
    expect(briefWorth(ready, 'now')).toBeGreaterThan(briefWorth(raw, 'now'))
    expect(briefWorth(raw, 'future')).toBeGreaterThan(briefWorth(ready, 'future'))
  })

  it('brings back only men inside the specification, and remembers it', () => {
    const g = world(); g.staff.scout = 2
    g.clubs[g.userClubId].balance = 5_000_000
    commissionScout(g, 'any', 3, { maxAge: 22, maxFee: 400_000, aim: 'future' })
    expect(g.commission).toMatchObject({ maxAge: 22, maxFee: 400_000, aim: 'future' })
    // the fee is read when the brief is set and again when it lands: prices move
    const fits = new Set(briefPool(g, g.commission!).map(p => p.id))
    g.season = Math.floor(g.commission!.done / 100); g.week = g.commission!.done % 100
    resolveCommission(g)
    expect(g.scoutFinds?.length).toBeGreaterThan(0)
    for (const f of g.scoutFinds ?? []) {
      expect(g.players[f.playerId].age).toBeLessThanOrEqual(22)
      expect(fits.has(f.playerId) || askingPrice(g, g.players[f.playerId]) <= 400_000).toBe(true)
    }
  })

  it('refuses a brief nobody could answer, before the money goes', () => {
    const g = world(); g.staff.scout = 2
    const before = g.clubs[g.userClubId].balance = 5_000_000
    commissionScout(g, 'HK', 3, { maxAge: 17, maxFee: 1 })
    expect(g.commission ?? null).toBeNull()
    expect(g.clubs[g.userClubId].balance).toBe(before)
  })

  it('ignores a mangled specification', () => {
    const g = world(); g.staff.scout = 2
    g.clubs[g.userClubId].balance = 5_000_000
    commissionScout(g, 'any', 3, { maxAge: NaN, maxFee: -5, aim: 'whenever' as never })
    expect(g.commission).toBeTruthy()
    expect(g.commission!.maxAge).toBeUndefined()
    expect(g.commission!.maxFee).toBeUndefined()
    expect(g.commission!.aim).toBeUndefined()
  })
})

describe('how sure the scout was', () => {
  it('a better badge and a longer look are surer', () => {
    expect(surenessOf({ spread: judgementSpread(3, 39) })).toBe('sure')
    expect(surenessOf({ spread: judgementSpread(1, 4) })).toBe('guess')
    expect(surenessOf({ spread: judgementSpread(2, 13) })).toBe('fair')
    expect(surenessOf({})).toBeNull()
  })

  it('his record counts only the calls that can be judged', () => {
    const g = world(); g.staff.scout = 2
    const a = abroad(g), r = rival(g)
    g.scoutRecs = [
      { playerId: a.id, grade: 2, cur: Math.round(a.ca), pot: 80, note: { k: 'x' } as never, season: 0, week: 1, src: 'brief' },
      { playerId: r.id, grade: 3, cur: Math.round(r.ca) + 10, pot: 90, note: { k: 'x' } as never, season: 0, week: 1, src: 'brief' },
    ]
    expect(scoutRecord(g)).toEqual({ held: 0, judged: 0 })
    a.sc = 100; r.sc = 100
    expect(scoutRecord(g)).toEqual({ held: 1, judged: 2 })
  })
})

describe('rivals in the hunt, and the file on the next opponent', () => {
  it('the scouts ring once per spell when a rival is after a target', async () => {
    const { rivalTalk } = await import('../src/game/recruit')
    const g = world()
    // find men the rumour mill is talking about this spell, at a full file
    const talked = Object.values(g.players).filter(p => {
      if (!p.clubId || p.clubId === g.userClubId) return false
      const was = p.sc; p.sc = 100
      const t = rivalTalk(g, p); p.sc = was
      return !!t
    }).slice(0, 3)
    expect(talked.length).toBeGreaterThan(0)
    for (const p of talked) p.sc = 100
    g.shortlist = talked.map(p => p.id)
    const rings = () => g.news.filter(n => n.k === 'news.shortlistAlert' && String(n.v?.alert_k).startsWith('news.slRival_')).length
    weeklyScouting(g)
    const first = rings()
    expect(first).toBe(talked.length)
    weeklyScouting(g)
    expect(rings()).toBe(first)
  })

  it('a club file runs from nothing at free tape to one at full files', async () => {
    const { clubFile, FILE_EDGE } = await import('../src/game/scoutknow')
    const { readOdds } = await import('../src/game/analyst')
    const g = world()
    const opp = Object.values(g.clubs).find(c => c.id !== g.userClubId && c.leagueId === g.clubs[g.userClubId].leagueId)!
    for (const id of opp.players) g.players[id].sc = FREE_CAP
    expect(clubFile(g, opp.id)).toBe(0)
    const units = { scrum: 70, lineout: 72, defence: 74, attack: 76, kicking: 78 }
    const thin = readOdds(g, opp.id, units, 202601).p
    for (const id of opp.players) g.players[id].sc = 100
    expect(clubFile(g, opp.id)).toBe(1)
    const deep = readOdds(g, opp.id, units, 202601).p
    expect(deep - thin).toBeCloseTo(FILE_EDGE, 5)
    expect(clubFile(g, g.userClubId)).toBe(0)
  })
})
