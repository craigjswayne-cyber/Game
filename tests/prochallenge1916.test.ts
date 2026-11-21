/**
 * ---- PRO CHALLENGES, CLAUSE BY CLAUSE (1.9.16 audit) ----
 *
 * The same claims as scripts/prochallengeprobe.ts, as assertions. Each
 * "blocked" claim is paired with a control (the same cloned career without
 * the challenge) in which the same call succeeds.
 *
 * KNOWN BUGS are written as `it.fails`: the assertion states the promise, and
 * the test goes green only while the engine still breaks it. When a bug is
 * fixed its `it.fails` turns red: change it to `it`.
 *   BUG 1  Fire Sale: the banked fees come back as next summer's transfer
 *          budget (rollover/finance.ts resetBudgets, 15% of the balance).
 *   BUG 2  Shoestring: a rich-buyer takeover raises the wage budget 12%
 *          (gossip.ts moneyMen), which opens wage room.
 */
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import {
  FIRESALE_COUNT, PRO_SEASONS, SHOESTRING_RUN, proActive, proBlocksMoney, proBlocksSigning, proCheck, startProChallenge,
  type ProChallengeId,
} from '../src/game/prochallenge'
import { agreeFee, agreePreContract, askingPrice, freeAgentDemand, offerFreeAgent, personalTermsDemand, signFreeAgent, signOnTerms } from '../src/game/ai'
import { loanIn, loanTargets } from '../src/game/loans'
import { signMedicalJoker } from '../src/game/joker'
import { requestFunds } from '../src/game/season/board'
import { applyInjection, userWageBudget } from '../src/game/grants'
import { releaseToBudget } from '../src/game/treasury'
import { townCollection } from '../src/game/rewarded'
import { capBill } from '../src/game/cap'
import { resignJob, sackManager } from '../src/game/jobs'
import { migrate } from '../src/game/save'
import { t } from '../src/game/i18n'
import type { GameState, Player } from '../src/game/model'

const CLUB = 'leicester', SEED = 91
const fresh = () => newGame(CLUB, 'Audit', SEED)
const started = (id: ProChallengeId) => { const g = fresh(); startProChallenge(g, id); return g }
const clone = (g: GameState): GameState => structuredClone(g)
const seniors = (g: GameState) => g.clubs[g.userClubId].players.map(id => g.players[id]).filter((p): p is Player => !!p && !p.acad)
const freeAgents = (g: GameState) => Object.values(g.players).filter(p => p.clubId == null && !p.retiring)
const has = (g: GameState, pid: number) => g.clubs[g.userClubId].players.includes(pid)
const PRO_ACADEMY = () => t('reply.proAcademy')
const PRO_NOFUNDS = () => t('reply.proNoFunds')
const toNextSeason = (g: GameState) => {
  const s = g.season
  let prev = clone(g), guard = 0
  while (g.season === s && guard++ < 80) { if (g.week >= 40) prev = clone(g); processWeekAndAdvance(g) }
  return prev
}
const finishSeason = (g: GameState) => { const s = g.season; let guard = 0; while (g.season === s && guard++ < 80) processWeekAndAdvance(g) }

/** The first candidate the control can do `attempt` with, and what the challenge career says to the same call. */
function paired<T>(base: GameState, cands: T[], attempt: (g: GameState, c: T) => { ok: boolean; msg: string }, prep?: (g: GameState) => void) {
  for (const c of cands) {
    const ctl = clone(base); prep?.(ctl)
    if (!attempt(ctl, c).ok) continue
    const ch = clone(base); startProChallenge(ch, 'academy'); prep?.(ch)
    return { c, r: attempt(ch, c), ch }
  }
  throw new Error('no control case found: the route could not be shown to work without the challenge')
}

