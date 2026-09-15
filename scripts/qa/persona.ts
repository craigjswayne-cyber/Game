// Persona probe: drive the STORE like a player for N seasons, audit each week,
// and compare a run with a JSON save/reload every week against a run without.
import { newGame } from '../../src/game/newgame'
import { useStore } from '../../src/store'
import { migrate } from '../../src/game/save'
import { respondToOffer } from '../../src/game/ai'
import type { GameState } from '../../src/game/model'

const SEASONS = Number(process.argv[2] ?? 2)
const SEED = Number(process.argv[3] ?? 777)
const CLUB = process.argv[4] ?? 'bath'
const LIVE_EVERY = 4 // every 4th match is watched live via kickOff/skipToBreak
let fails = 0
const bad = (m: string) => { fails++; if (fails < 60) console.log('FAIL  ' + m) }

function badNumberPath(x: unknown, path = 'state', depth = 0): string | null {
  if (typeof x === 'number') return Number.isFinite(x) ? null : path
  if (depth > 12) return null
  if (Array.isArray(x)) { for (let i = 0; i < x.length; i++) { const b = badNumberPath(x[i], `${path}[${i}]`, depth + 1); if (b) return b } return null }
  if (x && typeof x === 'object') { for (const [k, v] of Object.entries(x)) { const b = badNumberPath(v, `${path}.${k}`, depth + 1); if (b) return b } }
  return null
}

function audit(g: GameState, tag: string) {
  const seen = new Map<number, string>()
  for (const c of Object.values(g.clubs)) {
    for (const id of c.players) {
      const p = g.players[id]
      if (!p) { bad(`${tag} ${c.id} lists missing player ${id}`); continue }
      if (p.clubId !== c.id) bad(`${tag} ${p.name} clubId mismatch ${p.clubId} vs ${c.id}`)
      if (seen.has(id)) bad(`${tag} ${p.name} in two rosters`)
      seen.set(id, c.id)
    }
    const picks = c.tactic.lineup.filter((x): x is number => x != null)
    if (new Set(picks).size !== picks.length) bad(`${tag} ${c.id} duplicate in lineup`)
  }
  for (const p of Object.values(g.players)) {
    if (p.clubId && !g.clubs[p.clubId]) bad(`${tag} ${p.name} at nonexistent club ${p.clubId}`)
    if (p.clubId && !seen.has(p.id)) bad(`${tag} ${p.name} has clubId ${p.clubId} but is in no roster`)
    if (p.age < 16 || p.age > 45) bad(`${tag} ${p.name} age ${p.age}`)
    if (!(p.ca >= 1 && p.ca <= 100)) bad(`${tag} ${p.name} ca ${p.ca}`)
    if (p.wage < 0 || p.value < 0) bad(`${tag} ${p.name} wage/value negative`)
  }
  const fxIds = new Set<number>()
  for (const f of g.fixtures) {
    if (fxIds.has(f.id)) bad(`${tag} duplicate fixture id ${f.id}`)
    fxIds.add(f.id)
    if (f.homeId === f.awayId) bad(`${tag} ${f.homeId} plays itself`)
    if (f.played && (f.homeScore < 0 || f.awayScore < 0)) bad(`${tag} negative score`)
  }
  const nb = badNumberPath(g)
  if (nb) bad(`${tag} non-finite number at ${nb}`)
}

const st = useStore
const top = () => st.getState().nav[st.getState().nav.length - 1]?.screen
const G = () => st.getState().game!

function playLive() {
  let guard = 0
  while (guard++ < 400) {
    const lm = st.getState().liveMatch
    if (!lm) return
    if (lm.done) break
    if (lm.ctx.decision) { st.getState().decide('posts'); continue }
    if (lm.ctx.awaiting) { st.getState().startSecondHalf(); continue }
    st.getState().skipToBreak()
  }
  if (guard >= 400) bad('live match never finished')
  st.getState().finishMatch()
}

