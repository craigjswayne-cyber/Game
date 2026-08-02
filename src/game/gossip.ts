// The Rugby Wire — rumours, fallouts, terrace talk and agent whispers.
// A living-world feed so there is always something happening between matches.

import type { GameState, Player } from './model'
import { fmtMoney } from './model'
import { sortTable } from './schedule'
import { clamp, pick, type Rng } from './rng'

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
        `Sources close to the squad say ${pa.name} and ${pb.name} are still not speaking. Team-mates are starting to pick sides — the sort of thing that costs points.`, pa.id)
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
        `The Wire understands ${a.name} (${a.pers.toLowerCase()}) and ${b.name} (${b.pers.toLowerCase()}) had ${flash}. Coaches separated the pair. Expect the mood to suffer until it's resolved — keep winning and these things heal quicker.`, a.id)
      break
    }
  }
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
    `${buyer.name} have sent scouts to ${owner.short}'s last three matches — the man they're watching is ${t.name}.`,
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
    `${p.name} is out of contract at the end of the season and his agent is doing the media rounds: "My client loves the club, but he wants to feel loved back. We are listening to what's out there." Sort a new deal — or cash in.`, p.id)
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
    return `${i + 1}. ${c?.short ?? r.teamId} — ${tag}`
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
      `Three straight defeats and the phone-ins have turned. One season-ticket holder of 30 years: "I don't see a plan out there." Win this weekend and it all goes quiet — that's football... no, that's rugby.`)
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
    `Sources say ${p.name} (${p.pos}, rated among your best) trained away from the main group on Monday. His camp's message: "He didn't come here to hold tackle bags." Play him, sell him, or watch the mood sour${p.pers === 'Mercenary' ? ' — and his agent is already dialling' : ''}.`, p.id)
}

/** Weekly wire generation — always something to read, never a flood. */
export function generateGossip(state: GameState, rng: Rng) {
  if (state.unemployed) {
    if (rng() < 0.5) transferRumour(state, rng)
    return
  }
  dressingRoomFallout(state, rng)
  gameTimeGrumbles(state, rng)
  if (state.week === 22) {
    wire(state, `⏰ DEADLINE DAYS AHEAD`,
      `The mid-season market reaches its climax over the next two rounds. Chairmen panic, agents feast, medicals happen in car parks at midnight. If you're planning a move — for a signing or a sale — now is the moment. Expect the phone to ring.`)
  }
  if (state.week === 25) {
    wire(state, `🚪 The window slams shut`,
      `Deadline chaos over. Sporting directors emerge blinking into the daylight to explain themselves. Business can still be done, but the frenzy is over for another year.`)
  }
  const wheel = rng()
  if (state.week % 6 === 3) powerRankings(state)
  if (wheel < 0.3) transferRumour(state, rng)
  else if (wheel < 0.42) contractSaga(state, rng)
  else if (wheel < 0.55) wonderkidWatch(state, rng)
  else if (wheel < 0.75) streakWatch(state, rng)
  // else: a quiet week — they happen
}
