/**
 * ---- THE DREAM: a career goal the game never forgets ----
 *
 * The design review's finding on v1.0.1 was that the game has depth and no arc:
 * nothing anywhere says why you are playing THIS save. The Dream is the answer -
 * an ambition the manager names at career start, shown on Home every week,
 * measured every May, and graded at the end.
 *
 * What this holds the system to:
 *   1. NOTHING IS FREE IN WEEK ONE. Every dream reads zero progress on a fresh
 *      save. (This is the exact bug the season objectives shipped with - "one of
 *      the season objectives had been completed without a game being played" -
 *      and it would be far worse on a goal meant to last a decade.)
 *   2. NOTHING IS UNREACHABLE. Every dream's progress can be driven to done by
 *      staging the facts it reads, so no dream is a treadmill.
 *   3. THE OFFER FITS THE CLUB. A Championship side is offered promotion and a
 *      Premiership side is not; a top-flight side is offered the league-and-
 *      Europe double and a lower-league side is not.
 *   4. THE ENGINE NEVER READS IT. dreamState is a pure lens: it mutates nothing,
 *      so it cannot move the fingerprint or the balance. Asserted by deep
 *      comparison across a call.
 *   5. THE MAY VERDICT IS STAMPED AFTER THE SEASON IS ON THE RECORD, not before -
 *      the trap this wave nearly shipped, because state.review is assembled
 *      before finishes.push and a title-winning season would have reported no
 *      progress towards a dream about titles.
 *
 * Run: npx vite-node scripts/dreamprobe.ts
 */
import * as D from '../src/game/dream'
import { ensureLang, setLang } from '../src/game/i18n'

// dictionaries are lazy chunks now (v1.2.0); load French once so every
// setLang below stays the instant switch this probe was written against
await ensureLang('fr')
import { newGame } from '../src/game/newgame'
import type { GameState } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

// ---- the module surface (red on any tree without the wave) ----
ok(typeof D.dreamsFor === 'function', 'dream.ts exports dreamsFor')
ok(typeof D.dreamState === 'function', 'dream.ts exports dreamState')
ok(Array.isArray(D.DREAMS) && D.DREAMS.length >= 5, `there are dreams to choose from (${D.DREAMS?.length ?? 0})`)

// ---- the offer fits the club ----
{
  const prem = D.dreamsFor({ clubId: 'northampton', clubName: 'Saints', leagueId: 'prem', rep: 86 }).map(d => d.id)
  const champ = D.dreamsFor({ clubId: 'ealing', clubName: 'Ealing', leagueId: 'champ', rep: 62 }).map(d => d.id)
  const nl1 = D.dreamsFor({ clubId: 'esher', clubName: 'Esher', leagueId: 'natl1', rep: 38 }).map(d => d.id)
  ok(!prem.includes('topflight'), 'a Premiership club is not offered "reach the top flight"')
  ok(champ.includes('topflight'), 'a Championship club is')
  ok(nl1.includes('topflight'), 'and so is a National League One club')
  ok(prem.includes('double'), 'a top-flight club is offered the league-and-Europe double')
  ok(!champ.includes('double'), 'a Championship club is not')
  ok(prem.length >= 4 && champ.length >= 4 && nl1.length >= 4,
    `every club has a real choice (prem ${prem.length}, champ ${champ.length}, nl1 ${nl1.length})`)
  for (const list of [prem, champ, nl1]) ok(list.length > 0, 'and nobody is offered an empty list')
}

// ---- nothing is free in week one ----
{
  const worlds: [string, GameState][] = [
    ['northampton', newGame('northampton', 'Dreamer', 21)],
    ['ealing', newGame('ealing', 'Dreamer', 22)],
    ['esher', newGame('esher', 'Dreamer', 23)],
  ]
  for (const [clubId, g] of worlds) {
    const club = g.clubs[clubId]
    const ctx = { clubId, clubName: club.short, leagueId: club.leagueId, rep: club.rep }
    for (const def of D.dreamsFor(ctx)) {
      g.dream = { id: def.id, clubId, season: g.season }
      const st = D.dreamState(g)!
      ok(st.progress.at === 0 && !st.progress.done,
        `${clubId}/${def.id}: week one reads zero, not done (at ${st.progress.at})`)
      // IN BOTH LANGUAGES. A dream is a key now, and the failure this catches is
      // a note whose French was never written: t() falls back to English, so
      // the screen looks fine and a French manager reads his own career in the
      // wrong language for a decade. Comparing the two rendered strings is the
      // only thing that sees it - a missing key renders as English, which has
      // a length and passes any test that only asks whether something is there.
      for (const lang of ['en', 'fr'] as const) {
        setLang(lang)
        ok(D.dreamNote(st.progress).length > 0 && D.dreamTitle(def, ctx).length > 0,
          `${clubId}/${def.id}/${lang}: says something honest about where it stands`)
      }
      setLang('fr')
      const fr = { title: D.dreamTitle(def, ctx), note: D.dreamNote(st.progress) }
      setLang('en')
      const en = { title: D.dreamTitle(def, ctx), note: D.dreamNote(st.progress) }
      ok(fr.title !== en.title, `${clubId}/${def.id}: the title is actually translated, not falling back`)
      ok(fr.note !== en.note, `${clubId}/${def.id}: and so is the note ("${en.note}")`)
    }
  }
}

// ---- the lens mutates nothing ----
{
  const g = newGame('northampton', 'Dreamer', 31)
  g.dream = { id: 'immortal', clubId: g.userClubId, season: 0 }
  const before = JSON.stringify(g)
  D.dreamState(g)
  D.dreamState(g)
  ok(JSON.stringify(g) === before, 'dreamState is a pure read: the save is byte-identical after it')
}

