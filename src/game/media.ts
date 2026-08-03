import type { GameState, Player, PressItem } from './model'
import { derbyName, isDerby } from './rivalries'
import { clamp, pick, type Rng } from './rng'

const OUTLETS = [
  'The Rugby Chronicle', 'Oval Times', 'The Breakdown Podcast', 'Rugby World Weekly',
  'The Sunday Scrum', 'Lineout Live', 'The Egg Chasers Gazette', 'Front Row Daily',
]

function mk(state: GameState, question: string, playerId: number | undefined, options: PressItem['options'], rng: Rng): PressItem {
  return {
    id: state.nextId++,
    week: state.week,
    season: state.season,
    outlet: pick(rng, OUTLETS),
    question,
    playerId,
    options,
    answered: false,
  }
}

/** Weekly press generation for the user's club. */
export function generatePress(state: GameState, rng: Rng) {
  const club = state.clubs[state.userClubId]
  const squad = club.players.map(id => state.players[id]).filter(Boolean)
  const open = state.press.filter(p => !p.answered).length
  if (open >= 2) return // don't spam

  const candidates: PressItem[] = []

  // hot streak player
  const hot = squad.filter(p => p.form >= 8 && p.stats.apps >= 3)
  if (hot.length && rng() < 0.6) {
    const p = pick(rng, hot)
    candidates.push(mk(state,
      `${p.name} has been in scintillating form — some are calling him the best ${posNoun(p)} in the competition. Do you agree?`,
      p.id, [
        { label: 'Heap on the praise', morale: 1.2, board: 0, reaction: `${p.name} is reportedly delighted with your public backing.` },
        { label: 'Keep his feet on the ground', morale: -0.3, board: 0.5, reaction: `A measured response. ${p.name} knows there is more to do.` },
        { label: 'No comment', morale: 0, board: -0.2, reaction: 'The press pack grumbles and moves on.' },
      ], rng))
  }

  // struggling player
  const cold = squad.filter(p => p.form <= 4.5 && p.stats.apps >= 3)
  if (cold.length && rng() < 0.5) {
    const p = pick(rng, cold)
    candidates.push(mk(state,
      `${p.name} has looked well short of his best in recent weeks. Is his place under threat?`,
      p.id, [
        { label: 'Back him publicly', morale: 1.4, board: -0.3, reaction: `${p.name} appreciates the show of faith and vows to repay it.` },
        { label: 'Admit he must improve', morale: -1.2, board: 0.6, reaction: `Honest, but ${p.name} is stung by the criticism.` },
        { label: 'Refuse to single anyone out', morale: 0.2, board: 0, reaction: 'You deflect the question with a straight bat.' },
      ], rng))
  }

  // transfer rumour about star player
  const stars = squad.filter(p => p.ca >= 84)
  if (stars.length && rng() < 0.3) {
    const p = pick(rng, stars)
    const bigClubs = Object.values(state.clubs).filter(c => c.id !== club.id && c.rep >= club.rep)
    const suitor = bigClubs.length ? pick(rng, bigClubs) : null
    if (suitor) {
      candidates.push(mk(state,
        `We're hearing strong links between ${p.name} and ${suitor.name}. What's your message to worried supporters?`,
        p.id, [
          { label: `He's untouchable`, morale: 0.8, board: 0.3, reaction: `A firm line. ${p.name} feels wanted; ${suitor.short} are said to be undeterred.` },
          { label: 'Everyone has a price', morale: -1.5, board: 0, unsettle: true, reaction: `${p.name}'s agent has taken note. Expect the phone to ring.` },
          { label: 'Rumours are rumours', morale: 0, board: 0, reaction: 'You wave the question away.' },
        ], rng))
    }
  }

  // derby build-up: poke the fire or play it down
  const nextFx = state.fixtures.find(f =>
    !f.played && f.week === state.week &&
    (f.homeId === club.id || f.awayId === club.id) && isDerby(f.homeId, f.awayId))
  if (nextFx && rng() < 0.65) {
    const oppId = nextFx.homeId === club.id ? nextFx.awayId : nextFx.homeId
    const opp = state.clubs[oppId]
    candidates.push(mk(state,
      `${derbyName(nextFx.homeId, nextFx.awayId)} this weekend. ${opp?.short ?? 'They'} say the pressure is all on you. Your response?`,
      undefined, [
        { label: 'Fan the flames', morale: 0, board: 0.4, reaction: 'The back pages love it. The town is at boiling point — your players will feel ten feet tall, or feel the heat.' },
        { label: 'Just another game', morale: 0, board: -0.2, reaction: 'Nobody believes you, least of all your own supporters.' },
        { label: 'Praise the rivalry', morale: 0, board: 0.2, reaction: 'A statesmanlike answer. Both sets of fans nod approvingly, then go back to hating each other.' },
      ], rng))
  }

  // wonderkid hype
  const kids = squad.filter(p => p.age <= 21 && p.form >= 7 && p.stats.apps >= 2)
  if (kids.length && rng() < 0.4) {
    const p = pick(rng, kids)
    candidates.push(mk(state,
      `Everyone is talking about ${p.name} — ${p.age} years old and lighting up the league. Is he the future of the club?`,
      p.id, [
        { label: 'Crown him now', morale: 1.5, board: 0.2, unsettle: true, reaction: `${p.name} floats out of the press room — and every scout in the hemisphere just circled his name.` },
        { label: 'Protect the kid', morale: 0.3, board: 0.3, reaction: 'Measured. He keeps developing away from the circus.' },
        { label: 'He plays when he earns it', morale: -0.6, board: 0.4, reaction: `Old school. ${p.name} bristles, but the senior players approve.` },
      ], rng))
  }

  // results pressure
  const recent = state.fixtures.filter(f =>
    f.played && (f.homeId === club.id || f.awayId === club.id)).slice(-4)
  const losses = recent.filter(f =>
    (f.homeId === club.id && f.homeScore < f.awayScore) ||
    (f.awayId === club.id && f.awayScore < f.homeScore)).length
  if (losses >= 3) {
    candidates.push(mk(state,
      `${losses} defeats in the last ${recent.length}. Supporters are restless. How do you respond to talk of a crisis?`,
      undefined, [
        { label: 'Take full responsibility', morale: 0.4, board: 0.6, reaction: 'The dressing room respects your honesty.' },
        { label: 'Blame fine margins', morale: 0, board: -0.6, reaction: 'The board is unimpressed with excuses.' },
        { label: 'Attack the question', morale: -0.2, board: -0.3, reaction: 'The clip goes viral for the wrong reasons.' },
      ], rng))
  }

  // discipline row: cards in the last match
  const lastFx = [...state.fixtures].reverse().find(f =>
    f.played && (f.homeId === club.id || f.awayId === club.id))
  const carded = lastFx?.events?.filter(e =>
    (e.type === 'YC' || e.type === 'RC') && e.teamId === club.id && e.playerId != null) ?? []
  if (carded.length >= 2 && rng() < 0.6) {
    const ev = carded[carded.length - 1]
    candidates.push(mk(state,
      `${carded.length} cards at the weekend, ${ev.playerName ?? 'your man'} among them. Is there a discipline problem in your squad?`,
      ev.playerId, [
        { label: 'Defend your players', morale: 0.8, board: -0.4, reaction: 'The squad appreciates the shield. The disciplinary panel does not.' },
        { label: 'Promise it will be addressed', morale: -0.6, board: 0.6, reaction: 'Sternly said. Extra tackling-technique sessions are already booked.' },
        { label: 'Blame the officiating', morale: 0.4, board: -0.5, reaction: 'The players love it; the league office sends a warning letter.' },
      ], rng))
  }

  // the vultures: job speculation when the board is restless
  if (club.boardConfidence <= 42 && rng() < 0.5) {
    candidates.push(mk(state,
      `There are reports this morning that the board has sounded out potential replacements. Are you fighting for your job?`,
      undefined, [
        { label: `I'll be judged on trophies`, morale: 0.3, board: 0.3, reaction: 'Defiant. The players walk a little taller — now you have to deliver.' },
        { label: 'That is a question for the board', morale: -0.4, board: -0.3, reaction: 'The vacuum fills with more speculation.' },
        { label: 'Laugh it off', morale: 0.5, board: -0.1, reaction: 'The room chuckles. The chairman, watching the stream, does not.' },
      ], rng))
  }

  // title run-in nerves
  const myComp = state.comps[club.leagueId]
  if (myComp && state.week >= 30 && rng() < 0.45) {
    const pos = [...myComp.table].sort((a, b) => b.pts - a.pts).findIndex(r => r.teamId === club.id) + 1
    if (pos > 0 && pos <= 2) {
      candidates.push(mk(state,
        `Top ${pos === 1 ? 'of the table' : 'two'} with the season on the line. Can this group handle the pressure of a run-in?`,
        undefined, [
          { label: 'We want the target on our backs', morale: 0.6, board: 0.3, reaction: 'Bold. The bookies shorten your odds; the players feed off it.' },
          { label: 'One game at a time', morale: 0, board: 0.2, reaction: `The oldest line in the book, delivered with a straight face.` },
          { label: 'Pressure is a privilege', morale: 0.3, board: 0.2, reaction: 'Instant back-page headline. The town believes.' },
        ], rng))
    }
  }

  // Test-window exodus
  const away = squad.filter(p => p.natSquad).length
  if (away >= 4 && rng() < 0.5) {
    candidates.push(mk(state,
      `${away} of your players are away on international duty. Should clubs be compensated when the Test windows strip their squads?`,
      undefined, [
        { label: 'Proud to produce Test players', morale: 0.4, board: 0.3, reaction: 'Gracious — and the academy parents noticed.' },
        { label: 'The calendar is broken', morale: 0, board: 0.1, reaction: 'Half the league\'s coaches text you in agreement.' },
        { label: 'We cope. Next question', morale: 0.2, board: 0, reaction: 'Brisk. The fringe players hear the message: their chance is coming.' },
      ], rng))
  }

  // post-match reaction: the result you just walked off the pitch with
  const justPlayed = state.fixtures.find(f =>
    f.played && f.week === state.week && (f.homeId === club.id || f.awayId === club.id))
  if (justPlayed && rng() < 0.6) {
    const us = justPlayed.homeId === club.id ? justPlayed.homeScore : justPlayed.awayScore
    const them = justPlayed.homeId === club.id ? justPlayed.awayScore : justPlayed.homeScore
    const oppId = justPlayed.homeId === club.id ? justPlayed.awayId : justPlayed.homeId
    const oppName = state.clubs[oppId]?.short ?? oppId
    const margin = us - them
    const derby = isDerby(justPlayed.homeId, justPlayed.awayId)
    let reaction: PressItem | null = null
    if (margin >= 25) {
      reaction = mk(state,
        `${us}-${them}. A statement performance — the best this team can play, or is there more?`,
        undefined, [
          { label: 'There is more to come', morale: 0.6, board: 0.3, reaction: 'Ominous for the rest of the league. The players believe it too.' },
          { label: `Credit ${oppName} — they made it hard`, morale: 0.2, board: 0.2, reaction: 'Gracious in victory. Neutrals approve.' },
          { label: 'We move on immediately', morale: 0, board: 0.2, reaction: 'All business. The standard is the standard.' },
        ], rng)
    } else if (margin <= -25) {
      reaction = mk(state,
        `${us}-${them} to ${oppName}. Supporters deserve an explanation. What went wrong out there?`,
        undefined, [
          { label: 'That was on me, not the players', morale: 0.7, board: -0.2, reaction: 'The dressing room notices who took the bullets.' },
          { label: 'Some of that was unacceptable', morale: -0.9, board: 0.4, reaction: 'Hard words, publicly delivered. Training will be spiky this week.' },
          { label: 'One bad day. No drama', morale: 0.1, board: -0.3, reaction: 'Calm — but the phone-ins want blood, not calm.' },
        ], rng)
    } else if (derby && margin > 0) {
      reaction = mk(state,
        `Derby day belongs to you. The fans are singing your name outside — a message for them?`,
        undefined, [
          { label: 'Enjoy every minute of it', morale: 0.5, board: 0.3, reaction: 'The clip of your grin does big numbers. Bragging rights secured.' },
          { label: 'It is only worth four points', morale: -0.2, board: 0.3, reaction: 'True, technically. Nobody outside the building agrees.' },
          { label: 'This club owns this city', morale: 0.8, board: -0.1, unsettle: false, reaction: 'Front page. Their fans will keep the receipt — mind the return fixture.' },
        ], rng)
    } else if (derby && margin < 0) {
      reaction = mk(state,
        `A derby defeat, and their supporters are letting you know about it. How do you face your own fans this week?`,
        undefined, [
          { label: 'We will not hide from this', morale: 0.4, board: 0.3, reaction: 'Straight talk. The fans respect honesty more than excuses.' },
          { label: 'The performance was actually good', morale: 0, board: -0.4, reaction: 'The stats might back you up. Derby crowds do not deal in stats.' },
          { label: 'Wait for the return fixture', morale: 0.3, board: 0, reaction: 'A promise. It will be remembered — deliver or else.' },
        ], rng)
    }
    if (reaction && state.press.filter(p => !p.answered).length < 2) state.press.push(reaction)
  }

  if (candidates.length && rng() < 0.75) {
    state.press.push(candidates[Math.floor(rng() * candidates.length)])
    // keep press list bounded
    if (state.press.length > 40) state.press = state.press.slice(-40)
  }
}