describe('Academy Only: "No signings, no loans in, no free agents"', () => {
  const base = fresh()
  const uid = base.userClubId
  const cheap = Object.values(base.players).filter(p => p.clubId && p.clubId !== uid && !p.acad && !p.loanFrom && !p.onLoan)
    .sort((a, b) => a.ca - b.ca).filter(p => askingPrice(base, p) * 1.6 <= base.clubs[uid].budget).slice(0, 60)
  const feeFor = (g: GameState, p: Player) => Math.round(askingPrice(g, g.players[p.id]) * 1.5 / 50_000) * 50_000

  it('agreeFee is refused where the control agrees', () => {
    const { r } = paired(base, cheap, (g, p) => agreeFee(g, p.id, feeFor(g, p)))
    expect(r.ok).toBe(false)
    expect(r.msg).toBe(PRO_ACADEMY())
  })

  it('signOnTerms, called directly, moves nobody', () => {
    const { r, c, ch } = paired(base, cheap, (g, p) => {
      agreeFee(g, p.id, feeFor(g, p))
      const s = signOnTerms(g, p.id, feeFor(g, p), Math.round(personalTermsDemand(g, g.players[p.id]) * 1.2), 0, false)
      return { ok: s.ok && has(g, p.id), msg: s.msg }
    })
    expect(r.ok).toBe(false)
    expect(r.msg).toBe(PRO_ACADEMY())
    expect(has(ch, c.id)).toBe(false)
  })

  it('none of the day-one free agents can be signed (the 1.9.16 pool included), by the one-tap door or the talks', () => {
    const fa = freeAgents(base)
    expect(fa.length).toBeGreaterThanOrEqual(33)
    let control = 0
    const ch = started('academy')
    for (const p of fa) {
      const c = clone(base)
      if (signFreeAgent(c, p.id).ok && has(c, p.id)) control++
      const a = signFreeAgent(ch, p.id)
      const b = offerFreeAgent(ch, p.id, Math.round(freeAgentDemand(p, 2) * 1.3), 2)
      expect(a.ok, p.name).toBe(false)
      expect(a.msg).toBe(PRO_ACADEMY())
      expect(b.ok, p.name).toBe(false)
      expect(has(ch, p.id)).toBe(false)
    }
    expect(control).toBeGreaterThan(0) // and the same men do sign for the control
  })

  it('loanIn is refused where the control borrows', () => {
    const { r } = paired(base, loanTargets(base).slice(0, 80), (g, p) => {
      for (const share of [0.5, 0.75, 1]) {
        const msg = loanIn(g, p.id, 'season', share)
        if (has(g, p.id)) return { ok: true, msg }
        if (msg === PRO_ACADEMY()) return { ok: false, msg }
      }
      return { ok: false, msg: 'refused' }
    })
    expect(r.ok).toBe(false)
    expect(r.msg).toBe(PRO_ACADEMY())
  })

  it('the club starts with no loanee to buy outright (loanBuy has no guard of its own)', () => {
    expect(base.clubs[uid].players.map(id => base.players[id]).filter(p => p?.loanFrom)).toHaveLength(0)
  })

  it('the medical joker (free-agent injury cover) is refused where the control signs one', () => {
    const prep = (g: GameState) => { seniors(g)[0].injury = { desc: 'Knee ligament', until: g.week + 12, weeks: 12 } }
    const { r, c, ch } = paired(base, freeAgents(base), (g, p) => {
      const out = signMedicalJoker(g, seniors(g)[0].id, p.id)
      return { ok: out.ok && has(g, p.id), msg: out.msg }
    }, prep)
    expect(r.ok).toBe(false)
    expect(has(ch, c.id)).toBe(false)
  })

  it('a pre-contract is refused where the control agrees one (spring of season two, the first with expiring deals)', () => {
    const g = started('academy'); g.boardGrace = 999_999
    toNextSeason(g)
    let guard = 0
    while (g.week < 26 && guard++ < 40) processWeekAndAdvance(g)
    expect(proActive(g)?.id).toBe('academy')
    const ctlBase = clone(g); ctlBase.proChallenge = null
    const cands = Object.values(g.players).filter(p => p.clubId && p.clubId !== uid && !p.acad && p.contractEnds <= g.season && !p.loanFrom && !p.onLoan && !p.retiring)
      .sort((a, b) => a.ca - b.ca).slice(0, 120)
    const ok = cands.find(p => agreePreContract(clone(ctlBase), p.id).ok)
    expect(ok, 'a control pre-contract').toBeTruthy()
    const r = agreePreContract(g, ok!.id)
    expect(r.ok).toBe(false)
    expect(r.msg).toBe(PRO_ACADEMY())
    expect((g.preContracts ?? []).some(pc => pc.toClubId === uid)).toBe(false)
  }, 120_000)

  it('a season and its summer on Continue bring nobody in from outside, even with the squad cut to 20', () => {
    const g = started('academy'); g.boardGrace = 999_999
    let guard = 0
    while (g.week < 44 && guard++ < 60) processWeekAndAdvance(g)
    const strip = (s: GameState) => {
      const c = s.clubs[uid]
      const keep = seniors(s).sort((a, b) => b.ca - a.ca).slice(0, 20).map(p => p.id)
      for (const p of seniors(s)) if (!keep.includes(p.id)) { c.players = c.players.filter(id => id !== p.id); c.tactic.lineup = c.tactic.lineup.map(id => (id === p.id ? null : id)); p.clubId = null }
    }
    const outside = (s: GameState) => {
      const before = new Set(s.clubs[uid].players), world = new Set(Object.keys(s.players).map(Number))
      finishSeason(s)
      return s.clubs[uid].players.filter(id => !before.has(id) && world.has(id)).length
    }
    const ctl = clone(g); ctl.proChallenge = null; strip(ctl)
    const ch = clone(g); strip(ch)
    expect(outside(ctl)).toBeGreaterThan(0) // the board signs free agents for the control
    expect(outside(ch)).toBe(0)
  }, 120_000)

  it('a trophy with the club completes it, announced; another club\'s or a national one does not', () => {
    const g = started('academy')
    g.mgr.trophies.push({ compId: g.clubs[uid].leagueId, season: g.season, clubId: uid })
    g.season += 1; proCheck(g)
    expect(g.proChallenge?.done).toBe(true)
    expect(g.news.some(n => n.k === 'news.proDone')).toBe(true)
    expect(g.celebration?.hk).toBe('cel.challenge')
    expect(g.challengesDone).toContain('pro.academy')
    expect(g.careerOver ?? null).toBeNull()
    expect(proBlocksSigning(g)).toBe(false) // "the career carries on as you like"

    const o = started('academy')
    o.mgr.trophies.push({ compId: o.clubs[uid].leagueId, season: o.season, clubId: Object.keys(o.clubs).find(id => id !== uid)! })
    const intl = Object.values(o.comps).find(c => c.type === 'intl' || c.isNational)
    if (intl) o.mgr.trophies.push({ compId: intl.id, season: o.season, clubId: uid })
    o.season += 1; proCheck(o)
    expect(o.proChallenge?.done ?? false).toBe(false)
  })

  it(`the deadline is the end of season ${PRO_SEASONS.academy}: alive after ${PRO_SEASONS.academy - 1}, a trophy in the last season counts, nothing ends the career`, () => {
    const g = started('academy')
    g.season += PRO_SEASONS.academy - 1; proCheck(g)
    expect(g.careerOver ?? null).toBeNull()
    const last = clone(g)
    last.mgr.trophies.push({ compId: last.clubs[uid].leagueId, season: last.season, clubId: uid })
    last.season += 1; proCheck(last)
    expect(last.proChallenge?.done).toBe(true)
    g.season += 1; proCheck(g)
    expect(g.unemployed).toBe(true)
    expect(g.careerOver?.k).toBe('over.proFailed')
    expect(g.news.some(n => n.k === 'news.proFailed')).toBe(true)
  })
})