// ---- nothing is unreachable: drive each one to done ----
{
  const g = newGame('northampton', 'Dreamer', 41)
  const uid = g.userClubId
  const at = (id: string) => { g.dream = { id, clubId: uid, season: 0 }; return D.dreamState(g)!.progress }

  g.mgr.trophies.push({ compId: 'cc', season: 1, clubId: uid })
  ok(at('europe').done, 'europe: a Champions Cup makes it done')

  g.mgr.finishes.push({ season: 1, leagueId: 'prem', pos: 1, clubId: uid })
  ok(at('double').done, 'double: a league title alongside it completes the double')

  g.mgr.finishes.push({ season: 2, leagueId: 'prem', pos: 1, clubId: uid })
  ok(!at('dynasty').done, 'dynasty: two in a row is not three')
  g.mgr.finishes.push({ season: 3, leagueId: 'prem', pos: 1, clubId: uid })
  ok(at('dynasty').done, 'dynasty: three consecutive titles is')
  // and a broken run does not count as a dynasty
  const g2 = newGame('northampton', 'Dreamer', 42)
  g2.mgr.finishes.push({ season: 1, leagueId: 'prem', pos: 1, clubId: g2.userClubId })
  g2.mgr.finishes.push({ season: 3, leagueId: 'prem', pos: 1, clubId: g2.userClubId })
  g2.mgr.finishes.push({ season: 5, leagueId: 'prem', pos: 1, clubId: g2.userClubId })
  g2.dream = { id: 'dynasty', clubId: g2.userClubId, season: 0 }
  ok(!D.dreamState(g2)!.progress.done, 'and three titles in alternate seasons is not a dynasty')

  while (g.mgr.trophies.length < 15) g.mgr.trophies.push({ compId: 'prem', season: 9, clubId: uid })
  ok(at('immortal').done, `immortal: fifteen trophies does it (${g.mgr.trophies.length})`)

  g.natTeam = 'ENG'
  ok(!at('world').done && at('world').at === 1, 'world: holding a Test job is halfway, not done')
  g.mgr.trophies.push({ compId: 'wc', season: 10, clubId: uid })
  ok(at('world').done, 'world: winning the World Cup finishes it')

  // the academy dream counts graduates who have played senior rugby
  const squad = g.clubs[uid].players.map(id => g.players[id]).filter(Boolean)
  ok(at('academy').at === 0, 'academy: a bought squad counts for nothing')
  let marked = 0
  for (const p of squad) {
    if (marked >= 8) break
    if (p.acad) continue
    p.homegrown = true
    p.stats.apps = Math.max(1, p.stats.apps)
    marked++
  }
  ok(at('academy').done, `academy: eight graduates with senior rugby behind them (${at('academy').at}/8)`)
}

// ---- promotion drives the top-flight dream ----
{
  const g = newGame('ealing', 'Dreamer', 51)
  const uid = g.userClubId
  g.dream = { id: 'topflight', clubId: uid, season: 0 }
  // The KEY, not the words. The note used to be a sentence and this matched on
  // "Championship" inside it; now the distinction between "still in the
  // Championship" and "still in the lower leagues" lives in which key is
  // chosen, and matching the rendered text would only ever test English.
  ok(!D.dreamState(g)!.progress.done && D.dreamState(g)!.progress.noteK === 'dream.topflightStillChamp',
    'topflight: a Championship side is told exactly where it still is')
  g.mgr.finishes.push({ season: 1, leagueId: 'prem', pos: 9, clubId: uid })
  ok(D.dreamState(g)!.progress.at === 1, 'topflight: one season up is halfway')
  g.mgr.finishes.push({ season: 2, leagueId: 'prem', pos: 8, clubId: uid })
  ok(D.dreamState(g)!.progress.done, 'topflight: surviving a second season up finishes it')
}

// ---- a save with no dream is not a crash ----
{
  const g = newGame('northampton', 'Dreamer', 61)
  delete g.dream
  ok(D.dreamState(g) === null, 'a career from before dreams existed simply has none')
}

// ---- the refocus (v1.1.5): realised dreams bank, unrealised ones never reset ----
{
  const { useStore } = await import('../src/store')
  const g = newGame('ealing', 'Dreamer', 71)
  const uid = g.userClubId
  g.dream = { id: 'topflight', clubId: uid, season: 0 }
  // node has no indexedDB: the action's persist must be a no-op here or the
  // probe's tail is an async "save failed" grumble after its own verdict
  useStore.setState({ game: g, persist: async () => {} })
  const refocus = useStore.getState().refocusDream
  ok(!refocus('academy'), 'an unrealised dream cannot be refocused away')
  ok(g.dream.id === 'topflight' && !g.dreamsDone?.length, 'and nothing about it moved')
  // realise it
  g.mgr.finishes.push({ season: 1, leagueId: 'prem', pos: 9, clubId: uid })
  g.mgr.finishes.push({ season: 2, leagueId: 'prem', pos: 8, clubId: uid })
  ok(D.dreamState(g)!.progress.done, 'the dream is realised')
  ok(!refocus('topflight'), 'the dream just realised is not a valid new pick')
  ok(refocus('academy'), 'a realised dream may be refocused to a new one')
  ok(g.dream.id === 'academy', 'the new ambition is held')
  ok((g.dreamsDone ?? []).some(x => x.id === 'topflight'), 'and the realised one is banked, not erased')
  ok(!D.dreamState(g)!.progress.done, 'the new dream starts unrealised')
  ok(!refocus('trophy'), 'an unrealised new dream cannot itself be refocused away')
}

console.log(fails ? `DREAM PROBE FAILED (${fails})` : 'DREAM PROBE PASSED: the save knows what it is for')
if (fails) process.exit(1)
