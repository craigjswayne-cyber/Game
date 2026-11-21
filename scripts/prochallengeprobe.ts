/**
 * ---- PRO CHALLENGES, CLAUSE BY CLAUSE (1.9.16 audit) ----
 *
 * The three promises in en.json `pro.*Desc`, each clause tested against the
 * engine. Every "blocked" claim is paired with a CONTROL: the same career
 * (same club, same seed, cloned state) without the challenge, where the same
 * call succeeds, so a refusal is known to come from the challenge and not
 * from a full squad or an empty purse.
 *
 * Prints one PASS / FAIL / INFO line per clause. Read-only on the repo.
 * Run: npx vite-node scripts/prochallengeprobe.ts            (full, ~minutes)
 *      QUICK=1 npx vite-node scripts/prochallengeprobe.ts    (no season sims)
 */
import { newGame, START_FREE_AGENTS } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import {
  FIRESALE_COUNT, PRO_SEASONS, SHOESTRING_RUN, proActive, proBlocksMoney, proBlocksSigning, proCheck,
  startProChallenge, type ProChallengeId,
} from '../src/game/prochallenge'
import { agreeFee, agreePreContract, offerFreeAgent, signFreeAgent, signOnTerms, personalTermsDemand, freeAgentDemand, askingPrice } from '../src/game/ai'
import { loanBuy, loanIn, loanTargets } from '../src/game/loans'
import { signMedicalJoker } from '../src/game/joker'
import { requestFunds } from '../src/game/season/board'
import { applyInjection, userWageBudget, openingWageBudget } from '../src/game/grants'
import { releaseToBudget } from '../src/game/treasury'
import { townCollection } from '../src/game/rewarded'
import { capBill } from '../src/game/cap'
import { applyForJob, resignJob, sackManager } from '../src/game/jobs'
import { migrate } from '../src/game/save'
import { t } from '../src/game/i18n'
import type { GameState, Player } from '../src/game/model'

const QUICK = !!process.env.QUICK
const CLUB = process.env.CLUB ?? 'leicester'
const SEED = Number(process.env.SEED ?? 91)

let fails = 0, passes = 0
const line = (tag: 'PASS' | 'FAIL' | 'INFO', what: string, evidence = '') => {
  if (tag === 'FAIL') fails++
  if (tag === 'PASS') passes++
  console.log(`${tag}  ${what}${evidence ? `  [${evidence}]` : ''}`)
}
const verdict = (cond: unknown, what: string, evidence = '') => line(cond ? 'PASS' : 'FAIL', what, evidence)
const clone = (g: GameState): GameState => structuredClone(g)
const m = (n: number) => `${(n / 1e6).toFixed(2)}M`

const fresh = (seed = SEED, club = CLUB) => newGame(club, 'Probe', seed)
const started = (id: ProChallengeId, seed = SEED, club = CLUB) => { const g = fresh(seed, club); startProChallenge(g, id); return g }
const seniors = (g: GameState) => g.clubs[g.userClubId].players.map(id => g.players[id]).filter((p): p is Player => !!p && !p.acad)
const freeAgents = (g: GameState) => Object.values(g.players).filter(p => p.clubId == null && !p.retiring && !(p as { natOnly?: boolean }).natOnly)
const runTo = (g: GameState, season: number, week: number, each?: () => void) => {
  let guard = 0
  while ((g.season < season || (g.season === season && g.week < week)) && guard++ < 600) { processWeekAndAdvance(g); each?.() }
}
const PRO_ACADEMY = t('reply.proAcademy')
const PRO_NOFUNDS = t('reply.proNoFunds')

/** Try `attempt` on up to `cands` in the control until one succeeds; then make
 *  the same call in the challenge career. Returns both outcomes. */
function paired<T>(base: GameState, id: ProChallengeId, cands: T[], attempt: (g: GameState, c: T) => { ok: boolean; msg: string }, prep?: (g: GameState) => void) {
  for (const c of cands) {
    const ctl = clone(base); prep?.(ctl)
    const r = attempt(ctl, c)
    if (!r.ok) continue
    const ch = clone(base); startProChallenge(ch, id); prep?.(ch)
    const r2 = attempt(ch, c)
    return { found: true as const, c, ctl: r, ch: r2, chState: ch, ctlState: ctl }
  }
  return { found: false as const }
}