describe('Shoestring: "Half the transfer budget every summer and no extra wage room"', () => {
  const base = fresh()
  const uid = base.userClubId

  it('day one: the budget is halved and wage room is nil', () => {
    const g = started('shoestring')
    const c = g.clubs[uid]
    expect(c.budget).toBe(Math.round(base.clubs[uid].budget / 2 / 50_000) * 50_000)
    expect(userWageBudget(g, c) - capBill(g, c)).toBe(0)
    expect(userWageBudget(base, base.clubs[uid]) - capBill(base, base.clubs[uid])).toBeGreaterThan(0) // the control has room
  })

  it('day one: no free agent can be added without first moving wages off the bill', () => {
    const g = started('shoestring')
    for (const p of freeAgents(g)) expect(signFreeAgent(clone(g), p.id).ok, p.name).toBe(false)
  })

  it('the board\'s money is shut by every door: board request, store injection, cash reserve, town collection', () => {
    const g = started('shoestring')
    const b = g.clubs[uid].budget
    expect(proBlocksMoney(g)).toBe(true)
    expect(requestFunds(g)).toBe(PRO_NOFUNDS())
    expect(applyInjection(g, 's')).toBe(false)
    g.clubs[uid].balance = 50_000_000
    expect(releaseToBudget(g).ok).toBe(false)
    expect(townCollection(g)).toBeNull()
    expect(g.clubs[uid].budget).toBe(b)
    // a wage boost or the Charter bought earlier does not lift the ceiling either
    g.wageBoost = 0.25; g.uncapped = true
    expect(userWageBudget(g, g.clubs[uid])).toBe(g.clubs[uid].wageBudget)
  })

  it('every summer: the new budget is half the board\'s allowance, wage room is nil again, and the verdict feeds the run', () => {
    const g = started('shoestring'); g.boardGrace = 999_999
    for (let summer = 1; summer <= 2; summer++) {
      const pre = toNextSeason(g)
      // the same summer under the other no-board-money rule, which does not halve
      const twin = clone(pre); twin.proChallenge = { ...twin.proChallenge!, id: 'firesale' }
      finishSeason(twin)
      const c = g.clubs[uid]
      expect(c.budget, `summer ${summer}`).toBe(Math.round(twin.clubs[uid].budget / 2 / 50_000) * 50_000)
      expect(userWageBudget(g, c) - capBill(g, c), `summer ${summer}`).toBe(0)
      expect([0, summer]).toContain(g.proChallenge!.streak) // met every season so far, or reset
    }
  }, 240_000)

  it('three targets met in a row completes it; no run of three by the deadline ends the career', () => {
    const g = started('shoestring')
    g.proChallenge!.streak = SHOESTRING_RUN; g.season += 3; proCheck(g)
    expect(g.proChallenge?.done).toBe(true)
    expect(g.news.some(n => n.k === 'news.proDone')).toBe(true)
    const f = started('shoestring')
    f.proChallenge!.streak = 2; f.season += PRO_SEASONS.shoestring; proCheck(f)
    expect(f.careerOver?.k).toBe('over.proFailed')
  })

  // BUG 2 (gossip.ts moneyMen, the rich-buyer branch): wageBudget * 1.12 is applied under the challenge
  it.fails('BUG 2: a completed takeover by a rich buyer opens no wage room', () => {
    const s0 = started('shoestring'); s0.boardGrace = 999_999
    let guard = 0
    while (s0.week < 5 && guard++ < 10) processWeekAndAdvance(s0)
    let seen = 0
    for (let k = 0; k < 60 && seen < 1; k++) {
      const c = clone(s0); c.seed = (c.seed + k * 7919) >>> 0
      c.takeover = { clubId: uid, week: c.week - 3, stage: 1 } as never
      for (let w = 0; w < 4 && c.takeover; w++) processWeekAndAdvance(c)
      if (!c.news.some(n => n.k === 'news.takeoverRichMine')) continue
      seen++
      expect(userWageBudget(c, c.clubs[uid]) - capBill(c, c.clubs[uid])).toBe(0)
    }
    expect(seen).toBeGreaterThan(0)
  }, 120_000)
})

