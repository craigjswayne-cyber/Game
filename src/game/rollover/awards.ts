// The season's honours, handed out at the rollover while the season's
// numbers still stand: the Annual, the world's best, the record book, the
// try of the season, an unbeaten season and a scripted challenge won.
import { W } from '../gender'
import { tIn } from '../i18n'
import { seasonLabel, XV_SLOTS, type GameState } from '../model'
import { CHALLENGES } from '../newgame'
import { runTeamOfTheYear } from '../yearend'
import { ordinal } from './format'

export function seasonAwards(state: GameState) {
  const userLeague = state.clubs[state.userClubId].leagueId
  const leaguePlayers = Object.values(state.players).filter(p =>
    p.clubId && state.clubs[p.clubId]?.leagueId === userLeague && p.stats.apps >= 8)
  if (!leaguePlayers.length) return
  const topPoints = [...leaguePlayers].sort((a, b) => b.stats.points - a.stats.points)[0]
  const topTries = [...leaguePlayers].sort((a, b) => b.stats.tries - a.stats.tries)[0]
  const potm = [...leaguePlayers].sort((a, b) =>
    b.stats.ratingSum / Math.max(1, b.stats.apps) - a.stats.ratingSum / Math.max(1, a.stats.apps))[0]

  // Team of the Season: best average rating per position slot
  const used = new Set<number>()
  const tots: string[] = []
  for (const slot of XV_SLOTS) {
    const cands = leaguePlayers
      .filter(p => !used.has(p.id) && (p.pos === slot.pos || p.alt.includes(slot.pos)))
      .sort((a, b) => b.stats.ratingSum / Math.max(1, b.stats.apps) - a.stats.ratingSum / Math.max(1, a.stats.apps))
    if (cands[0]) { used.add(cands[0].id); tots.push(`${slot.shirt}. ${cands[0].name} (${state.clubs[cands[0].clubId!]?.short})`) }
  }

  // record-book lines
  const leagueFx = state.fixtures.filter(f => f.compId === userLeague && f.played && !f.stage)
  const biggest = leagueFx.sort((a, b) =>
    Math.abs(b.homeScore - b.awayScore) - Math.abs(a.homeScore - a.awayScore))[0]
  const bestAtt = leagueFx.sort((a, b) => (b.att ?? 0) - (a.att ?? 0))[0]

  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
    subject: `The ${seasonLabel(state.season)} Annual - awards & records`,
    body: [
      `Player of the Season: ${potm.name} (${state.clubs[potm.clubId!]?.short}) - avg rating ${(potm.stats.ratingSum / Math.max(1, potm.stats.apps)).toFixed(2)}`,
      `Top Points Scorer: ${topPoints.name} - ${topPoints.stats.points} points`,
      `Top Try Scorer: ${topTries.name} - ${topTries.stats.tries} tries`,
      biggest ? `Biggest win: ${state.clubs[biggest.homeId]?.short} ${biggest.homeScore}-${biggest.awayScore} ${state.clubs[biggest.awayId]?.short}` : '',
      bestAtt?.att ? `Best attendance: ${bestAtt.att.toLocaleString()} at ${state.clubs[bestAtt.homeId]?.stadium}` : '',
      '',
      // two packed lines instead of fifteen numbered ones (brevity pass 19A):
      // the phone-screen version of a back-page graphic
      `Team of the Season - Pack: ${tots.slice(0, 8).map(t => t.replace(/^\d+\. /, '')).join(', ')}.`,
      `Backs: ${tots.slice(8).map(t => t.replace(/^\d+\. /, '')).join(', ')}.`,
    ].filter(Boolean).join('\n'),
    k: 'news.annual',
    v: {
      season: seasonLabel(state.season),
      rows_ll: JSON.stringify([
        { k: 'news.annPotm', name: potm.name, club: state.clubs[potm.clubId!]?.short ?? '', avg: (potm.stats.ratingSum / Math.max(1, potm.stats.apps)).toFixed(2) },
        { k: 'news.annPoints', name: topPoints.name, n: topPoints.stats.points },
        { k: 'news.annTries', name: topTries.name, n: topTries.stats.tries },
        ...(biggest ? [{ k: 'news.annBiggest', home: state.clubs[biggest.homeId]?.short ?? '', hs: biggest.homeScore, as: biggest.awayScore, away: state.clubs[biggest.awayId]?.short ?? '' }] : []),
        ...(bestAtt?.att ? [{ k: 'news.annAtt', n: bestAtt.att, stadium: state.clubs[bestAtt.homeId]?.stadium ?? '' }] : []),
      ]),
      pack: tots.slice(0, 8).map(t => t.replace(/^\d+\. /, '')).join(', '),
      backs: tots.slice(8).map(t => t.replace(/^\d+\. /, '')).join(', '),
    },
  })
}