// =========================================================================
console.log(`\n=== ACADEMY ONLY  (${CLUB}, seed ${SEED}) ===`)
console.log(`promise: "${t('pro.academyDesc', { n: PRO_SEASONS.academy })}"`)
{
  const base = fresh()
  const uid = base.userClubId
  const inSquad = (g: GameState, pid: number) => g.clubs[uid].players.includes(pid)
  const others = Object.values(base.players).filter(p => p.clubId && p.clubId !== uid && !p.acad && !p.loanFrom && !p.onLoan)
    .sort((a, b) => a.ca - b.ca)
  // cheap men first so the fee fits the purse
  const cheap = others.filter(p => askingPrice(base, p) * 1.6 <= base.clubs[uid].budget).slice(0, 60)

  // --- agreeFee
  {
    const r = paired(base, 'academy', cheap, (g, p) => agreeFee(g, p.id, Math.round(askingPrice(g, g.players[p.id]) * 1.5 / 50_000) * 50_000))
    if (!r.found) line('FAIL', 'A1 agreeFee: no control signing could be found to compare against')
    else verdict(!r.ch.ok && r.ch.msg === PRO_ACADEMY, 'A1 "no signings": agreeFee (a bid for a contracted player) is refused',
      `control ok=${r.ctl.ok}; challenge ok=${r.ch.ok} msg="${r.ch.msg}"`)
  }
  // --- signOnTerms called directly (stage 2 without stage 1), and userBid's full path
  {
    const r = paired(base, 'academy', cheap, (g, p) => {
      const q = g.players[p.id]
      const fee = Math.round(askingPrice(g, q) * 1.5 / 50_000) * 50_000
      const a = agreeFee(g, p.id, fee)
      // in the challenge career stage 1 is refused; go to stage 2 regardless, as a screen bug or a stale card would
      const s = signOnTerms(g, p.id, fee, Math.round(personalTermsDemand(g, q) * 1.2), 0, false)
      return { ok: s.ok && inSquad(g, p.id), msg: `${a.ok ? 'fee agreed' : 'fee refused'} / ${s.msg}` }
    })
    if (!r.found) line('FAIL', 'A2 signOnTerms: no control signing could be found to compare against')
    else verdict(!r.ch.ok && !inSquad(r.chState, (r.c as Player).id), 'A2 "no signings": signOnTerms (personal terms, the move itself) is refused even when called directly',
      `control signed=${r.ctl.ok}; challenge signed=${r.ch.ok} msg="${r.ch.msg}"`)
  }
  // --- the free agents on day one
  {
    const fa = freeAgents(base)
    const seniorFa = fa.filter(p => p.age >= 20)
    line('INFO', `free agents in the world on day one: ${fa.length} (START_FREE_AGENTS=${START_FREE_AGENTS}; aged 20+: ${seniorFa.length})`)
    let ctlOk = 0, chOk = 0, chWrongMsg = 0, ctlOk2 = 0, chOk2 = 0
    for (const p of fa) {
      const ctl = clone(base)
      if (signFreeAgent(ctl, p.id).ok && inSquad(ctl, p.id)) ctlOk++
      const ctl2 = clone(base)
      if (offerFreeAgent(ctl2, p.id, Math.round(freeAgentDemand(p, 2) * 1.3), 2).ok && inSquad(ctl2, p.id)) ctlOk2++
      const ch = clone(base); startProChallenge(ch, 'academy')
      const r = signFreeAgent(ch, p.id)
      if (r.ok || inSquad(ch, p.id)) chOk++
      else if (r.msg !== PRO_ACADEMY) chWrongMsg++
      const ch2 = clone(base); startProChallenge(ch2, 'academy')
      const r2 = offerFreeAgent(ch2, p.id, Math.round(freeAgentDemand(p, 2) * 1.3), 2)
      if (r2.ok || inSquad(ch2, p.id)) chOk2++
    }
    verdict(ctlOk > 0 && chOk === 0 && chWrongMsg === 0, 'A3 "no free agents": signFreeAgent refused for every day-one free agent (the 1.9.16 pool included)',
      `control signs ${ctlOk}/${fa.length}; challenge signs ${chOk}/${fa.length}; refusals with another message: ${chWrongMsg}`)
    verdict(ctlOk2 > 0 && chOk2 === 0, 'A4 "no free agents": offerFreeAgent (the talks) refused for every day-one free agent',
      `control signs ${ctlOk2}/${fa.length}; challenge signs ${chOk2}/${fa.length}`)
  }
  // --- loans in
  {
    const targets = loanTargets(base).slice(0, 80)
    const r = paired(base, 'academy', targets, (g, p) => {
      for (const share of [0.5, 0.75, 1]) {
        const msg = loanIn(g, p.id, 'season', share)
        if (inSquad(g, p.id)) return { ok: true, msg }
        if (msg === PRO_ACADEMY) return { ok: false, msg }
      }
      return { ok: false, msg: 'refused' }
    })
    if (!r.found) line('FAIL', `A5 loanIn: no control loan could be found among ${targets.length} targets`)
    else verdict(!r.ch.ok && r.ch.msg === PRO_ACADEMY, 'A5 "no loans in": loanIn is refused', `control joined=${r.ctl.ok}; challenge joined=${r.ch.ok} msg="${r.ch.msg}"`)
  }
  // --- a loanee already at the club on day one, bought outright
  {
    const loanees = base.clubs[uid].players.map(id => base.players[id]).filter(p => p?.loanFrom)
    if (!loanees.length) {
      // can it be reached at all? take a loan in the control, THEN lay the challenge over (not a route the game offers), to show what loanBuy itself checks
      let shown = false
      for (const p of loanTargets(base).slice(0, 80)) {
        const g = clone(base)
        loanIn(g, p.id, 'season', 1)
        if (!inSquad(g, p.id)) continue
        startProChallenge(g, 'academy')
        g.clubs[uid].budget = 50_000_000; g.clubs[uid].wageBudget *= 3; g.players[p.id].loanOpt = true as never
        const r = loanBuy(g, p.id)
        line('INFO', `A6 loanBuy has no Academy Only guard of its own (${r.ok ? 'it BOUGHT a loanee with the challenge on' : `refused here: ${r.k}`}); unreachable in play because the club starts with ${loanees.length} loanees and loanIn is blocked`)
        shown = true
        break
      }
      if (!shown) line('INFO', 'A6 loanBuy: the club starts with 0 loanees and no loan could be staged')
    } else {
      line('FAIL', `A6 the club starts with ${loanees.length} loanee(s); loanBuy is not guarded by proBlocksSigning (loans.ts loanBuy)`)
    }
  }
  // --- the medical joker (a free agent in to cover a long injury)
  {
    const prep = (g: GameState) => {
      const hurt = seniors(g)[0]
      hurt.injury = { desc: 'Knee ligament', until: g.week + 12, weeks: 12 }
    }
    const cands = freeAgents(base)
    const r = paired(base, 'academy', cands, (g, p) => {
      const hurt = seniors(g)[0]
      const out = signMedicalJoker(g, hurt.id, p.id)
      return { ok: out.ok && inSquad(g, p.id), msg: out.msg }
    }, prep)
    if (!r.found) line('FAIL', 'A7 medical joker: no control signing found')
    else verdict(!r.ch.ok, 'A7 "no free agents": the medical joker (free-agent injury cover) is refused', `control signed=${r.ctl.ok}; challenge signed=${r.ch.ok} msg="${r.ch.msg}"`)
  }
  // --- goal, deadline, void (the summer check in isolation)
  {
    const g = started('academy')
    g.mgr.trophies.push({ compId: g.clubs[uid].leagueId, season: g.season, clubId: uid })
    g.season += 1; proCheck(g)
    verdict(g.proChallenge?.done === true && g.news.some(n => n.k === 'news.proDone') && g.celebration?.hk === 'cel.challenge' && (g.challengesDone ?? []).includes('pro.academy') && !g.careerOver && !g.unemployed,
      'A9 success: a trophy with the club is detected at the summer, announced (news + celebration), badged, and the career carries on',
      `done=${g.proChallenge?.done} news=${g.news.some(n => n.k === 'news.proDone')} celebration=${g.celebration?.hk} badge=${(g.challengesDone ?? []).join(',')}`)
    verdict(!proBlocksSigning(g), 'A9b after success the rule is lifted ("the career carries on as you like")', `proBlocksSigning=${proBlocksSigning(g)}`)

    const cupIds = Object.values(g.comps).filter(c => c.type !== 'league' && c.type !== 'intl' && !c.isNational && c.id !== 'fr').map(c => `${c.id}:${c.type}`)
    line('INFO', `non-league club competitions that would count as "a trophy": ${cupIds.join(', ') || 'none'}`)

    const other = started('academy')
    const otherClub = Object.keys(other.clubs).find(id => id !== uid)!
    other.mgr.trophies.push({ compId: other.clubs[uid].leagueId, season: other.season, clubId: otherClub })
    const intl = Object.values(other.comps).find(c => c.type === 'intl' || c.isNational)
    if (intl) other.mgr.trophies.push({ compId: intl.id, season: other.season, clubId: uid })
    other.season += 1; proCheck(other)
    verdict(!other.proChallenge?.done, 'A10 a trophy with another club, or a national-team trophy, does not count', `done=${!!other.proChallenge?.done}; intl comp tried=${intl?.id ?? 'none'}`)

    const late = started('academy')
    late.season += PRO_SEASONS.academy - 1; proCheck(late)
    const still = !late.careerOver && !late.unemployed
    late.season += 1; proCheck(late)
    verdict(still && late.unemployed && late.careerOver?.k === 'over.proFailed' && late.news.some(n => n.k === 'news.proFailed') && late.proChallenge?.over === true,
      `A11 failure: nothing after ${PRO_SEASONS.academy - 1} seasons, the career ends at the summer after season ${PRO_SEASONS.academy}`,
      `after ${PRO_SEASONS.academy - 1}: alive=${still}; after ${PRO_SEASONS.academy}: unemployed=${late.unemployed} careerOver=${late.careerOver?.k}`)

    const last = started('academy')
    last.season += PRO_SEASONS.academy - 1
    last.mgr.trophies.push({ compId: last.clubs[uid].leagueId, season: last.season, clubId: uid })
    last.season += 1; proCheck(last)
    verdict(last.proChallenge?.done === true && !last.careerOver, `A12 a trophy won IN season ${PRO_SEASONS.academy} (the last allowed) still counts`, `done=${last.proChallenge?.done} careerOver=${last.careerOver?.k ?? 'none'}`)
  }
}