function posNoun(p: Player): string {
  const map: Record<string, string> = {
    LP: 'prop', TP: 'prop', HK: 'hooker', LK: 'lock', FL: 'flanker', N8: 'number eight',
    SH: 'scrum-half', FH: 'fly-half', CE: 'centre', WG: 'winger', FB: 'full-back',
  }
  return map[p.pos] ?? 'player'
}

/** Apply the chosen answer. */
export function answerPress(state: GameState, pressId: number, optionIndex: number) {
  const item = state.press.find(p => p.id === pressId)
  if (!item || item.answered) return
  const opt = item.options[optionIndex]
  if (!opt) return
  item.answered = true
  item.answerLabel = opt.label
  item.reaction = opt.reaction
  if (item.playerId != null) {
    const p = state.players[item.playerId]
    if (p) {
      const swing = p.pers === 'Temperamental' ? 1.7 : 1
      p.morale = clamp(p.morale + opt.morale * swing, 1, 10)
      if (opt.unsettle) p.morale = clamp(p.morale - 1, 1, 10) // agents circle an unsettled player
    }
  }
  const club = state.clubs[state.userClubId]
  club.boardConfidence = clamp(club.boardConfidence + opt.board * 5, 0, 100)

  // tone ledger: what you say in public adds up
  const prev = state.pressTone ?? 0
  if (opt.morale >= 0.5) state.pressTone = clamp(prev + 1, -6, 6)
  else if (opt.morale <= -0.5) state.pressTone = clamp(prev - 1, -6, 6)
  const tone = state.pressTone ?? 0
  if (prev < 4 && tone >= 4) {
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'gossip', read: false,
      subject: `Swagger alert: is all that praise going to their heads?`,
      body: `Your players can't stop telling the press how good they are — because you keep telling the press how good they are. The assistant's note is blunt: "Training tempo has dipped. They think they only need to turn up." Expect flat performances until someone puts a shift in — or until you sharpen your tongue.`,
    })
  }
  if (prev > -4 && tone <= -4) {
    for (const id of club.players) {
      const p = state.players[id]
      if (p) p.morale = clamp(p.morale - 0.5, 1, 10)
    }
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'gossip', read: false,
      subject: `Dressing room bruised by public criticism`,
      body: `Week after week of hard words in press conferences has landed. Senior players are reportedly "sick of being thrown under the bus" and morale has sagged across the squad. A little public warmth would go a long way.`,
    })
  }
}
