// League tables, knockout draws and the knockout rounds. Split out of
// season.ts, which re-exports the public parts.
import type { Competition, Fixture, GameState, Player, TableRow } from '../model'
import { adminPenalty } from '../insolvency'
import { finalVenue, tieWinner } from '../model'
import { autoSelect, teamShort, teamUnits, rosterOf } from '../matchEngine'
import { emptyRow, sortTable } from '../schedule'
import { clamp, shuffled, type Rng } from '../rng'
import { tIn } from '../i18n'

// ------------------------------------------------------------------
// Tables & knockouts
// ------------------------------------------------------------------

export function applyToTable(comp: Competition, fx: Fixture) {
  if (fx.stage) return // knockout games don't affect tables
  const h = comp.table.find(r => r.teamId === fx.homeId)
  const a = comp.table.find(r => r.teamId === fx.awayId)
  if (!h || !a) return
  h.p++; a.p++
  h.pf += fx.homeScore; h.pa += fx.awayScore
  a.pf += fx.awayScore; a.pa += fx.homeScore
  h.tf += fx.homeTries; h.ta += fx.awayTries
  a.tf += fx.awayTries; a.ta += fx.homeTries
  if (fx.homeScore > fx.awayScore) { h.w++; a.l++; h.pts += 4 }
  else if (fx.homeScore < fx.awayScore) { a.w++; h.l++; a.pts += 4 }
  else { h.d++; a.d++; h.pts += 2; a.pts += 2 }
  // bonus points
  if (fx.homeTries >= 4) { h.bp++; h.pts++ }
  if (fx.awayTries >= 4) { a.bp++; a.pts++ }
  if (fx.homeScore < fx.awayScore && fx.awayScore - fx.homeScore <= 7) { h.bp++; h.pts++ }
  if (fx.awayScore < fx.homeScore && fx.homeScore - fx.awayScore <= 7) { a.bp++; a.pts++ }
}

/**
 * Recompute a league table from the fixtures that have actually been played.
 *
 * A save can arrive holding a table that disagrees with its own fixture list -
 * a bad write, a hand edit, or fixtures pruned on load because they named clubs
 * the file no longer contains. The standings are what a whole season is read
 * through, so a table saying forty-one games played in a league that has played
 * one is not cosmetic: every objective, every board judgement and every headline
 * about the title race is drawn from it.
 *
 * This replays the real fixtures through the real points rules rather than
 * inventing a correction, so the repaired table is the one the engine would have
 * produced. Found by scripts/savefuzz.ts.
 */
export function rebuildTable(comp: Competition, fixtures: Fixture[], state?: GameState) {
  if (comp.type !== 'league' || !Array.isArray(comp.table)) return
  for (const r of comp.table) {
    r.p = 0; r.w = 0; r.d = 0; r.l = 0
    r.pf = 0; r.pa = 0; r.tf = 0; r.ta = 0; r.bp = 0; r.pts = 0
  }
  for (const fx of fixtures) {
    if (fx.compId !== comp.id || !fx.played || fx.stage) continue
    applyToTable(comp, fx)
  }
  applyAdminPenalties(comp, state)
}

/**
 * A club in administration starts the season on minus ten.
 *
 * Applied HERE rather than painted on by the table screen, because a deduction
 * that only exists in the UI is not a deduction: promotion, relegation, playoff
 * cut-offs, the title itself and every AI board's read of its own season all
 * come off comp.table, and each of those has to see the same number the manager
 * does. Points are allowed to go negative, as they do in the real thing.
 */
export function applyAdminPenalties(comp: Competition, state?: GameState) {
  if (!state || comp.type !== 'league' || !Array.isArray(comp.table)) return
  for (const r of comp.table) {
    const hit = adminPenalty(state.clubs[r.teamId], state.season)
    if (hit) r.pts -= hit
  }
}

