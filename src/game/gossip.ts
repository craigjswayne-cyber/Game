// The Rugby Wire - rumours, fallouts, terrace talk and agent whispers.
// A living-world feed so there is always something happening between matches.

import type { GameState, Player } from './model'
import { fmtMoney } from './model'
import { sortTable } from './schedule'
import { clamp, gauss, pick, type Rng } from './rng'

function wire(state: GameState, subject: string, body: string, playerId?: number) {
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'gossip',
    read: false, subject, body, playerId,
  })
}

/** Personality pairs that rub each other the wrong way. */
const CLASHES: [string, string][] = [
  ['Temperamental', 'Leader'],
  ['Temperamental', 'Professional'],
  ['Mercenary', 'Loyal'],
  ['Ambitious', 'Ambitious'],
  ['Temperamental', 'Temperamental'],
]

interface Feud { a: number; b: number; week: number }

/** Active feuds ride along in state via a soft field. */
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
      wire(state, `Peace breaks out: ${pa.name.split(' ').slice(-1)[0]} and ${pb.name.split(' ').slice(-1)[0]}`,
        `Clear-the-air talks at the training ground this week. ${pa.name} and ${pb.name} trained together on Thursday and the squad say the atmosphere has lifted. One senior player: "It's done. We move."`, pa.id)
    } else if (rng() < 0.25) {
      pa.morale = clamp(pa.morale - 0.4, 1, 10)
      pb.morale = clamp(pb.morale - 0.4, 1, 10)
      wire(state, `Still frosty at ${state.clubs[state.userClubId].short}`,
        `Sources close to the squad say ${pa.name} and ${pb.name} are still not speaking. Team-mates are starting to pick sides - the sort of thing that costs points.`, pa.id)
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
      wire(state, `EXCLUSIVE: ${a.name.split(' ').slice(-1)[0]} and ${b.name.split(' ').slice(-1)[0]} in dressing-room rift`,
        `The Wire understands ${a.name} (${a.pers.toLowerCase()}) and ${b.name} (${b.pers.toLowerCase()}) had ${flash}. Coaches separated the pair. Expect the mood to suffer until it's resolved - keep winning and these things heal quicker.`, a.id)
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
      `Best on the grass: ${star.name} - sharp all week.`,
      pushing ? `Knocking on the door: ${pushing.name} is training like a man who wants the shirt.` : '',
      kid && rng() < 0.5 ? `From the academy pitches: the coaches keep mentioning ${kid.name}. One for the notebook.` : '',
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
    wire(state, `Community day at ${club.short}`,
      `The whole squad spent Wednesday coaching at local schools and visiting the children's ward. Corny? Maybe. But the group came back closer, and the town noticed.`)
  } else if (roll < 0.5 && star) {
    star.morale = clamp(star.morale + 0.5, 1, 10)
    wire(state, `${star.name.split(' ').slice(-1)[0]} lands a boot deal`,
      `${star.name} has signed a personal sponsorship with a boot manufacturer. His locker now contains fourteen boxes of boots and one very smug grin.`, star.id)
  } else if (roll < 0.7) {
    wire(state, `Groundsman wars at ${club.stadium}`,
      `The head groundsman has banned the forwards from 'his' pitch until Thursday after last week's scrummaging session left it looking ploughed. The pack are training on the back field, muttering.`)
  } else if (roll < 0.85 && star) {
    wire(state, `${star.name.split(' ').slice(-1)[0]} spotted filming an advert`,
      `${star.name} spent his day off filming a regional car dealership advert. Team-mates have already obtained the script. Training may include dramatic readings.`, star.id)
  } else {
    const chef = ['a new nutritionist', 'a sleep consultant', 'a breathing coach', 'an ice-bath guru'][Math.floor(rng() * 4)]
    wire(state, `${club.short} hire ${chef}`,
      `The performance department has brought in ${chef} for the rest of the season. The senior pros are sceptical. The young lads are all-in. Someone has already broken the new equipment.`)
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
  wire(state, `A bug sweeps the camp`,
    `The medical room is standing-room only: ${hit.map(p => p.name.split(' ').slice(-1)[0]).join(', ')} have all been laid low by a virus doing the rounds. They'll play if picked, but the tanks won't be full this week. The kit man is bleaching everything.`)
}

/** Money men circle the modern game - most of it is smoke, occasionally
 *  it's a takeover. */
