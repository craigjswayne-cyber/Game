// Dressing-room authority (four pillars, pillar 1).
//
// The game already had two numbers about the manager and used one of them.
// squadTrust is EARNED here - results, kept promises - and it scales team
// talks. mgrReputation is what the CV says, and until this module it was a
// badge on the Profile screen and a job-market key, invisible to the men in
// the room. This makes it visible: a rookie walking into a title-favourite
// dressing room is questioned in ways a double-winner never is, and the way
// out is the same as real life - deliver, and the room stops asking.
//
// Everything here is a pure derivation or a deterministic gate (mulberry32 on
// ids and weeks, never the shared match rng). No new number is hidden: the
// Profile screen prints the standing, and every consequence says its name.
import type { GameState, Player, PressOption } from './model'
import { mgrReputation, squadTrust, SEASON_WEEKS } from './model'
import { clamp, mulberry32 } from './rng'
import { t, tIn, type Vars } from './i18n'
import { OFFICE_OUTLET } from './media'

const absWeek = (state: GameState) => state.season * SEASON_WEEKS + state.week

/** The squad's collective standing, on the same 0-100 ruler as the manager's
 *  reputation. The 23 that actually play, not the 45 on the books - a famous
 *  club with a thin squad is a thin squad. ca 60 reads about 23, ca 90 about
 *  82, so a mid-table room and a mid-career manager meet as equals. */
export function squadProfile(state: GameState, clubId: string): number {
  const club = state.clubs[clubId]
  if (!club) return 40
  const top = club.players
    .map(id => state.players[id])
    .filter((p): p is Player => !!p && !p.acad)
    .sort((a, b) => b.ca - a.ca)
    .slice(0, 23)
  if (!top.length) return 40
  const mean = top.reduce((s, p) => s + p.ca, 0) / top.length
  return clamp(Math.round((mean - 48) * 1.95), 0, 100)
}

export interface Standing {
  rep: number
  profile: number
  gap: number
  /** 0 = the room accepts you, 1 = the room is carrying you on sufferance */
  bite: number
  /** multiplier on playbook drilling speed (0.5 at full bite) */
  familiarity: number
  /** multiplier on team-talk effect distance (0.3 at full bite) */
  talk: number
}

/** Where the manager stands with this squad. Trust is earned HERE; standing
 *  is brought here - a manager can be out of his depth on paper and still
 *  hold a room he has won, which is why delivered trust cancels the strain
 *  entirely at 100. The gap only bites past twenty points. */
export function standing(state: GameState): Standing {
  const rep = mgrReputation(state)
  const profile = state.unemployed ? 0 : squadProfile(state, state.userClubId)
  const gap = rep - profile
  const strain = gap >= -20 ? 0 : Math.min(1, (-20 - gap) / 25)
  // Earned trust cancels the strain LINEARLY AND FULLY: at trust 100 the
  // room is yours and your CV stops mattering. The first cut left a quarter
  // of the strain in place forever, and trustprobe rightly objected - the
  // trust system's own promise is that a fully bought-in room gives the
  // full designed effect, and this module composes with that promise
  // rather than quietly breaking it.
  const earned = squadTrust(state) / 100
  const bite = strain * (1 - earned)
  return {
    rep, profile, gap, bite,
    familiarity: 1 - bite * 0.5,
    talk: 1 - bite * 0.7,
  }
}

/** One sentence for the Profile screen, honest about which way it points. */
export function standingWord(s: Standing): string {
  if (s.bite <= 0.05) return t(s.gap >= 10 ? 'profile.standCarries' : 'profile.standFaceValue')
  if (s.bite < 0.35) return t('profile.standSomeAsk')
  if (s.bite < 0.65) return t('profile.standOutranks')
  return t('profile.standNoName')
}

// ---------------------------------------------------------------------------
// The discipline ledger. An infraction is not a morale event, it is a TEST OF
// AUTHORITY: the same missed gym session is a quiet word from a proven
// manager and a stand-off from an unproven one.
// ---------------------------------------------------------------------------

