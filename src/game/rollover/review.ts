// The season judged: the rival's year, the manager's season in review and
// the awards dinner, and the board's verdict against its objective.
import { rivalVerdict } from '../boss'
import { demandedFinish } from '../chairman'
import { dreamState } from '../dream'
import { tIn, type Vars } from '../i18n'
import { boardPatience, fmtMoney, seasonLabel, type GameState, type NewsItem, type Player } from '../model'
import { objectiveBonus, objectiveById } from '../objectives'
import { clamp } from '../rng'
import { sortTable } from '../schedule'
import { boardPriorityF } from '../seasonplan'
import { ordinal } from './format'

/** The rival's year, settled (C3). Read at the top of the rollover, before
 *  the leagues are rebuilt empty. */
export function rivalYearVerdict(state: GameState) {
  const v = rivalVerdict(state)
  if (v) {
    state.news.push({
      id: state.nextId++, week: 1, season: state.season + 1, type: 'general', read: false,
      subject: tIn('en', `${v.k}Subj`, v.v), body: tIn('en', v.k, v.v),
      k: v.k, v: v.v,
    })
  }
}

/** The manager's season in review - a proper full-time moment. */
export function managerSeasonReview(state: GameState) {
  if (!state.unemployed) {
    const uid = state.userClubId
    const uf = state.fixtures.filter(f => f.played && (f.homeId === uid || f.awayId === uid))
    let w = 0, d = 0, l = 0
    let best: { diff: number; line: string } | null = null
    for (const f of uf) {
      const us = f.homeId === uid ? f.homeScore : f.awayScore
      const them = f.homeId === uid ? f.awayScore : f.homeScore
      if (us > them) w++; else if (us < them) l++; else d++
      const diff = us - them
      if (us > them && (!best || diff > best.diff)) {
        best = { diff, line: `${state.clubs[f.homeId]?.short ?? f.homeId} ${f.homeScore}-${f.awayScore} ${state.clubs[f.awayId]?.short ?? f.awayId}` }
      }
    }
    const squad = state.clubs[uid].players.map(id => state.players[id]).filter(Boolean)
    const topPts = [...squad].sort((a, b) => b.stats.points - a.stats.points)[0]
    const topTry = [...squad].sort((a, b) => b.stats.tries - a.stats.tries)[0]
    let predLine = ''
    /** the same line as a KEY, so it is not English in a French inbox */
    let predRow: Record<string, unknown> | null = null
    const predicted = state.preds?.[uid]
    const myComp = state.comps[state.clubs[uid].leagueId]
    const actualPos = myComp ? sortTable(myComp.table).findIndex(r => r.teamId === uid) + 1 : 0
    if (predicted && myComp && actualPos > 0) {
      predLine = `Pundits predicted ${actualPos < predicted ? `${ordinal(predicted)} - you finished ${ordinal(actualPos)}. They owe you an apology.`
        : actualPos === predicted ? `${ordinal(predicted)} - and ${ordinal(actualPos)} it was. Read like a book.`
        : `${ordinal(predicted)} - you finished ${ordinal(actualPos)}. The phone-ins will be brutal.`}`
      // THE ENGLISH ABOVE IS THE FALLBACK BODY ONLY. It used to be handed
      // straight into v.pred, so a French career read three lines of French and
      // then "Pundits predicted 4th..." in English. frliveprobe found it the
      // moment the calendar change made the prediction fire in its run.
      predRow = {
        k: actualPos < predicted ? 'news.srPredBeat'
          : actualPos === predicted ? 'news.srPredExact' : 'news.srPredMiss',
        pred_o: predicted, act_o: actualPos,
      }
    }

    // structured snapshot for the one-page Season Review screen
    const leagueFx = uf.filter(f => f.compId === state.clubs[uid].leagueId && !f.stage)
    let lw = 0, ld = 0, ll = 0
    for (const f of leagueFx) {
      const us = f.homeId === uid ? f.homeScore : f.awayScore
      const them = f.homeId === uid ? f.awayScore : f.homeScore
      if (us > them) lw++; else if (us < them) ll++; else ld++
    }
    const stageRank: Record<string, number> = { BAR: 0, R16: 1, QF: 2, SF: 3, F: 4 }
    const stageWord: Record<string, string> = { BAR: 'playoff barrage', R16: 'last-16 exit', QF: 'quarter-final exit', SF: 'semi-final exit', F: 'Runners-up' }
    const cupRuns: { comp: string; result: string }[] = []
    for (const comp of Object.values(state.comps)) {
      if (comp.type === 'league') continue
      const mine = state.fixtures.filter(f => f.compId === comp.id && f.played && (f.homeId === uid || f.awayId === uid))
      if (!mine.length || !state.clubs[mine[0].homeId]) continue
      const ko = mine.filter(f => f.stage).sort((a, b) => (stageRank[a.stage!] ?? 0) - (stageRank[b.stage!] ?? 0))
      const last = ko[ko.length - 1]
      let result = 'Pool stages'
      if (last) {
        const won = last.homeId === uid ? last.homeScore > last.awayScore : last.awayScore > last.homeScore
        result = last.stage === 'F' && won ? 'CHAMPIONS' : stageWord[last.stage!] ?? `${last.stage} exit`
      }
      cupRuns.push({ comp: comp.short, result })
    }
    const rated0 = squad.filter(p => p.stats.apps >= 8)
      .map(p => ({ p, avg: p.stats.ratingSum / Math.max(1, p.stats.apps) }))
      .sort((a, b) => b.avg - a.avg)[0]
    // the summer verdict from the terraces: silverware and overachievement
    // carry into next season's mood; a flop resets the goodwill
    const trophyCount = state.history.filter(h => h.season === state.season && h.champion === uid).length
    let moodShift = trophyCount * 18
    if (predicted && actualPos > 0) moodShift += (predicted - actualPos) * 3
    state.fanMood = clamp((state.fanMood ?? 60) * 0.6 + 55 * 0.4 + moodShift, 10, 95)

    const club0 = state.clubs[uid]
    state.review = {
      season: state.season,
      clubName: club0.name,
      league: { name: myComp?.name ?? '', pos: actualPos, predicted, w: lw, d: ld, l: ll },
      overall: { w, d, l, m: uf.length, bestWin: best?.line },
      cups: cupRuns,
      topPoints: topPts?.stats.points ? { name: topPts.name, val: topPts.stats.points } : undefined,
      topTries: topTry?.stats.tries ? { name: topTry.name, val: topTry.stats.tries } : undefined,
      bestAvg: rated0 ? { name: rated0.p.name, val: Math.round(rated0.avg * 100) / 100 } : undefined,
      tryOfSeason: state.tryOfSeason && state.tryOfSeason.season === state.season
        ? { name: state.tryOfSeason.name, min: state.tryOfSeason.min, opp: state.tryOfSeason.opp }
        : undefined,
      balanceDelta: club0.balance - (state.finHist?.[0]?.b ?? club0.balance),
      confidence: club0.boardConfidence,
      trophies: state.history.filter(h => h.season === state.season && h.champion === uid).map(h => state.comps[h.compId]?.name ?? h.compId),
    }
    // the annals: the career chronicle, one entry per season, oldest first
    ;(state.annals ??= []).push(state.review)
    if (state.annals.length > 30) state.annals = state.annals.slice(-30)

    // the era: anniversaries are marked, and long loyal service with
    // silverware makes you part of the club's furniture forever
    {
      const tenure = state.season - (state.tenureStart ?? state.season) + 1
      const era = (state.annals ?? []).filter(a => a.clubName === club0.name).slice(-tenure)
      const eraW = era.reduce((s, a) => s + a.overall.w, 0)
      const eraL = era.reduce((s, a) => s + a.overall.l, 0)
      const eraCups = era.reduce((s, a) => s + a.trophies.length, 0)
      if ([5, 10, 15, 20, 25].includes(tenure)) {
        state.news.push({
          id: state.nextId++, week: 1, season: state.season + 1, type: 'award', read: false,
          subject: `${tenure} years at ${club0.name}`,
          body: `The club marks your ${tenure}th season in charge: ${eraW} wins, ${eraL} defeats and ${eraCups} ${eraCups === 1 ? 'trophy' : 'trophies'} in the era. The programme runs a retrospective; the chairman makes a speech; the fixture list, as ever, does not care. On we go.`,
          k: 'news.tenure',
          v: { n: tenure, n_o: tenure, club: club0.name, w: eraW, l: eraL, cups: eraCups,
               cup_k: eraCups === 1 ? 'news.trophyOne' : 'news.trophyMany' },
        })
      }
      state.legendOf ??= []
      if (tenure >= 8 && eraCups >= 3 && !state.legendOf.includes(club0.id)) {
        state.legendOf.push(club0.id)
        state.fanMood = clamp((state.fanMood ?? 60) + 10, 5, 98)
        state.news.push({
          id: state.nextId++, week: 1, season: state.season + 1, type: 'award', read: false,
          subject: `CLUB LEGEND: the supporters claim you as their own`,
          body: `${tenure} seasons. ${eraCups} trophies. The supporters' trust has voted unanimously: you are a legend of ${club0.name}, whatever happens from here. There is talk of a statue outside ${club0.stadium}, and the artist has already asked how you would like to be posed. Results can dip; this cannot be taken away.`,
          k: 'news.clubLegend',
          v: { n: tenure, cups: eraCups, club: club0.name, stadium: club0.stadium },
        })
      }
    }
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
      subject: `Your ${seasonLabel(state.season)} season in review`,
      body: [
        `Record: ${w}W ${d}D ${l}L from ${uf.length} matches.`,
        best ? `Best win: ${best.line}` : '',
        topPts?.stats.points ? `Top points: ${topPts.name} (${topPts.stats.points})` : '',
        topTry?.stats.tries ? `Top tries: ${topTry.name} (${topTry.stats.tries})` : '',
        predLine,
      ].filter(Boolean).join('\n'),
      k: 'news.seasonReview',
      v: {
        season: seasonLabel(state.season),
        rows_ll: JSON.stringify([
          { k: 'news.srRecord', w, d, l, m: uf.length },
          ...(best ? [{ k: 'news.srBest', line: best.line }] : []),
          ...(topPts?.stats.points ? [{ k: 'news.srPoints', name: topPts.name, n: topPts.stats.points }] : []),
          ...(topTry?.stats.tries ? [{ k: 'news.srTries', name: topTry.name, n: topTry.stats.tries }] : []),
          ...(predRow ? [predRow] : []),
        ]),
      },
    })

    // the end-of-season awards dinner - black tie, white wine, in-jokes
    const rated = squad.filter(p => p.stats.apps >= 8)
    if (rated.length >= 3) {
      const avgR = (p: Player) => p.stats.ratingSum / Math.max(1, p.stats.apps)
      const poty = [...rated].sort((a, b) => avgR(b) - avgR(a))[0]
      const young = [...rated].filter(p => p.age <= 22).sort((a, b) => avgR(b) - avgR(a))[0]
      const tryKing = [...rated].sort((a, b) => b.stats.tries - a.stats.tries)[0]
      for (const w of [poty, young, tryKing]) {
        if (w) w.morale = clamp(w.morale + 0.8, 1, 10)
      }
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
        subject: `Club awards night: ${poty.name} sweeps the room`,
        body: [
          `The season ends the way it should - the whole squad in one room, telling lies about each other.`,
          ``,
          `Player of the Season: ${poty.name} (avg ${avgR(poty).toFixed(2)})`,
          young ? `Young Player of the Season: ${young.name} (${young.age})` : '',
          tryKing.stats.tries > 0 ? `Top Try Scorer: ${tryKing.name} (${tryKing.stats.tries})` : '',
        ].filter(Boolean).join('\n'),
        k: 'news.awardsNight',
        v: {
          player: poty.name,
          rows_ll: JSON.stringify([
            { k: 'news.anPoty', name: poty.name, avg: avgR(poty).toFixed(2) },
            ...(young ? [{ k: 'news.anYoung', name: young.name, age: young.age }] : []),
            ...(tryKing.stats.tries > 0 ? [{ k: 'news.anTries', name: tryKing.name, n: tryKing.stats.tries }] : []),
          ]),
        },
        playerId: poty.id,
      })
    }
  }
}

