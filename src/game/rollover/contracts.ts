// Contracts at the rollover: pre-contracts honoured, expiring deals renewed,
// released or rolled on, across every club in the world.
import { aiRenewalWage, preContractWage } from '../ai'
import { aiPayRate } from '../aiecon'
import { playerWage } from '../attributes'
import { endSeasonJokers } from '../joker'
import { rememberDeparture } from '../memory'
import { absWeek, BASE_YEAR, fmtMoney, type Club, type GameState, type Player } from '../model'
import { clamp, type Rng } from '../rng'

export function handleContracts(state: GameState, rng: Rng, rooms: Map<string, number>) {
  // every medical joker's deal ends with the season, before anybody can mistake
  // one for an expiring contract to roll (joker.ts)
  endSeasonJokers(state)
  // pre-contracts go through first: the moves were agreed in the spring
  const freeMoves: { p: Player; to: Club; from: Club | null }[] = []
  for (const pc of state.preContracts ?? []) {
    const p = state.players[pc.playerId]
    const to = state.clubs[pc.toClubId]
    if (!p || !to || p.clubId === pc.toClubId) continue
    const from = p.clubId ? state.clubs[p.clubId] : null
    if (from) rememberDeparture(state, p, 'let-go', from.id, to.id) // memory.ts: only the user's club
    if (from) {
      from.players = from.players.filter(id => id !== p.id)
      from.tactic.lineup = from.tactic.lineup.map(id => (id === p.id ? null : id))
      if (from.captain === p.id) from.captain = null
      if (from.vice === p.id) from.vice = null
    }
    to.players.push(p.id)
    p.clubId = to.id
    // the arrival stamp executeTransfer puts on every in-season move (the
    // "ink is still wet" gate reads it). Pre-contract moves skipped it, so a
    // man signed in the summer could be bought off his new club in week one
    // at his plain market price - the exact hole the owner walked through
    // (v1.1.3). This runs before season += 1, so the stamp dates the move to
    // the end of the old season and ages correctly into the new one.
    p.joinedAt = absWeek(state.season, state.week)
    p.contractEnds = state.season + 1 + (p.age < 30 ? 2 : 1)
    // AND ON THE TERMS HE SIGNED FOR. agreePreContract quoted a wage, checked
    // the budget against it and printed it in the news, and then nothing ever
    // paid it: he arrived on his old club's wage, and the arrival story
    // printed that instead. A save from before the figure was stored reads the
    // same quote again rather than leaving him on the old number.
    if (to.id === state.userClubId) p.wage = pc.wage ?? preContractWage(p)
    p.morale = clamp(p.morale + 1, 1, 10)
    p.transferListed = false
    p.debutPending = 'signing'
    if (to.id === state.userClubId) { p.sc = 100; state.mgr.signings += 1 }
    if (to.id === state.userClubId || from?.id === state.userClubId) {
      freeMoves.push({ p, to, from })
    }
  }
  // a summer of pre-contract business arrives on one page. Three of these in a
  // single week-1 inbox were three separate letters saying the same thing.
  if (freeMoves.length) {
    const one = freeMoves.length === 1
    const line = (m: typeof freeMoves[0]) =>
      `${m.p.name} (${m.p.pos}, ${m.p.age}) to ${m.to.name} on ${fmtMoney(m.p.wage)}/week until ${BASE_YEAR + m.p.contractEnds}${m.from ? `, leaving ${m.from.short} watching a ${fmtMoney(m.p.value)} asset walk out the door` : ''}`
    // the three biggest moves in full, the rest counted: a six-deal summer at
    // 130 characters a deal blew straight through the 800-character inbox
    // ceiling (19A) the first time the world dealt one - caught by
    // brevityprobe after the Bath data refresh re-dealt the stream (round 24)
    const shown = [...freeMoves].sort((a, b) => b.p.ca - a.p.ca).slice(0, 3)
    const rest = freeMoves.length - shown.length
    state.news.push({
      id: state.nextId++, week: 1, season: state.season + 1, type: 'transfer', read: false,
      subject: one
        ? `${freeMoves[0].p.name} joins ${freeMoves[0].to.name} on a free`
        : `${freeMoves.length} free transfers go through`,
      body: `${one ? 'The pre-contract agreed in the spring goes through' : 'The pre-contracts agreed in the spring go through'}: ${shown.map(line).join('. ')}.${rest > 0 ? ` And ${rest} more deal${rest === 1 ? '' : 's'} of the same kind, done quietly.` : ''} Not a penny changed hands.`,
      k: one ? 'news.freeOne' : 'news.freeMany',
      v: {
        player: freeMoves[0].p.name, to: freeMoves[0].to.name, n: freeMoves.length,
        men_l: JSON.stringify(shown.map(m => ({
          k: m.from ? 'news.freeManFrom' : 'news.freeMan',
          name: m.p.name, pos: m.p.pos, age: m.p.age, to: m.to.name,
          wage: fmtMoney(m.p.wage), until: BASE_YEAR + m.p.contractEnds,
          from: m.from?.short ?? '', value: fmtMoney(m.p.value),
        }))),
        rest_k: rest > 0 ? 'news.freeRest' : 'common.nothing', rest,
      },
      playerId: shown[0].p.id,
    })
  }
  state.preContracts = []

  const freed: Player[] = []
  const rolled: Player[] = []
  // each club's middle senior wage, the line above which a board that cannot
  // pay its bill thinks twice about a renewal (ai.ts aiRenewals)
  const middles = new Map<string, number>()
  for (const club of Object.values(state.clubs)) {
    const w = club.players.map(id => state.players[id]).filter(p => p && !p.acad).map(p => p.wage).sort((a, b) => a - b)
    middles.set(club.id, w[Math.floor(w.length / 2)] ?? 0)
  }
  for (const p of Object.values(state.players)) {
    if (p.clubId && p.contractEnds < state.season + 1) {
      const club = state.clubs[p.clubId]
      // the quiet AI renewal is on the same terms as the in-season one
      // (ai.ts aiRenewals, 1.8.3): at the rate the club can pay, and a board
      // that cannot pay keeps fewer of its dear men. The draw is unchanged.
      const rate = club && p.clubId !== state.userClubId ? aiPayRate(state, club, rooms.get(club.id)) : 1
      const dear = !!club && p.wage > (middles.get(club.id) ?? Infinity)
      if (p.clubId !== state.userClubId && rng() < 0.5 * (dear ? rate : 1)) {
        // quiet AI renewal
        p.contractEnds = state.season + 2
        p.wage = rate < 1 ? aiRenewalWage(p, rate) : playerWage(p.ca, p.age)
        continue
      }
      // A ROLLING DEAL IS THE EXCEPTION, NOT THE SAFETY NET.
      //
      // Owner, v1.1.17: "once contracts are done they can go on a rolling
      // contract but most likely will leave and pursue other opportunities."
      //
      // This used to keep SEVEN IN TEN settled men on a quiet one-year
      // extension, which made letting a contract run out very nearly free: the
      // squad mostly stayed, and the four reminders in the inbox were four
      // warnings about a thing that generally did not happen. At three in ten
      // it is what he describes - a man may go month to month while he thinks
      // about it, and most of them go.
      //
      // Who stays is still not random: it is the settled and unlisted, and the
      // happier he is the likelier he rolls. A man on the list or with his head
      // down was always leaving and still does.
      const settled = p.clubId === state.userClubId && !p.transferListed && p.morale >= 3.5
      if (settled && rng() < 0.32 + Math.min(0.18, (p.morale - 3.5) * 0.04)) {
        p.contractEnds = state.season + 1
        p.wage = playerWage(p.ca, p.age)
        rolled.push(p)
        continue
      }
      club.players = club.players.filter(id => id !== p.id)
      if (p.clubId === state.userClubId) { freed.push(p); rememberDeparture(state, p, 'let-go', state.userClubId) }
      p.clubId = null
      p.transferListed = false
    }
  }
  if (freed.length) {
    state.news.push({
      id: state.nextId++, week: 1, season: state.season + 1, type: 'contract', read: false,
      subject: 'Contracts expired',
      body: `Departed on free transfers after their deals expired: ${freed.map(p => p.name).join(', ')}.`,
      k: 'news.contractsExpired', v: { names: freed.map(p => p.name).join(', ') },
    })
  }
  // AND THE ONES WHO STAYED SAY SO. A man rolling on month to month is a
  // decision the manager did not make and should still hear about - otherwise
  // the only contract news is the leavers, and a squad that quietly kept three
  // men reads as a squad that lost everybody.
  if (rolled.length) {
    state.news.push({
      id: state.nextId++, week: 1, season: state.season + 1, type: 'contract', read: false,
      subject: 'Rolling on, for now',
      body: `No new deal agreed, but staying month to month while they think about it: ${rolled.map(p => p.name).join(', ')}. Settle their terms or somebody else will.`,
      k: 'news.contractsRolling', v: { names: rolled.map(p => p.name).join(', ') },
    })
  }
}
