// ---- PLAYERS WHO TALK BACK (roadmap 2b) ----
//
// Owner, 26 Sep 2026: "deeper career - do this", with four new reasons to
// knock: a dropped senior asks why, the captain warns about a signing, a
// leader wants the armband, a player wants a new position.
//
// The office already had the door (media.ts builds the knock, answerPress
// applies the answer, pledges keep the receipts). What it did not have was the
// man on the other side of it: every answer moved every player the same fixed
// amount, and the only thing that knew who he was was a 1.7x swing for the
// Temperamental. The roadmap asked for "the outcome depends on who he is, not
// on a dice roll", and that is this file:
//
//   FIT      each answer is a good, mixed or bad fit for each personality. The
//            same "earn it back" that a Professional takes as a challenge is an
//            insult to a Mercenary. Not a roll: the same man given the same
//            answer takes it the same way every time.
//   REPLY    what he says back is written for how he took it, so the reader
//            can see the fit without a number on the screen.
//   ROOM     a senior voice - the captain, his vice, a Leader, a key man of
//            twenty-nine - carries the conversation into the dressing room:
//            the squad's mood and its trust in the manager move with it.
//
// The new knocks are raised on the office's own private stream (seed, season,
// week), never the week's shared one: a knock that appeared or did not must
// not move a single draw anywhere else in the world.
import { absWeek, logDecision, type GameState, type Personality, type Player, type PressItem, type PressOption, type OfficeTopic } from './model'
import { clamp, mulberry32 } from './rng'
import { tIn } from './i18n'
import { OFFICE_OUTLET, askedRecently, rememberAsk } from './media'

export type Fit = 'good' | 'mixed' | 'bad'

const G: Fit = 'good', M: Fit = 'mixed', B: Fit = 'bad'
const PERS: Personality[] = ['Professional', 'Loyal', 'Ambitious', 'Mercenary', 'Temperamental', 'Leader']
/** One row per answer, in PERS order: Professional, Loyal, Ambitious,
 *  Mercenary, Temperamental, Leader. */
const row = (...f: Fit[]): Record<Personality, Fit> =>
  Object.fromEntries(PERS.map((p, i) => [p, f[i]])) as Record<Personality, Fit>

/** How each personality takes each answer. The tags are the answers' own
 *  (PressOption.tb), stable across languages and saves. */
export const FIT: Record<string, Record<string, Record<Personality, Fit>>> = {
  // the frozen-out senior (media.ts)
  plans: {
    in: row(G, G, M, M, G, G),      // "you're in my plans": a promise; the ambitious want the shirt, not the words
    out: row(M, B, B, M, B, M),     // "you're not": the honest answer the loyal cannot hear
    earn: row(G, M, M, B, B, G),    // "earn it": a challenge to some, a brush-off to others
  },
  // the academy prospect who wants a loan (media.ts)
  loan: {
    minutes: row(G, G, M, M, M, G),
    agree: row(G, M, G, G, M, G),   // the loyal lad did not really want to go
    stay: row(M, M, B, B, B, M),
  },
  // the veteran on an expiring deal (media.ts)
  deal: {
    year: row(G, G, G, M, G, G),    // the mercenary hoped for more than a year
    last: row(M, B, B, M, B, M),
    wait: row(M, M, B, B, B, M),
  },
  // NEW: a regular starter left out of the twenty-three twice running
  dropped: {
    form: row(G, M, M, B, B, G),    // "your form dipped - win it back"
    back: row(G, G, M, M, G, G),    // "you'll be back next week" - a promise of minutes
    youth: row(M, B, B, B, B, M),   // "it's the younger man's time"
    final: row(M, M, B, M, B, B),   // "my decision, not up for debate"
  },
  // NEW: the captain, after a signing in somebody's position (fit is HIS)
  signing: {
    reassure: row(G, G, M, M, G, G),
    compete: row(G, M, G, M, B, G),
    help: row(G, G, M, B, B, G),
    mine: row(M, B, M, M, B, B),
  },
  // NEW: a leader who wants the armband
  armband: {
    yes: row(G, G, G, G, G, G),
    vice: row(G, G, M, M, M, M),
    earn: row(G, M, B, B, B, M),
    no: row(M, M, B, B, B, B),
  },
  // NEW: a player who wants to be tried at his other position
  position: {
    try: row(G, G, G, G, G, G),     // a promise of minutes there
    train: row(G, G, M, M, B, M),
    no: row(M, M, B, B, B, M),
  },
}

