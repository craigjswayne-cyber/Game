/**
 * A SIGNING DOES NOT BRING HIS OLD CAREER WITH HIM (owner, 1.8.12).
 *
 * "Ive just signed Cros as a medical joker but it says he has played 275 games
 * for Northampton." A free agent with no career rows yet had his whole
 * pre-2025 count (p.hist) credited to whichever club he stood at. Checked:
 *   1. a free agent signed by the manager (the medical joker door and the
 *      plain transfer door) reads only what he has played since he arrived;
 *   2. a man who has been at the club since the career began still reads
 *      his long service;
 *   3. a legend made off the false count is taken off the board on load.
 *
 * Run: npx vite-node scripts/signedappsprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { executeTransfer } from '../src/game/ai'
import { signMedicalJoker, jokerCandidates } from '../src/game/joker'
import { service, LEGEND_APPS } from '../src/game/legends'
import { playerStory } from '../src/game/stories'
import { t } from '../src/game/i18n'
import { migrate } from '../src/game/save'
import type { GameState } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const g: GameState = newGame('northampton', 'Signed', 91)
const uid = g.userClubId
const long = (id: number) => (g.players[id].hist?.apps ?? 0) >= 100

// 2. the long servant at his own club
const servant = g.clubs[uid].players.map(id => g.players[id]).find(p => long(p.id) && !p.exClub)
ok(!!servant, 'a long servant is at the club from the start')
if (servant) ok(service(servant, uid).apps >= 100, `${servant.name} still reads his service (${service(servant, uid).apps})`)

// 1a. a free agent through the transfer door
// released mid-season by their clubs, before any career row is written: the
// way a man with 275 games came to be on the free list
const free = Object.values(g.players).filter(p => p.clubId && p.clubId !== uid && !p.exClub && (p.hist?.apps ?? 0) >= 100 && !p.career.length).slice(0, 4)
for (const p of free) { const c = g.clubs[p.clubId!]; c.players = c.players.filter(id => id !== p.id); c.tactic.lineup = c.tactic.lineup.map(id => (id === p.id ? null : id)); p.clubId = null }
ok(free.length >= 2, `free agents with long careers exist (${free.length})`)
const a = free[0]
executeTransfer(g, a, uid, 0)
ok(service(a, uid).apps === 0, `${a.name}, ${a.hist!.apps} games elsewhere, has 0 for the club on signing (${service(a, uid).apps})`)
const lines = playerStory(g, a).map(l => t(l.k, l.v)).join(' | ')
ok(!/\d{2,} appearances for/.test(lines), `and no story credits him with them (${lines || 'none'})`)

// 1b. the medical joker door
const hurt = g.clubs[uid].players.map(id => g.players[id])[0]
hurt.injury = { type: 'Knee', until: g.week + 8 } as never
const pool = jokerCandidates(g, hurt, 200).filter(p => (p.hist?.apps ?? 0) >= 50)
if (pool.length) {
  const j = pool[0]
  const r = signMedicalJoker(g, hurt.id, j.id)
  ok(r.ok, `a medical joker signs (${r.msg.slice(0, 60)})`)
  ok(service(j, uid).apps === 0, `${j.name}, ${j.hist!.apps} games elsewhere, has 0 for the club as a joker (${service(j, uid).apps})`)
} else ok(true, 'no joker with a long career in this world (skipped)')

// 3. a legend made off the false count comes off on load
;(g.hist ??= {} as never)
g.hist!.legends = [...(g.hist!.legends ?? []), { pid: a.id, name: a.name, clubId: uid, apps: a.hist!.apps, tries: 0, pts: 0, season: g.season }]
if (servant && service(servant, uid).apps >= LEGEND_APPS) g.hist!.legends.push({ pid: servant.id, name: servant.name, clubId: uid, apps: service(servant, uid).apps, tries: 0, pts: 0, season: g.season })
const back = migrate(JSON.parse(JSON.stringify(g)))
ok(!back.hist!.legends.some(l => l.pid === a.id), 'the false legend is gone after load')
if (servant && service(servant, uid).apps >= LEGEND_APPS) ok(back.hist!.legends.some(l => l.pid === servant.id), 'a real one stays')

console.log(fails ? `\nSIGNED APPS PROBE FAILED (${fails})` : '\nSIGNED APPS PROBE PASSED: a signing starts his count at the club on the day he arrives')
