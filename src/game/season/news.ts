// The wire after a round: match reports, milestones, the league round-up
// and the manager's own marks. Split out of season.ts, which re-exports the
// public parts.
import type { Fixture, GameState } from '../model'
import { telling, tellingsOf } from '../tellings'
import { careerRows } from '../model'
import { teamShort } from '../matchEngine'
import { derbyName, isDerby, rivalsOf } from '../rivalries'
import type { Rng } from '../rng'
import { historyAfterMatch } from '../history'
import { arcAfterMatch } from '../arc'
import { tIn } from '../i18n'

export function matchReport(state: GameState, fx: Fixture) {
  // the engine already filed a full report for matches played in detail -
  // a second VICTORY/DEFEAT item on the same result is just noise
  if (fx.events?.length) return
  const comp = state.comps[fx.compId]
  const isHome = fx.homeId === state.userClubId
  const us = isHome ? fx.homeScore : fx.awayScore
  const them = isHome ? fx.awayScore : fx.homeScore
  const verdict = us > them ? 'VICTORY' : us < them ? 'DEFEAT' : 'DRAW'
  const scorers = (fx.events ?? [])
    .filter(e => e.type === 'TRY' && e.playerName)
    .map(e => `${e.playerName} (${e.min}')`)
  const motm = fx.motm != null ? state.players[fx.motm] : null
  const rows: { k: string; [x: string]: string | number }[] = [
    { k: 'news.resScore', home: teamShort(state, fx.homeId), hs: fx.homeScore, as: fx.awayScore, away: teamShort(state, fx.awayId) },
  ]
  if (fx.att) rows.push({ k: 'news.resAtt', att: fx.att, venue: fx.venue?.name ?? state.clubs[fx.homeId]?.stadium ?? tIn('en', 'news.resNeutral') })
  rows.push(scorers.length ? { k: 'news.resTries', tries: scorers.join(', ') } : { k: 'news.resNoTries' })
  if (motm) rows.push({ k: 'news.resMotm', player: motm.name })
  const lines = rows.map(r => tIn('en', r.k, r))
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'result', read: false,
    // THREE OUTCOMES, THREE PREPOSITIONS. This read `us >= them ? 'over' : 'to'`,
    // so a draw took the winner's word and the headline said "DRAW: 16-16 over
    // Sale" - the verdict correct and the line beside it claiming the win. The
    // owner read one of these and believed he had won a match he had drawn.
    subject: `${verdict}: ${us}-${them} ${us > them ? 'over' : us < them ? 'to' : 'with'} ${teamShort(state, isHome ? fx.awayId : fx.homeId)} (${comp?.short})`,
    body: lines.join('\n'),
    k: 'news.result',
    v: {
      verdict_k: us > them ? 'news.resWin' : us < them ? 'news.resLoss' : 'news.resDraw',
      us, them, over_k: us > them ? 'news.resOver' : us < them ? 'news.resTo' : 'news.resWith',
      opp: teamShort(state, isHome ? fx.awayId : fx.homeId), comp: comp?.short ?? '',
      rows_ll: JSON.stringify(rows),
    },
    fixtureId: fx.id,
  })
}

/**
 * THE GRUDGE AND THE LEDGER (v1.2.2, pre-launch audit).
 *
 * Two things that happen the moment the manager's side has played, each
 * turning a number that was already true into a sentence somebody would
 * repeat:
 *
 *  - THE GRUDGE checks the league table against the club's nominated rival
 *    (the first derby pairing rivalries.ts knows) and files a story the
 *    week you climb above them, or fall below.
 *  - THE LEDGER records the quiet firsts - the first win at a ground, the
 *    first derby win, ten unbeaten - once each, as a story and as an entry
 *    on Legacy. mgrMilestones already salutes the round numbers on the
 *    manager's own record, so those are not repeated here.
 *
 * None of it moves a stat. It is there to be noticed.
 *
 * A third, THE BACK PAGE, lived here in v1.2.2 and was removed in v1.2.3 at
 * the owner's word ("remove the newspaper back page feature"). It is worth
 * one line of why, because the bug it shipped with is the general lesson:
 * its sub-heading values were built once, before the branch that chose the
 * heading, so a hat-trick page asked for a count nothing had put there and
 * printed a literal {n} on the owner's phone. Every probe passed - none of
 * them rendered state.backPage, because the French live reader walks news,
 * commentary, decisions and the press room, and the back page was none of
 * those. A feature that renders through its own path needs its own reader.
 */