describe('Fire Sale: "Your five best players are sold before day one, and the money clears the debts"', () => {
  const base = fresh()
  const uid = base.userClubId
  const best = seniors(base).sort((a, b) => b.ca - a.ca || a.id - b.id).slice(0, FIRESALE_COUNT)
  const fees = best.reduce((s, p) => s + Math.round(p.value / 50_000) * 50_000, 0)

  it('the five best are gone before a week is played, and nobody better is left', () => {
    const g = started('firesale')
    expect(g.week).toBe(base.week)
    for (const p of best) expect(g.players[p.id].clubId).not.toBe(uid)
    expect(Math.max(...seniors(g).map(p => p.ca))).toBeLessThanOrEqual(best[FIRESALE_COUNT - 1].ca)
    expect(g.news.find(n => n.k === 'news.proStartSold')?.v?.sold).toBe(best.map(p => p.name).join(', '))
  })

  it('day one: none of the fees is transfer budget, all of it is banked, and it cannot be moved back', () => {
    const g = started('firesale')
    const c = g.clubs[uid]
    expect(c.budget).toBe(base.clubs[uid].budget)
    expect(c.balance).toBe(base.clubs[uid].balance + fees)
    expect(releaseToBudget(g).ok).toBe(false)
    expect(requestFunds(g)).toBe(PRO_NOFUNDS())
    expect(c.budget).toBe(base.clubs[uid].budget)
  })

  it('there is no debt to clear: the club starts in credit', () => {
    // the promise reads "the money clears the debts"; no club in the world starts overdrawn
    expect(base.clubs[uid].balance).toBeGreaterThanOrEqual(0)
    expect(Object.values(base.clubs).filter(c => c.balance < 0)).toHaveLength(0)
  })

  // BUG 1 (rollover/finance.ts resetBudgets): budget = rep * 45k + 15% of the balance, and the balance holds the fees
  it.fails('BUG 1: a summer later, the banked fees have added nothing to the transfer budget', () => {
    const g = started('firesale'); g.boardGrace = 999_999
    const pre = toNextSeason(g)
    const ctl = clone(pre); ctl.clubs[uid].balance -= fees // the same summer, had the fees really gone on debts
    finishSeason(ctl)
    expect(g.clubs[uid].budget).toBeLessThanOrEqual(ctl.clubs[uid].budget)
  }, 120_000)

  it('a league title completes it, a cup does not, and the deadline ends the career', () => {
    const g = started('firesale')
    const s = clone(g); s.history.push({ season: s.season, compId: s.clubs[uid].leagueId, champion: uid }); s.season += 1; proCheck(s)
    expect(s.proChallenge?.done).toBe(true)
    expect(s.news.some(n => n.k === 'news.proDone')).toBe(true)
    const cup = Object.values(g.comps).find(c => c.type !== 'league' && c.type !== 'intl' && !c.isNational && c.id !== 'fr')!
    const k = clone(g); k.history.push({ season: k.season, compId: cup.id, champion: uid }); k.season += 1; proCheck(k)
    expect(k.proChallenge?.done ?? false).toBe(false)
    const f = clone(g); f.season += PRO_SEASONS.firesale - 1; proCheck(f)
    expect(f.careerOver ?? null).toBeNull()
    f.season += 1; proCheck(f)
    expect(f.careerOver?.k).toBe('over.proFailed')
    expect(f.unemployed).toBe(true)
  })

  it('END TO END: a title won on the pitch is detected and announced by the real summer', () => {
    const g = started('firesale'); g.boardGrace = 999_999
    for (const p of seniors(g)) { for (const key of Object.keys(p.a) as (keyof typeof p.a)[]) p.a[key] = 20; p.ca = 99; p.pa = 99 }
    toNextSeason(g)
    const won = g.history.some(h => h.champion === uid && g.comps[h.compId]?.type === 'league')
    expect(won, 'the boosted side wins its league on this seed').toBe(true)
    expect(g.proChallenge?.done).toBe(true)
    expect(g.news.some(n => n.k === 'news.proDone')).toBe(true)
    expect(g.challengesDone).toContain('pro.firesale')
    expect(g.careerOver ?? null).toBeNull()
  }, 120_000)
})