// =========================================================================
console.log(`\n=== SHOESTRING  (${CLUB}, seed ${SEED}) ===`)
console.log(`promise: "${t('pro.shoestringDesc', { n: PRO_SEASONS.shoestring })}"`)
{
  const base = fresh()
  const uid = base.userClubId
  const b0 = base.clubs[uid].budget, w0 = base.clubs[uid].wageBudget
  const g = started('shoestring')
  const club = g.clubs[uid]
  verdict(club.budget === Math.round(b0 / 2 / 50_000) * 50_000, 'S1 "half the transfer budget": halved on day one', `${m(b0)} -> ${m(club.budget)}`)
  const room0 = userWageBudget(g, club) - capBill(g, club)
  verdict(room0 === 0, 'S2 "no extra wage room": day-one wage room (wage budget less the bill) is nil', `control room ${w0 - capBill(base, base.clubs[uid])}/wk -> challenge room ${room0}/wk; wageBudget ${w0} -> ${club.wageBudget}; bill ${capBill(g, club)}`)
  // can a free agent be added on day one? (no fee, so only wage room stops it)
  {
    let signed = 0, cheapest = Infinity
    for (const p of freeAgents(g)) {
      const c = clone(g)
      if (signFreeAgent(c, p.id).ok) signed++
      cheapest = Math.min(cheapest, freeAgentDemand(p, 2))
    }
    verdict(signed === 0, 'S3 "no extra wage room": no day-one free agent can be added without first moving wages off the bill', `signable ${signed}/${freeAgents(g).length}; cheapest asks ${cheapest}/wk`)
  }
  // the board's money, by every door found
  {
    const doors: [string, (s: GameState) => boolean][] = [
      ['requestFunds (ask the board)', s => { const b = s.clubs[uid].budget; const msg = requestFunds(s); return s.clubs[uid].budget === b && msg === PRO_NOFUNDS }],
      ['applyInjection (store board injection)', s => { const b = s.clubs[uid].budget; const r = applyInjection(s, 's'); return !r && s.clubs[uid].budget === b && !s.wageBoost }],
      ['releaseToBudget (cash reserve)', s => { const b = s.clubs[uid].budget; s.clubs[uid].balance = 50_000_000; const r = releaseToBudget(s); return !r.ok && s.clubs[uid].budget === b }],
      ['townCollection (rewarded ad)', s => { const b = s.clubs[uid].budget; const r = townCollection(s); return r == null && s.clubs[uid].budget === b }],
    ]
    for (const [name, fn] of doors) {
      let okk = false, err = ''
      try { okk = fn(clone(g)) } catch (e) { err = String(e) }
      verdict(okk, `S4 board money shut: ${name}`, err)
    }
    // wage boosts bought earlier must not lift the ceiling
    const c = clone(g); c.wageBoost = 0.25; c.uncapped = true
    verdict(userWageBudget(c, c.clubs[uid]) === c.clubs[uid].wageBudget, 'S5 "no extra wage room": a store wage boost or the Charter does not lift the wage ceiling', `ceiling ${userWageBudget(c, c.clubs[uid])} vs budget ${c.clubs[uid].wageBudget}`)
  }
  // streak, goal, deadline (in isolation)
  {
    const s = clone(g); s.proChallenge!.streak = SHOESTRING_RUN; s.season += 3; proCheck(s)
    verdict(s.proChallenge?.done === true && s.news.some(n => n.k === 'news.proDone'), 'S6 success: three targets met in a row is detected and announced', `done=${s.proChallenge?.done}`)
    const f = clone(g); f.proChallenge!.streak = 2; f.season += PRO_SEASONS.shoestring; proCheck(f)
    verdict(f.careerOver?.k === 'over.proFailed' && f.unemployed, `S7 failure: no run of three by the end of season ${PRO_SEASONS.shoestring} ends the career`, `careerOver=${f.careerOver?.k}`)
  }
}