/**
 * THE FOUR ROUNDS THAT CANNOT END LEVEL, and only those four.
 *
 * `stage` is not a knockout marker. It is a free-text label, and the tours and
 * Test series use it too - '1st Test', 'Tour match Waikato', and every name in
 * TEST_NAMES. Sudden death was gated on `fx.stage` being truthy, so a drawn
 * Test match, which is a perfectly ordinary result and sometimes a famous one,
 * had three points added to one side by a coin weighted on squad strength.
 */
export const KO_STAGES = new Set(['QF', 'SF', 'F', 'BAR'])
export function isKnockoutTie(fx: Fixture): boolean {
  return !!fx.stage && KO_STAGES.has(fx.stage)
}

/** A line of extra time, for the ticker (store.ts settleKnockout). */
export interface EtLine { min: number; type: 'SUB' | 'TRY' | 'PEN' | 'FT'; teamId: string; k: string; v: Record<string, string | number> }

/**
 * ---- EXTRA TIME (1.8.16, owner's coverage list item 20) ----
 *
 * In knockout rugby there are no draws, and this used to settle a level tie
 * with a coin weighted on squad strength that added three points to one side:
 * a golden point nobody saw. The Premiership's play-off regulations (and the
 * European cups') do it in three steps, and so does this now:
 *
 *   1. two ten-minute periods of extra time, every point of it counting;
 *   2. still level, the side that scored more tries in the match goes through;
 *   3. still level, a place-kick competition: three kickers a side, six kicks
 *      each from the 22 and the ten-metre line, then sudden death.
 *
 * After steps 2 and 3 the score stays level, as it does in the real game, and
 * the winner is kept on the fixture (decider, read by tieWinner).
 *
 * Extra time is played in four five-minute blocks off the strength of the two
 * sides' best available XVs, as the old coin was. Tired men and the bench are
 * in the strength already: this is the epilogue to a match, not a second one.
 */
