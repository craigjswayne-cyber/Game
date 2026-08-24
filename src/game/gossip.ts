// The Rugby Wire - rumours, fallouts, terrace talk and agent whispers.
// A living-world feed so there is always something happening between matches.

import type { GameState, Player } from './model'
import { RELEGATES, SEASON_WEEKS, fmtMoney, formGuide, mgrReputation, poss } from './model'
import { sortTable } from './schedule'
import { clamp, gauss, pick, type Rng } from './rng'
import { tIn, type Vars } from './i18n'

/** File a Wire story.
 *
 *  The key is the story and it is REQUIRED - that is the point of the
 *  signature. The English subject and body are RENDERED FROM THE DICTIONARY
 *  rather than passed in, so there is one copy of every sentence instead of two
 *  that drift apart, and the stored English the engine reads back (gossip
 *  dedupes on the community-day subject, media.ts looks for "joins {club}")
 *  stays exactly what it always was.
 *
 *  There is no way to file a Wire story without a key, which is deliberate: the
 *  compiler is a better reminder than a probe, and a better one still than
 *  hoping somebody remembers. */
function wire(state: GameState, k: string, v: Vars, playerId?: number) {
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'gossip',
    read: false,
    subject: tIn('en', `${k}Subj`, v),
    body: tIn('en', k, v),
    k, v, playerId,
  })
}

// deterministic voicing: the same story wears different words from week to
// week without drawing on the shared rng, so the world stream is untouched.
// The options are KEYS now - picking the wording and picking the language are
// different questions, and this one only answers the first.
const voice = (state: GameState, salt: number, opts: string[]) =>
  opts[(state.season * 5 + state.week * 3 + salt) % opts.length]

/** Personality pairs that rub each other the wrong way. */
const CLASHES: [string, string][] = [
  ['Temperamental', 'Leader'],
  ['Temperamental', 'Professional'],
  ['Mercenary', 'Loyal'],
  ['Ambitious', 'Ambitious'],
  ['Temperamental', 'Temperamental'],
]

export interface Feud {
  a: number
  b: number
  week: number
  /** the week the manager last tried to broker peace, if he has */
  tried?: number
}

/** Active feuds ride along in state via a soft field. */
export function activeFeuds(state: GameState): Feud[] {
  return feuds(state).filter(f => {
    const a = state.players[f.a]
    const b = state.players[f.b]
    return a && b && a.clubId === state.userClubId && b.clubId === state.userClubId
  })
}

/** How likely the manager is to broker peace, 0-1.
 *
 *  It comes down to whether these two will do it for HIM, which is the whole
 *  point: a manager the room respects can end a rift with a conversation, and one
 *  it does not will make it worse by trying. So the odds read the two men's mood,
 *  their characters, and the manager's standing at the club.
 *
 *  Nothing is a certainty. Even at the top of the range it can fail, because a
 *  guaranteed button is not a decision. */
export function reconcileChance(state: GameState, f: Feud): number {
  const a = state.players[f.a]
  const b = state.players[f.b]
  const club = state.clubs[state.userClubId]
  if (!a || !b || !club) return 0
  const mood = ((a.morale + b.morale) / 2 - 5) * 0.045       // ±0.22 across the range
  const standing = (club.boardConfidence - 55) * 0.0035      // the room reads the table too
  // and who is asking: a manager with silverware and a winning record gets the
  // benefit of the doubt in a room that a novice does not
  const rep = mgrReputation(state) >= 70 ? 0.07 : mgrReputation(state) >= 55 ? 0.03 : 0
  const hard = [a, b].filter(p => p.pers === 'Temperamental' || p.pers === 'Mercenary').length * 0.09
  const easy = [a, b].filter(p => p.pers === 'Professional' || p.pers === 'Leader' || p.pers === 'Loyal').length * 0.07
  // a rift that has festered for weeks is harder to unpick than a fresh one
  const stale = Math.min(0.12, Math.max(0, state.week - f.week - 2) * 0.02)
  return clamp(0.5 + mood + standing + rep + easy - hard - stale, 0.12, 0.88)
}

/** Get the two of them in a room. Returns what happened, in words.
 *
 *  One attempt a week: a manager who calls the same meeting every day is a
 *  manager nobody listens to, and it would turn a gamble into a grind. */