export function afterClubMatch(state: GameState, fx: Fixture) {
  const club = state.clubs[state.userClubId]
  if (!club || fx.compId === 'fr') return
  historyAfterMatch(state, fx) // the club's memory: tenure, legends, records (history.ts)
  arcAfterMatch(state, fx) // the career arc: the coach opposite, the era's book (arc.ts), no rng
  const isHome = fx.homeId === club.id
  const oppId = isHome ? fx.awayId : fx.homeId
  const opp = state.clubs[oppId]
  const won = (isHome ? fx.homeScore : fx.awayScore) > (isHome ? fx.awayScore : fx.homeScore)
  const oppShort = teamShort(state, oppId)

  // ---- the grudge ----
  {
    const rivalId = rivalsOf(club.id)[0]
    const table = state.comps[club.leagueId]?.table
    if (rivalId && table && state.clubs[rivalId]?.leagueId === club.leagueId) {
      const pos = (id: string) => {
        const rows = [...table].sort((a, b) => b.pts - a.pts || (b.pf - b.pa) - (a.pf - a.pa) || b.tf - a.tf)
        return rows.findIndex(r => r.teamId === id) + 1
      }
      const mine = pos(club.id), theirs = pos(rivalId)
      if (mine > 0 && theirs > 0) {
        const above = mine < theirs
        if (state.grudgeAbove != null && above !== state.grudgeAbove && state.week > 3) {
          const k = above ? 'news.grudgeAbove' : 'news.grudgeBelow'
          const v = { rival: teamShort(state, rivalId), mine, theirs }
          state.news.push({
            id: state.nextId++, week: state.week, season: state.season, type: 'gossip', read: false,
            subject: tIn('en', `${k}Subj`, v), body: tIn('en', k, v), k, v,
          })
        }
        state.grudgeAbove = above
      }
    }
  }

  // ---- the ledger ----
  {
    const ledger = (state.ledger ??= [])
    const have = new Set(ledger.map(e => `${e.k}|${e.v.at ?? ''}`))
    const add = (k: string, v: Record<string, string | number>) => {
      if (have.has(`${k}|${v.at ?? ''}`)) return
      ledger.push({ k, v, season: state.season, week: state.week })
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
        subject: tIn('en', `${k}Subj`, v), body: tIn('en', k, v), k, v,
      })
    }
    // first win at this ground - counted across the whole career in the save
    if (won && !isHome) {
      const priorAny = state.fixtures.some(f => f.played && f.id !== fx.id && f.awayId === club.id && f.homeId === oppId && f.compId !== 'fr' && f.awayScore > f.homeScore)
      if (!priorAny) {
        const tries = state.fixtures.filter(f => f.played && f.awayId === club.id && f.homeId === oppId && f.compId !== 'fr').length
        add('news.ledgerFirstAway', { at: oppId, ground: opp?.stadium ?? oppShort, opp: oppShort, tries, tries_k: tries === 1 ? 'news.ledgerFirstGo' : 'news.ledgerGoes' })
      }
    }
    // first derby win
    if (won && isDerby(fx.homeId, fx.awayId) && !ledger.some(e => e.k === 'news.ledgerFirstDerby')) {
      add('news.ledgerFirstDerby', { at: '', derby: derbyName(fx.homeId, fx.awayId) ?? '', opp: oppShort })
    }
    // ten, twenty unbeaten in the league
    const res = state.fixtures.filter(f => f.played && f.compId === club.leagueId && (f.homeId === club.id || f.awayId === club.id)).sort((a, b) => b.week - a.week || b.id - a.id)
    let run = 0
    for (const f of res) {
      const a = f.homeId === club.id ? f.homeScore : f.awayScore
      const b = f.homeId === club.id ? f.awayScore : f.homeScore
      if (a >= b) run++; else break
    }
    if (run === 10) add('news.ledgerUnbeaten', { at: '10', n: 10 })
    if (run === 20) add('news.ledgerUnbeaten', { at: '20', n: 20 })
  }
}