/** The game's biggest individual prize: judged on the whole world's season,
 *  not one league - form first, with a nudge for tries and silverware. */
export function worldPlayerOfTheYear(state: GameState) {
  const cands = Object.values(state.players)
    .filter(p => p.clubId && state.clubs[p.clubId] && p.stats.apps >= 15)
    .map(p => {
      const avg = p.stats.ratingSum / p.stats.apps
      const cups = state.history.filter(h => h.season === state.season && h.champion === p.clubId).length
      // tries already lift match ratings, so the nudge here stays small -
      // any bigger and the podium is wingers only
      return { p, avg, score: avg + p.stats.tries * 0.004 + cups * 0.15 }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
  if (cands.length < 3) return
  const [win, second, third] = cands
  win.p.poty = (win.p.poty ?? 0) + 1
  ;(state.potyRoll ??= []).push({
    season: state.season, playerId: win.p.id, name: win.p.name,
    clubName: state.clubs[win.p.clubId!]?.name ?? 'Unknown',
  })
  const mine = (x: typeof win) => x.p.clubId === state.userClubId
  const row = (x: typeof win, rank: number) => ({
    k: 'news.potyLine', rank, name: x.p.name, pos: x.p.pos,
    club: state.clubs[x.p.clubId!]?.short ?? '', avg: x.avg.toFixed(2), n: x.p.stats.tries,
    tries_k: x.p.stats.tries === 1 ? 'count.tryOne' : 'count.tryMany',
    again_k: rank === 1 && (x.p.poty ?? 0) > 1 ? 'news.potyAgain' : 'common.nothing',
    poty: x.p.poty ?? 0,
  })
  const line = (x: typeof win) =>
    `${x.p.name} (${x.p.pos}, ${state.clubs[x.p.clubId!]?.short}) - avg ${x.avg.toFixed(2)}, ${x.p.stats.tries} tries`
  state.news.push({
    id: state.nextId++, week: 1, season: state.season + 1, type: 'award', read: false,
    subject: `World Player of the Year: ${win.p.name}`,
    body: [
      `The world game names its best. The shortlist:`,
      `1. ${line(win)}${(win.p.poty ?? 0) > 1 ? ` (award number ${win.p.poty})` : ''}`,
      `2. ${line(second)}`,
      `3. ${line(third)}`,
      mine(win) ? `He is YOURS. The whole sport just watched your man collect its biggest prize - enjoy the market circling him, because it starts tomorrow.`
        : mine(second) || mine(third) ? `One of yours made the podium. The scouts noticed; so did his agent.`
        : `The bar for next season is set.`,
    ].join('\n'),
    k: 'news.poty',
    v: {
      player: win.p.name,
      rows_ll: JSON.stringify([row(win, 1), row(second, 2), row(third, 3)]),
      tail_k: mine(win) ? 'news.potyYours'
        : mine(second) || mine(third) ? 'news.potyPodium' : 'news.potyBar',
    },
    playerId: win.p.id,
  })
  // and the fifteen, on the same night, off the same season (yearend.ts)
  runTeamOfTheYear(state, win.p.id)
}

export function settleRecords(state: GameState) {
  state.records ??= {}
  for (const comp of Object.values(state.comps)) {
    if (comp.type !== 'league') continue
    const teamSet = new Set(comp.teamIds)
    const pool = Object.values(state.players).filter(p => p.clubId && teamSet.has(p.clubId) && p.stats.apps >= 6)
    if (!pool.length) continue
    const topP = [...pool].sort((a, b) => b.stats.points - a.stats.points)[0]
    const topT = [...pool].sort((a, b) => b.stats.tries - a.stats.tries)[0]
    const rec = state.records[comp.id] ??= {
      pts: { name: topP.name, val: topP.stats.points, season: state.season },
      tries: { name: topT.name, val: topT.stats.tries, season: state.season },
    }
    const userLeague = state.clubs[state.userClubId]?.leagueId === comp.id
    if (topP.stats.points > rec.pts.val && rec.pts.season !== state.season) {
      if (userLeague) state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
        subject: `RECORD BROKEN: most points in a ${comp.short} season`,
        body: `${topP.name} finishes with ${topP.stats.points} points - beating ${rec.pts.name}'s record of ${rec.pts.val} (${seasonLabel(rec.pts.season)}). The record book gets a new page.`,
        k: 'news.recPoints',
        v: { comp: comp.short, name: topP.name, n: topP.stats.points, old: rec.pts.name, oldN: rec.pts.val, season: seasonLabel(rec.pts.season) },
        playerId: topP.id,
      })
      state.records[comp.id].pts = { name: topP.name, val: topP.stats.points, season: state.season }
    }
    if (topT.stats.tries > rec.tries.val && rec.tries.season !== state.season) {
      if (userLeague) state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
        subject: `RECORD BROKEN: most tries in a ${comp.short} season`,
        body: `${topT.name} crosses ${topT.stats.tries} times - past ${rec.tries.name}'s ${rec.tries.val} (${seasonLabel(rec.tries.season)}). Wingers everywhere take note.`,
        k: 'news.recTries',
        v: { comp: comp.short, name: topT.name, n: topT.stats.tries, old: rec.tries.name, oldN: rec.tries.val, season: seasonLabel(rec.tries.season) },
        playerId: topT.id,
      })
      state.records[comp.id].tries = { name: topT.name, val: topT.stats.tries, season: state.season }
    }
  }
}

