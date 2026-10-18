// Migration of old saves (was scripts/migratetest.ts, ported whole). An old
// save missing natl1 and jl1 gets them injected and its pid counter restored;
// each later block takes the migrated world, damages or back-dates one part
// of it, and checks migrate() heals or keeps exactly what it should.
import { beforeAll, describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { migrate } from '../src/game/save'
import { resetIds, nextPid } from '../src/game/attributes'
import { processWeekAndAdvance } from '../src/game/season'
import { playbookOf } from '../src/game/playbook'
import { RETIRED_NAMES_KEPT, worldNames } from '../src/game/nations'
import { CAREER_ROWS, archiveSeason, careerRows, type GameState } from '../src/game/model'

const copy = <T>(x: T): T => JSON.parse(JSON.stringify(x))

let before = 0
let m: GameState

beforeAll(() => {
  const g = newGame('leicester', 'Test', 4242)
  // strip natl1 + jl1 as if the save predates them
  for (const c of Object.values(g.clubs)) {
    if (c.leagueId === 'natl1' || c.leagueId === 'jl1') {
      for (const id of c.players) delete g.players[id]
      delete g.clubs[c.id]
    }
  }
  delete g.comps['natl1']; delete g.comps['jl1']
  g.fixtures = g.fixtures.filter(f => f.compId !== 'natl1' && f.compId !== 'jl1')
  before = Object.keys(g.clubs).length
  // a cold session: id counter back to 1 (the latent bug)
  resetIds(1)
  m = migrate(copy(g))
}, 60_000)

describe('an old save without natl1 and jl1', () => {
  // 24 until 18 Oct 2026: National One is fourteen clubs in the real 2026-27
  // league (natl1.ts), Japan Division One still twelve
  it('gets the 26 clubs injected', () => {
    expect(Object.keys(m.clubs).length - before).toBe(26)
  })

  // A club the migration invents needs an academy too (feedback 10G): the
  // first cut stamped the academy top-up per SAVE, so the 24 injected clubs
  // came into the world with no scholars and no way to field an A League side.
  it('gives an injected club an academy and a starting XV', () => {
    const ross = m.clubs['rosslyn']
    expect(ross.tactic.lineup.slice(0, 15).every(x => x != null)).toBe(true)
    expect(ross.players.filter(id => m.players[id]?.acad).length).toBeGreaterThanOrEqual(27)
    expect(m.academy?.fixtures.length).toBeGreaterThan(0)
  })

  it('sets the pid counter above every existing id', () => {
    const maxId = Object.keys(m.players).reduce((x, k) => Math.max(x, Number(k)), 0)
    expect(nextPid()).toBeGreaterThan(maxId)
  })

  it('leaves no roster entry pointing at a missing or foreign player', () => {
    let orphans = 0
    for (const c of Object.values(m.clubs)) for (const id of c.players) {
      const p = m.players[id]
      if (!p || p.clubId !== c.id) orphans++
    }
    expect(orphans).toBe(0)
  })
})

describe('migrate() heals and keeps', () => {
  // the match evidence (1.8.3) is optional: a loop from before it loads with
  // none, and is read as none; a mangled list is dropped, not loaded
  it('match evidence: absent stays absent, mangled is dropped', () => {
    const pre = copy(m) as GameState & { tacLoop: unknown }
    pre.tacLoop = { findings: [] }
    expect(migrate(pre).tacLoop?.evidence).toBeUndefined()
    const bad = copy(m) as GameState & { tacLoop: unknown }
    bad.tacLoop = { findings: [], evidence: { not: 'a list' } }
    expect(migrate(bad).tacLoop?.evidence).toBeUndefined()
  })

  // THE LAST MEETING WITH EACH SIDE (1.8.4): an older save's lists, six or
  // fewer, keep every record; homework from before it loads as it was, and
  // homework that cannot be read is dropped
  it('the last meeting with each side: records and homework', () => {
    const pre = copy(m) as GameState & { tacLoop: unknown; fixHw: unknown }
    const rec = (i: number) => ({ fxId: i, season: m.season, week: i, oppId: `o${i}`, us: 1, them: 0, items: [] })
    pre.tacLoop = { findings: [1, 2, 3, 4, 5, 6].map(rec) }
    pre.fixHw = { fxId: 6, season: m.season, week: 6, tags: ['discipline'] }
    const a = migrate(pre)
    expect(a.tacLoop?.findings.length).toBe(6)
    expect(a.fixHw?.tags[0]).toBe('discipline')
    const bad = copy(m) as GameState & { fixHw: unknown }
    bad.fixHw = { fxId: 'x', tags: 'none' }
    expect(migrate(bad).fixHw).toBeUndefined()
  })

  // THE NAME REGISTRY'S MEMORY (1.8.3): a save that kept every departed name
  // keeps the newest RETIRED_NAMES_KEPT, each once, in the order written; a
  // list inside the cap is left exactly as it was
  it('retired names: trimmed to the newest, each once', () => {
    const pre = copy(m) as GameState & { retiredNames: unknown[] }
    pre.retiredNames = Array.from({ length: RETIRED_NAMES_KEPT + 2500 }, (_, i) => `retired man ${i}`)
    pre.retiredNames.push('retired man 7000', 42)
    const a = migrate(pre)
    const r = a.retiredNames ?? []
    expect(r.length).toBe(RETIRED_NAMES_KEPT)
    expect(new Set(r).size).toBe(r.length)
    expect(r[r.length - 1]).toBe('retired man 7000')
    expect(r.every(n => typeof n === 'string')).toBe(true)
    expect(r.includes('retired man 0')).toBe(false)
    expect(r.includes(`retired man ${RETIRED_NAMES_KEPT + 2499}`)).toBe(true)
    const small = copy(m)
    small.retiredNames = ['a b', 'c d']
    expect(migrate(small).retiredNames).toEqual(['a b', 'c d'])
    // and the registry is rebuilt from the trimmed list: an old name is free
    // again, a recent one is still taken
    const taken = worldNames(a)
    expect(taken.has('retired man 7000')).toBe(true)
    expect(taken.has('retired man 0')).toBe(false)
  })

  // THE FOLDED SEASONS (1.8.3): careerOld is optional and absent on an old
  // save; a mangled one is dropped or filtered, a career longer than the
  // table is folded into it, and no appearance is lost on the way
  it('folded seasons: no appearance lost, damage dropped', () => {
    const pre = copy(m) as unknown as { players: Record<string, Record<string, unknown>> }
    const ids = Object.keys(pre.players)
    const long = pre.players[ids[0]]
    long.career = Array.from({ length: 24 }, (_, i) => ({ season: i - 30, clubId: i < 6 ? 'bath' : 'leicester', apps: 20, tries: 2, points: 10 }))
    long.careerOld = undefined
    pre.players[ids[1]].careerOld = [{ season: 0, clubId: 'bath', apps: 'x', tries: 0, points: 0 }, null, { season: -40, clubId: 'bath', apps: 5, tries: 1, points: 5 }]
    pre.players[ids[2]].careerOld = { not: 'a list' }
    const a = migrate(pre as unknown as GameState)
    const L = a.players[Number(ids[0])], B = a.players[Number(ids[1])], W = a.players[Number(ids[2])]
    const apps = careerRows(L).reduce((n, c) => n + c.apps, 0)
    expect(L.career.length).toBe(CAREER_ROWS)
    expect(apps).toBe(24 * 20)
    expect(L.careerOld?.length).toBe(1)
    expect(L.careerOld?.[0].apps).toBe(4 * 20)
    expect(L.careerOld?.[0].clubId).toBe('bath')
    expect(B.careerOld?.length).toBe(1)
    expect(B.careerOld?.[0].apps).toBe(5)
    expect(W.careerOld).toBeUndefined()
    expect(Object.values(a.players).some(p => p.careerOld !== undefined && !Array.isArray(p.careerOld))).toBe(false)
    // the summer folds the same way: the table stays at CAREER_ROWS, the totals do not shrink
    const p = { career: [...L.career], careerOld: L.careerOld?.map(r => ({ ...r })) }
    archiveSeason(p, { season: 1, clubId: 'leicester', apps: 7, tries: 1, points: 5 })
    expect(p.career.length).toBe(CAREER_ROWS)
    expect(careerRows(p).reduce((n, c) => n + c.apps, 0)).toBe(apps + 7)
  })

  // THE ERA'S 1.8.4 FACTS: an era told before them loads without them; a
  // fact that cannot be read is dropped, a good one kept
  it("the era's 1.8.4 facts: none invented, bad dropped, good kept", () => {
    const pre = copy(m) as GameState & { arc: unknown }
    const era = { c: m.userClubId, cn: 'X', f: 0, t: 2, m: 10, w: 5, d: 1, l: 4, tr: [], intl: 1, sk: 'arc.storyShort', sv: {}, why: '5' }
    pre.arc = { eras: [{ ...era, rs: { n: 'A', fee: 5 } }, { ...era, gr: 'x', rs: { n: 'B', fee: 5, s: 'y' }, wd: { o: 'bath', us: 0, them: 9, s: 1 } }, { ...era, gr: 3 }] }
    const [old, bad, good] = migrate(pre).arc!.eras
    expect(old.gr).toBeUndefined()
    expect(old.rs?.s).toBeUndefined()
    expect(bad.gr).toBeUndefined()
    expect(bad.rs?.s).toBeUndefined()
    expect(bad.wd?.s).toBe(1)
    expect(good.gr).toBe(3)
  })
})

// a 1.8.2 playbook's wear (whole counts that only the summer cleared) carries
// on under 1.8.3's, which fades a call left out (armsrace.ts THE WEAR); and
// the season still simulates
describe('the migrated world plays on', () => {
  it("three weeks simulate and an old playbook's wear carries on", () => {
    const pb = playbookOf(m.clubs[m.userClubId])
    pb.used = { ...pb.used, mv_loop: 9, mv_switch: 6 }
    m.clubs[m.userClubId].tactic.moveMain = 'mv_loop'
    for (let i = 0; i < 3; i++) processWeekAndAdvance(m)
    const wear = playbookOf(m.clubs[m.userClubId]).used
    expect(wear.mv_loop).toBeGreaterThanOrEqual(9)
    expect(wear.mv_switch).toBeLessThan(6)
    expect(Object.values(wear).every(v => Number.isFinite(v) && v >= 0)).toBe(true)
  }, 60_000)
})