// =========================================================================
console.log(`\n=== FIRE SALE  (${CLUB}, seed ${SEED}) ===`)
console.log(`promise: "${t('pro.firesaleDesc', { n: PRO_SEASONS.firesale })}"`)
{
  const base = fresh()
  const uid = base.userClubId
  const c0 = base.clubs[uid]
  const rank = seniors(base).sort((a, b) => b.ca - a.ca || a.id - b.id)
  const best = rank.slice(0, FIRESALE_COUNT)
  const fifthCa = best[FIRESALE_COUNT - 1].ca
  const g = started('firesale')
  const club = g.clubs[uid]
  const gone = best.filter(p => g.players[p.id].clubId !== uid)
  verdict(gone.length === FIRESALE_COUNT && g.week === base.week && g.season === base.season,
    'F1 "your five best players are sold before day one"', `sold ${gone.length}/${FIRESALE_COUNT}: ${best.map(p => `${p.name} ${p.pos} ${p.ca}`).join(', ')}; week ${g.week}`)
  const bestLeft = Math.max(...seniors(g).map(p => p.ca))
  verdict(bestLeft <= fifthCa, 'F1b nobody left at the club is rated above the fifth man sold', `best left ${bestLeft}, fifth sold ${fifthCa}`)
  const loaneesHeld = seniors(base).filter(p => p.loanFrom && p.ca > fifthCa).length
  line('INFO', `loanees rated above the fifth man sold and kept (not the club's to sell): ${loaneesHeld}`)
  const fees = best.reduce((s, p) => s + Math.round(p.value / 50_000) * 50_000, 0)
  verdict(club.budget === c0.budget, 'F2 "the money clears the debts": none of the fees reach the transfer budget', `budget ${m(c0.budget)} -> ${m(club.budget)}; fees ${m(fees)}`)
  verdict(club.balance === c0.balance, 'F3 the fees are gone the day they arrive: none is left in the bank (1.9.16)', `balance ${m(c0.balance)} -> ${m(club.balance)} (+${m(club.balance - c0.balance)}); fees ${m(fees)}`)
  {
    const debtKeys = Object.keys(c0).filter(k => /debt|loan|owed|overdraft/i.test(k))
    const stateDebt = Object.keys(base).filter(k => /debt|overdraft/i.test(k))
    line(c0.balance < 0 ? 'PASS' : 'INFO', `F4 "clears the debts": the club's balance on day one is ${m(c0.balance)} (${c0.balance < 0 ? 'in debt, and the fees pay it down' : 'NOT in debt: there is no debt to clear, the fees simply sit in the bank'})`,
      `club debt-like fields: ${debtKeys.join(',') || 'none'}; state debt-like fields: ${stateDebt.join(',') || 'none'}`)
  }
  // the money cannot come back
  {
    const c = clone(g)
    const b = c.clubs[uid].budget
    const r = releaseToBudget(c)
    const msg = requestFunds(clone(g))
    verdict(!r.ok && c.clubs[uid].budget === b && msg === PRO_NOFUNDS && proBlocksMoney(g), 'F5 the banked fees cannot be moved back to the budget (reserve slider, board request)', `release ok=${r.ok} msg="${r.msg}"; requestFunds="${msg}"`)
  }
  // what the sale frees: the wage room
  {
    const room = userWageBudget(g, club) - capBill(g, club)
    const roomBefore = userWageBudget(base, c0) - capBill(base, c0)
    line('INFO', `wage room after the sale: ${room}/wk (was ${roomBefore}/wk): the five wages are freed and the transfer budget is untouched (${m(club.budget)}), so replacements can be bought on day one`)
    // can the sold men be bought straight back?
    let back = 0, tried = 0, why = ''
    for (const p of best) {
      const c = clone(g); tried++
      const q = c.players[p.id]
      const fee = Math.min(c.clubs[uid].budget, Math.round(askingPrice(c, q) * 2.2 / 50_000) * 50_000)
      const a = agreeFee(c, p.id, fee)
      if (a.ok) back++; else why = a.msg
    }
    line('INFO', `buying a sold man straight back on day one: fee agreed for ${back}/${tried}${why ? ` (a refusal: "${why}")` : ''}`)
  }
  // the squad left behind is playable
  {
    const lu = club.tactic.lineup
    const holes = lu.slice(0, 23).filter(id => id == null || !club.players.includes(id as number)).length
    line(holes === 0 ? 'PASS' : 'INFO', `F6 the team sheet after the sale: ${holes} of 23 shirts empty or pointing at a sold man`, `seniors left ${seniors(g).length}; captain ${club.captain ?? 'none'}`)
    line('INFO', `the start letter names the sold: ${g.news.find(n => n.k === 'news.proStartSold')?.v?.sold ?? '(no letter)'}`)
  }
  // goal and deadline (in isolation)
  {
    const s = clone(g); s.history.push({ season: s.season, compId: club.leagueId, champion: uid }); s.season += 1; proCheck(s)
    verdict(s.proChallenge?.done === true && s.news.some(n => n.k === 'news.proDone'), 'F7 success: a league title is detected and announced', `done=${s.proChallenge?.done}`)
    const cup = Object.values(g.comps).find(c => c.type !== 'league' && c.type !== 'intl' && !c.isNational && c.id !== 'fr')
    if (cup) {
      const k = clone(g); k.history.push({ season: k.season, compId: cup.id, champion: uid }); k.season += 1; proCheck(k)
      verdict(!k.proChallenge?.done, 'F8 a cup is not "the league"', `cup ${cup.id}: done=${!!k.proChallenge?.done}`)
    }
    const f = clone(g); f.season += PRO_SEASONS.firesale - 1; proCheck(f)
    const alive = !f.careerOver
    f.season += 1; proCheck(f)
    verdict(alive && f.careerOver?.k === 'over.proFailed' && f.unemployed, `F9 failure: no title by the end of season ${PRO_SEASONS.firesale} ends the career`, `alive after ${PRO_SEASONS.firesale - 1}=${alive}; careerOver=${f.careerOver?.k}`)
  }
}