function moneyMen(state: GameState, rng: Rng) {
  const st = state as GameState & { takeover?: { clubId: string; week: number; stage: number } }
  const t = st.takeover
  if (t) {
    const club = state.clubs[t.clubId]
    if (!club) { st.takeover = undefined; return }
    if (state.week - t.week < 2 || rng() > 0.5) return
    if (t.stage === 0) {
      st.takeover = { ...t, week: state.week, stage: 1 }
      wire(state, `Takeover talk hardens at ${club.short}`,
        `The consortium linked with ${club.name} has reportedly entered exclusivity. Due diligence is under way; the current owners are said to be "open to the right offer". Supporters dare to dream of a war chest.`)
      return
    }
    // resolution: most collapse, some complete
    st.takeover = undefined
    if (rng() < 0.3) {
      const boost = 2_000_000 + Math.round(rng() * 6_000_000 / 500_000) * 500_000
      club.budget += boost
      club.balance += Math.round(boost * 0.6)
      club.rep = clamp(club.rep + 2, 30, 95)
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
        subject: `🤝 TAKEOVER COMPLETE: new owners at ${club.name}`,
        body: `It's done. The consortium has completed its purchase of ${club.name} and immediately pledged fresh investment${club.id === state.userClubId ? ` - your transfer budget rises by ${fmtMoney(boost)}. New owners bring new expectations: deliver, and this could be the start of an era.` : `. The rest of the league takes note: ${club.short} just became dangerous in the market.`}`,
      })
    } else {
      wire(state, `Takeover collapses at ${club.short}`,
        `After weeks of whispers, the money men have walked away from ${club.name} - "valuation gap", say sources. The club statement thanks supporters for their patience and says it remains "well capitalised". Nobody is convinced.`)
    }
    return
  }
  if (rng() > 0.035) return
  const candidates = Object.values(state.clubs).filter(c => c.rep >= 55)
  if (!candidates.length) return
  const club = pick(rng, candidates)
  st.takeover = { clubId: club.id, week: state.week, stage: 0 }
  wire(state, `Money men circle ${club.short}`,
    `A wealthy consortium - the names change depending on who you ask - has been linked with a takeover of ${club.name}. A private jet at the local airfield has done a lot of heavy lifting in the fan forums. Most of these stories die quietly; some don't.`)
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
  const line = pick(rng, [
    `${buyer.name} have sent scouts to ${owner.short}'s last three matches - the man they're watching is ${t.name}.`,
    `Agents claim ${buyer.short} are readying a ${fmtMoney(fee)} bid for ${t.name}. ${owner.short} insist he is going nowhere.`,
    `${t.name} to ${buyer.short}? A source at the player's management agency says "there is interest, and it's serious."`,
    `Whispers from ${buyer.city}: ${buyer.short}'s head coach has made ${t.name} his number one target.`,
  ])
  wire(state, `RUMOUR MILL: ${t.name} linked with ${buyer.short}`, line, t.id)
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
  wire(state, `Agent talk: ${p.name}'s future`,
    `${p.name} is out of contract at the end of the season and his agent is doing the media rounds: "My client loves the club, but he wants to feel loved back. We are listening to what's out there." Sort a new deal - or cash in.`, p.id)
}

function powerRankings(state: GameState) {
  const leagueId = state.clubs[state.userClubId].leagueId
  const comp = state.comps[leagueId]
  if (!comp || !comp.table.some(r => r.p > 0)) return
  const order = sortTable(comp.table).slice(0, 5)
  const lines = order.map((r, i) => {
    const c = state.clubs[r.teamId]
    const tag = i === 0 ? 'The team to beat.' : i === 1 ? 'Breathing down their necks.'
      : i === 2 ? 'Quietly excellent.' : i === 3 ? 'Dangerous on their day.' : 'The dark horses.'
    return `${i + 1}. ${c?.short ?? r.teamId} - ${tag}`
  })
  wire(state, `THE WIRE POWER RANKINGS`, lines.join('\n'))
}

function streakWatch(state: GameState, rng: Rng) {
  const uid = state.userClubId
  const recent = state.fixtures
    .filter(f => f.played && (f.homeId === uid || f.awayId === uid))
    .slice(-3)
  if (recent.length < 3) return
  const results = recent.map(f => {
    const us = f.homeId === uid ? f.homeScore : f.awayScore
    const them = f.homeId === uid ? f.awayScore : f.homeScore
    return us > them ? 'W' : us < them ? 'L' : 'D'
  })
  const club = state.clubs[uid]
  if (results.every(r => r === 'W') && rng() < 0.7) {
    wire(state, `Terrace pulse: believers at ${club.short}`,
      `Three wins on the spin and the ${club.stadium} bars are humming. A supporters' podcast this week: "Whisper it, but this ${state.managerName} side might actually be building something."`)
  } else if (results.every(r => r === 'L') && rng() < 0.8) {
    wire(state, `Terrace pulse: grumbles at ${club.short}`,
      `Three straight defeats and the phone-ins have turned. One season-ticket holder of 30 years: "I don't see a plan out there." Win this weekend and it all goes quiet - that's football... no, that's rugby.`)
  }
}

function wonderkidWatch(state: GameState, rng: Rng) {
  const kids = Object.values(state.players).filter(p =>
    p.clubId && p.age <= 21 && p.ca >= 62 && (p.ca - (p.ca0 ?? p.ca)) >= 2)
  if (!kids.length) return
  const k = pick(rng, kids)!
  const club = state.clubs[k.clubId!]
  wire(state, `WONDERKID WATCH: ${k.name}`,
    `Every scout in the league has ${club?.short ?? 'his club'}'s ${k.age}-year-old ${k.pos} ${k.name} in their notebook. Coaches say he's added real polish this season. One director of rugby: "He'll cost a fortune in a year. Move now or regret it."`, k.id)
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
  wire(state, `${p.name} frustrated by lack of rugby`,
    `Sources say ${p.name} (${p.pos}, rated among your best) trained away from the main group on Monday. His camp's message: "He didn't come here to hold tackle bags." Play him, sell him, or watch the mood sour${p.pers === 'Mercenary' ? ' - and his agent is already dialling' : ''}.`, p.id)
}