const MILESTONE_KEYS = tellingsOf('news.milestone')

export function milestones(state: GameState, _rng: Rng) {
  const club = state.clubs[state.userClubId]
  for (const id of club.players) {
    const p = state.players[id]
    // only the week he actually crossed the number - never a repeat salute
    if (!p || !p.stats.apps || p.lastWk !== state.week) continue
    const totApps = careerRows(p).reduce((s, c) => s + c.apps, 0) + p.stats.apps + (p.hist?.apps ?? 0)
    const totTries = careerRows(p).reduce((s, c) => s + c.tries, 0) + p.stats.tries + (p.hist?.tries ?? 0)
    const totPts = careerRows(p).reduce((s, c) => s + c.points, 0) + p.stats.points + (p.hist?.points ?? 0)
    const hits: { k: string; n: number }[] = []
    if ([50, 100, 150, 200, 250].includes(totApps)) hits.push({ k: 'news.mileApps', n: totApps })
    if ([25, 50, 75, 100].includes(totTries)) hits.push({ k: 'news.mileTries', n: totTries })
    if ([250, 500, 1000, 1500].includes(totPts)) hits.push({ k: 'news.milePts', n: totPts })
    for (const h of hits) {
      const v = { player: p.name, what_k: h.k, n: h.n }
      // a player parked exactly on a number (no tries this week) must not
      // be saluted again - one presentation per milestone. Matched on the
      // man and the mark rather than on the wording, which now varies
      if (state.news.some(n => n.k != null && MILESTONE_KEYS.includes(n.k) && n.playerId === p.id &&
        n.v?.what_k === h.k && n.v?.n === h.n)) continue
      const k = telling(state, 'news.milestone')
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
        subject: tIn('en', `${k}Subj`, v),
        body: tIn('en', k, v),
        k, v,
        playerId: p.id,
      })
    }
  }
}

export function leagueRoundUp(state: GameState) {
  const leagueId = state.clubs[state.userClubId].leagueId
  const round = state.fixtures.filter(f =>
    f.compId === leagueId && f.week === state.week && f.played &&
    f.homeId !== state.userClubId && f.awayId !== state.userClubId)
  if (!round.length) return
  const rows: Record<string, string | number>[] = round.map(f => ({
    k: 'news.roundRow', home: teamShort(state, f.homeId), hs: f.homeScore,
    as: f.awayScore, away: teamShort(state, f.awayId),
  }))
  rows.push(...formLines(state, leagueId, round))
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
    subject: `${state.comps[leagueId]?.short} round-up`,
    body: rows.map(r => tIn('en', String(r.k), r)).join('\n'),
    k: 'news.roundUp',
    v: { comp: state.comps[leagueId]?.short ?? '', rows_ll: JSON.stringify(rows) },
  })
  tryRace(state, leagueId, round)
}

/**
 * THE FORM LINE UNDER THE SCORES (1.8.1, "feels too samey"). The round-up was a
 * list of scorelines and nothing else, seventeen times a season. The table
 * already knows which of those clubs cannot stop winning and which cannot
 * start, so the round-up says so: the longest winning run and the longest run
 * without a win among the clubs that played this round, each only on the
 * weeks it reaches a new mark (four wins, six, eight...; five without, seven,
 * nine...) so one club's run is not the same line every Monday. A line on an
 * existing story, not a new story: more to read, not more to open.
 */