describe.each(['academy', 'shoestring', 'firesale'] as ProChallengeId[])('%s: leaving the club, and save / load', id => {
  it('resigning or being sacked voids it: no badge, and the deadline no longer ends the career', () => {
    for (const leave of [resignJob, (g: GameState) => sackManager(g, 'news.sacked')]) {
      const g = started(id)
      leave(g)
      expect(proActive(g)).toBeNull()
      g.season += PRO_SEASONS[id]; proCheck(g)
      expect(g.proChallenge ?? null).toBeNull()
      expect(g.careerOver ?? null).toBeNull()
      expect(g.challengesDone ?? []).not.toContain(`pro.${id}`)
    }
  })

  it('at another club the rule does not apply, and the summer voids it', () => {
    const g = started(id)
    g.userClubId = Object.keys(g.clubs).find(c => c !== g.userClubId && g.clubs[c].leagueId === g.clubs[g.userClubId].leagueId)!
    expect(proBlocksSigning(g)).toBe(false)
    expect(proBlocksMoney(g)).toBe(false)
    g.season += 1; proCheck(g)
    expect(g.proChallenge ?? null).toBeNull()
  })

  it('a save and load keeps the challenge, its rule and the purse; a damaged record is dropped', () => {
    const g = started(id)
    if (id === 'shoestring') g.proChallenge!.streak = 2
    const c0 = g.clubs[g.userClubId]
    let s: GameState = g
    for (let i = 0; i < 2; i++) {
      s = migrate(JSON.parse(JSON.stringify(s)) as GameState)
      expect(s.proChallenge).toEqual(g.proChallenge)
      expect(proBlocksSigning(s)).toBe(proBlocksSigning(g))
      expect(proBlocksMoney(s)).toBe(proBlocksMoney(g))
      expect(s.clubs[s.userClubId].budget).toBe(c0.budget)
      expect(s.clubs[s.userClubId].wageBudget).toBe(c0.wageBudget)
    }
    const bad = JSON.parse(JSON.stringify(g)) as GameState
    ;(bad.proChallenge as unknown as Record<string, unknown>).id = 'nonsense'
    expect(migrate(bad).proChallenge ?? null).toBeNull()
  })
})
