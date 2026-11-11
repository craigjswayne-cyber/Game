/**
 * ---- THE 1.9 ROUND, IN THE WOMEN'S GAME ----
 *
 * Owner, 4 Nov 2026: "Can I check all feedback and changes across 1.9 have
 * all been applied to the womens games."
 *
 * Every probe and harness written for 1.9.7 to 1.9.10 played a men's club.
 * The engine is the same code for both games (a save holds one world, see
 * docs/womens-game.md), so what can differ is the world itself (smaller
 * squads, no shirt minimum) and the text, which in a women's world reads the
 * `_f` sibling of a key where a language needs one. This plays a women's
 * career through the 1.9 features and reads their new lines in the women's
 * world in every language.
 *
 *   1.9.7  the wage budget refreshed every summer and on a new job
 *   1.9.10 retraining: started, settled, its news; the office knock that asks
 *          for it; the training load and last week's line
 *   text   the 1.9.7 to 1.9.10 lines, rendered in a women's world, carry no
 *          masculine player noun, adjective or participle
 *
 * Run: npx vite-node scripts/womens19probe.ts
 */
import { newGame, LEAGUE_DEFS } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { userWageBudget } from '../src/game/grants'
import { answerJobOffer } from '../src/game/jobs'
import { genderOf } from '../src/game/gender'
import { absWeek, type GameState, type Player } from '../src/game/model'
import { retrainOf, retrainOdds, settleRetrains, startRetrain } from '../src/game/retrain'
import { answerPress } from '../src/game/media'
import { ensureLang, setLang, setWorld, t, type Lang } from '../src/game/i18n'
import { ok, done } from './lib/probe'

const bill = (g: GameState, id: string) => g.clubs[id].players.reduce((s, p) => {
  const pl = g.players[p]
  return pl && !pl.acad ? s + pl.wage : s
}, 0)
const seniors = (g: GameState) => g.clubs[g.userClubId].players.map(id => g.players[id]).filter((p): p is Player => !!p && !p.acad)

const wClub = LEAGUE_DEFS('w')[0].clubs[0].id

console.log('=== 1.9.7: wage room, every summer and on a new job ===')
{
  const g = newGame(wClub, 'Probe', 7, undefined, 'coach', 'w')
  ok(genderOf(g) === 'w', `a women's career (${g.clubs[g.userClubId].name})`)
  ok(g.wageFix === 1, 'a new women\'s career is marked as already given its wage room')
  const s0 = g.season
  let guard = 0
  while (g.season < s0 + 3 && guard++ < 300) {
    const before = g.season
    processWeekAndAdvance(g)
    if (g.season !== before) {
      const ids = Object.keys(g.clubs)
      const over = ids.filter(id => bill(g, id) >= g.clubs[id].wageBudget)
      ok(over.length === 0, `season +${g.season - s0} opens with wage room at every women's club (${over.length}/${ids.length} without)`)
    }
  }
  for (let i = 0; i < 20; i++) processWeekAndAdvance(g)
  const target = Object.values(g.clubs).find(c => c.id !== g.userClubId)!
  target.wageBudget = Math.round(bill(g, target.id) * 0.9)
  g.vacancies.push({ clubId: target.id, week: g.week })
  g.jobOffer = { clubId: target.id, week: g.week }
  answerJobOffer(g, true)
  const u = g.clubs[g.userClubId]
  ok(g.userClubId === target.id && userWageBudget(g, u) > bill(g, u.id),
    `a manager walking in to ${u.short} has wage room (bill ${bill(g, u.id)}, budget ${userWageBudget(g, u)})`)
}

console.log('\n=== 1.9.10: retraining in a women\'s squad ===')
{
  const g = newGame(wClub, 'Probe', 21, undefined, 'coach', 'w')
  const fl = seniors(g).find(p => p.pos === 'FL')
  ok(!!fl, 'the women\'s squad has a flanker to retrain')
  if (fl) {
    fl.alt = []
    const near = retrainOdds(g, fl, 'N8', true), cross = retrainOdds(g, fl, 'WG', true)
    ok(near > cross && cross <= 0.12, `a flanker to number 8 beats a flanker to wing (${near.toFixed(2)} against ${cross.toFixed(2)})`)
    ok(startRetrain(g, fl.id, 'N8', true), 'a retrain starts')
    const r = retrainOf(g, fl.id)!
    const at = r.start + r.weeks
    g.season = Math.floor(at / 48); g.week = at - g.season * 48
    ok(absWeek(g.season, g.week) === at, 'the clock is at the week it is due')
    settleRetrains(g)
    const n = g.news.at(-1)
    ok(n?.k === 'news.retrainDone' || n?.k === 'news.retrainFail', `it settles with its news (${n?.k})`)
  }
}

