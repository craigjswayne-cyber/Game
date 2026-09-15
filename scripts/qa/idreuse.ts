// Player-id reuse after reload: the id counter lives in a module variable and is
// reset to max(live id)+1 on load, while rollover deletes players. Prove or refute reuse.
import { newGame } from '../../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../../src/game/season'
import { simMatch } from '../../src/game/matchEngine'
import { answerPress } from '../../src/game/media'
import { migrate } from '../../src/game/save'
import { SEASON_WEEKS, type GameState } from '../../src/game/model'

const SEASONS = Number(process.argv[2] ?? 6)
const SEED = Number(process.argv[3] ?? 4242)
let g = newGame('leicester', 'Id Probe', SEED)
function runSeason(g: GameState, onWeek?: () => void) {
  const target = g.season + 1
  let guard = 0
  while (g.season < target && guard++ < SEASON_WEEKS + 5) {
    const fx = userFixtureThisWeek(g)
    if (fx) simMatch(g, fx, weekRng(g), true)
    for (const pi of g.press.filter(p => !p.answered)) answerPress(g, pi.id, 0)
    processWeekAndAdvance(g)
    onWeek?.()
  }
}
const ID_KEY = /^(pid|playerId|player|motm|captain|vice|topScorer|heir|mentor|pupil|kicker|target|subjectId|who|winner|potm|poty|star|talisman|id|a|b|out|in)$/i
const ID_ARRAY = /^(shortlist|seniors|kids|lineup|players|ids|squad|xv|team|bench|picks|pool)$/i
function refs(x: unknown, ids: Set<number>, path: string, out: string[], depth = 0) {
  if (out.length > 200 || depth > 9) return
  if (Array.isArray(x)) { x.forEach((v, i) => refs(v, ids, `${path}[${i}]`, out, depth + 1)); return }
  if (x && typeof x === 'object') {
    for (const [k, v] of Object.entries(x)) {
      if (typeof v === 'number' && ids.has(v) && ID_KEY.test(k)) out.push(`${path}.${k}=${v}`)
      else if (Array.isArray(v) && ID_ARRAY.test(k)) { for (const e of v) if (typeof e === 'number' && ids.has(e)) out.push(`${path}.${k}[]=${e}`) }
      else if (typeof v === 'object' && v) refs(v, ids, `${path}.${k}`, out, depth + 1)
    }
  }
}
let totalReused = 0
for (let s = 0; s < SEASONS; s++) {
  const before = new Set(Object.keys(g.players).map(Number))
  const maxBefore = Math.max(...before)
  runSeason(g)
  const after = new Set(Object.keys(g.players).map(Number))
  const deleted = [...before].filter(id => !after.has(id))
  const maxAfter = Math.max(...after)
  const deletedAboveMax = deleted.filter(id => id > maxAfter)
  console.log(`season ${g.season}: players ${before.size}->${after.size}, deleted ${deleted.length}, max id before ${maxBefore} after ${maxAfter}, deleted ids above the new max: ${deletedAboveMax.length}`)
  // the app reloads: migrate resets the counter to maxAfter+1
  const reloaded = migrate(JSON.parse(JSON.stringify(g))) as GameState
  // references to deleted ids that still linger in the save (dangling BEFORE any reuse)
  const dangling: string[] = []
  refs(reloaded, new Set(deleted), 'state', dangling)
  const danglingOutsidePlayers = dangling.filter(d => !d.startsWith('state.players.'))
  if (danglingOutsidePlayers.length) console.log(`  dangling refs to deleted players: ${danglingOutsidePlayers.length}, e.g. ${danglingOutsidePlayers.slice(0, 6).join(' ; ')}`)
  g = reloaded
  // play 3 more weeks then check which new ids reused deleted ones
  const beforeMint = new Set(Object.keys(g.players).map(Number))
  const t = g.week
  for (let i = 0; i < 6; i++) { const fx = userFixtureThisWeek(g); if (fx) simMatch(g, fx, weekRng(g), true); processWeekAndAdvance(g) }
  const minted = Object.keys(g.players).map(Number).filter(id => !beforeMint.has(id))
  const reused = minted.filter(id => deleted.includes(id))
  totalReused += reused.length
  if (reused.length) {
    console.log(`  REUSED ${reused.length} ids of deleted players in the first weeks of season ${g.season}: ${reused.slice(0, 5).join(',')}`)
    const hits: string[] = []
    refs(g, new Set(reused), 'state', hits)
    const suspicious = hits.filter(h => !/^state\.players\.\d+\.id=/.test(h))
    console.log(`  references to those ids now (outside the new players' own records): ${suspicious.length}`)
    for (const h of suspicious.slice(0, 15)) console.log('    ' + h)
  }
}
console.log(totalReused ? `ID REUSE CONFIRMED: ${totalReused} ids re-minted after reload` : 'no id reuse observed')