export function reconcileFeud(state: GameState, index: number, rng: Rng): { ok: boolean; msg: string } {
  const list = feuds(state)
  const f = activeFeuds(state)[index]
  if (!f) return { ok: false, msg: 'That rift has already settled.' }
  const a = state.players[f.a]
  const b = state.players[f.b]
  if (!a || !b) return { ok: false, msg: 'That rift has already settled.' }
  if (f.tried != null && state.week - f.tried < 1) {
    return { ok: false, msg: 'You had them in this week already. Give it seven days.' }
  }
  f.tried = state.week
  const p = reconcileChance(state, f)
  if (rng() < p) {
    const i = list.indexOf(f)
    if (i >= 0) list.splice(i, 1)
    a.morale = clamp(a.morale + 1.1, 1, 10)
    b.morale = clamp(b.morale + 1.1, 1, 10)
    wire(state, 'news.wPeaceBrokered',
      { a: a.name.split(' ').slice(-1)[0], b: b.name.split(' ').slice(-1)[0] }, a.id)
    return { ok: true, msg: `Handshakes. ${a.name} and ${b.name} will play together.` }
  }
  // a failed intervention is worse than none: now the room knows he tried
  a.morale = clamp(a.morale - 0.5, 1, 10)
  b.morale = clamp(b.morale - 0.5, 1, 10)
  wire(state, 'news.wTalksFail',
    { short: state.clubs[state.userClubId].short, a: a.name, b: b.name }, a.id)
  return { ok: false, msg: `${a.name} would not shake on it. That has cost you: the room knows you tried and failed.` }
}

function feuds(state: GameState): Feud[] {
  const s = state as GameState & { feuds?: Feud[] }
  s.feuds ??= []
  return s.feuds
}

function dressingRoomFallout(state: GameState, rng: Rng) {
  const active = feuds(state)

  // simmering feuds resolve or fester
  for (let i = active.length - 1; i >= 0; i--) {
    const f = active[i]
    const pa = state.players[f.a]
    const pb = state.players[f.b]
    if (!pa || !pb || pa.clubId !== state.userClubId || pb.clubId !== state.userClubId) {
      active.splice(i, 1)
      continue
    }
    if (state.week - f.week >= 2 && rng() < 0.5) {
      active.splice(i, 1)
      pa.morale = clamp(pa.morale + 0.8, 1, 10)
      pb.morale = clamp(pb.morale + 0.8, 1, 10)
      wire(state, voice(state, 21, ['news.wPeace1', 'news.wPeace2', 'news.wPeace3']),
        { a: pa.name, b: pb.name, aLast: pa.name.split(' ').slice(-1)[0], bLast: pb.name.split(' ').slice(-1)[0] }, pa.id)
    } else if (rng() < 0.25) {
      pa.morale = clamp(pa.morale - 0.4, 1, 10)
      pb.morale = clamp(pb.morale - 0.4, 1, 10)
      wire(state, voice(state, 22, ['news.wFrosty1', 'news.wFrosty2', 'news.wFrosty3']),
        { short: state.clubs[state.userClubId].short, a: pa.name, b: pb.name }, pa.id)
    }
  }

  // a new feud sparks
  if (active.length >= 1 || rng() > 0.055) return
  const squad = state.clubs[state.userClubId].players
    .map(id => state.players[id]).filter((p): p is Player => !!p && !p.onLoan)
  for (const [x, y] of rng() < 0.5 ? CLASHES : [...CLASHES].reverse()) {
    const as = squad.filter(p => p.pers === x)
    const bs = squad.filter(p => p.pers === y && !as.slice(0, 1).some(a => a.id === p.id))
    if (as.length && bs.length) {
      const a = pick(rng, as)
      const b = pick(rng, bs.filter(p => p.id !== a.id))
      if (!b) continue
      active.push({ a: a.id, b: b.id, week: state.week })
      a.morale = clamp(a.morale - 0.9, 1, 10)
      b.morale = clamp(b.morale - 0.9, 1, 10)
      const flash = pick(rng, [
        'a flashpoint in Tuesday\'s contact session',
        'a row over a missed defensive read',
        'a training-ground bust-up witnessed by the whole squad',
        'a disagreement that started at the gym and followed them onto the pitch',
      ])
      wire(state, 'news.wRift',
        { a: a.name, b: b.name, aLast: a.name.split(' ').slice(-1)[0], bLast: b.name.split(' ').slice(-1)[0],
          aPers_k: `pers.${a.pers}`, bPers_k: `pers.${b.pers}`, flash }, a.id)
      break
    }
  }
}