export function resolveKnockoutDraw(state: GameState, fx: Fixture, rng: Rng): EtLine[] {
  if (!isKnockoutTie(fx)) return []
  if (fx.homeScore !== fx.awayScore) return []
  // ONCE. A tie the live screen settled on tries or kicks (store/live.ts
  // settleKnockout) is still level, and the week's settle reaches it again on
  // its way to the table: without this it played a second extra time, put
  // points on the record the ticker never showed and could send the other
  // side through under a decider naming the first.
  if (fx.decider) return []
  const lines: EtLine[] = []
  const short = (id: string) => teamShort(state, id)
  const hl = autoLineup(state, fx.homeId), al = autoLineup(state, fx.awayId)
  const hs = teamUnits(state, hl).overall
  const as = teamUnits(state, al).overall
  // a final at a neutral ground has no home edge
  const share = clamp(hs / (hs + as) + (fx.venue ? 0 : 0.03), 0.2, 0.8)
  lines.push({ min: 80, type: 'SUB', teamId: '', k: 'comm.etStart', v: { home: short(fx.homeId), away: short(fx.awayId), hs: fx.homeScore, ascore: fx.awayScore } })
  const et: [number, number] = [0, 0]
  for (let b = 0; b < 4; b++) {
    const min = 81 + b * 5 + Math.floor(rng() * 5)
    for (const home of [true, false]) {
      const s = home ? share : 1 - share
      if (rng() >= 0.1 * Math.pow(s * 2, 1.6)) continue
      const id = home ? fx.homeId : fx.awayId
      let pts: number
      if (rng() < 0.45) {
        const con = rng() < 0.7
        pts = con ? 7 : 5
        if (home) fx.homeTries += 1; else fx.awayTries += 1
        lines.push({ min, type: 'TRY', teamId: id, k: con ? 'comm.etTryCon' : 'comm.etTry', v: { team: short(id) } })
      } else {
        pts = 3
        lines.push({ min, type: 'PEN', teamId: id, k: 'comm.etPen', v: { team: short(id) } })
      }
      if (home) { fx.homeScore += pts; et[0] += pts } else { fx.awayScore += pts; et[1] += pts }
    }
    if (b === 1) lines.push({ min: 90, type: 'SUB', teamId: '', k: 'comm.etTurn', v: { hs: fx.homeScore, ascore: fx.awayScore } })
  }
  if (et[0] || et[1]) fx.aet = et
  if (fx.homeScore !== fx.awayScore) {
    const w = fx.homeScore > fx.awayScore ? fx.homeId : fx.awayId
    lines.push({ min: 100, type: 'FT', teamId: w, k: 'comm.etWon', v: { team: short(w), hs: fx.homeScore, ascore: fx.awayScore } })
    return lines
  }
  // still level: the try count
  if (fx.homeTries !== fx.awayTries) {
    const w = fx.homeTries > fx.awayTries ? fx.homeId : fx.awayId
    fx.decider = { by: 'tries', winner: w }
    lines.push({ min: 100, type: 'FT', teamId: w, k: 'comm.etOnTries', v: { team: short(w), n: Math.max(fx.homeTries, fx.awayTries), m: Math.min(fx.homeTries, fx.awayTries), hs: fx.homeScore, ascore: fx.awayScore } })
    return lines
  }
  // and the kicks: three kickers a side, six kicks each, then sudden death
  const kickers = (ids: (number | null)[]) => ids.slice(0, 15)
    .map(id => (id != null ? state.players[id] : null))
    .filter((p): p is Player => !!p)
    .sort((a, b) => b.a.goa - a.a.goa)
    .slice(0, 3)
  const hk = kickers(hl), ak = kickers(al)
  const made = (p: Player | undefined, spot: number) => rng() < clamp(0.42 + (p?.a.goa ?? 8) / 40 - (spot % 2) * 0.08, 0.35, 0.92)
  let h = 0, a = 0
  for (let i = 0; i < 6; i++) { if (made(hk[i % 3], i)) h++; if (made(ak[i % 3], i)) a++ }
  let round = 0
  while (h === a && round < 30) { if (made(hk[round % 3], 1)) h++; if (made(ak[round % 3], 1)) a++; round++ }
  if (h === a) { if (share >= 0.5) h++; else a++ }
  const w = h > a ? fx.homeId : fx.awayId
  fx.decider = { by: 'kicks', winner: w, kicks: [h, a] }
  lines.push({ min: 100, type: 'SUB', teamId: '', k: 'comm.etKicksStart', v: { home: short(fx.homeId), away: short(fx.awayId) } })
  lines.push({ min: 100, type: 'FT', teamId: w, k: round ? 'comm.etKicksSudden' : 'comm.etKicksWon', v: { team: short(w), n: Math.max(h, a), m: Math.min(h, a), hs: fx.homeScore, ascore: fx.awayScore } })
  return lines
}

function autoLineup(state: GameState, teamId: string) {
  const pool = rosterOf(state, teamId).map(id => state.players[id]).filter(p => p && !p.injury && p.bans === 0)
  return autoSelect(state, pool)
}

function poolStandings(state: GameState, comp: Competition): string[][] {
  const pools = comp.pools ?? [comp.teamIds]
  return pools.map(pool => {
    const rows: TableRow[] = pool.map(emptyRow)
    for (const fx of state.fixtures) {
      if (fx.compId !== comp.id || !fx.played || fx.stage) continue
      if (!pool.includes(fx.homeId)) continue
      const mini: Competition = { ...comp, table: rows, pools: undefined }
      applyToTable(mini, fx)
    }
    return sortTable(rows).map(r => r.teamId)
  })
}