// =========================================================================
console.log('\n=== LEAVING THE CLUB, AND SAVE / LOAD ===')
for (const id of ['academy', 'shoestring', 'firesale'] as ProChallengeId[]) {
  // resign
  {
    const g = started(id)
    resignJob(g)
    const lifted = !proActive(g)
    g.season += 1; proCheck(g)
    verdict(lifted && g.proChallenge == null && !g.careerOver, `L1 ${id}: resigning voids the challenge (no badge, no career end)`, `proChallenge=${JSON.stringify(g.proChallenge)} careerOver=${g.careerOver?.k ?? 'none'}`)
  }
  // sacked for results
  {
    const g = started(id)
    sackManager(g, 'news.sacked')
    g.season += PRO_SEASONS[id]; proCheck(g)
    verdict(g.proChallenge == null && !g.careerOver, `L2 ${id}: sacked for results voids it, and the deadline does not then end the career`, `proChallenge=${JSON.stringify(g.proChallenge)} careerOver=${g.careerOver?.k ?? 'none'}`)
  }
  // resign in the last week of the last season, with the goal missed
  {
    const g = started(id)
    g.season += PRO_SEASONS[id] - 1
    resignJob(g)
    g.season += 1; proCheck(g)
    line('INFO', `L3 ${id}: resigning before the final summer dodges "career ends" (as prochallenge.ts documents: the challenge is simply void)`, `careerOver=${g.careerOver?.k ?? 'none'} unemployed=${g.unemployed}`)
  }
  // goal reached, then out of the job before the summer check
  {
    const g = started(id)
    const uid = g.userClubId
    if (id === 'academy') g.mgr.trophies.push({ compId: g.clubs[uid].leagueId, season: g.season, clubId: uid })
    if (id === 'shoestring') g.proChallenge!.streak = SHOESTRING_RUN
    if (id === 'firesale') g.history.push({ season: g.season, compId: g.clubs[uid].leagueId, champion: uid })
    resignJob(g)
    g.season += 1; proCheck(g)
    line('INFO', `L4 ${id}: goal reached but the manager leaves before the summer check: badge awarded=${(g.challengesDone ?? []).includes(`pro.${id}`)}`)
  }
  // back at the same club before the summer
  {
    const g = started(id)
    resignJob(g)
    g.unemployed = false // re-hired by the same club (applyForJob sets this on success)
    line('INFO', `L5 ${id}: resign and be re-hired by the same club before the summer: the challenge is live again=${!!proActive(g)}`)
  }
  // another job
  {
    const g = started(id)
    const other = Object.keys(g.clubs).find(c => c !== g.userClubId && g.clubs[c].leagueId === g.clubs[g.userClubId].leagueId)!
    g.userClubId = other
    const lifted = !proActive(g) && !proBlocksSigning(g) && !proBlocksMoney(g)
    g.season += 1; proCheck(g)
    verdict(lifted && g.proChallenge == null && !g.careerOver, `L6 ${id}: at another club the rule no longer applies and the challenge is void at the summer`, `proChallenge=${JSON.stringify(g.proChallenge)}`)
  }
  // save and load
  {
    const g = started(id)
    g.proChallenge!.streak = id === 'shoestring' ? 2 : 0
    const before = JSON.stringify(g.proChallenge)
    const loaded = migrate(JSON.parse(JSON.stringify(g)) as GameState)
    const after = JSON.stringify(loaded.proChallenge)
    const sameRule = proBlocksSigning(loaded) === proBlocksSigning(g) && proBlocksMoney(loaded) === proBlocksMoney(g)
    const c0 = g.clubs[g.userClubId], c1 = loaded.clubs[loaded.userClubId]
    verdict(before === after && sameRule && c0.budget === c1.budget && c0.wageBudget === c1.wageBudget,
      `L7 ${id}: a save and load (JSON round trip through migrate) keeps the challenge, its rule and the purse`,
      `challenge ${after}; budget ${m(c0.budget)}->${m(c1.budget)}; wageBudget ${c0.wageBudget}->${c1.wageBudget}`)
    // a second load
    const again = migrate(JSON.parse(JSON.stringify(loaded)) as GameState)
    verdict(JSON.stringify(again.proChallenge) === before && again.clubs[again.userClubId].wageBudget === c0.wageBudget, `L8 ${id}: a second load changes nothing`, `wageBudget ${again.clubs[again.userClubId].wageBudget}`)
    // an old save (no wageFix mark) under Shoestring
    if (id === 'shoestring') {
      const old = JSON.parse(JSON.stringify(g)) as GameState
      delete old.wageFix
      const l2 = migrate(old)
      const cl = l2.clubs[l2.userClubId]
      line(cl.wageBudget === c0.wageBudget ? 'PASS' : 'INFO', 'L9 shoestring: a save without the wageFix mark (written before 1.9.7; no Shoestring save can be that old) keeps its wage ceiling on load',
        `wageBudget ${c0.wageBudget} -> ${cl.wageBudget}; openingWageBudget would be ${openingWageBudget(l2, cl)}`)
    }
    // a damaged record
    const bad = JSON.parse(JSON.stringify(g)) as GameState
    ;(bad.proChallenge as unknown as Record<string, unknown>).id = 'nonsense'
    let crashed = false
    let lb: GameState | null = null
    try { lb = migrate(bad) } catch { crashed = true }
    verdict(!crashed && lb?.proChallenge == null, `L10 ${id}: a damaged challenge record is dropped on load, not a crash`)
  }
}


// =========================================================================
// THE SEASONS: each challenge played through two summers by a manager who
// only presses Continue (the board held off, as careerloop.ts does), with a
// counterfactual cloned at each summer.
// =========================================================================
import { demandedFinish } from '../src/game/chairman'

/** Run to the first week of the next season. Returns the state as it stood
 *  one week before the season turned. */
function toNextSeason(g: GameState, each?: () => void): GameState {
  const s = g.season
  let prev = clone(g)
  let guard = 0
  while (g.season === s && guard++ < 80) {
    if (g.week >= 40) prev = clone(g)
    processWeekAndAdvance(g); each?.()
  }
  return prev
}
const finishSeason = (g: GameState) => { const s = g.season; let guard = 0; while (g.season === s && guard++ < 80) processWeekAndAdvance(g) }