/** Tuesday-to-Thursday: the assistant's training report. */
function trainingReport(state: GameState, rng: Rng) {
  // fortnightly at most - a report every single week reads like spam
  if (state.week % 2 === 1 || rng() > 0.7) return
  const club = state.clubs[state.userClubId]
  const squad = club.players.map(id => state.players[id]).filter((p): p is Player => !!p && !p.injury && !p.acad)
  if (squad.length < 15) return
  const star = [...squad].sort((a, b) => b.form - a.form)[0]
  const pushing = [...squad]
    .filter(p => !club.tactic.lineup.slice(0, 15).includes(p.id) && p.form >= 6.5)
    .sort((a, b) => b.form - a.form)[0]
  const kid = club.players.map(id => state.players[id])
    .filter((p): p is Player => !!p && !!p.acad)
    .sort((a, b) => b.pa - a.pa)[0]
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
    subject: `📋 Training report, week ${state.week}`,
    body: [
      pick(rng, [
        `Best on the grass: ${star.name} - sharp all week.`,
        `${star.name} trained like the ball was on a string. Best of the week by a distance.`,
        `The staff vote for the week's best on the paddock was unanimous: ${star.name}.`,
        `${star.name} finished every drill first and every session smiling. Ominous for the opposition.`,
      ]),
      pushing ? pick(rng, [
        `Knocking on the door: ${pushing.name} is training like a man who wants the shirt.`,
        `${pushing.name} spent the week making the selection meeting awkward. Good.`,
        `If team sheets were picked on a Tuesday, ${pushing.name} starts this weekend.`,
      ]) : '',
      kid && rng() < 0.5 ? pick(rng, [
        `From the academy pitches: the coaches keep mentioning ${kid.name}. One for the notebook.`,
        `${kid.name} trained up with the seniors on Thursday and did not look out of place.`,
        `The academy staff have started staying late to watch ${kid.name}. That usually means something.`,
      ]) : '',
      state.matchPrep ? `Focus this week: ${state.matchPrep} work, as ordered.` : `No match preparation set - the week ran on autopilot.`,
    ].filter(Boolean).join('\n'),
    playerId: star.id,
  })
}

/** Small club moments - the life of a rugby town between matches. */
function midweekMoment(state: GameState, rng: Rng) {
  if (rng() > 0.22) return
  const club = state.clubs[state.userClubId]
  const squad = club.players.map(id => state.players[id]).filter((p): p is Player => !!p)
  const star = [...squad].sort((a, b) => b.ca - a.ca)[0]
  const roll = rng()
  const recentCommunity = state.news.some(n =>
    n.season === state.season && n.subject === `Community day at ${club.short}` && state.week - n.week < 10)
  if (roll < 0.3 && !recentCommunity) {
    for (const p of squad) p.morale = clamp(p.morale + 0.15, 1, 10)
    wire(state, voice(state, 27, ['news.wCommunity1', 'news.wCommunity2']), { short: club.short })
  } else if (roll < 0.5 && star) {
    star.morale = clamp(star.morale + 0.5, 1, 10)
    wire(state, voice(state, 28, ['news.wBoot1', 'news.wBoot2']),
      { player: star.name, last: star.name.split(' ').slice(-1)[0] }, star.id)
  } else if (roll < 0.7) {
    wire(state, voice(state, 29, ['news.wGround1', 'news.wGround2']), { stadium: club.stadium })
  } else if (roll < 0.85 && star) {
    wire(state, voice(state, 30, ['news.wAdvert1', 'news.wAdvert2']),
      { player: star.name, last: star.name.split(' ').slice(-1)[0] }, star.id)
  } else {
    const chef = ['a new nutritionist', 'a sleep consultant', 'a breathing coach', 'an ice-bath guru'][Math.floor(rng() * 4)]
    wire(state, voice(state, 31, ['news.wChef1', 'news.wChef2']), { short: club.short, chef })
  }
}

/** A bug goes round the training ground - bodies in beds, not on grass. */
function sicknessSweep(state: GameState, rng: Rng) {
  if (rng() > 0.045) return
  const squad = state.clubs[state.userClubId].players
    .map(id => state.players[id]).filter((p): p is Player => !!p && !p.injury)
  if (squad.length < 6) return
  const hit = [...squad].sort(() => rng() - 0.5).slice(0, 2 + Math.floor(rng() * 3))
  for (const p of hit) p.cond = clamp(p.cond - (12 + rng() * 10), 20, 100)
  wire(state, voice(state, 26, ['news.wBug1', 'news.wBug2', 'news.wBug3']),
    { names: hit.map(p => p.name.split(' ').slice(-1)[0]).join(', ') })
}

/** Money men circle the modern game - most of it is smoke, occasionally
 *  it's a takeover. */