/** The year's best moment, replayed: the try judged most dramatic at the
 *  whistle all season gets its own award night, commentary line and all. */
export function tryOfTheSeason(state: GameState) {
  // note: the ledger is not cleared here - the season review captures it
  // further down rebuildSeason, and the clear happens at the very end
  const t = state.tryOfSeason
  if (!t || t.season !== state.season) return
  const scorer = state.players[t.playerId]
  const club = state.clubs[state.userClubId]
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
    subject: `Try of the Season: ${t.name}`,
    body: [
      `The supporters' vote was not close. ${t.name}'s ${ordinal(t.min)}-minute score against ${t.opp} is the ${club.name} Try of the Season.`,
      `As it sounded at the time: "${t.text}"`,
      scorer && scorer.clubId === state.userClubId
        ? `He collects the award at the end-of-season dinner to the loudest cheer of the night.`
        : `He is not at the club to collect it, which makes the ovation longer, not shorter.`,
    ].join('\n'),
    k: 'news.tryOfSeason',
    v: {
      player: t.name, min_o: t.min, opp: t.opp, club: club.name, text: t.text,
      // the commentary line in the reader's language (i18n _j); the English
      // stays as the fallback (1.8.5 career QA: "TRY! Quick tap by..." in French)
      ...(typeof t.tj === 'string' ? { text_j: t.tj } : {}),
      tail_k: scorer && scorer.clubId === state.userClubId ? 'news.totsHere' : 'news.totsGone',
    },
    playerId: t.playerId,
  })
}

/** Scripted challenges are won at a season's end, and the game says so.
 *  Exported for scripts/challengetest, which forges the end-of-season states a
 *  two-season audit will never reach on its own - the same reason
 *  invinciblesCheck is exported below. */