if (!QUICK) {
  // ---------------------------------------------------------------- ACADEMY
  console.log(`\n=== ACADEMY ONLY, PLAYED: two summers (${CLUB}, seed ${SEED}) ===`)
  {
    const g = started('academy'); g.boardGrace = 999_999
    const uid = g.userClubId
    const first = new Map<number, string | null>()
    for (const p of Object.values(g.players)) first.set(p.id, p.clubId ?? null)
    const outsiders = new Map<number, string>()
    let generatedSenior = 0, generatedAcad = 0
    const seenAtClub = new Set<number>(g.clubs[uid].players)
    const watch = () => {
      for (const p of Object.values(g.players)) if (!first.has(p.id)) first.set(p.id, p.clubId ?? null)
      for (const id of g.clubs[uid].players) {
        if (seenAtClub.has(id)) continue
        seenAtClub.add(id)
        const p = g.players[id]
        if (!p) continue
        if (first.get(id) !== uid) outsiders.set(id, `${p.name} (${p.pos} ${p.ca}) s${g.season}w${g.week}, first seen at ${first.get(id) ?? 'no club'}`)
        else if (p.acad) generatedAcad++
        else generatedSenior++
      }
    }
    // spring of season one: the routes again, in play, against a control cloned the same week
    runTo(g, g.season, 26, watch)
    {
      const ctlBase = clone(g); ctlBase.proChallenge = null
      // free agents again, mid-season
      const fa = freeAgents(g)
      let ctlOk = 0, chOk = 0
      for (const p of fa.slice(0, 40)) {
        const c1 = clone(ctlBase); if (signFreeAgent(c1, p.id).ok) ctlOk++
        const c2 = clone(g); if (signFreeAgent(c2, p.id).ok) chOk++
      }
      verdict(chOk === 0 && ctlOk > 0, 'A13 mid-season (week 26): free agents still cannot be signed', `control ${ctlOk}/${Math.min(40, fa.length)}; challenge ${chOk}`)
    }
    // the first summer, with the squad cut to 20 seniors so the board has to fill it
    {
      const pre = clone(g)
      runTo(pre, pre.season, 44)
      const strip = (s: GameState) => {
        const c = s.clubs[uid]
        const keep = seniors(s).sort((a, b) => b.ca - a.ca).slice(0, 20).map(p => p.id)
        for (const p of seniors(s)) if (!keep.includes(p.id)) {
          c.players = c.players.filter(id => id !== p.id)
          c.tactic.lineup = c.tactic.lineup.map(id => (id === p.id ? null : id))
          p.clubId = null
        }
      }
      const arrivals = (s: GameState) => {
        const before = new Set(s.clubs[uid].players)
        const world = new Set(Object.keys(s.players).map(Number))
        finishSeason(s)
        const inn = s.clubs[uid].players.filter(id => !before.has(id)).map(id => s.players[id])
        return {
          outside: inn.filter(p => world.has(p.id)),
          kidsSenior: inn.filter(p => !world.has(p.id) && !p.acad),
          kidsAcad: inn.filter(p => !world.has(p.id) && p.acad),
          board: s.news.filter(n => /^Board signing/.test(n.subject ?? '')).length,
        }
      }
      const ctl = clone(pre); ctl.proChallenge = null; strip(ctl)
      const ch = clone(pre); strip(ch)
      const a = arrivals(ctl), b = arrivals(ch)
      verdict(a.outside.length > 0 && b.outside.length === 0,
        'A14 the summer board top-up of a short squad (20 seniors) brings no outside player in',
        `control: ${a.outside.length} outside arrivals (${a.board} "Board signing" letters); challenge: ${b.outside.length} outside, ${b.kidsSenior.length} generated young pros on senior deals, ${b.kidsAcad.length} academy intake`)
      line('INFO', `under Academy Only the board fills the short squad with ${b.kidsSenior.length} newly generated 19-20 year-olds on senior contracts (rollover/squads.ts): not from outside, but not from the manager's academy either`,
        b.kidsSenior.slice(0, 6).map(p => `${p.pos} ${p.age}y ca${p.ca}`).join(', '))
    }
    toNextSeason(g, watch)
    // A TITLE IN SEASON ONE COMPLETES THE CHALLENGE (1.9.16: it did, once the
    // national squads were re-dealt and the autumn took different men). It is
    // taken on again so the rule is still under test in season two.
    const retake = () => { if (!proActive(g) && !g.unemployed) startProChallenge(g, 'academy') }
    retake()
    const afterOne = { season: g.season, seniors: seniors(g).length, acad: g.clubs[uid].players.length - seniors(g).length }
    // spring of season two: the first spring in which any contract in the world is in its last year
    runTo(g, g.season, 26, watch)
    {
      const ctlBase = clone(g); ctlBase.proChallenge = null
      const cands = Object.values(g.players).filter(p => p.clubId && p.clubId !== uid && !p.acad && p.contractEnds <= g.season && !p.loanFrom && !p.onLoan && !p.retiring)
        .sort((a, b) => a.ca - b.ca).slice(0, 120)
      let shown = false
      for (const p of cands) {
        const ctl = clone(ctlBase)
        const rc = agreePreContract(ctl, p.id)
        if (!rc.ok) continue
        const ch = clone(g)
        const rh = agreePreContract(ch, p.id)
        verdict(!rh.ok && rh.msg === PRO_ACADEMY && !(ch.preContracts ?? []).some(pc => pc.playerId === p.id && pc.toClubId === uid),
          'A8 "no signings": agreePreContract (a summer free transfer agreed in spring) is refused', `week ${g.week}; control ok=${rc.ok}; challenge ok=${rh.ok} msg="${rh.msg}"`)
        shown = true
        break
      }
      if (!shown) line('FAIL', `A8 pre-contract: no control deal found among ${cands.length} expiring players at week ${g.week}`)
    }
    toNextSeason(g, watch)
    retake()
    verdict(outsiders.size === 0 && !g.unemployed && proActive(g)?.id === 'academy',
      'A15 two full seasons and two summers on Continue: nobody from outside ever appears in the squad',
      `outside arrivals ${outsiders.size}${outsiders.size ? ': ' + [...outsiders.values()].slice(0, 5).join('; ') : ''}; generated at the club: ${generatedAcad} academy, ${generatedSenior} senior; now s${g.season}w${g.week}, seniors ${seniors(g).length}; challenge live=${!!proActive(g)}`)
    verdict(generatedAcad > 0, 'A16 "build from your own academy": the academy intake still arrives', `${generatedAcad} academy players generated over two summers; after summer one: ${afterOne.seniors} seniors, ${afterOne.acad} academy`)
  }

  // ------------------------------------------------------------- SHOESTRING
  console.log(`\n=== SHOESTRING, PLAYED: three summers (${CLUB}, seed ${SEED}) ===`)
  {
    const g = started('shoestring'); g.boardGrace = 999_999
    const uid = g.userClubId
    let wb = g.clubs[uid].wageBudget
    const raises: string[] = []
    let maxRoom = 0
    const watch = () => {
      const c = g.clubs[uid]
      if (c.wageBudget > wb && g.week !== 1) raises.push(`s${g.season}w${g.week}: ${wb} -> ${c.wageBudget}`)
      wb = c.wageBudget
      maxRoom = Math.max(maxRoom, userWageBudget(g, c) - capBill(g, c))
    }
    let streakBefore = 0
    for (let summer = 1; summer <= 3; summer++) {
      const pre = toNextSeason(g, watch)
      // the same summer without the challenge
      const ctl = clone(pre); ctl.proChallenge = null
      finishSeason(ctl)
      const c = g.clubs[uid], cc = ctl.clubs[uid]
      // and the same summer under the other no-board-money rule (Fire Sale's flag), which does not halve:
      // the purse the board sets before Shoestring's cut, with the objective bonus withheld in both
      const twin = clone(pre); twin.proChallenge = { ...twin.proChallenge!, id: 'firesale' }
      finishSeason(twin)
      const tc = twin.clubs[uid]
      const half = Math.round(tc.budget / 2 / 50_000) * 50_000
      verdict(c.budget === half, `S8 summer ${summer}: the new transfer budget is exactly half of the board's allowance for that summer`,
        `allowance ${m(tc.budget)} -> ${m(c.budget)} (half is ${m(half)}); a career without any challenge gets ${m(cc.budget)} the same summer, the extra being board money Shoestring withholds`)
      const room = userWageBudget(g, c) - capBill(g, c)
      verdict(room === 0, `S9 summer ${summer}: wage room at week 1 of the new season is nil`, `wage budget ${c.wageBudget}, bill ${capBill(g, c)}, room ${room}/wk (without the challenge: ${userWageBudget(ctl, cc) - capBill(ctl, cc)}/wk); seniors ${seniors(g).length}`)
      // the board's verdict feeds the run
      const preClub = pre.clubs[uid]
      const obj = demandedFinish(pre, uid, pre.comps[preClub.leagueId].table.length)
      const fin = g.mgr.finishes[g.mgr.finishes.length - 1]
      const won = g.history.some(h => h.season === pre.season && h.compId === preClub.leagueId && h.champion === uid)
      const met = won || (fin.pos > 0 && fin.pos <= obj.pos)
      const streak = g.proChallenge?.streak ?? -1
      const expect = met ? streakBefore + 1 : 0
      verdict(g.proChallenge?.done ? streakBefore + 1 >= SHOESTRING_RUN : streak === expect, `S10 summer ${summer}: the run of targets counts this season's verdict`,
        `finished ${fin.pos}, target top ${obj.pos} ("${obj.text}"), met=${met}; streak ${streakBefore} -> ${streak}${g.proChallenge?.done ? ' (challenge done)' : ''}`)
      streakBefore = Math.max(0, streak)
      if (g.proChallenge?.done || g.unemployed) break
    }
    if (g.proChallenge?.done) {
      verdict(g.news.some(n => n.k === 'news.proDone') && (g.challengesDone ?? []).includes('pro.shoestring') && !g.careerOver,
        'S11 END TO END: three targets met in play, and the real summer announces it', `season ${g.season}; news=${g.news.some(n => n.k === 'news.proDone')}; celebration=${g.celebration?.hk}`)
    } else line('INFO', `S11 the run after three summers on Continue: ${g.proChallenge?.streak} (not three in a row on this seed, so the real-summer announcement was not reached here)`)
    verdict(raises.length === 0, 'S12 "no extra wage room": the wage budget never rises in-season', raises.slice(0, 4).join('; ') || `no in-season rise; largest room seen in any week ${maxRoom}/wk (room opens only as men leave or deals end)`)
    // the one event found in the code that raises it regardless: a takeover (gossip.ts)
    // the one event found in the code that raises it regardless: a takeover by a rich buyer (gossip.ts moneyMen)
    {
      const s0 = started('shoestring'); s0.boardGrace = 999_999
      runTo(s0, s0.season, 5)
      let rich = 0, tight = 0, tried = 0, ev = ''
      for (let k = 0; k < 60 && rich < 3; k++) {
        const c = clone(s0); c.seed = (c.seed + k * 7919) >>> 0
        c.takeover = { clubId: uid, week: c.week - 3, stage: 1 } as never
        const cl = c.clubs[uid]
        const before = { wb: cl.wageBudget, b: cl.budget, room: userWageBudget(c, cl) - capBill(c, cl) }
        tried++
        for (let w = 0; w < 4 && c.takeover; w++) processWeekAndAdvance(c)
        if (c.news.some(n => n.k === 'news.takeoverRichMine')) {
          rich++
          ev = `wage budget ${before.wb} -> ${cl.wageBudget}; room ${before.room} -> ${userWageBudget(c, cl) - capBill(c, cl)}/wk; transfer budget ${m(before.b)} -> ${m(cl.budget)}`
        } else if (c.news.some(n => n.k === 'news.takeoverTightMine')) tight++
      }
      if (!rich) line('INFO', `S13 takeover by a rich buyer: not reached in ${tried} staged takeovers (${tight} ended in cuts)`)
      else verdict(false === /-> (\d+); room 0 -> [1-9]/.test(ev), 'S13 "no extra wage room": a completed takeover by a rich buyer does not open wage room', `${rich} rich takeovers in ${tried} staged; last: ${ev}`)
    }
  }

  // -------------------------------------------------------------- FIRE SALE
  console.log(`\n=== FIRE SALE, PLAYED: two summers (${CLUB}, seed ${SEED}) ===`)
  {
    const base = fresh()
    const uid = base.userClubId
    const best = seniors(base).sort((a, b) => b.ca - a.ca || a.id - b.id).slice(0, FIRESALE_COUNT)
    const fees = best.reduce((s, p) => s + Math.round(p.value / 50_000) * 50_000, 0)
    const g = started('firesale'); g.boardGrace = 999_999
    const day1 = { budget: g.clubs[uid].budget, balance: g.clubs[uid].balance }
    {
      // through the first league match: is a full side sent out, with five shirts empty on the sheet?
      const league = g.clubs[uid].leagueId
      const firstWk = Math.min(...g.fixtures.filter(f => f.compId === league && (f.homeId === uid || f.awayId === uid)).map(f => f.week))
      runTo(g, g.season, firstWk + 1)
      const lu = g.clubs[uid].tactic.lineup
      const holes = lu.slice(0, 23).filter(id => id == null || !g.clubs[uid].players.includes(id as number)).length
      const appeared = g.clubs[uid].players.map(id => g.players[id]).filter(p => p && (p.stats?.apps ?? 0) > 0).length
      line(appeared >= 15 ? 'PASS' : 'FAIL', `F6b the first league match (week ${firstWk}) is played by a full side although the sheet was left with holes`, `sheet holes now ${holes} of 23; men with an appearance ${appeared}`)
    }
    const pre = toNextSeason(g)
    // the same summer as it was before 1.9.16, with the fees still sitting in the bank:
    // the budget they would have bought is the leak that is now shut
    const ctl = clone(pre); ctl.clubs[uid].balance += fees
    finishSeason(ctl)
    const c = g.clubs[uid], cc = ctl.clubs[uid]
    const leak = c.budget - cc.budget
    verdict(leak < 0, 'F10 "the money clears the debts", a summer later: the banked fees add nothing to the next transfer budget',
      `fees ${m(fees)}; balance before the summer ${m(pre.clubs[uid].balance)}; new budget ${m(c.budget)} against ${m(cc.budget)} had the fees not been banked: +${m(leak)} of budget comes from the sale (rollover/finance.ts resetBudgets: 15% of the balance)`)
    line('INFO', `day one budget ${m(day1.budget)} / balance ${m(day1.balance)}; season two budget ${m(c.budget)} / balance ${m(c.balance)}; facilities ${JSON.stringify(c.facilities)} against ${JSON.stringify(cc.facilities)} without the fees`)
    const reinvest = g.news.filter(n => /reinvest/i.test(`${n.k ?? ''}`)).map(n => `${n.k}`).slice(0, 3)
    line('INFO', `board reinvestment letters in the challenge career: ${reinvest.join(', ') || 'none'}`)
    toNextSeason(g)
    {
      const titles = g.history.filter(h => h.champion === uid && g.comps[h.compId]?.type === 'league').map(h => `${h.compId}@s${h.season}`)
      const liveOk = !g.unemployed && proActive(g)?.id === 'firesale' && !g.careerOver && !titles.length
      const wonOk = !g.unemployed && g.proChallenge?.done === true && titles.length > 0 && g.news.some(n => n.k === 'news.proDone') && !g.careerOver
      verdict(liveOk || wonOk, wonOk
        ? 'F11 two summers on Continue: the side won the league without help, and the real summer detected and announced it'
        : 'F11 two summers in, short of the deadline: the challenge is still live and the career goes on',
        `s${g.season}w${g.week}; challenge=${JSON.stringify(g.proChallenge)}; league titles=${titles.join(',') || 'none'}; finishes=${g.mgr.finishes.map(f => f.pos).join(',')}`)
    }
  }

  // -------------------------------------------- END TO END: a title, for real
  console.log('\n=== END TO END: a real title under each rule ===')
  for (const id of ['academy', 'firesale'] as ProChallengeId[]) {
    const g = started(id); g.boardGrace = 999_999
    const uid = g.userClubId
    // a squad nobody in the league can live with: the goal is reached by the engine, not by writing the record
    for (const p of seniors(g)) { for (const k of Object.keys(p.a) as (keyof typeof p.a)[]) p.a[k] = 20; p.ca = 99; p.pa = 99 }
    toNextSeason(g)
    const league = g.history.find(h => h.season === g.season - 1 && h.champion === uid)
    if (!league && !g.mgr.trophies.length) { line('INFO', `E2E ${id}: the boosted side did not win anything on this seed, so the real-summer detection was not reached`); continue }
    verdict(g.proChallenge?.done === true && g.news.some(n => n.k === 'news.proDone') && (g.challengesDone ?? []).includes(`pro.${id}`) && !g.careerOver && !g.unemployed,
      `E2E ${id}: a title won on the pitch is detected and announced by the real summer`,
      `titles: ${g.history.filter(h => h.champion === uid).map(h => h.compId).join(',') || 'none'}; mgr trophies: ${g.mgr.trophies.map(x => x.compId).join(',')}; done=${g.proChallenge?.done}; celebration=${g.celebration?.hk ?? 'none'}`)
  }
}