function moneyMen(state: GameState, rng: Rng) {
  const t = state.takeover
  if (t) {
    const club = state.clubs[t.clubId]
    if (!club) { state.takeover = null; return }
    if (state.week - t.week < 2 || rng() > 0.5) return
    if (t.stage === 0) {
      state.takeover = { ...t, week: state.week, stage: 1 }
      wire(state, 'news.wTakeoverHardens', { short: club.short, club: club.name })
      return
    }
    // resolution: most collapse, some complete - and not every buyer
    // arrives with a chequebook. A few arrive with accountants.
    state.takeover = null
    if (rng() < 0.3) {
      if (rng() < 0.25) {
        club.budget = Math.round(club.budget * 0.5)
        club.wageBudget = Math.round(club.wageBudget * 0.92)
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
          subject: `📉 TAKEOVER COMPLETE: belts tighten at ${club.name}`,
          body: club.id === state.userClubId
            ? `The deal is done - and the new owners' first act is an audit, their second a memo. Your transfer budget is cut to ${fmtMoney(club.budget)} and every contract will be "reviewed for value". Sell before you buy, and expect the new chairman to watch every result.`
            : `${club.name}'s new owners have arrived with accountants, not ambition. Expect their best players to be quietly available - at the right price.`,
          k: club.id === state.userClubId ? 'news.takeoverTightMine' : 'news.takeoverTight',
          v: { club: club.name, budget: fmtMoney(club.budget) },
        })
      } else {
        const boost = 4_000_000 + Math.round(rng() * 10_000_000 / 500_000) * 500_000
        club.budget += boost
        club.balance += Math.round(boost * 0.6)
        club.wageBudget = Math.round(club.wageBudget * 1.12)
        club.rep = clamp(club.rep + 2, 30, 95)
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
          subject: `🤝 TAKEOVER COMPLETE: new owners at ${club.name}`,
          body: club.id === state.userClubId
            ? `It's done. Your new owner walks the training ground on day one and leaves a message with your secretary: the transfer budget is up ${fmtMoney(boost)}, the wage ceiling is raised - and mediocrity is no longer on the menu. The next two months are your audition.`
            : `It's done. The consortium has completed its purchase of ${club.name} and immediately pledged fresh investment. The rest of the league takes note: ${club.short} just became dangerous in the market.`,
          k: club.id === state.userClubId ? 'news.takeoverRichMine' : 'news.takeoverRich',
          v: { club: club.name, short: club.short, boost: fmtMoney(boost) },
        })
      }
      // a new boss upstairs: the slate is half-wiped, and for two months
      // every result lands harder while he makes up his mind about you
      if (club.id === state.userClubId) {
        club.boardConfidence = 58
        state.newOwnerUntil = Math.min(state.week + 8, 45)
      }
    } else {
      wire(state, 'news.wTakeoverOff', { short: club.short, club: club.name })
    }
    return
  }
  if (rng() > 0.035) return
  const candidates = Object.values(state.clubs).filter(c => c.rep >= 55)
  if (!candidates.length) return
  const club = pick(rng, candidates)
  state.takeover = { clubId: club.id, week: state.week, stage: 0 }
  wire(state, 'news.wTakeoverCircle', { short: club.short, club: club.name })
}

/** Rumours live where deals live: the windows (weeks 1-4, 22-25). */
function windowOpen(state: GameState): boolean {
  return state.week <= 7 || (state.week >= 25 && state.week <= 28)
}

function transferRumour(state: GameState, rng: Rng) {
  const clubs = Object.values(state.clubs)
  const buyer = pick(rng, clubs.filter(c => c.rep >= 74))
  if (!buyer) return
  const targets = Object.values(state.players).filter(p =>
    p.clubId && p.clubId !== buyer.id && p.ca >= 78 && p.age <= 30 && !p.onLoan)
  if (!targets.length) return
  const t = pick(rng, targets)
  const owner = state.clubs[t.clubId!]
  const fee = Math.round(t.value * (1.1 + rng() * 0.5) / 100_000) * 100_000
  const line = pick(rng, ['news.wRumour1', 'news.wRumour2', 'news.wRumour3', 'news.wRumour4'])!
  wire(state, line, {
    player: t.name, buyer: buyer.short, buyerName: buyer.name, buyerCity: buyer.city,
    owner: owner.short, ownerPoss: poss(owner.short), buyerPoss: poss(buyer.short), fee: fmtMoney(fee),
  }, t.id)
  // being talked about turns some heads
  if (t.clubId === state.userClubId && (t.pers === 'Mercenary' || t.pers === 'Ambitious') && rng() < 0.5) {
    t.morale = clamp(t.morale - 0.5, 1, 10)
  }
}

function contractSaga(state: GameState, rng: Rng) {
  const squad = state.clubs[state.userClubId].players.map(id => state.players[id])
  const expiring = squad.filter(p => p && p.contractEnds <= state.season && p.ca >= 74)
  if (!expiring.length) return
  const p = pick(rng, expiring)!
  wire(state, voice(state, 23, ['news.wAgent1', 'news.wAgent2', 'news.wAgent3']), { player: p.name }, p.id)
}

function powerRankings(state: GameState) {
  const leagueId = state.clubs[state.userClubId].leagueId
  const comp = state.comps[leagueId]
  if (!comp || !comp.table.some(r => r.p > 0)) return
  const order = sortTable(comp.table).slice(0, 5)
  const lines = order.map((r, i) => {
    const c = state.clubs[r.teamId]
    const tagKey = i === 0 ? 'news.wRank1' : i === 1 ? 'news.wRank2'
      : i === 2 ? 'news.wRank3' : i === 3 ? 'news.wRank4' : 'news.wRank5'
    return { k: 'news.wRankLine', n: i + 1, club: c?.short ?? r.teamId, tag_k: tagKey }
  })
  wire(state, 'news.wPowerRankings', { rows_ll: JSON.stringify(lines) })
}

