/**
 * ---- THE 1.8.5 TRUST FIXES, HELD ----
 *
 * Four small lines that told the manager something untrue, and two desk lines
 * that told him the same thing every week. Each is set up by hand on a fresh
 * career and read back:
 *
 *   1. HOMEWORK OF THE SAME KIND. "Since last match" compares a club match
 *      with the club match before it and a Test with a Test; the homework a
 *      club match set is not marked against a Test, nor a Test's against a
 *      club side (coachfix homeworkFor). A save from before the kind was kept
 *      still marks it.
 *   2. THE TAPE NAMES A CALL HE STILL RUNS. The report's tape line named the
 *      most-taped call even when it had left the playbook (armsrace tapeLine).
 *   3. NO NEGATIVE METRES. A read call that went backwards quoted "-3m from 4
 *      calls"; it says the ground was lost (evidence readTold, whyReadLost).
 *   4. A PLAN CHANGED AT THE BREAK WAS JUDGED ON THE FIRST HALF, and the next
 *      report says so (oppreport lastPlanHalf_*).
 *   5. THE WAGE LINE SPEAKS WHILE THE WINDOW IS OPEN, and the homework once:
 *      a job that was already last match's homework is not the desk's news.
 *
 * Run: npx vite-node scripts/trustfixprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { matchRng, userFixtureThisWeek, processWeekAndAdvance } from '../src/game/season'
import { beginMatch, playHalf } from '../src/game/matchEngine'
import { homeworkFor } from '../src/game/coachfix'
import { tapeLine } from '../src/game/armsrace'
import { MOVE_BY_ID, calledIds, callsOf, isStrike } from '../src/game/moves'
import { buildEvidence, readTold } from '../src/game/evidence'
import { buildReport, type FindingsRecord } from '../src/game/oppreport'
import { buildDesk, deskText } from '../src/game/desk'
import { lineText } from '../src/game/matchfindings'
import { windowOpen } from '../src/game/ai'
import { userWageBudget } from '../src/game/grants'
import { ensureLang, tIn, type Lang } from '../src/game/i18n'

const LANGS: Lang[] = ['en', 'fr', 'es', 'it', 'af', 'ja']
for (const l of LANGS) await ensureLang(l)
let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}
const raw = (s: string) => /[{}]|\b[a-z]+\.[a-zA-Z_]+\b/.test(s.replace(/\d+\.\d+/g, ''))

const g = newGame('leicester', 'Trust Tester', 18_585)
const me = g.clubs[g.userClubId]
const opp = Object.values(g.clubs).find(c => c.id !== me.id && c.leagueId === me.leagueId)!

// ---- 1. homework of the same kind
const week0 = g.week
{
  g.week = 10
  const base = { fxId: 9_001, season: g.season, week: 8, tags: ['set'] }
  g.fixHw = { ...base, test: false }
  ok(homeworkFor(g, 9_002, opp.id)?.fxId === 9_001, 'a club match marks the club homework')
  ok(homeworkFor(g, 9_002, 'ENG') === null, 'a Test does not mark the club homework')
  g.fixHw = { ...base, test: true }
  ok(homeworkFor(g, 9_002, opp.id) === null, 'a club match does not mark a Test\'s homework')
  ok(homeworkFor(g, 9_002, 'ENG')?.fxId === 9_001, 'a Test marks a Test\'s')
  g.fixHw = { ...base }
  ok(homeworkFor(g, 9_002, opp.id)?.fxId === 9_001 && homeworkFor(g, 9_002, 'ENG')?.fxId === 9_001, 'an old save\'s homework (no kind kept) is still marked')
  g.fixHw = { ...base, test: false }
  g.week = 13
  ok(homeworkFor(g, 9_002, opp.id) === null, 'and none is marked five weeks on')
  delete g.fixHw
  g.week = week0
}

// ---- 2. the tape names a call he still runs
{
  const pb0 = me.playbook
  const tac0 = { main: me.tactic.moveMain, alt: me.tactic.moveAlt }
  const strikes = Object.keys(MOVE_BY_ID).filter(isStrike)
  me.tactic.moveMain = strikes[0]
  me.tactic.moveAlt = strikes[1]
  const called = calledIds(callsOf(g, me))
  const gone = Object.keys(MOVE_BY_ID).find(id => !called.includes(id))!
  const live = called.find(id => MOVE_BY_ID[id])!
  me.playbook = { ...(me.playbook ?? {}), faced: { [gone]: 12, [live]: 4 } } as typeof me.playbook
  const l = tapeLine(g, opp.id, 0.9)
  ok(!!l && l.v.move_k === MOVE_BY_ID[live].say && l.v.pct === 25, `the tape line names ${live}, a call still run (${l?.k} ${l?.v.move_k} ${l?.v.pct}%)`)
  me.playbook = { ...(me.playbook ?? {}), faced: { [gone]: 12 } } as typeof me.playbook
  const r = tapeLine(g, opp.id, 0.9)
  ok(r?.k === 'armsrace.tapeRetired', 'a tape of old calls only says they are no longer run')
  for (const lang of LANGS) {
    const s = tIn(lang, r!.k, r!.v)
    if (raw(s)) ok(false, `${lang}: ${s}`)
  }
  me.playbook = pb0
  me.tactic.moveMain = tac0.main
  me.tactic.moveAlt = tac0.alt
}

// ---- 3. no negative metres
{
  let ev = null
  for (let i = 0; i < 12 && !ev; i++) {
    const fx = userFixtureThisWeek(g)
    if (fx && !fx.played && g.clubs[fx.homeId] && g.clubs[fx.awayId]) {
      const ctx = beginMatch(g, fx, matchRng(g), true, g.userClubId)
      playHalf(g, ctx); playHalf(g, ctx)
      ev = buildEvidence(g, ctx)
    } else processWeekAndAdvance(g)
  }
  ok(!!ev, 'a match was played for its evidence')
  if (ev) {
    const id = calledIds(callsOf(g, me)).find(x => MOVE_BY_ID[x])!
    ev.side[0].calls = { [id]: [4, -3, 0, 4, 5] }
    const w = readTold(ev, [id])
    ok(w?.k === 'matchday.whyReadLost' && w.v.m === 3 && w.v.d === 5, `a read call that lost ground says so (${w?.k} m=${w?.v.m} d=${w?.v.d})`)
    for (const lang of LANGS) {
      const s = tIn(lang, w!.k, w!.v)
      if (raw(s) || /-\d/.test(s)) ok(false, `${lang}: ${s}`)
    }
    ev.side[0].calls = { [id]: [4, 6, 0, 4, 5] }
    ok(readTold(ev, [id])?.k === 'matchday.whyRead', 'one that made ground keeps the old line')
  }
}

// ---- 4. a plan changed at the break
{
  const rec: FindingsRecord = {
    fxId: 9_100, season: g.season, week: g.week, oppId: opp.id, us: 20, them: 10, items: [],
    plan: { id: 'exploit', target: null, followed: true, verdict: 'worked', half: true },
  }
  ;(g.tacLoop ??= {} as never)
  ;(g.tacLoop!.findings ??= []).push(rec)
  const line = buildReport(g, opp.id).lines.find(l => l.k.startsWith('oppreport.lastPlan'))
  ok(line?.k === 'oppreport.lastPlanHalf_worked', `the next report says it was judged on the first half (${line?.k})`)
  const said = line ? lineText(line) : ''
  ok(/first half/.test(said) && !raw(said), `"${said}"`)
  rec.plan!.half = undefined
  ok(buildReport(g, opp.id).lines.some(l => l.k === 'oppreport.lastPlan_worked'), 'a plan carried to the whistle keeps the old line')
  g.tacLoop!.findings!.pop()
}

// ---- 5. the desk's wage line and homework
{
  const wages = me.players.reduce((s, id) => s + (g.players[id]?.wage ?? 0), 0)
  me.balance = Math.max(me.balance, 5_000_000)
  const lines = () => { const d = buildDesk(g); return [...d.rows.flatMap(r => r.lines), ...(d.thread?.lines ?? [])].map(l => deskText(l)) }
  const wageLine = (s: string) => /Wage (budget full|room)/.test(s)
  const save = g.week
  g.week = 15
  ok(!windowOpen(g.week) && !lines().some(wageLine), 'the wage line is not on the desk with the window shut')
  g.week = 3
  ok(windowOpen(g.week) && lines().some(wageLine), `and is with it open (${userWageBudget(g, me) - wages > 0 ? 'room' : 'full'})`)
  g.week = save
  g.fixHw = { fxId: 9_200, season: g.season, week: g.week - 1, tags: ['fitness'], test: false, was: ['fitness'] }
  ok(!lines().some(s => /Homework/.test(s) && /bench/.test(s)), 'last match\'s homework again is not the desk\'s news')
  g.fixHw = { ...g.fixHw, was: [] }
  const th = buildDesk(g).thread
  ok(!!th && (th.lines.some(l => /Homework/.test(deskText(l))) || th.go?.screen !== 'tactics'), `a new job is (or the thread has something stronger to say): ${th ? th.lines.map(l => deskText(l)).join(' ') : 'none'}`)
}

if (fails) { console.log(`\n${fails} FAILED`); process.exit(1) }
console.log('\nTRUST FIX PROBE PASSED')