type Incident = NonNullable<GameState['incidents']>[number]

const live = (i: Incident) => i.state === 'festering' || i.state === 'challenged'

export function incidentsOf(state: GameState): Incident[] {
  return (state.incidents ??= [])
}

/** The weekly pass, user club only: surface at most one new infraction, age
 *  the unanswered ones into festering, and let the senior players call their
 *  meeting when the room has had enough. Deterministic gates throughout. */
export function disciplineWeek(state: GameState) {
  if (state.unemployed) return
  const now = absWeek(state)
  const list = incidentsOf(state)

  // the desk does not wait forever: a flagged incident the manager has not
  // dealt with inside two weeks was dealt with by silence
  for (const inc of list) {
    if (inc.state === 'flagged' && now - (inc.season * SEASON_WEEKS + inc.week) >= 2) {
      applyResponse(state, inc, 'ignore', true)
    }
  }

  // at most one new incident a week, and none while two are already open -
  // the machine models a dressing room, not a queue
  const open = list.filter(i => i.state === 'flagged' || live(i))
  if (open.length < 2) {
    const club = state.clubs[state.userClubId]
    const candidates = club.players
      .map(id => state.players[id])
      .filter((p): p is Player => !!p && !p.acad && !p.injury && !p.natSquad)
      .filter(p => !list.some(i => i.pid === p.id && now - (i.season * SEASON_WEEKS + i.week) < 10))
    for (const p of candidates) {
      const sulky = (p.pers === 'Temperamental' || p.pers === 'Mercenary') && p.morale < 4.5
      const poorWeek = (p.lastR ?? 6) < 4.6
      if (!sulky && !poorWeek) continue
      // base odds are LOW and flat: authority decides how an incident ENDS,
      // not how often the squad misbehaves - punishing the rookie twice over
      // would be the same thumb on the scale twice
      const roll = mulberry32((state.seed * 31 + p.id * 13 + now * 7) >>> 0)()
      if (roll >= (sulky ? 0.10 : 0.06)) continue
      raiseIncident(state, p, sulky ? 'training' : 'rating')
      break
    }
  }

  // the senior challenge: two live grievances and the leaders knock
  const grievances = list.filter(live)
  if (grievances.length >= 2 && (state.challengeAt == null || now - state.challengeAt >= 8)) {
    const a = standing(state)
    if (a.bite > 0.2) {
      state.challengeAt = now
      const club = state.clubs[state.userClubId]
      const senior = club.players.map(id => state.players[id])
        .filter((p): p is Player => !!p && !p.acad)
        .sort((x, y) => (y.a.lea + y.ca / 10) - (x.a.lea + x.ca / 10))[0]
      state.mgrTrust = clamp((state.mgrTrust ?? 30) - 4, 0, 100)
      for (const id of club.players) {
        const p = state.players[id]
        if (p && !p.acad) p.morale = clamp(p.morale - 0.3, 1, 10)
      }
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
        subject: `🚪 ${senior?.name ?? 'The senior players'} asks for a meeting`,
        body: [
          `${senior?.name ?? 'A delegation of senior players'} comes to the office and closes the door. The message is polite and blunt: the room has watched two situations drift, and it wants to know who is in charge of this squad.`,
          `A manager with silverware shrugs this off. Right now, you have to answer it with results - settle the open incidents, win on Saturday, and the door stops opening.`,
        ].join('\n'),
        k: senior ? 'news.deputationNamed' : 'news.deputation',
        v: { player: senior?.name ?? '' },
        playerId: senior?.id,
      })
    }
  }

  // prune the history: resolved and more than a season old carries nothing
  state.incidents = list.filter(i =>
    i.state === 'flagged' || live(i) || now - (i.season * SEASON_WEEKS + i.week) < SEASON_WEEKS)
}