/** Create knockout fixtures for a competition when the calendar reaches them. */
export function maybeCreateKnockouts(state: GameState, comp: Competition, rng: Rng) {
  if (!comp.playoffTeams) return
  /** stages whose ties were made on this tick, so the draw can be assembled after */
  const drawnStages = new Set<string>()
  const cupLike = comp.type === 'cup' || !!comp.pools
  const koFx = (stage: string) => state.fixtures.filter(f => f.compId === comp.id && f.stage === stage)
  const mkFx = (stage: string, week: number, home: string, away: string) => {
    // A TIE NEEDS TWO TEAMS. A league whose playoffTeams does not match the
    // branch that seeds it hands this `undefined`, and the fixture that
    // results is unplayable, unremovable and visible - see the n === 2 note
    // below for the twenty seasons that cost. Refusing it here means the next
    // mis-specified competition loses its play-off rather than its fixture
    // list, and the soak sees a missing champion instead of a ghost.
    if (!home || !away) return
    const fx: Fixture = {
      id: state.nextId++, compId: comp.id, round: 99, week, homeId: home, awayId: away,
      played: false, homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0, stage,
    }
    // a showpiece final leaves home: the Premier Division final is always
    // Twickenham, the Elite 14 final always the Stade de France, and the
    // European finals go to whichever great ground won this season's bid.
    // Only club finals - a World Championship final has its own host nation.
    if (stage === 'F' && state.clubs[home]) {
      const v = finalVenue(state, comp.id)
      if (v) fx.venue = v
    }
    state.fixtures.push(fx)
    // the draw is news when you're in the hat
    const mine = [state.userClubId, state.natTeam].filter(Boolean)
    drawnStages.add(stage)
    if (mine.includes(home) || mine.includes(away)) {
      const us = mine.includes(home) ? home : away
      const opp = us === home ? away : home
      const stgKey = { QF: 'news.stgQF', SF: 'news.stgSF', F: 'news.stgF', BAR: 'news.stgBAR', R16: 'news.stgR16' }[stage]
      const stg = stgKey ? tIn('en', stgKey) : stage
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
        subject: `The ${comp.short} ${stg} draw: ${teamShort(state, opp)}`,
        body: fx.venue
          ? `It is settled. ${teamShort(state, opp)} in the ${comp.name} FINAL, at ${fx.venue.name} in ${fx.venue.city} - ${fx.venue.capacity.toLocaleString()} seats and both sets of supporters on the road to fill them. One match. Everything on it.`
          : us === home
            ? `The balls have been drawn. You host ${teamShort(state, opp)} in the ${comp.name} ${stg} - win, and the road continues. ${stg === 'FINAL' ? 'One match. Everything on it.' : 'Get the place rocking.'}`
            : `The balls have been drawn. You travel to ${teamShort(state, opp)} for the ${comp.name} ${stg}. ${stg === 'FINAL' ? 'One match. Everything on it.' : 'Quiet the crowd early and anything is possible.'}`,
        k: fx.venue ? 'news.drawFinal' : us === home ? 'news.drawHome' : 'news.drawAway',
        v: {
          opp: teamShort(state, opp), comp: comp.name, short: comp.short,
          stg_k: stgKey ?? '', stage,
          venue: fx.venue?.name ?? '', city: fx.venue?.city ?? '', seats: fx.venue?.capacity ?? 0,
          tail_k: stg === 'FINAL' ? 'news.drawTailFinal'
            : us === home ? 'news.drawTailHome' : 'news.drawTailAway',
        },
      })
    }
  }
  /**
   * Hold a freshly drawn round back as a ceremony (F19).
   *
   * The ties have to exist the moment the previous round ends, or the manager's
   * own tie would be simmed before the MatchDay screen ever saw it. But he should
   * not simply FIND them in his fixture list: a cup draw is a moment, and the
   * only one in the sport where you watch your season change without playing.
   *
   * Assembled after the round is built rather than while it is being built,
   * because the first ball out is rarely the manager's - collecting as we went
   * missed every tie drawn before his name came up.
   */
  const holdTheDraw = () => {
    for (const stage of drawnStages) {
      const ties = state.fixtures.filter(f => f.compId === comp.id && f.stage === stage)
      const mine = [state.userClubId, state.natTeam].filter(Boolean)
      // a round with only one tie in it is a final: there is nothing to draw
      if (ties.length < 2) continue
      if (!ties.some(f => mine.includes(f.homeId) || mine.includes(f.awayId))) continue
      state.draw = {
        compId: comp.id, stage, week: state.week, season: state.season, revealed: 0,
        ties: ties.map(f => ({ homeId: f.homeId, awayId: f.awayId })),
      }
    }
  }

  const regularDone = state.fixtures
    .filter(f => f.compId === comp.id && !f.stage)
    .every(f => f.played)
  if (!regularDone) return

  // Knockout ties are created as soon as the previous round is complete -
  // never lazily on their own match week, or the user's tie would be
  // simmed away before the MatchDay screen ever saw it.
  const ko = comp.koWeeks
  if (cupLike && comp.pools?.length === 2) {
    // two pools (the MRC Cup, schedule.ts): each winner hosts the other
    // pool's runner-up in the semi-finals, SF ko[0], F ko[1]. A winner never
    // meets its own pool again before the final.
    if (koFx('SF').length === 0) {
      const [a, b] = poolStandings(state, comp)
      mkFx('SF', ko[0], a[0], b[1])
      mkFx('SF', ko[0], b[0], a[1])
    }
    const sf = koFx('SF')
    if (koFx('F').length === 0 && sf.length === 2 && sf.every(f => f.played)) {
      mkFx('F', ko[1], winnerOf(sf[0]), winnerOf(sf[1]))
    }
  } else if (cupLike) {
    // pool competitions (Continental Cup, World Championship): QF ko[0], SF ko[1], F ko[2]
    if (koFx('QF').length === 0) {
      const pools = poolStandings(state, comp)
      const winners = pools.map(p => p[0])
      const runners = pools.map(p => p[1])
      // NO POOL REMATCH IN THE QUARTERS (user: "If you qualify from the cup -
      // you should not play a team from the group you played next"). The
      // shuffle can hand a runner straight back to his own pool winner, so:
      // keep the shuffled order when it is clean, otherwise walk the runner
      // permutations in a fixed order and take the first with no rematch.
      // Winner i came from pool i; runner slot order below pairs slots
      // [0,1,2,3] with winners [3,2,1,0] (the mkFx lines). Deterministic
      // repair, zero extra rng draws, so the match stream never moves.
      const rs = shuffled(rng, runners)
      const poolOf = new Map(runners.map((t, i) => [t, i]))
      const PARTNER = [3, 2, 1, 0] // runner slot -> winner index it will play
      const clean = (a: string[]) => a.every((t, slot) => poolOf.get(t) !== PARTNER[slot])
      let picked = rs
      if (!clean(rs)) {
        const perms = (xs: number[]): number[][] => xs.length <= 1 ? [xs]
          : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map(p2 => [x, ...p2]))
        for (const perm of perms([0, 1, 2, 3])) {
          const cand = perm.map(i => rs[i])
          if (clean(cand)) { picked = cand; break }
        }
      }
      const seeds = [...winners, ...picked]
      mkFx('QF', ko[0], seeds[0], seeds[7])
      mkFx('QF', ko[0], seeds[3], seeds[4])
      mkFx('QF', ko[0], seeds[1], seeds[6])
      mkFx('QF', ko[0], seeds[2], seeds[5])
      // the host city is announced with the quarter-final draw. Both European
      // finals share one great ground on one weekend, so the story runs once,
      // off the Continental Cup, and covers the pair of them.
      if (comp.id === 'cc') {
        const v = finalVenue(state, 'cc')
        // ONE FINAL OR TWO, DEPENDING ON THE WORLD. The men's game plays the
        // Shield final on the Friday and the Cup on the Saturday, which is
        // what this story was written for. The women's game has no Shield -
        // there is no second tier beneath the Hemispheric Championship to
        // feed one (dream.ts WORLD_COMPS) - so a women's career was reading
        // about "both European finals", a Continental Shield that does not
        // exist and a continent its competition does not sit on. The keyed
        // copy carries the women's version in its `_f` sibling; these English
        // literals are the snapshot an old save reads back, so they have to
        // fork here as well.
        const pair = !!state.comps['chc']
        if (v) state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
          subject: pair
            ? `FINALS WEEKEND: ${v.city} gets Europe's showpiece`
            : `FINALS WEEKEND: ${v.city} gets the showpiece`,
          body: pair
            ? [
              `${v.name} will stage both European finals this season: the Continental Shield under Friday lights, the Continental Cup on the Saturday. ${v.capacity.toLocaleString()} seats, one city, the whole sport in town for a weekend.`,
              `Eight quarter-finalists still stand in each competition, and every one of them circled the date this morning and priced the trip to ${v.city}.`,
            ].join('\n')
            : [
              `${v.name} will stage the ${comp.name} final this season. ${v.capacity.toLocaleString()} seats, one city, the whole sport in town for a weekend.`,
              `Eight quarter-finalists still stand, and every one of them circled the date this morning and priced the trip to ${v.city}.`,
            ].join('\n'),
          k: 'news.finalsWeekend',
          v: { venue: v.name, city: v.city, seats: v.capacity },
        })
      }
    }
    const qf = koFx('QF')
    if (koFx('SF').length === 0 && qf.length === 4 && qf.every(f => f.played)) {
      const w = qf.map(winnerOf)
      mkFx('SF', ko[1], w[0], w[1])
      mkFx('SF', ko[1], w[2], w[3])
    }
    const sf = koFx('SF')
    if (koFx('F').length === 0 && sf.length === 2 && sf.every(f => f.played)) {
      mkFx('F', ko[2], winnerOf(sf[0]), winnerOf(sf[1]))
    }
  } else {
    // league playoffs
    const order = sortTable(comp.table).map(r => r.teamId)
    const n = comp.playoffTeams
    if (n === 2) {
      /**
       * A TWO-TEAM PLAY-OFF IS A FINAL, AND NOTHING ELSE.
       *
       * Found by the women's 20-season soak: the Celtic Provinces Cup - six
       * clubs, playoffTeams 2 - fell past every branch here into the eight-team
       * one, which reads order[6] and order[7] off a table six long. So the
       * season ended by manufacturing four quarter-finals, two of them against
       * `undefined`, which no engine can play. They sat unplayed for ever, the
       * semi-final gate never opened, and the competition ran twenty seasons
       * without crowning anybody - while a manager in that league watched his
       * fixture list say "undefined" in April.
       *
       * The last knockout week, not ko[0]: koWeeks is [42, 43] at this size
       * (schedule.ts), and a final belongs on finals weekend with the others.
       */
      if (koFx('F').length === 0 && order.length >= 2) mkFx('F', ko[ko.length - 1], order[0], order[1])
    } else if (n === 4) {
      const [sfW, fW] = ko
      if (koFx('SF').length === 0) {
        mkFx('SF', sfW, order[0], order[3])
        mkFx('SF', sfW, order[1], order[2])
      }
      const sf = koFx('SF')
      if (koFx('F').length === 0 && sf.length === 2 && sf.every(f => f.played)) {
        mkFx('F', fW, winnerOf(sf[0]), winnerOf(sf[1]))
      }
    } else {
      const [r1W, sfW, fW] = ko
      const r1Stage = n === 6 ? 'BAR' : 'QF'
      if (koFx(r1Stage).length === 0) {
        if (n === 6) {
          mkFx('BAR', r1W, order[2], order[5])
          mkFx('BAR', r1W, order[3], order[4])
        } else {
          mkFx('QF', r1W, order[0], order[7])
          mkFx('QF', r1W, order[3], order[4])
          mkFx('QF', r1W, order[1], order[6])
          mkFx('QF', r1W, order[2], order[5])
        }
      }
      const r1 = koFx(r1Stage)
      if (koFx('SF').length === 0 && r1.length && r1.every(f => f.played)) {
        const w = r1.map(winnerOf)
        if (n === 6) {
          mkFx('SF', sfW, order[0], w[1])
          mkFx('SF', sfW, order[1], w[0])
        } else {
          mkFx('SF', sfW, w[0], w[1])
          mkFx('SF', sfW, w[2], w[3])
        }
      }
      const sf = koFx('SF')
      if (koFx('F').length === 0 && sf.length === 2 && sf.every(f => f.played)) {
        mkFx('F', fW, winnerOf(sf[0]), winnerOf(sf[1]))
      }
    }
  }

  // every tie in this round is drawn now: hold it back as a ceremony
  holdTheDraw()
}

export const winnerOf = (fx: Fixture) => tieWinner(fx)