/** What a fit does to the man himself, before the Temperamental swing that
 *  answerPress already applies to every office conversation. */
const MORALE: Record<Fit, number> = { good: 0.9, mixed: -0.2, bad: -1.1 }

/** Does what this man says in the office get out into the dressing room? */
export function seniorVoice(state: GameState, p: Player): boolean {
  const club = state.clubs[state.userClubId]
  return club?.captain === p.id || club?.vice === p.id || p.pers === 'Leader'
    || (p.age >= 29 && p.status === 'key')
}

export function fitFor(topic: string, tag: string, p: Player): Fit {
  return FIT[topic]?.[tag]?.[p.pers] ?? 'mixed'
}

/** Nudge the whole senior squad, and the room's trust in the manager. */
function room(state: GameState, moraleDelta: number, trustDelta: number, but?: number) {
  const club = state.clubs[state.userClubId]
  if (!club) return
  for (const id of club.players) {
    const q = state.players[id]
    if (!q || q.acad || id === but) continue
    q.morale = clamp(q.morale + moraleDelta, 1, 10)
  }
  state.mgrTrust = clamp((state.mgrTrust ?? 30) + trustDelta, 0, 100)
}

export interface TalkOutcome {
  fit: Fit
  /** the morale the answer carries, before the Temperamental swing */
  morale: number
  unsettle: boolean
  rk: string
  rv: Record<string, string | number>
}

/**
 * Settle a talk-back answer: who he is decides how it lands. Called by
 * answerPress for any office item whose option carries a tag; applies the
 * consequences beyond the man's own morale (the room, the armband) and
 * returns what answerPress still applies itself (his morale, the unsettle,
 * the reply).
 */
export function settleTalk(state: GameState, item: PressItem, opt: PressOption): TalkOutcome | null {
  const topic = item.topic
  const tag = opt.tb
  const p = item.playerId != null ? state.players[item.playerId] : undefined
  if (!topic || !tag || !p) return null
  const fit = fitFor(topic, tag, p)
  const Tag = tag[0].toUpperCase() + tag.slice(1)
  const Fit = fit[0].toUpperCase() + fit.slice(1)
  const rv: Record<string, string | number> = { player: p.name, ...(item.qv ?? {}) }
  const out: TalkOutcome = {
    fit,
    morale: MORALE[fit],
    // an ambitious or mercenary man who takes it badly lets his agent know
    unsettle: fit === 'bad' && (p.pers === 'Ambitious' || p.pers === 'Mercenary'),
    rk: `talk.${topic}${Tag}${Fit}`,
    rv,
  }
  const club = state.clubs[state.userClubId]

  // a senior voice takes the conversation into the dressing room
  if (seniorVoice(state, p) && topic !== 'signing') {
    if (fit === 'good') room(state, 0.08, 1, p.id)
    else if (fit === 'bad') room(state, -0.12, -2, p.id)
  }

  if (topic === 'signing') {
    // the captain speaks for the room, so the room hears the answer whoever
    // the captain is; the man whose place is under threat hears it loudest
    if (fit === 'good') room(state, 0.12, 2, p.id)
    else if (fit === 'bad') room(state, -0.15, -3, p.id)
    const threatened = typeof item.qv?.rivalId === 'number' ? state.players[item.qv.rivalId as number] : undefined
    if (threatened) threatened.morale = clamp(threatened.morale + (fit === 'good' ? 0.3 : fit === 'bad' ? -0.4 : 0), 1, 10)
  }

  if (topic === 'armband' && club) {
    if (tag === 'yes') {
      const old = club.captain != null ? state.players[club.captain] : undefined
      if (old && old.id !== p.id) {
        // the man who loses the armband takes it the way he takes everything
        old.morale = clamp(old.morale + (old.pers === 'Professional' ? -0.3 : old.pers === 'Leader' || old.pers === 'Temperamental' ? -1.2 : -0.7), 1, 10)
        rv.old = old.name
      }
      // if he was the vice, the man he replaces takes his old job
      if (club.vice === p.id) club.vice = old && old.id !== p.id ? old.id : null
      club.captain = p.id
      logDecision(state, 'dec.newCaptain', { player: p.name }, true)
    } else if (tag === 'vice') {
      if (club.captain !== p.id) club.vice = p.id
    }
  }
  return out
}