/** The board's verdict on the season against its stated objective, and the
 *  secondary objectives. Returns the final position, the title and the
 *  objective money, which are settled after the budget refresh. */
export function boardVerdict(state: GameState): { userFinishPos: number; userWonLeague: boolean; objBonus: number } {
  let userFinishPos = 0
  let userWonLeague = false
  let objBonus = 0
  if (!state.unemployed) {
    const club = state.clubs[state.userClubId]
    const comp = state.comps[club.leagueId]
    if (comp) {
      const pos = sortTable(comp.table).findIndex(r => r.teamId === club.id) + 1
      state.mgr.finishes.push({ season: state.season, leagueId: club.leagueId, pos, clubId: club.id })
      const obj = demandedFinish(state, club.id, comp.table.length)
      const wonLeague = comp.champion === club.id
      userFinishPos = pos
      userWonLeague = wonLeague
      const met = wonLeague || (pos > 0 && pos <= obj.pos)
      // PATIENCE SCALES WITH STATURE (wave 2, same curve boardReaction and the
      // half-term check use). The trophy itself still lands the same flat +25
      // everywhere - winning the whole league is exceptional at any club, so it
      // is not rescaled - but missing the target now costs a giant roughly 60%
      // MORE than the old flat -14 (rep 93: -23) and a minnow roughly 40% LESS
      // (rep 38: -8), because the same shortfall means something different at
      // each end. Clearing the target without winning outright runs the other
      // way: a modest target cleared buys a small club noticeably more than
      // the old flat +12 (rep 38: +16), and a demanding target barely cleared
      // buys a giant noticeably less (rep 93: +7) - it was only ever the floor.
      const patienceF = boardPatience(club.rep)
      // and louder or quieter as the manager ranked the league in his season
      // plan (seasonplan.ts); exactly 1 with no plan
      const prioF = boardPriorityF(state, club.leagueId)
      const delta = Math.round((wonLeague ? 25 : met ? Math.round(12 * (1.65 - patienceF * 0.65)) : -Math.round(14 * patienceF)) * prioF)
      club.boardConfidence = clamp(club.boardConfidence + delta, 5, 100)
      // THE DREAM'S MAY VERDICT. Stamped here rather than where state.review is
      // built, because the review is assembled BEFORE this season's finish and
      // trophies are on the record - snapshot it up there and a title-winning
      // season would report no progress towards a dream about titles.
      if (state.review) {
        const d = dreamState(state)
        if (d) {
          const prev = state.annals && state.annals.length > 1
            ? state.annals[state.annals.length - 2]?.dream?.at ?? null : null
          state.review.dream = {
            // The English AND the keys. The review is kept for the life of the
            // career, so it renders through the keys - and the English is what
            // a review written before dreams carried keys still reads back.
            title: d.title,
            titleK: d.titleK,
            titleV: d.titleV,
            note: tIn('en', d.progress.noteK, d.progress.noteV),
            noteK: d.progress.noteK,
            noteV: d.progress.noteV,
            at: d.progress.at,
            goal: d.progress.goal,
            done: d.progress.done,
            moved: prev != null ? d.progress.at - prev : null,
          }
          // THE REFOCUS INVITATION (v1.1.5, owner: "if you achieve your dream
          // do you get to refocus and pick a new one at the end of season?").
          // A realised dream is written into the honour roll ONCE, and the
          // letter says a new one may be named (Legacy screen). An unrealised
          // dream is untouched - nothing anywhere resets it.
          if (d.progress.done && state.dream &&
              !(state.dreamsDone ?? []).some(x => x.id === state.dream!.id)) {
            ;(state.dreamsDone ??= []).push({ ...state.dream })
            const v = { dream_k: d.def.titleLowerK, ...(d.titleV ?? {}) }
            state.news.push({
              id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
              subject: tIn('en', 'news.dreamRefocusSubj'),
              body: tIn('en', 'news.dreamRefocus', v),
              k: 'news.dreamRefocus', v,
            })
          }
        }
      }
      // secondary objectives: side quests with real consequences
      const sideLines: string[] = []
      const sideRows: Vars[] = []
      const paidNews: NewsItem[] = []
      for (const id of state.objectives ?? []) {
        const def = objectiveById(id)
        if (!def || !def.applies(state)) continue
        const ok = def.met(state)
        // the continental brief is weighed as the plan ranked that cup
        const objF = id === 'cup' ? boardPriorityF(state, 'cc') : 1
        club.boardConfidence = clamp(club.boardConfidence + (ok ? 5 : -4) * objF, 5, 100)
        // what it is worth to THIS club, not a flat figure that is four per
        // cent of one budget and six times another (objectives.objectiveBonus)
        const bonus = objectiveBonus(club.budget)
        if (ok) { objBonus += bonus; state.boardOwed = true }
        sideLines.push(`${tIn('en', def.textKey(state))}${ok ? ` - met (+${fmtMoney(bonus)} budget)` : ' - missed'}`)
        sideRows.push({ k: ok ? 'news.sideMet' : 'news.sideMissed', text_k: def.textKey(state), amount: fmtMoney(bonus) })
        // ONE SHORT LINE FOR EACH BRIEF MET (owner, round 5): a banked one had
        // its line the week it came true (season.ts, objDone); one that only
        // settles now gets it now, with what it earned.
        if (ok && !(state.objDone ?? []).includes(id)) {
          const v = { head_k: `${def.textKey(state)}Head`, amount: fmtMoney(bonus) }
          paidNews.push({
            id: 0, week: state.week, season: state.season, type: 'board', read: false,
            subject: tIn('en', 'news.objPaidMaySubj', v), body: tIn('en', 'news.objPaidMay', v),
            k: 'news.objPaidMay', v,
          })
        }
      }
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
        subject: met ? 'Board delighted with the season' : 'Board verdict: not good enough',
        body: `The objective was to ${tIn('en', obj.text)}. You finished ${ordinal(pos)}${wonLeague ? ' and won the title' : ''}. ${met
          ? 'The chairman shakes your hand warmly - keep building.'
          : 'The chairman expects markedly better next season.'}${sideLines.length ? '\n\n' + sideLines.join('\n') : ''}`,
        k: met ? 'news.boardHappy' : 'news.boardUnhappy',
        v: {
          aim_k: obj.text, pos_o: pos,
          title_k: wonLeague ? 'news.wonTitleToo' : 'common.nothing',
          side_k: sideRows.length ? 'news.sideList' : 'common.nothing',
          rows_ll: JSON.stringify(sideRows),
        },
      })
      // after the verdict, so the inbox reads the season and then its briefs
      for (const n of paidNews) state.news.push({ ...n, k: n.k, id: state.nextId++ })
    }
  }
  return { userFinishPos, userWonLeague, objBonus }
}
