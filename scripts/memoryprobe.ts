/**
 * ---- THE WORLD REMEMBERS (memory.ts) ----
 *
 * The consequence engine: the manager's decisions are written down, and the
 * world reads them back as stories when it closes the loop. What this holds:
 *
 *   1. THE LOG IS SMALL. remember/recall work, and however much is written the
 *      log never passes MEMORY_CAP; the least salient and oldest go first.
 *   2. OLD SAVES LOAD. A save with no memory, or a damaged one, migrates to an
 *      empty log rather than failing, and a good log survives the trip intact.
 *   3. THE DECISIONS ARE RECORDED where they happen: a release, a sale, a knock
 *      played through, a transfer request answered, a staff sacking.
 *   4. EVERY PAYOFF FIRES, and names the right man and the right decision: a
 *      released man captains a rival, a sold man scores against you, an academy
 *      debutant is capped, a broken promise is remembered and agents price it.
 *   5. IN A REAL CAREER, left to run for several seasons with the manager letting
 *      men go, at least one memory story fires on its own, and every one names a
 *      player the log actually remembers.
 *   6. IT MOVES NO MATCH. A season played with a full memory and the same season
 *      with an empty one produce identical scores: memory draws no rng.
 *
 * Run: npx vite-node scripts/memoryprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { migrate } from '../src/game/save'
import { releaseBlock, releasePlayer } from '../src/game/release'
import { executeTransfer } from '../src/game/ai'
import { playThrough } from '../src/game/knock'
import { answerRequest } from '../src/game/chats'
import { sackStaff, appointStaff, staffCandidates } from '../src/game/staff'
import { SEASON_WEEKS, seasonLabel, type GameState, type Player } from '../src/game/model'
import {
  MEMORY_CAP, agentWariness, memoryAfterMatch, memoryWeek, migrateMemory, recall, remember,
  noteMemory, rememberDebut, rememberPromise,
} from '../src/game/memory'
import { ensureLang, tIn } from '../src/game/i18n'

await ensureLang('fr')

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const seniors = (g: GameState, clubId: string) =>
  g.clubs[clubId].players.map(id => g.players[id]).filter((p): p is Player => !!p && !p.acad)
// stories are held until the settle ends (memory.ts tell), so a hook called
// directly here has filed into the queue, not the inbox yet
const memNews = (g: GameState, k?: string) => [...g.news, ...(g.memory?.queue ?? []).map(n => ({ ...n, id: -1 }))]
  .filter(n => n.k?.startsWith('mem.') && (!k || n.k === k))
const leagueRival = (g: GameState) => {
  const me = g.clubs[g.userClubId]
  return Object.values(g.clubs).find(c => c.id !== me.id && c.leagueId === me.leagueId)!
}

// ---- 1. the log is small ----
{
  const g = newGame('northampton', 'Memory', 181)
  ok(!g.memory || g.memory.entries.length === 0, 'a new career remembers nothing')
  for (let i = 0; i < MEMORY_CAP * 3; i++) {
    g.season = Math.floor(i / 60)
    remember(g, { kind: 'staff-hired', payload: { name: `n${i}` }, sal: i % 50 === 0 ? 3 : 1 })
  }
  const log = g.memory!
  ok(log.entries.length <= MEMORY_CAP, `writing ${MEMORY_CAP * 3} entries leaves ${log.entries.length}, under the cap of ${MEMORY_CAP}`)
  ok(log.entries.filter(e => e.sal === 3).length === Math.ceil((MEMORY_CAP * 3) / 50) - log.entries.filter(e => e.sal === 3 && g.season - e.season > 8).length,
    'the salient entries are the ones kept')
  ok(recall(g, { kind: 'staff-hired', sinceSeason: g.season }).every(e => e.season >= g.season), 'recall filters by season')
  ok(new Set(log.entries.map(e => e.id)).size === log.entries.length, 'ids are unique')
  const bytes = JSON.stringify(log).length
  ok(bytes < 40_000, `a full log is ${bytes} bytes in a save`)
}

// ---- 2. old saves load ----
{
  const g = newGame('northampton', 'Old', 182)
  delete (g as Partial<GameState>).memory
  const old = migrate(JSON.parse(JSON.stringify(g)) as GameState)
  ok(!!old.memory && Array.isArray(old.memory.entries) && old.memory.entries.length === 0 && old.memory.next === 1,
    'a save from before memory existed loads with an empty log')

  const bad = JSON.parse(JSON.stringify(g)) as GameState
  ;(bad as unknown as Record<string, unknown>).memory = 'garbage'
  migrateMemory(bad)
  ok(bad.memory!.entries.length === 0, 'a damaged log is replaced, not trusted')

  const mixed = JSON.parse(JSON.stringify(g)) as GameState
  ;(mixed as unknown as Record<string, unknown>).memory = {
    entries: [null, { kind: 'sold', season: 0, week: 3, id: 7, sal: 9, paid: 'x' }, { kind: 3 }], next: 2,
  }
  migrateMemory(mixed)
  ok(mixed.memory!.entries.length === 1 && mixed.memory!.entries[0].sal === 3 && Array.isArray(mixed.memory!.entries[0].paid),
    'bad entries are dropped and a good one is repaired')
  ok(mixed.memory!.next === 8, 'and the id counter is moved past it')

  remember(g, { kind: 'sold', playerId: 1, payload: { name: 'x' }, sal: 2 })
  const round = migrate(JSON.parse(JSON.stringify(g)) as GameState)
  ok(round.memory!.entries.length === 1 && round.memory!.entries[0].kind === 'sold', 'a real log survives a save and load')
}

// ---- 3. the decisions are recorded where they happen ----
{
  const g = newGame('northampton', 'Record', 183)
  const me = g.userClubId
  const squad = seniors(g, me).sort((a, b) => a.ca - b.ca)
  const cut = squad.find(p => !releaseBlock(g, p.id))
  ok(!!cut, 'there is a man the manager may release')
  if (cut) {
    const r = releasePlayer(g, cut.id)
    const e = recall(g, { kind: 'released', playerId: cut.id })[0]
    ok(r.ok && !!e && e.payload?.from === me && e.payload?.name === cut.name, `releasing ${cut.name} is remembered, with the club he left`)
  }
  const rival = leagueRival(g)
  const sold = squad[squad.length - 3]
  executeTransfer(g, sold, rival.id, 1_000_000)
  const s = recall(g, { kind: 'sold', playerId: sold.id })[0]
  ok(!!s && s.payload?.to === rival.id && s.payload?.fee === 1_000_000, `selling ${sold.name} to ${rival.short} is remembered with the buyer and fee`)
  // an AI-to-AI deal is none of the manager's business
  const other = seniors(g, rival.id)[0]
  const third = Object.values(g.clubs).find(c => c.id !== rival.id && c.id !== me)!
  executeTransfer(g, other, third.id, 500_000)
  ok(recall(g, { playerId: other.id }).length === 0, 'a deal between two other clubs is not the manager\'s memory')

  const hurt = seniors(g, me).find(p => !p.injury)!
  hurt.injury = { desc: 'Hamstring strain', dk: 'inj.hamstring', until: g.week + 2, weeks: 4, seen: true }
  const k = playThrough(g, hurt.id)
  ok(k.ok && recall(g, { kind: 'rushed-back', playerId: hurt.id }).length === 1, 'sending a man out on a knock is remembered')

  const moaner = seniors(g, me).find(p => p.id !== hurt.id)!
  moaner.wantsOut = 5
  answerRequest(g, moaner, false)
  ok(recall(g, { kind: 'request-refused', playerId: moaner.id }).length === 1, 'turning down a transfer request is remembered')

  const role = 'attack' as const
  g.clubs[me].balance += 5_000_000
  appointStaff(g, role, 0)
  const hired = recall(g, { kind: 'staff-hired' }).length
  sackStaff(g, role)
  ok(hired === 1 && recall(g, { kind: 'staff-sacked' }).length === 1, 'appointing and sacking staff are remembered')
  void staffCandidates
}

// ---- 4. every payoff fires, and names the right decision ----
{
  const g = newGame('northampton', 'Payoff', 184)
  const me = g.userClubId
  const rival = leagueRival(g)
  g.week = 10

  // a. released, then captain of a rival
  const man = seniors(g, me).sort((a, b) => b.ca - a.ca).find(p => !releaseBlock(g, p.id))!
  releasePlayer(g, man.id)
  const entry = recall(g, { kind: 'released', playerId: man.id })[0]
  g.week = 12
  executeTransfer(g, man, rival.id, 0)
  rival.captain = man.id
  memoryWeek(g)
  g.week = 13
  memoryWeek(g)
  g.week = 14
  memoryWeek(g)
  const cap = memNews(g, 'mem.captainVs')[0]
  const signed = memNews(g, 'mem.signedRival')[0]
  ok(!!signed && signed.playerId === man.id, `${man.name} resurfacing at ${rival.short} is news`)
  ok(!!cap && cap.playerId === man.id && cap.v?.player === man.name && cap.v?.season === seasonLabel(entry.season) && cap.v?.how_k === 'mem.howReleased',
    `${man.name} captaining ${rival.short} is news, and it says you released him in ${seasonLabel(entry.season)}`)
  ok(!!cap && cap.body.includes('You released') && cap.body.includes(rival.name), `the story reads: "${cap?.body.slice(0, 110)}..."`)
  ok(!!cap && tIn('fr', cap.k!, cap.v).includes('libéré'), 'and in French it says so too')
  g.week = 15
  const before = memNews(g).length
  memoryWeek(g); g.week = 16; memoryWeek(g)
  ok(memNews(g, 'mem.captainVs').length === 1 && memNews(g).length === before, 'it is told once, not every week')

  // b. sold, then scores against you
  g.week = 20
  const sold = seniors(g, me).sort((a, b) => b.ca - a.ca)[2]
  executeTransfer(g, sold, rival.id, 2_000_000)
  const fx = {
    id: 999_001, compId: g.clubs[me].leagueId, round: 1, week: g.week, homeId: me, awayId: rival.id,
    played: true, homeScore: 10, awayScore: 17, homeTries: 1, awayTries: 2,
    events: [{ min: 30, type: 'TRY' as const, teamId: rival.id, playerId: sold.id, text: 'try', homeScore: 0, awayScore: 5 }],
  }
  memoryAfterMatch(g, fx)
  const tryStory = memNews(g, 'mem.tryVs')[0]
  ok(!!tryStory && tryStory.playerId === sold.id && tryStory.v?.buyer === rival.name && tryStory.body.includes('You sold'),
    `${sold.name} scoring against you names the sale: "${tryStory?.body.slice(0, 90)}..."`)
  g.week = 21
  memoryAfterMatch(g, { ...fx, id: 999_002, week: 21 })
  ok(memNews(g, 'mem.tryVs').length === 1, 'the same man scoring again is not a second story')

  // c. the academy debut you gave, and the cap that follows
  g.week = 22
  const kid = g.clubs[me].players.map(id => g.players[id]).find(p => p && p.acad)!
  rememberDebut(g, kid)
  g.season += 1; g.week = 5
  kid.caps = (kid.caps ?? 0) + 1
  memoryWeek(g)
  const intl = memNews(g, 'mem.acadIntl')[0]
  ok(!!intl && intl.playerId === kid.id && intl.v?.season === seasonLabel(g.season - 1),
    `${kid.name} capped, and the story remembers the debut in ${seasonLabel(g.season - 1)}`)

  // d. a broken promise is remembered, and costs you
  g.week = 8
  const pl = seniors(g, me)[5]
  rememberPromise(g, pl, false, 'plans')
  ok(agentWariness(g) > 1, `agents price a broken promise in (x${agentWariness(g).toFixed(2)})`)
  pl.lastWk = 0
  const morale = pl.morale
  const trust = g.mgrTrust ?? 30
  for (let w = 9; w <= 16; w++) { g.week = w; memoryWeek(g) }
  const grudge = memNews(g, 'mem.grudge')[0]
  ok(!!grudge && grudge.playerId === pl.id && pl.morale < morale && (g.mgrTrust ?? 30) < trust,
    `${pl.name} has not forgotten: morale ${morale.toFixed(1)} -> ${pl.morale.toFixed(1)}, trust ${trust} -> ${g.mgrTrust}`)
  g.week = 25
  memoryWeek(g)
  const agents = memNews(g, 'mem.agents')[0]
  ok(!!agents && agents.v?.player === pl.name, 'agents cite the broken promise in the next window')

  // e. the knock you sent him out on
  const k = seniors(g, me).find(p => !p.injury && !p.knock)!
  k.injury = { desc: 'Calf strain', dk: 'inj.calf', until: g.week + 2, weeks: 4, seen: true }
  playThrough(g, k.id)
  g.week += 6
  k.knock = undefined
  k.injury = { desc: 'Calf strain', dk: 'inj.calf', until: g.week + 3, weeks: 3 }
  k.injLog = [...(k.injLog ?? []), { s: g.season, w: g.week, dk: 'inj.calf', weeks: 3 }]
  memoryWeek(g)
  const again = memNews(g, 'mem.knockAgain')[0]
  ok(!!again && again.playerId === k.id && again.body.includes('3 weeks'), `${k.name} breaking down again recalls the knock`)

  const perSeason = memNews(g).filter(n => n.season === g.season).length
  ok(perSeason <= 8, `the season's memory stories stay rationed (${perSeason})`)
}

// ---- 5. a real career: let men go, and see what comes back ----
{
  const t0 = Date.now()
  const SEASONS = 4
  const g = newGame('northampton', 'Career', 185)
  let maxLen = 0
  // the inbox is trimmed as the career goes, so the stories are collected as they land
  const seen = new Map<number, GameState['news'][number]>()
  for (let s = 0; s < SEASONS; s++) {
    for (let w = 0; w < SEASON_WEEKS; w++) {
      // week two of every season: release two decent seniors and sell one to a
      // league rival, the decisions a real manager makes every summer
      if (g.week === 2) {
        const rivals = Object.values(g.clubs).filter(c => c.id !== g.userClubId && c.leagueId === g.clubs[g.userClubId].leagueId)
        const squad = seniors(g, g.userClubId).sort((a, b) => b.ca - a.ca)
        let cut = 0
        for (const p of squad.slice(6)) {
          if (cut >= 2) break
          if (!releaseBlock(g, p.id) && releasePlayer(g, p.id).ok) cut++
        }
        const sale = squad[4]
        if (sale && sale.clubId === g.userClubId) executeTransfer(g, sale, rivals[s % rivals.length].id, Math.max(100_000, sale.value))
      }
      // the job is kept, so the career is the manager's all the way through
      // (the trick round25c.ts and deepsave.ts use: a sacked manager makes no
      // decisions and the log would be testing employment, not memory)
      if (!g.unemployed) g.clubs[g.userClubId].boardConfidence = Math.max(g.clubs[g.userClubId].boardConfidence, 55)
      processWeekAndAdvance(g)
      maxLen = Math.max(maxLen, g.memory?.entries.length ?? 0)
      for (const n of memNews(g)) seen.set(n.id, n)
    }
  }
  const log = g.memory!
  const kinds = new Set(log.entries.map(e => e.kind))
  console.log(`  ${SEASONS} seasons in ${((Date.now() - t0) / 1000).toFixed(0)}s: ${log.entries.length} entries (${[...kinds].join(', ')})`)
  ok(log.entries.length > 0 && kinds.has('released') && kinds.has('sold'), 'a career fills the log')
  ok(kinds.has('let-go'), 'contracts run down and unpromoted academy boys are remembered too')
  ok(maxLen <= 160, `and it never passed the cap (peak ${maxLen})`)
  const stories = [...seen.values()]
  const byKey: Record<string, number> = {}
  for (const n of stories) byKey[n.k!] = (byKey[n.k!] ?? 0) + 1
  console.log(`  memory stories: ${stories.length} (${Object.entries(byKey).map(([k, v]) => `${k.slice(4)} ${v}`).join(', ')})`)
  ok(stories.length >= 1, 'at least one memory story fired on its own')
  const remembered = new Set(log.entries.map(e => e.playerId).filter(x => x != null))
  const named = stories.filter(n => n.playerId != null)
  ok(named.every(n => remembered.has(n.playerId!) && (n.v?.player === g.players[n.playerId!]?.name || n.v?.player === log.entries.find(e => e.playerId === n.playerId)?.payload?.name)),
    'every story names a man the log remembers, by his own name')
  ok(stories.every(n => !/\{|\}/.test(n.body) && !n.body.includes('mem.')), 'no story leaks a hole or a key')
  const perSeason = Math.max(0, ...Array.from({ length: SEASONS + 1 }, (_, s) => stories.filter(n => n.season === s).length))
  ok(perSeason <= 9, `and no season carries more than a handful (${perSeason})`)
}

// ---- 6. it moves no match ----
// News, players and fixtures share state.nextId, and a fixture's dice are
// seeded from its id: a story filed mid-settle would shift a cup tie drawn
// later in the same settle onto other dice. Memory holds its stories until the
// settle is over (memory.ts tell/flushMemoryNews). Held to it here week by
// week, over a season and a bit: every fixture's id and every score, with a
// full memory log and with none.
{
  const WEEKS = SEASON_WEEKS + 6
  const play = (full: boolean) => {
    const g = newGame('leicester', 'Rng', 186)
    if (full) {
      // departures of men now at other clubs: the follow-him, rival-signing,
      // captaincy, cap and match payoffs all have a chance to fire
      const others = Object.values(g.players).filter(p => p.clubId && p.clubId !== g.userClubId && !p.acad).slice(0, 120)
      for (const p of others) remember(g, { kind: 'released', playerId: p.id, clubId: g.userClubId, payload: { name: p.name, from: g.userClubId, caps: 0 }, sal: 2 })
    }
    const weeks: string[] = []
    let queued = 0
    for (let w = 0; w < WEEKS; w++) {
      if (!g.unemployed) g.clubs[g.userClubId].boardConfidence = Math.max(g.clubs[g.userClubId].boardConfidence, 55)
      processWeekAndAdvance(g)
      queued += g.memory?.queue?.length ?? 0
      weeks.push(g.fixtures.map(f => `${f.id}:${f.homeId}${f.played ? `${f.homeScore}-${f.awayScore}` : '_'}${f.awayId}`).join('|'))
    }
    return { weeks, g, queued }
  }
  const a = play(false)
  const b = play(true)
  const told = (b.g.memory?.entries ?? []).filter(e => e.paid?.length).length
  ok(told >= 1, `the full memory told stories about ${told} of its subjects in ${WEEKS} weeks`)
  ok(b.queued === 0, 'and none was ever left waiting for an id between weeks')
  const ids = b.g.news.map(n => n.id)
  ok(new Set(ids).size === ids.length && b.g.news.some(n => n.k?.startsWith('mem.') && !Number.isInteger(n.id)),
    'the stories took ids between the others without spending the counter, and no two share one')
  const healed = migrate(JSON.parse(JSON.stringify(b.g)) as GameState)
  ok(Number.isInteger(healed.nextId) && healed.nextId === b.g.nextId, `a save and load leaves the counter whole (${healed.nextId})`)
  const firstDiff = a.weeks.findIndex((w, i) => w !== b.weeks[i])
  if (firstDiff >= 0) {
    const x = a.weeks[firstDiff].split('|'), y = b.weeks[firstDiff].split('|')
    const d = x.map((t, i) => [t, y[i]]).filter(([t, u]) => t !== u)
    console.log(`        ${x.length} vs ${y.length} fixtures, ${d.length} differ, first: ${d.slice(0, 4).map(([t, u]) => `${t} / ${u}`).join('  ')}`)
  }
  ok(a.weeks.length === WEEKS && a.weeks[0].length > 1000 && firstDiff === -1,
    firstDiff === -1 ? `every fixture id and every score identical, week by week, for ${WEEKS} weeks`
      : `fixtures first differ after week ${firstDiff + 1}`)
}

// ---- 7. the other modules' notes land in the log ----
{
  const g = newGame('northampton', 'Notes', 187)
  const a = noteMemory(g, { kind: 'plan_followed', clubId: 'bath', payload: { plan: 'kick', followed: true, junk: { x: 1 } } })
  ok(!!a && a.kind === 'plan-followed' && a.payload?.followed === 1 && !('junk' in (a.payload ?? {})), 'a followed plan is remembered, payload kept to what a save holds')
  ok(noteMemory(g, { kind: 'plan_ignored', clubId: 'bath' })?.kind === 'plan-ignored', 'an ignored plan too')
  ok(noteMemory(g, { kind: 'rivalry-born', clubId: 'bath' })?.kind === 'rivalry-formed', 'a rivalry formed')
  ok(noteMemory(g, { kind: 'left-sacked', clubId: 'northampton' })?.sal === 3 && noteMemory(g, { kind: 'took-job', clubId: 'bath' })?.kind === 'took-job',
    'the jobs a manager takes and leaves')
  ok(noteMemory(g, { kind: 'nonsense' }) === null && recall(g).length === 5, 'and an unknown kind is left out')
}

console.log(fails === 0
  ? '\nMEMORY PROBE PASSED: the world remembers what you did, and says so'
  : `\nMEMORY PROBE FAILED: ${fails}`)
process.exit(fails === 0 ? 0 : 1)