// ---------------------------------------------------------------- the knocks

/** An option whose outcome is settled by who he is. The label is the answer;
 *  the reaction on the item until it is answered is a placeholder, replaced by
 *  settleTalk with the one written for how he took it. */
function tagged(topic: string, tag: string, v: Record<string, string | number>, extra: Partial<PressOption> = {}): PressOption {
  const Tag = tag[0].toUpperCase() + tag.slice(1)
  const lk = `talk.${topic}${Tag}`
  return {
    lk, lv: v, label: tIn('en', lk, v),
    rk: `talk.${topic}${Tag}Mixed`, rv: v, reaction: tIn('en', `talk.${topic}${Tag}Mixed`, v),
    morale: 0, board: 0, tb: tag, ...extra,
  }
}

function knock(state: GameState, topic: OfficeTopic, p: Player, qk: string, qv: Record<string, string | number>, options: PressOption[]): PressItem {
  return {
    id: state.nextId++, week: state.week, season: state.season,
    outlet: OFFICE_OUTLET, question: tIn('en', qk, qv), qk, qv,
    playerId: p.id, options, answered: false, topic,
  }
}

/** Every man at the club who could be in the office this week. */
function squadOf(state: GameState): Player[] {
  const club = state.clubs[state.userClubId]
  if (!club) return []
  const committed = new Set((state.preContracts ?? []).map(pc => pc.playerId))
  return club.players.map(id => state.players[id])
    .filter((p): p is Player => !!p && !p.acad && !p.onLoan && !p.injury && !committed.has(p.id) && !p.retiring)
}

/**
 * THE NEW KNOCKS. At most one a week, and only when the office is free: a
 * conversation with options holds the week until it is answered, so two at
 * once would be a queue at the door rather than a dressing room.
 */
