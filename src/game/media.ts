import type { GameState, Player, PressItem } from './model'
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
}