/** Fan forums, social posts and pundit columns - cheap talk, every week. */
function socialBuzz(state: GameState, rng: Rng) {
  const clubs = Object.values(state.clubs)
  const club = pick(rng, clubs)
  if (!club) return
  const squad = club.players.map(id => state.players[id]).filter((p): p is Player => !!p)
  const star = [...squad].sort((a, b) => b.ca - a.ca)[0]
  const kid = squad.filter(p => p.age <= 21).sort((a, b) => b.ca - a.ca)[0]
  const other = pick(rng, clubs.filter(c => c.id !== club.id && c.rep >= club.rep - 8))
  const target = other ? [...other.players.map(id => state.players[id]).filter(Boolean)].sort((a, b) => b!.ca - a!.ca)[0] : null
  const takes: [string, string, number?][] = []
  if (star) takes.push(
    [`FAN FORUM: "${star.name.split(' ').slice(-1)[0]} to leave?" - ${club.short} board melts down`,
      `A single unsourced post claiming ${star.name} has "told friends he wants out" hit 400 replies overnight on the ${club.short} fan forum. No agent, no journalist, no evidence - but try telling the replies that. One mod: "Every year, same thread."`, star.id],
    [`SOCIAL: training-ground clip of ${star.name} goes viral`,
      `Eleven seconds of ${star.name} doing something outrageous in ${club.short} training is doing the rounds - two million views and counting. Opposition analysts have watched it more than anyone.`, star.id],
  )
  if (kid && target) takes.push(
    [`PUNDIT COLUMN: "${club.short} have unearthed a gem"`,
      `This week's big read claims ${kid.name} (${kid.age}) is "the most natural ${kid.pos} of his generation" - and that half the league knows it. ${club.short} supporters would rather the column had stayed unwritten.`, kid.id],
  )
  if (target && other) takes.push(
    [`AGENT TALK: ${target!.name} "flattered" by interest`,
      `${target!.name}'s representatives did nothing to hose down speculation this week: "My client is very happy at ${other.short}. But every player listens." Fan forums across the league did the rest.`, target!.id],
    [`FAN FORUM: dream signing thread - ${club.short}`,
      `"Realistic transfer targets" is the thread title; ${target!.name} is the name on every page. The finances make no sense, the fit is debatable, the enthusiasm is total.`, target!.id],
  )
  if (!takes.length) return
  const t = takes[Math.floor(rng() * takes.length)]
  wire(state, t[0], t[1], t[2])
}

/** Preseason pundit predictions for the user's league. Stored on state.preds
 *  and settled against reality in the season review. */
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
  const myPos = state.preds[club.id]
  const nm = (id: string) => state.clubs[id]?.short ?? id
  const verdict = myPos === 1
    ? `${nm(club.id)} are everyone's title pick - anything less is failure.`
    : myPos <= Math.max(3, comp.playoffTeams)
      ? `${nm(club.id)} are tipped for the playoffs. The pressure is on from day one.`
      : myPos <= Math.ceil(order.length / 2)
        ? `${nm(club.id)} are pegged mid-table - "solid, unspectacular" is the consensus. Prove them wrong.`
        : myPos === order.length
          ? `The pundits have ${nm(club.id)} dead last. Wooden spoon talk already. Use it.`
          : `${nm(club.id)} are among the relegation favourites. Nobody expects much - the perfect place to start.`
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'gossip', read: false,
    subject: `🎙 Pundits' ${comp.name} predictions are in`,
    body: [
      `Title: ${nm(order[0])}. Chasing: ${nm(order[1])}, ${nm(order[2])}.`,
      `Bottom: ${nm(order[order.length - 1])}.`,
      `You: predicted ${ordinal(myPos)}.`,
      verdict,
    ].join('\n'),
  })
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

/** Weekly wire generation - always something to read, never a flood. */
export function generateGossip(state: GameState, rng: Rng) {
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
    wire(state, `⏰ DEADLINE DAYS AHEAD`,
      `The mid-season market reaches its climax over the next two rounds. Chairmen panic, agents feast, medicals happen in car parks at midnight. If you're planning a move - for a signing or a sale - now is the moment. Expect the phone to ring.`)
  }
  if (state.week === 28) {
    wire(state, `🚪 The window slams shut`,
      `Deadline chaos over. Sporting directors emerge blinking into the daylight to explain themselves. Business can still be done, but the frenzy is over for another year.`)
  }
  const wheel = rng()
  if (state.week % 6 === 3) powerRankings(state)
  if (wheel < 0.15) contractSaga(state, rng)
  else if (wheel < 0.3) wonderkidWatch(state, rng)
  else if (wheel < 0.55) streakWatch(state, rng)
  // else: a quieter week - the forums never sleep, though
}