export function talkbackWeek(state: GameState) {
  if (state.unemployed) return
  const club = state.clubs[state.userClubId]
  if (!club) return
  const open = state.press.filter(q => !q.answered)
  if (open.length >= 2 || open.some(q => q.outlet === OFFICE_OUTLET)) return
  const rng = mulberry32((state.seed ^ Math.imul(absWeek(state.season, state.week) + 1, 2246822519) ^ 0x7a1cb) >>> 0)
  const wk = state.week
  const squad = squadOf(state)
  const xv23 = new Set(club.tactic.lineup.slice(0, 23).filter((x): x is number => x != null))
  // candidates are recipes, not items: building an item takes an id, and
  // ids seed the discipline machine (authority.ts), so a knock that is never
  // chosen must never take one
  const cands: (() => PressItem)[] = []

  // 1. DROPPED: a regular starter left out of the twenty-three twice running
  if (wk >= 8 && wk <= 40) {
    const lastPlayed = (() => {
      // the fixture list only ever holds the current season
      const mine = state.fixtures.filter(f => f.played && f.week < wk &&
        (f.homeId === club.id || f.awayId === club.id)).map(f => f.week)
      return mine.sort((a, b) => b - a).slice(0, 2)
    })()
    const dropped = lastPlayed.length === 2 ? squad.filter(p => p.age >= 24 && p.stats.starts >= 4 &&
      !xv23.has(p.id) && (p.lastWk ?? 0) < lastPlayed[1] && !askedRecently(state, p.id, 'dropped')) : []
    if (dropped.length) {
      const p = dropped[Math.floor(rng() * dropped.length)]
      const v = { player: p.name }
      const q = rng() < 0.5 ? 'talk.droppedQ1' : 'talk.droppedQ2'
      cands.push(() => knock(state, 'dropped', p, q, v, [
        tagged('dropped', 'form', v),
        tagged('dropped', 'back', v, { pledge: 'minutes' }),
        tagged('dropped', 'youth', v),
        tagged('dropped', 'final', v),
      ]))
    }
  }

  // 2. SIGNING: the captain, the week after a signing in somebody's position
  const cap = club.captain != null ? state.players[club.captain] : undefined
  if (cap && cap.clubId === club.id && !cap.injury && !askedRecently(state, cap.id, 'signing')) {
    const now = absWeek(state.season, wk)
    const fresh = club.players.map(id => state.players[id])
      .filter((n): n is Player => !!n && !n.acad && n.id !== cap.id && n.joinedAt != null && now - n.joinedAt <= 2 && now - n.joinedAt >= 0 && n.ca >= 68)
    for (const n of fresh) {
      const rival = squad.filter(q => q.id !== n.id && q.id !== cap.id && q.pos === n.pos && (q.status === 'key' || q.stats.starts >= 3))
        .sort((a, b) => b.ca - a.ca)[0]
      if (!rival) continue
      const v = { player: cap.name, signing: n.name, rival: rival.name, rivalId: rival.id }
      const vv = { player: cap.name, signing: n.name, rival: rival.name }
      const q = rng() < 0.5 ? 'talk.signingQ1' : 'talk.signingQ2'
      cands.push(() => knock(state, 'signing', cap, q, v, [
        tagged('signing', 'reassure', vv),
        tagged('signing', 'compete', vv),
        tagged('signing', 'help', vv),
        tagged('signing', 'mine', vv),
      ]))
      break
    }
  }

  // 3. ARMBAND: a natural leader who is not wearing it
  if (wk >= 6 && wk <= 36 && club.captain != null) {
    const leaders = squad.filter(p => club.captain !== p.id && club.vice !== p.id && p.age >= 25 && p.ca >= 70 &&
      p.stats.apps >= 3 && p.morale >= 5 && (p.pers === 'Leader' || p.a.lea >= 75) &&
      !askedRecently(state, p.id, 'armband'))
    if (leaders.length && rng() < 0.5) {
      const p = leaders[Math.floor(rng() * leaders.length)]
      const capName = state.players[club.captain]?.name ?? ''
      const v = { player: p.name, captain: capName }
      const q = rng() < 0.5 ? 'talk.armbandQ1' : 'talk.armbandQ2'
      cands.push(() => knock(state, 'armband', p, q, v, [
        tagged('armband', 'yes', v),
        tagged('armband', 'vice', v),
        tagged('armband', 'earn', v),
        tagged('armband', 'no', v),
      ]))
    }
  }

  // 4. POSITION: a squad man who thinks he would get on the field elsewhere
  if (wk >= 8 && wk <= 34) {
    const movers = squad.filter(p => p.alt.length > 0 && p.age >= 21 && p.age <= 31 &&
      p.stats.apps <= 3 && p.status !== 'key' && !xv23.has(p.id) && !askedRecently(state, p.id, 'position'))
    if (movers.length && rng() < 0.4) {
      const p = movers[Math.floor(rng() * movers.length)]
      const to = p.alt[Math.floor(rng() * p.alt.length)]
      const v = { player: p.name, from_k: `pos.${p.pos}`, to_k: `pos.${to}` }
      const q = rng() < 0.5 ? 'talk.positionQ1' : 'talk.positionQ2'
      cands.push(() => knock(state, 'position', p, q, v, [
        tagged('position', 'try', v, { pledge: 'minutes' }),
        tagged('position', 'train', v),
        tagged('position', 'no', v),
      ]))
    }
  }

  // about one week in three with somebody at the door, when there is somebody
  if (!cands.length || rng() >= 0.35) return
  const chosen = cands[Math.floor(rng() * cands.length)]()
  state.press.push(chosen)
  rememberAsk(state, chosen.playerId!, chosen.topic!)
  if (state.press.length > 40) state.press = state.press.slice(-40)
}