function streakWatch(state: GameState, rng: Rng) {
  const uid = state.userClubId
  // formGuide sorts by week, so the streak is the real last three and not the
  // last three in array order (appended cup rounds broke that on the Home pips)
  const results = formGuide(state, uid, 3)
  if (results.length < 3) return
  const club = state.clubs[uid]
  // ONE PULSE PER STREAK, NOT ONE PER WEEK OF IT (user: "the message about
  // belief from the terrace keeps coming up"). The beat used to fire on every
  // week of a run, so a seven-match streak read the same sermon five times.
  //
  // Two ways in, both deterministic on the stream:
  //   - the week the run BECOMES three (the result four games back is the
  //     other colour), with the three-on-the-spin voice;
  //   - a longer run that has gone unmentioned for four weeks - the first
  //     draft fired ONLY on the becoming-three week, and on a seed where the
  //     70% roll missed that one window a five-win streak passed in total
  //     silence, which is the opposite failure.
  // The rng draws below still happen exactly when they did - the gates read
  // state.news and the form guide, never the stream, so every match after
  // this week plays out identically.
  const four = formGuide(state, uid, 4)
  // A STAMP, NOT A NEWS SCAN - and the cooldown holds BOTH doors. Two bugs
  // lived here, found by instrumenting seed 2's repeat at weeks 41+42 after
  // the Saints data change re-dealt the calendar:
  //   - the gate read state.news for its own cooldown, and the log trims at
  //     NEWS_KEEP - the same lesson as memoprobe, stancecheck and LAW WATCH:
  //     a gate that reads the news log forgets whatever the log forgot first;
  //   - "fresh" (the run just became three) BYPASSED the cooldown, and fresh
  //     is derived from the form guide, which does not advance in a week the
  //     club plays no match - so a blank week after a becoming-three pulse
  //     re-announced the same third win with the same sermon.
  // A genuine new streak needs at least four match-weeks between same-subject
  // pulses (loss plus three wins), so the cooldown gating every door loses no
  // legitimate pulse; fresh now only picks the VOICE. The rng draw stays
  // exactly where it was, so the stream is untouched.
  const now = state.season * 100 + state.week
  const quietFor = (subj: string) => now - (state.pulseAt?.[subj] ?? -99) >= 4
  const stamp = (subj: string) => { (state.pulseAt ??= {})[subj] = now }
  if (results.every(r => r === 'W')) {
    const fire = rng() < 0.7
    const fresh = !(four.length === 4 && four[0] === 'W')
    const subj = `Terrace pulse: believers at ${club.short}`
    if (fire && quietFor(subj)) {
      stamp(subj)
      wire(state, fresh
        ? voice(state, 24, ['news.wWin1', 'news.wWin2', 'news.wWin3', 'news.wWin4', 'news.wWin5'])
        : voice(state, 26, ['news.wWinOn1', 'news.wWinOn2', 'news.wWinOn3']),
        { short: club.short, stadium: club.stadium, manager: state.managerName })
    }
  } else if (results.every(r => r === 'L')) {
    const fire = rng() < 0.8
    const fresh = !(four.length === 4 && four[0] === 'L')
    const subj = `Terrace pulse: grumbles at ${club.short}`
    if (fire && quietFor(subj)) {
      stamp(subj)
      wire(state, fresh
        ? voice(state, 25, ['news.wLose1', 'news.wLose2', 'news.wLose3', 'news.wLose4', 'news.wLose5'])
        : voice(state, 27, ['news.wLoseOn1', 'news.wLoseOn2', 'news.wLoseOn3']),
        { short: club.short, stadium: club.stadium, manager: state.managerName })
    }
  }
}

function wonderkidWatch(state: GameState, rng: Rng) {
  const kids = Object.values(state.players).filter(p =>
    p.clubId && p.age <= 21 && p.ca >= 62 && (p.ca - (p.ca0 ?? p.ca)) >= 2)
  if (!kids.length) return
  const k = pick(rng, kids)!
  const club = state.clubs[k.clubId!]
  wire(state, voice(state, 32, ['news.wKid1', 'news.wKid2', 'news.wKid3']), {
    player: k.name, age: k.age, pos: k.pos,
    club: club?.short ?? tIn('en', 'news.hisClub'),
    clubPoss: poss(club?.short ?? tIn('en', 'news.hisClub')),
  }, k.id)
}