export function challengeCheck(state: GameState) {
  const ch = state.challenge
  // a challenge is completed by the manager, not by his old club: userClubId
  // still names the club that sacked him, so without this a man out of work
  // could collect the badge for what his successor did there
  if (!ch || state.unemployed) return
  const uid = state.userClubId
  const prev = state.season - 1 // the season just completed
  const wonEver = (compId: string) => state.history.some(h => h.champion === uid && h.compId === compId)
  const done =
    ch === 'sapiac' ? uid === 'montauban' && state.clubs[uid]?.leagueId === 'top14'
    : ch === 'redbull' ? uid === 'newcastle' && state.history.some(h => h.season === prev && h.compId === 'prem' && h.champion === uid)
    : ch === 'dynasty' ? uid === 'munster' && wonEver('urc') && wonEver('cc')
    : ch === 'pirates' ? uid === 'pirates' && state.clubs[uid]?.leagueId === 'prem'
    // the women's four. Same four shapes: win it, win it twice, climb out of
    // the bottom, win the division below.
    // STOP THE CIRCUS (1.5.8). Winning the title once while Gloucester have a
    // bad year is not stopping anything, so the badge asks for the other half
    // of it too: a winning record against them across this tenure. vsBook is
    // the manager's own book at this club (season.ts), wiped when he moves, so
    // it cannot be inherited from a career somewhere else.
    // If the two have never met - they went down, the leagues never crossed -
    // the title alone settles it. A challenge that can become unwinnable
    // through no act of the manager's is a bug wearing a badge.
    : ch === 'threepeat' ? uid === W + 'saracens' && wonEver(W + 'pwr') && (() => {
      const rec = state.vsBook?.[W + 'glosharty']
      return rec ? rec.w > rec.l : true
    })()
    : ch === 'ealing' ? uid === W + 'trailfinders'
      && state.history.filter(h => h.champion === uid && h.compId === W + 'pwr').length >= 2
    // no relegation to survive, so the licence is the thing at risk and a
    // play-off place is what answers it. The annal carries the finish; the
    // club name keeps a later job at another club from settling this one.
    : ch === 'licence' ? uid === W + 'sale'
      && (state.annals ?? []).some(a => a.clubName === state.clubs[uid]?.name && a.league.pos <= 4)
    : ch === 'grudge' ? uid === W + 'lichfield' && wonEver(W + 'champ')
    : false
  if (!done) return
  state.challenge = undefined
  ;(state.challengesDone ??= []).push(ch)
  const title = tIn('en', CHALLENGES.find(c => c.id === ch)?.title ?? ch)
  const lineKey =
    // EVERY CHALLENGE GETS ITS OWN LINE. This chain stopped at the men's four
    // and fell through to Penzance, so all four women's badges announced
    // themselves with "Cornwall has a top-flight club at last" - a sentence
    // about a club that does not exist in that world.
    ch === 'sapiac' ? 'news.chalSapiac'
    : ch === 'redbull' ? 'news.chalRedbull'
    : ch === 'dynasty' ? 'news.chalDynasty'
    : ch === 'threepeat' ? 'news.chalCircus'
    : ch === 'ealing' ? 'news.chalEaling'
    : ch === 'licence' ? 'news.chalLicence'
    : ch === 'grudge' ? 'news.chalGrudge'
    : 'news.chalPirates'
  const line = tIn('en', lineKey)
  state.news.push({
    id: state.nextId++, week: 1, season: state.season, type: 'award', read: false,
    subject: `CHALLENGE COMPLETE: ${title}`,
    body: `${line}\n\nThe badge goes on your profile, forever. Whatever happens next, nobody can take this one away.`,
    k: 'news.challengeDone',
    v: { title_k: CHALLENGES.find(c => c.id === ch)?.title ?? ch, line_k: lineKey },
  })
  // the full-screen moment - deliberately after promotion sets its own, so
  // the rarer achievement wins the confetti
  const chalTitleK = CHALLENGES.find(c => c.id === ch)?.title ?? ch
  state.celebration = {
    headline: tIn('en', 'cel.challenge'),
    sub: tIn('en', 'cel.challengeSub', { title_k: chalTitleK, manager: state.managerName }),
    icon: 'award',
    hk: 'cel.challenge',
    sk: 'cel.challengeSub', sv: { title_k: chalTitleK, manager: state.managerName },
  }
}

/** A whole competitive season unbeaten (16C). Checked at rollover while the
 *  fixtures still exist; at least 15 competitive games so a cup-only stub or
 *  a half-imported save cannot claim it. Exported for scripts/unbeatenprobe. */
export function invinciblesCheck(state: GameState) {
  const club = state.clubs[state.userClubId]
  if (!club) return
  const mine = state.fixtures.filter(f =>
    f.played && f.compId !== 'fr' && (f.homeId === club.id || f.awayId === club.id))
  if (mine.length < 15) return
  const losses = mine.filter(f =>
    (f.homeId === club.id ? f.homeScore < f.awayScore : f.awayScore < f.homeScore)).length
  if (losses > 0) return
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
    subject: `THE INVINCIBLES: ${club.name} finish the season unbeaten`,
    body: `${mine.length} competitive matches. Zero defeats. Whatever else this club ever does, this season now lives outside the record books, in the place where the game keeps its legends. They will name teams after this side. ${state.managerName} built the team nobody could beat.`,
    k: 'news.invincibles', v: { club: club.name, n: mine.length, manager: state.managerName },
  })
  state.celebration = {
    headline: tIn('en', 'cel.invincibles'),
    sub: tIn('en', 'cel.invinciblesSub', { club: club.name, manager: state.managerName }),
    icon: 'shield',
    hk: 'cel.invincibles',
    sk: 'cel.invinciblesSub', sv: { club: club.name, manager: state.managerName },
  }
}