function raiseIncident(state: GameState, p: Player, kind: Incident['kind']) {
  const inc: Incident = {
    id: state.nextId++, pid: p.id, kind, state: 'flagged',
    season: state.season, week: state.week,
  }
  incidentsOf(state).push(inc)
  // this is a press item too, and it was built here rather than in media.ts -
  // which is how it stayed English while the rest of the press room was
  // translated. Same shape as everything else now: keys, not sentences.
  const qk = kind === 'training' ? 'press.discTraining' : 'press.discForm'
  const qv = { player: p.name }
  const disc = (lk: string, d: 'fine' | 'word' | 'ignore'): PressOption =>
    ({ label: tIn('en', lk), lk, morale: 0, board: 0, disc: d, reaction: '' })
  state.press.push({
    id: state.nextId++, week: state.week, season: state.season,
    outlet: OFFICE_OUTLET, answered: false, playerId: p.id, incidentId: inc.id,
    question: tIn('en', qk, qv), qk, qv,
    options: [
      disc('press.discFine', 'fine'),
      disc('press.discWord', 'word'),
      disc('press.discSlide', 'ignore'),
    ],
  })
}

/** Resolve one incident with the manager's chosen response. Returns the line
 *  the office prints. Whether a PUNISHMENT lands depends on standing: the
 *  same fine is discipline from a proven manager and provocation from an
 *  unproven one - which is the user's complaint made mechanical. */
/** The verdict on a disciplinary response.
 *
 *  Returns a key and its variables, not a sentence: the press room WRITES this
 *  onto the item and the coverage list reads it back weeks later, so a string
 *  translated here would be frozen in whatever language the button was pressed
 *  in. `text` is the English, kept for the same reason every stored body is. */
export interface Verdict { k: string; v?: Vars; text: string }
const verdict = (k: string, v?: Vars): Verdict => ({ k, v, text: tIn('en', k, v) })

export function applyResponse(state: GameState, inc: Incident, response: 'fine' | 'word' | 'ignore', silent = false): Verdict {
  if (inc.state !== 'flagged') return verdict('reply.momentPassed')
  const p = state.players[inc.pid]
  if (!p) { inc.state = 'handled'; return verdict('reply.alreadyLeftClub') }
  const a = standing(state)

  if (response === 'ignore') {
    inc.state = 'festering'
    p.morale = clamp(p.morale - 0.3, 1, 10)
    if (!silent) return verdict('reply.incidentIgnored', { player: p.name })
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
      subject: `The ${p.name} situation drifts`,
      body: `Two weeks on, nothing said. The squad has noticed that ${p.name} got away with it, and the standard you walk past is the standard you accept.`,
      k: 'news.incidentDrifts', v: { player: p.name },
      playerId: p.id,
    })
    return verdict('common.nothing')
  }

  // a soft response always lands, but only a hard one rebuilds authority
  if (response === 'word') {
    inc.state = 'handled'
    p.morale = clamp(p.morale - 0.1, 1, 10)
    return verdict('reply.incidentWord', { player: p.name })
  }

  // the fine: deterministic on the incident id, biased by standing
  const lands = mulberry32((state.seed + inc.id * 977) >>> 0)() > a.bite
  if (lands) {
    inc.state = 'handled'
    p.morale = clamp(p.morale - 0.2, 1, 10)
    state.mgrTrust = clamp((state.mgrTrust ?? 30) + 1, 0, 100)
    return verdict('reply.incidentFineLands', { player: p.name })
  }
  inc.state = 'challenged'
  p.morale = clamp(p.morale - 1.0, 1, 10)
  state.mgrTrust = clamp((state.mgrTrust ?? 30) - 3, 0, 100)
  const club = state.clubs[state.userClubId]
  for (const id of club.players) {
    const ally = state.players[id]
    if (ally && ally !== p && !ally.acad && ally.pos === p.pos) ally.morale = clamp(ally.morale - 0.3, 1, 10)
  }
  return verdict('reply.incidentFineChallenged', { player: p.name })
}