if (!QUICK) {
  // Shoestring to its goal: a boosted side meets the board's target three seasons running
  {
    const g = started('shoestring'); g.boardGrace = 999_999
    const uid = g.userClubId
    const boost = () => { for (const p of seniors(g)) { for (const k of Object.keys(p.a) as (keyof typeof p.a)[]) p.a[k] = 20; p.ca = 99; p.pa = 99 } }
    const streaks: number[] = []
    for (let i = 0; i < SHOESTRING_RUN && !g.proChallenge?.done && !g.unemployed; i++) { boost(); toNextSeason(g); streaks.push(g.proChallenge?.streak ?? -1) }
    verdict(g.proChallenge?.done === true && g.season - g.proChallenge.since === SHOESTRING_RUN && g.news.some(n => n.k === 'news.proDone') && !g.careerOver,
      'E2E shoestring: three targets met on the pitch, detected and announced at the third real summer, not before', `streak by summer: ${streaks.join(',')}; done=${g.proChallenge?.done}; finishes=${g.mgr.finishes.map(f => f.pos).join(',')}; celebration=${g.celebration?.hk ?? 'none'}`)
  }
  // the Fire Sale money, at other clubs
  console.log('\n=== FIRE SALE MONEY AT OTHER CLUBS ===')
  for (const [club, seed] of (process.env.MORE ?? 'bath:7,ealing:13,toulouse:29').split(',').map(x => x.split(':') as [string, string])) {
    let base: GameState
    try { base = fresh(Number(seed), club) } catch { line('INFO', `${club}: no such club`); continue }
    if (!base.clubs[club]) { line('INFO', `${club}: no such club`); continue }
    const best = seniors(base).sort((a, b) => b.ca - a.ca || a.id - b.id).slice(0, FIRESALE_COUNT)
    const fees = best.reduce((s, p) => s + Math.round(p.value / 50_000) * 50_000, 0)
    const g = started('firesale', Number(seed), club); g.boardGrace = 999_999
    const d1 = g.clubs[club].budget
    const pre = toNextSeason(g)
    const ctl = clone(pre); ctl.clubs[club].balance += fees // as before 1.9.16: fees left in the bank
    finishSeason(ctl)
    const leak = g.clubs[club].budget - ctl.clubs[club].budget
    verdict(leak < 0, `F10 ${club} (seed ${seed}): the banked fees add nothing to the next transfer budget`,
      `day-one balance ${m(base.clubs[club].balance)}; fees ${m(fees)}; budget day one ${m(d1)}, season two ${m(g.clubs[club].budget)}, without the banked fees ${m(ctl.clubs[club].budget)}: +${m(leak)}`)
  }
}

console.log(`\n--- ${passes} PASS, ${fails} FAIL ---`)