/** Fringe stars want minutes: too good to sit, and they'll say so. */
function gameTimeGrumbles(state: GameState, rng: Rng) {
  if (state.week < 10 || state.week % 6 !== 0) return
  const squad = state.clubs[state.userClubId].players
    .map(id => state.players[id])
    .filter((p): p is Player => !!p && !p.onLoan && !p.injury)
  const bench = squad.filter(p =>
    p.ca >= 74 && p.age >= 23 && p.stats.starts < Math.max(2, Math.floor(state.week / 5)))
  if (!bench.length || rng() > 0.6) return
  const p = pick(rng, bench)!
  const swing = p.pers === 'Temperamental' ? 1.6 : p.pers === 'Ambitious' ? 1.3 : 1
  p.morale = clamp(p.morale - 0.7 * swing, 1, 10)
  const merc = p.pers === 'Mercenary'
  wire(state, voice(state, 33, ['news.wGrumble1', 'news.wGrumble2', 'news.wGrumble3']), {
    player: p.name, pos: p.pos,
    merc1_k: merc ? 'news.wMerc1' : 'common.nothing',
    merc2_k: merc ? 'news.wMerc2' : 'common.nothing',
    merc3_k: merc ? 'news.wMerc3' : 'common.nothing',
  }, p.id)
}

interface Take { id: string; k: string; who?: number }

/**
 * Which wire takes have been used, and when.
 *
 * Reported live, with a screenshot of the REF MIC story: "ive seen this a few
 * times - needs to be funnier messages - more humour for it to be a viral
 * sensation style thing."
 *
 * Both halves of that are real. The pool was nine items and the pick was
 * rng() * length, so the birthday problem did the rest: on a column that fires
 * four weeks in five, the same story came round inside a month and sometimes
 * twice in three weeks. A bigger pool alone would not fix it, because random
 * choice over any pool repeats. So the choice is now LEAST RECENTLY USED - every
 * take in the pool is spent before any is spent twice - and the pool is three
 * times the size.
 *
 * Keyed by a stable template id rather than by the finished subject line, because
 * the subject has a club and a player name baked into it and the same joke about
 * a different club is still the same joke.
 */
function wireLog(state: GameState): Record<string, number> {
  const s = state as GameState & { wireLog?: Record<string, number> }
  s.wireLog ??= {}
  return s.wireLog
}

/** Fan forums, social posts and pundit columns - cheap talk, every week.
 *
 *  The brief is the internet on a Monday: the sport is enormous and serious, and
 *  everything AROUND it is ridiculous. So every item has a turn in it. A story
 *  that only reports a thing is a filler item; a story where the last sentence
 *  undercuts the first is one somebody screenshots. */