function formLines(state: GameState, leagueId: string, round: Fixture[]): Record<string, string | number>[] {
  const played = state.fixtures
    .filter(f => f.compId === leagueId && f.played)
    .sort((a, b) => b.week - a.week || b.id - a.id)
  const runOf = (clubId: string, won: boolean): number => {
    let n = 0
    for (const f of played) {
      if (f.homeId !== clubId && f.awayId !== clubId) continue
      const us = f.homeId === clubId ? f.homeScore : f.awayScore
      const them = f.homeId === clubId ? f.awayScore : f.homeScore
      if ((us > them) !== won) break
      n++
    }
    return n
  }
  const clubs = round.flatMap(f => [f.homeId, f.awayId])
  const best = (won: boolean, marks: (n: number) => boolean) => clubs
    .map(id => ({ id, n: runOf(id, won) }))
    .filter(x => marks(x.n))
    .sort((a, b) => b.n - a.n)[0]
  const out: Record<string, string | number>[] = []
  const hot = best(true, n => n >= 4 && n % 2 === 0)
  if (hot) out.push({ k: 'news.ruHot', club: teamShort(state, hot.id), n: hot.n })
  const cold = best(false, n => n >= 5 && n % 2 === 1)
  if (cold) out.push({ k: 'news.ruCold', club: teamShort(state, cold.id), n: cold.n })
  return out
}

/**
 * THE TRY RACE, twice a season (1.8.1). A third of the way through the league
 * and two thirds of the way, the leading try scorer among the players at this
 * league's clubs and the man chasing him, from the season's own scoring. Filed
 * only when there is a race to speak of: three tries at least, and a second
 * name to chase.
 */
function tryRace(state: GameState, leagueId: string, round: Fixture[]) {
  const comp = state.comps[leagueId]
  if (!comp) return
  const total = new Set(state.fixtures.filter(f => f.compId === leagueId && !f.stage).map(f => f.round)).size
  const at = round[0]?.round ?? -1
  if (total < 6 || (at !== Math.floor(total / 3) && at !== Math.floor((2 * total) / 3))) return
  const teams = new Set(comp.teamIds)
  const scorers = Object.values(state.players)
    .filter(p => p.clubId && teams.has(p.clubId) && p.stats.tries > 0)
    .sort((a, b) => b.stats.tries - a.stats.tries || b.stats.points - a.stats.points || a.id - b.id)
  const [first, second] = scorers
  if (!first || !second || first.stats.tries < 3) return
  const v = {
    comp: comp.short, player: first.name, club: teamShort(state, first.clubId!), n: first.stats.tries,
    second: second.name, club2: teamShort(state, second.clubId!), m: second.stats.tries,
  }
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
    subject: tIn('en', 'news.tryRaceSubj', v),
    body: tIn('en', 'news.tryRace', v),
    k: 'news.tryRace', v,
    playerId: first.id,
  })
}

/** The dugout counts too: round numbers on the manager's own record.
 *  The win check only fires on a win, or it would repeat while the
 *  counter sits on the mark through defeats. */
/**
 * The career marks that get saluted, exported so the Legacy screen can show what
 * you are chasing rather than only what you have already passed.
 *
 * They were local arrays here, which meant the game celebrated a threshold it had
 * never mentioned: your 250th win arrived as a surprise, and nothing anywhere said
 * a 250th win was a thing.
 */
export const WIN_MARKS = [50, 100, 250, 500, 750, 1000]
export const GAME_MARKS = [100, 250, 500, 750, 1000]

export function mgrMilestones(state: GameState, won: boolean) {
  const m = state.mgr
  const winMarks = WIN_MARKS
  const gameMarks = GAME_MARKS
  const pct = m.m > 0 ? Math.round((m.w / m.m) * 100) : 0
  if (won && winMarks.includes(m.w)) {
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
      subject: `Career win number ${m.w}`,
      body: `That was the ${m.w}th win of your managerial career - ${m.w} from ${m.m} matches (${pct}%), with ${m.trophies.length} ${m.trophies.length === 1 ? 'trophy' : 'trophies'} in the cabinet. The staff mark it with a quiet round of applause in the corridor. Back to work.`,
      k: 'news.careerWin',
      v: { w: m.w, m: m.m, pct, n: m.trophies.length, cup_k: m.trophies.length === 1 ? 'news.trophyOne' : 'news.trophyMany' },
    })
  }
  if (gameMarks.includes(m.m)) {
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
      subject: `Match ${m.m} in the dugout`,
      body: `You have now taken charge of ${m.m} matches: ${m.w} won, ${m.d} drawn, ${m.l} lost (${pct}%). Very few last this long in the job.`,
      k: 'news.careerGames',
      v: { m: m.m, w: m.w, d: m.d, l: m.l, pct },
    })
  }
}