console.log('\n=== 1.9.10: the office knock that asks to learn a shirt, and the load ===')
{
  // the knock is rare in either game (about one career in five sees it in
  // three seasons, men's and women's alike, measured 4 Nov 2026); this is a
  // women's career where it comes. SEED 36, NOT 33 (1.9.12): the match
  // retune moved the dice; of seeds 33-36 and 45 the knock comes in 36 (week
  // 13) and 45 (week 24)
  const g = newGame('w:bristol', 'Probe', 36, undefined, 'coach', 'w')
  g.trainLoad = 'hard'
  let knock: GameState['press'][number] | undefined
  for (let w = 0; w < 48 * 3 && !knock; w++) {
    processWeekAndAdvance(g)
    knock = g.press.find(q => q.qk === 'talk.positionQ3' && !q.answered)
  }
  ok(!!g.trainLog && g.trainLog.load === 'hard', `the hard load writes last week's line (${JSON.stringify(g.trainLog)})`)
  ok(!!knock, 'a women\'s player knocks to ask to learn a new position')
  if (knock) {
    const i = knock.options.findIndex(o => o.retrain)
    answerPress(g, knock.id, i)
    const r = retrainOf(g, knock.playerId!)
    ok(!!r || g.news.some(x => x.k === 'training.retrainNoRoom'), `"start on it in training" starts a real retrain (${r?.to ?? 'no room'})`)
  }
}

console.log('\n=== the 1.9 lines, read in a women\'s world ===')
// The masculine forms these lines used before 1.9.10's women's pass. Each is
// a player noun or a word that agrees with one; none belongs in a women's career.
// (\p{L} rather than \b: \b counts "é" as a non-letter, so "adapté" would
// match inside the correct "adaptée")
const word = (alts: string) => new RegExp(`(?<!\\p{L})(${alts})(?!\\p{L})`, 'u')
const MASC: Partial<Record<Lang, RegExp>> = {
  fr: word('joueurs?|partant|blessés|adapté'),
  es: word('jugador|jugadores|lesionados|bueno a'),
  it: word('giocatore|giocatori|motivato|adattato|schierato|infortunati'),
  af: word('hy|hom|sy'),
}
const v = { player: 'Ellie Kildunne', pos_k: 'pos.N8', to_k: 'pos.N8', load_k: 'training.loadHard', pts: 3, inj: 2, n: 8, done: 2, of: 8, who: 'Dr Lane' }
const KEYS = [
  'training.retrainNoRoom', 'training.retrainWhyNotSenior', 'training.retrainWhyKnown', 'training.retrainWhyBusy',
  'training.retrainWhyFailed', 'training.retrainWhyFull', 'training.retrainNone', 'training.lastWeek', 'training.retrainProgress',
  'news.retrainDoneSubj', 'news.retrainDone', 'news.retrainFailSubj', 'news.retrainFail',
  'talk.positionQ3', 'talk.positionLearnGood', 'talk.positionLearnMixed', 'talk.positionLearnBad',
  'search.attrsHint', 'player.byPositionSub', 'tacticsScreen.condCoach',
]
setWorld('w')
for (const lang of ['en', 'fr', 'es', 'it', 'ja', 'af'] as Lang[]) {
  await ensureLang(lang)
  setLang(lang)
  const re = MASC[lang] ?? /\b(he|him|his|himself)\b/i
  const bad = KEYS.map(k => [k, t(k, v)] as const).filter(([k, s]) => re.test(s) || s === k)
  ok(bad.length === 0, `${lang}: every 1.9 line reads for a women's squad${bad.length ? ` (${bad.map(([k, s]) => `${k}: "${s.slice(0, 70)}"`).join('; ')})` : ''}`)
}

done('WOMENS 1.9 PROBE', 'wage room, retraining, the knock, the load and the new text all work in the women\'s game')