function socialBuzz(state: GameState, rng: Rng) {
  const clubs = Object.values(state.clubs)
  const club = pick(rng, clubs)
  if (!club) return
  const squad = club.players.map(id => state.players[id]).filter((p): p is Player => !!p)
  const star = [...squad].sort((a, b) => b.ca - a.ca)[0]
  const kid = squad.filter(p => p.age <= 21).sort((a, b) => b.ca - a.ca)[0]
  const prop = squad.find(p => p.pos === 'LP' || p.pos === 'TP')
  const nine = squad.find(p => p.pos === 'SH')
  const other = pick(rng, clubs.filter(c => c.id !== club.id && c.rep >= club.rep - 8))
  const target = other ? [...other.players.map(id => state.players[id]).filter(Boolean)].sort((a, b) => b!.ca - a!.ca)[0] : null
  const last = (p: Player) => p.name.split(' ').slice(-1)[0]
  const takes: Take[] = []

  if (star) takes.push(
    { id: 'forum-exit', who: star.id, k: 'news.grForumExit' },
    { id: 'social-clip', who: star.id, k: 'news.grSocialClip' },
    { id: 'podcast-kebab', who: star.id, k: 'news.grPodcastKebab' },
    { id: 'ai-graphic', who: star.id, k: 'news.grAiGraphic' },
    { id: 'stat-account', k: 'news.grStatAccount' },
  )

  if (kid) takes.push(
    { id: 'pundit-gem', who: kid.id, k: 'news.grPunditGem' },
    { id: 'school-visit', who: kid.id, k: 'news.grSchoolVisit' },
    { id: 'kid-fifa', who: kid.id, k: 'news.grKidFifa' },
  )

  if (target && other) takes.push(
    { id: 'agent-flattered', who: target!.id, k: 'news.grAgentFlattered' },
    { id: 'forum-dream', who: target!.id, k: 'news.grForumDream' },
  )

  if (prop) takes.push(
    { id: 'ref-mic', k: 'news.grRefMic' },
    { id: 'prop-gym', who: prop.id, k: 'news.grPropGym' },
    { id: 'prop-marathon', who: prop.id, k: 'news.grPropMarathon' },
  )

  if (nine) takes.push(
    { id: 'nine-mic', who: nine.id, k: 'news.grNineMic' },
  )

  // and the ones that need nothing but a club
  takes.push(
    { id: 'kit-leak', k: 'news.grKitLeak' },
    { id: 'groundsman', k: 'news.grGroundsman' },
    { id: 'mascot', k: 'news.grMascot' },
    { id: 'announcer', k: 'news.grAnnouncer' },
    { id: 'pie', k: 'news.grPie' },
    { id: 'drone', k: 'news.grDrone' },
    { id: 'seagull', k: 'news.grSeagull' },
    { id: 'merch-typo', k: 'news.grMerchTypo' },
    { id: 'banner', k: 'news.grBanner' },
    { id: 'stream', k: 'news.grStream' },
    { id: 'sponsor', k: 'news.grSponsor' },
    { id: 'weather', k: 'news.grWeather' },
    { id: 'bus', k: 'news.grBus' },
    { id: 'quiz', k: 'news.grQuiz' },
    { id: 'cat', k: 'news.grCat' },
    { id: 'tmo', k: 'news.grTmo' },
    { id: 'kicker-net', k: 'news.grKickerNet' },
    // THE WILD ONES (16B, user: "weird and wonderful local rugby stories -
    // made up. just for fun. think wild"). House rule from the funeral
    // sponsor: every joke lands its punchline on the page.
    { id: 'sheep', k: 'news.grSheep' },
    { id: 'trophy-lost', k: 'news.grTrophyLost' },
    { id: 'postman', k: 'news.grPostman' },
    { id: 'dog-try', k: 'news.grDogTry' },
    { id: 'anthem', k: 'news.grAnthem' },
    { id: 'scrum-cafe', k: 'news.grScrumCafe' },
    { id: 'lineout-ladder', k: 'news.grLineoutLadder' },
    { id: 'fog-match', k: 'news.grFogMatch' },
  )

  if (!takes.length) return

  // LEAST RECENTLY USED, not random. Everything in the pool gets spent before
  // anything is spent twice, which is the only way "I have seen this a few times"
  // stops being true on a column that runs most weeks. Ties among the never-used
  // break on a rotation rather than a hash: a hash over a small candidate set
  // repeats back to back and a rotation cannot.
  const log = wireLog(state)
  const stamp = state.season * 100 + state.week
  const rot = (state.season * 7 + state.week) % takes.length
  const order = (i: number) => (i - rot + takes.length) % takes.length
  const chosen = takes
    .map((t, i) => ({ t, i }))
    .sort((a, b) => ((log[a.t.id] ?? -1) - (log[b.t.id] ?? -1)) || (order(a.i) - order(b.i)))[0].t
  log[chosen.id] = stamp
  wire(state, chosen.k, {
    short: club.short, shortPoss: poss(club.short), stadium: club.stadium,
    star: star?.name ?? '', starLast: star ? last(star) : '',
    kid: kid?.name ?? '', kidAge: kid?.age ?? 0, kidPos: kid?.pos ?? '', kidLast: kid ? last(kid) : '',
    target: target?.name ?? '', prop: prop?.name ?? '', propLast: prop ? last(prop) : '',
    other: other?.short ?? '', nine: nine?.name ?? '', nineLast: nine ? last(nine) : '',
  }, chosen.who)
}

/** Clubhouse tales: warm, daft, deeply rugby stories with no losers.
 *  A couple a season, never negative - the game should make you smile. */
function clubhouseTales(state: GameState, rng: Rng) {
  if (rng() > 0.055) return
  if (state.news.some(n => n.season === state.season && n.subject.startsWith('CLUBHOUSE') && state.week - n.week < 6)) return
  const club = state.clubs[state.userClubId]
  const squad = club.players.map(id => state.players[id]).filter((p): p is Player => !!p)
  const prop = squad.find(p => p.pos === 'LP' || p.pos === 'TP')
  const lock = squad.find(p => p.pos === 'LK')
  const nine = squad.find(p => p.pos === 'SH')
  const ten = squad.find(p => p.pos === 'FH')
  const wing = squad.find(p => p.pos === 'WG')
  const tales: [string, number?][] = []
  if (prop) tales.push(
    ['news.chTale1', prop.id],
    ['news.chTale2', prop.id],
  )
  if (lock) tales.push(
    ['news.chTale3', lock.id],
  )
  if (nine && ten) tales.push(
    ['news.chTale4', nine.id],
  )
  if (wing) tales.push(
    ['news.chTale5', wing.id],
  )
  tales.push(
    ['news.chTale6'],
    ['news.chTale7'],
    ['news.chTale8'],
  )
  if (!tales.length) return
  const t = tales[(state.season * 11 + state.week * 7) % tales.length]
  wire(state, t[0], {
    prop: prop?.name ?? '', propLast: prop ? prop.name.split(' ').slice(-1)[0] : '',
    lock: lock?.name ?? '', lockLast: lock ? lock.name.split(' ').slice(-1)[0] : '',
    nine: nine?.name ?? '', ten: ten?.name ?? '',
    wing: wing?.name ?? '', wingLast: wing ? wing.name.split(' ').slice(-1)[0] : '',
  }, t[1])
}

/** Once or twice a year the world governing body floats something outrageous, purely to
 *  see the fans combust. Nothing ever comes of it. Nothing ever will. */