function run(reloadEachWeek: boolean): { results: string[]; taps: number; msPerSeason: number[]; sizes: number[]; stuck: string[] } {
  const g0 = newGame(CLUB, 'Persona ' + (reloadEachWeek ? 'B' : 'A'), SEED)
  st.setState({ game: g0, nav: [{ screen: 'home' }], lastAdvanceAt: 0, liveMatch: null, saveSlot: 'probe' })
  const results: string[] = []
  const msPerSeason: number[] = []
  const sizes: number[] = []
  const stuck: string[] = []
  let taps = 0, matches = 0
  let lastKey = ''
  let sameCount = 0
  for (let s = 0; s < SEASONS; s++) {
    const t0 = Date.now()
    const target = G().season + 1
    let guard = 0
    while (G().season < target && guard++ < 3000) {
      const g = G()
      const key = `s${g.season}w${g.week}d${g.day ?? 0}:${top()}:${g.press.filter(p => !p.answered).length}:${g.offers.filter(o => o.status === 'pending' && o.forUser).length}`
      if (key === lastKey) { sameCount++ } else { sameCount = 0; lastKey = key }
      if (sameCount > 12) { stuck.push(key); bad(`stuck at ${key}`); break }
      const scr = top()
      if (scr === 'press') {
        for (const pi of g.press.filter(p => !p.answered)) st.getState().answerPressOption(pi.id, 0)
        st.getState().back()
        continue
      }
      if (scr === 'offers') {
        for (const o of g.offers.filter(o => o.status === 'pending' && o.forUser)) {
          const p = g.players[o.playerId]
          respondToOffer(g, o.id, !!p && o.fee > p.value * 1.5)
        }
        st.getState().back()
        continue
      }
      if (scr === 'annual') { g.annual = undefined; st.getState().back(); continue }
      if (scr === 'country') { st.getState().answerNatOffer?.(false); st.getState().back(); continue }
      if (scr === 'matchday') {
        matches++
        if (matches % LIVE_EVERY === 0) { st.getState().kickOff('calm', 'highlights'); playLive() }
        else st.getState().instantResult('calm')
        taps++
        continue
      }
      if (scr === 'wire' || scr === 'results' || scr === 'day') { /* fallthrough to continue */ }
      st.setState({ lastAdvanceAt: 0 })
      const wk = g.week
      st.getState().continueWeek()
      taps++
      if (reloadEachWeek && G().week !== wk) {
        const json = JSON.stringify(G())
        const copy = migrate(JSON.parse(json) as GameState)
        st.setState({ game: copy })
      }
      if (G().week !== wk) audit(G(), `s${G().season}w${G().week}`)
    }
    msPerSeason.push(Date.now() - t0)
    sizes.push(JSON.stringify(G()).length)
    if (guard >= 3000) bad(`season ${s} guard exhausted at ${lastKey}`)
    for (const h of G().history.filter(h => h.season === G().season - 1)) results.push(`${h.compId}:${h.champion}`)
  }
  for (const f of G().fixtures.filter(f => f.played)) results.push(`${f.id}:${f.homeId}${f.homeScore}-${f.awayScore}${f.awayId}`)
  return { results, taps, msPerSeason, sizes, stuck }
}

const A = run(false)
console.log(`A: taps ${A.taps}, ms/season ${A.msPerSeason.join(',')}, save KB ${A.sizes.map(x => Math.round(x / 1024)).join(',')}`)
const B = run(true)
console.log(`B: taps ${B.taps}, ms/season ${B.msPerSeason.join(',')}, save KB ${B.sizes.map(x => Math.round(x / 1024)).join(',')}`)
const diff = A.results.filter((r, i) => B.results[i] !== r)
console.log(`A results ${A.results.length}, B results ${B.results.length}, differing ${diff.length}`)
if (diff.length) console.log('  first diffs: ' + diff.slice(0, 5).join(' | ') + ' vs ' + B.results.filter((r, i) => A.results[i] !== r).slice(0, 5).join(' | '))
const g = G()
console.log(`final: season ${g.season} week ${g.week} club ${g.userClubId} unemployed ${g.unemployed} balance ${g.clubs[g.userClubId]?.balance} players ${Object.keys(g.players).length}`)
console.log(fails ? `PERSONA FAILED (${fails})` : 'PERSONA PASSED')