function lawWatch(state: GameState, rng: Rng) {
  if (rng() > 0.033) return
  const proposals: [string][] = [
    ['news.lawWatch1'],
    ['news.lawWatch2'],
    ['news.lawWatch3'],
    ['news.lawWatch4'],
    ['news.lawWatch5'],
    ['news.lawWatch6'],
  ]
  const pick2 = proposals[(state.season * 7 + state.week * 5) % proposals.length]
  // Never twice in quick succession - one wind-up at a time. The clock is a
  // stamp on state, NOT a scan of state.news: the news log is trimmed at 250
  // items, so a busy month could push the last airing out of sight and re-arm
  // the wind-up early - and the old scan compared same-season only, so every
  // rollover reset the clock entirely. Absolute weeks survive both.
  const now = state.season * SEASON_WEEKS + state.week
  if (state.lawWatchAt != null && now - state.lawWatchAt < 12) return
  state.lawWatchAt = now
  wire(state, pick2[0], {})
}

/** Preseason pundit predictions for the user's league. Stored on state.preds
 *  and settled against reality in the season review. The news itself waits
 *  until the friendlies are done - pundits write when the season looms. */
export function punditPredictions(state: GameState, rng: Rng) {
  const club = state.clubs[state.userClubId]
  const comp = state.comps[club?.leagueId]
  if (!club || !comp) return
  const order = comp.teamIds
    .map(id => ({ id, score: (state.clubs[id]?.rep ?? 50) + gauss(rng) * 2.6 }))
    .sort((a, b) => b.score - a.score)
    .map(x => x.id)
  state.preds = {}
  order.forEach((id, i) => { state.preds![id] = i + 1 })
}

/** Post the predictions column once pre-season is over (week 4). */
export function postPredictionsNews(state: GameState) {
  const club = state.clubs[state.userClubId]
  const comp = state.comps[club?.leagueId]
  if (!club || !comp || !state.preds) return
  if (state.news.some(n => n.season === state.season && n.subject.includes('predictions are in'))) return
  const order = Object.entries(state.preds)
    .filter(([id]) => comp.teamIds.includes(id))
    .sort((a, b) => a[1] - b[1])
    .map(([id]) => id)
  if (order.length < 4) return
  const myPos = state.preds[club.id]
  if (!myPos) return
  const nm = (id: string) => state.clubs[id]?.short ?? id
  const verdictKey = myPos === 1 ? 'news.predTitle'
    : myPos <= Math.max(3, comp.playoffTeams) ? 'news.predPlayoffs'
    : myPos <= Math.ceil(order.length / 2) ? 'news.predMid'
    : myPos === order.length ? 'news.predLast'
    : RELEGATES.includes(club.leagueId) ? 'news.predRelegation'
    : 'news.predBottom'
  const verdict = tIn('en', verdictKey, { club: nm(club.id) })
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'gossip', read: false,
    subject: `🎙 Pundits' ${comp.name} predictions are in`,
    body: [
      `Title: ${nm(order[0])}. Chasing: ${nm(order[1])}, ${nm(order[2])}.`,
      `Bottom: ${nm(order[order.length - 1])}.`,
      `You: predicted ${ordinal(myPos)}.`,
      verdict,
    ].join('\n'),
    k: 'news.predictions',
    v: {
      comp: comp.name, title: nm(order[0]), a: nm(order[1]), b: nm(order[2]),
      bottom: nm(order[order.length - 1]), pos_o: myPos, verdict_k: verdictKey,
    },
  })
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

/** Weekly wire generation - always something to read, never a flood. */
export function generateGossip(state: GameState, rng: Rng) {
  // the predictions column lands once the friendlies are done (FY feedback)
  if (state.week === 4 && !state.unemployed) postPredictionsNews(state)
  lawWatch(state, rng)
  if (!state.unemployed) clubhouseTales(state, rng)
  sicknessSweep(state, rng)
  moneyMen(state, rng)
  trainingReport(state, rng)
  midweekMoment(state, rng)
  if (state.unemployed) {
    if (windowOpen(state) && rng() < 0.5) transferRumour(state, rng)
    if (rng() < 0.6) socialBuzz(state, rng)
    return
  }
  dressingRoomFallout(state, rng)
  gameTimeGrumbles(state, rng)
  // cheap talk is constant even when real business is quiet
  if (rng() < 0.8) socialBuzz(state, rng)
  if (windowOpen(state) && rng() < 0.45) transferRumour(state, rng)
  if (state.week === 25) {
    wire(state, 'news.wDeadlineAhead', {})
  }
  if (state.week === 28) {
    wire(state, 'news.wWindowShut', {})
  }
  const wheel = rng()
  if (state.week % 6 === 3) powerRankings(state)
  if (wheel < 0.15) contractSaga(state, rng)
  else if (wheel < 0.3) wonderkidWatch(state, rng)
  else if (wheel < 0.55) streakWatch(state, rng)
  // else: a quieter week - the forums never sleep, though
}
