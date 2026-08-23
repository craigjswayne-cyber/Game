import type { Club, FacilityId, GameState } from './model'
import { ATTR_KEYS, SEASON_WEEKS, emptyStats, finalVenue, initFacilities } from './model'
import { ensureCaptains } from './analysis'
import { buildPlayer, deriveCaps, deriveHist, deriveTrait, resetIds , playerWage } from './attributes'
import { LEAGUE_DEFS, seedExClubs } from './newgame'
import { autoSelect } from './matchEngine'
import { NATIONS, regenName, worldNames } from './nations'
import { rebuildTable } from './season'
import { hashString, mulberry32 } from './rng'
import { seedNatRank } from './natrank'
import { seedPhilosophies } from './philosophy'
import { applyStadiumName, seedDeals } from './commercial'
import { seedStaffPeople } from './staff'
import { ensureAcademyLeague, topUpAcademy } from './academy'

// NOT renamed with the game. This string is the key every existing save lives
// under, so changing it to 'fab-rugby' would not rename anything - it would point
// the game at an empty database and every career would appear to have vanished.
const DB_NAME = 'rugby-manager'
const STORE = 'saves'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export interface SaveMeta {
  slot: string
  club: string
  season: number
  week: number
  savedAt: number
  managerName: string
}

export async function saveGame(slot: string, state: GameState): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const meta: SaveMeta = {
      slot,
      club: state.clubs[state.userClubId]?.name ?? '?',
      season: state.season,
      week: state.week,
      savedAt: Date.now(),
      managerName: state.managerName,
    }
    // NO MANUAL DEEP CLONE. This used to be JSON.parse(JSON.stringify(state)),
    // which is a full round-trip of the whole save on the main thread before
    // IndexedDB then structured-clones it itself: measured at 92ms on a 6.8MB
    // five-season save in a desktop container, so a good deal more than that on
    // the phone this is played on, every single week, for nothing.
    //
    // put() clones what it is given, so passing state straight in does the job
    // once instead of twice. What the JSON round-trip also did, silently, was
    // strip anything unserialisable - so if a Map, a Set or a function ever
    // reaches GameState, this now throws DataCloneError at save time on somebody's
    // phone rather than quietly dropping the field. scripts/cloneprobe.ts is the
    // tripwire for that, and it holds a real five-season save.
    tx.objectStore(STORE).put({ meta, state }, slot)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

// ---- the live match in progress ------------------------------------------
//
// Its own key, one per slot, so writing it never touches the 7MB career save.
// The record itself carries a copy of the pre-match state (see resume.ts for why
// replay beats serialising), which is why it is written ONCE at kick-off and only
// its short command list is updated after that.
const resumeKey = (slot: string) => `${slot}::live`

export async function putResume(slot: string, rec: unknown): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(JSON.parse(JSON.stringify(rec)), resumeKey(slot))
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function getResume<T>(slot: string): Promise<T | null> {
  const db = await openDb()
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(resumeKey(slot))
    req.onsuccess = () => { db.close(); resolve((req.result as T) ?? null) }
    req.onerror = () => { db.close(); resolve(null) }
  })
}

export async function clearResume(slot: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(resumeKey(slot))
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); resolve() }
  })
}

/** Backfill fields added since a save was written. */
export function migrate(s: GameState): GameState {
  // ---- the collections the game reads without asking whether they are there ----
  //
  // A save written by an older build is simply missing the fields that build had
  // never heard of, and a save mangled by a bad copy can hold the wrong kind of
  // thing entirely. Either way the game reads state.news.filter(...) on the very
  // first tick and dies on the way to the title screen - which reads to the
  // player as "my career is gone", not "one field was absent".
  //
  // So every list and map the engine treats as always-present is made so here,
  // once, at the only gate between the file and the game. Found by
  // scripts/savefuzz.ts, which deletes each of them in turn.
  const asList = <T>(v: unknown): T[] => (Array.isArray(v) ? v as T[] : [])
  const asMap = <T>(v: unknown): Record<string, T> =>
    (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, T> : {})
  s.news = asList(s.news)
  s.press = asList(s.press)
  s.offers = asList(s.offers)
  s.fixtures = asList(s.fixtures)
  s.history = asList(s.history)
  s.mentors = asList(s.mentors)
  s.pledges = asList(s.pledges)
  s.preContracts = asList(s.preContracts)
  s.comps = asMap(s.comps)
  // COMPETITION NAMES LIVE IN THE SAVE, so a career started before v1.0.3
  // carries the old real-world names in state.comps and would keep showing them
  // for the rest of its life - rollover only rebuilds the cups, never the
  // leagues. Renaming by id on load is the only thing that reaches an
  // in-flight career. Keyed on id, so it is also the one place to change if a
  // competition is ever renamed again.
  const COMP_NAMES: Record<string, [string, string]> = {
    prem: ['English Premier Division', 'Premier'],
    top14: ['French Elite 14', 'Elite 14'],
    urc: ['United Provinces Championship', 'UPC'],
    srp: ['Pacific Championship', 'Pacific'],
    champ: ['English Championship', 'Championship'],
    prod2: ['French Elite 2', 'Elite 2'],
    jl1: ['Japan Division One', 'Japan D1'],
    natl1: ['English National One', 'National 1'],
    cc: ['Continental Cup', 'Continental Cup'],
    chc: ['Continental Shield', 'Continental Shield'],
    wc: ['World Championship', 'Worlds'],
    sn: ['Northern Championship', 'Northern'],
    trc: ['The Southern Championship', 'Southern'],
    pnc: ['Pacific Islands Cup', 'Islands Cup'],
  }
  for (const [id, [name, short]] of Object.entries(COMP_NAMES)) {
    const c = s.comps[id]
    if (c) { c.name = name; c.short = short }
  }
  s.natSquads = asMap(s.natSquads)
  s.players = asMap(s.players)
  s.clubs = asMap(s.clubs)

  // ---- the scalars the whole calendar hangs off ----
  //
  // week and season index into the fixture list and the record books, so a week
  // of "three", of -5, or of null does not fail politely: it reads undefined out
  // of an array and throws on the first tick after loading. Coerce them into
  // range instead. Anything unreadable starts the season at week one, which is a
  // playable career rather than a dead one.
  const int = (v: unknown, min: number, max: number, dflt: number) => {
    const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : Number.NaN
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : dflt
  }
  s.season = int(s.season, 0, 999, 0)
  s.week = int(s.week, 1, SEASON_WEEKS, 1)
  s.day = int(s.day, 0, 5, 0) as GameState['day']
  if (!Number.isFinite(s.seed)) s.seed = hashString(`${s.userClubId ?? 'rugby'}-${s.season}`)

  // ---- prune the rubbish out of the lists ----
  //
  // A story that is not an object at all - a null left by a bad write - throws
  // the moment anything reads its week. Drop those, and fill the holes in the
  // half-written ones, so a damaged inbox costs the player some stories rather
  // than the career.
  const story = (n: unknown): boolean => !!n && typeof n === 'object'
  s.news = s.news.filter(story)
  for (const n of s.news) {
    n.week = int(n.week, 1, SEASON_WEEKS, 1)
    n.season = int(n.season, 0, 999, s.season)
    n.type ??= 'gossip'
    if (typeof n.subject !== 'string' || !n.subject) n.subject = 'From the archive'
    if (typeof n.body !== 'string') n.body = ''
    n.read ??= true
  }
  s.press = s.press.filter(p => story(p) && typeof (p as { question?: unknown }).question === 'string')
  s.offers = s.offers.filter(story)
  s.fixtures = s.fixtures.filter(story)
  s.mentors = s.mentors.filter(story)
  s.pledges = s.pledges.filter(story)
  s.preContracts = s.preContracts.filter(story)

  // ---- the id counter must clear everything already in the world ----
  //
  // nextId is shared by news, fixtures and offers. A save holding a NaN or a
  // negative there mints duplicate ids for ever afterwards, and two stories with
  // the same id is an inbox that opens the wrong letter. Take the highest id
  // actually in use and start above it.
  const highestId = Math.max(
    0,
    ...s.news.map(n => (typeof n.id === 'number' && Number.isFinite(n.id) ? n.id : 0)),
    ...s.fixtures.map(f => (typeof f.id === 'number' && Number.isFinite(f.id) ? f.id : 0)),
    ...s.offers.map(o => (typeof o.id === 'number' && Number.isFinite(o.id) ? o.id : 0)),
  )
  s.nextId = Math.max(
    typeof s.nextId === 'number' && Number.isFinite(s.nextId) ? Math.round(s.nextId) : 0,
    highestId + 1,
    1,
  )
  // and any story still lacking an id gets one now, so nothing shares
  for (const n of s.news) {
    if (typeof n.id !== 'number' || !Number.isFinite(n.id)) n.id = s.nextId++
  }

  // ---- the world has to point at itself ----
  //
  // Every one of these is a dangling reference, and a dangling reference in a
  // save file is not a cosmetic problem: a player with no attributes crashes the
  // first scrum, a fixture between two clubs that are not in the file cannot be
  // played or tabulated, and a squad listing a player who is gone shows an empty
  // row the manager can tap. Repair them here, where there is still a chance to,
  // rather than discovering each one separately at kick-off.
  const num = (v: unknown, min: number, max: number, dflt: number) => {
    const n = typeof v === 'number' && Number.isFinite(v) ? v : Number.NaN
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : dflt
  }
  for (const p of Object.values(s.players)) {
    if (!p || typeof p !== 'object') continue
    p.ca = int(p.ca, 1, 100, 50)
    p.pa = int(p.pa, p.ca, 100, p.ca)
    p.age = int(p.age, 15, 45, 25)
    p.form = num(p.form, 0, 10, 6)
    p.morale = num(p.morale, 0, 10, 6)
    p.cond = num(p.cond, 0, 100, 100)
    p.sharp = num(p.sharp, 0, 100, 60)
    p.wage = num(p.wage, 0, 1_000_000_000, 5_000)
    p.value = num(p.value, 0, 1_000_000_000_000, 100_000)
    p.bans = int(p.bans, 0, 99, 0)
    if (typeof p.name !== 'string' || !p.name) p.name = 'Unnamed Player'
    p.stats ??= emptyStats()
    // an attribute grid that is missing or not an object: derive a flat set from
    // his ability rather than crashing the first time the pack engages
    if (!p.a || typeof p.a !== 'object') {
      const base = Math.max(1, Math.min(20, Math.round(p.ca / 5)))
      p.a = Object.fromEntries(ATTR_KEYS.map(k => [k, base])) as typeof p.a
    } else {
      for (const k of ATTR_KEYS) p.a[k] = int(p.a[k], 1, 20, 10)
    }
    // a club that is not in the file means free agency, not a ghost employer
    if (p.clubId != null && !s.clubs[p.clubId]) p.clubId = null
  }
  for (const c of Object.values(s.clubs)) {
    if (!c || typeof c !== 'object') continue
    if (!Array.isArray(c.players)) c.players = []
    // a roster lists only men who say they play here: an id naming nobody, or
    // naming somebody whose club is now elsewhere (or nowhere, because the club
    // in his record does not exist in this file), is dropped
    c.players = c.players.filter(id => !!s.players[id] && s.players[id].clubId === c.id)
    c.balance = num(c.balance, -1_000_000_000_000, 1_000_000_000_000, 0)
    c.budget = num(c.budget, 0, 1_000_000_000_000, 0)
    c.wageBudget = num(c.wageBudget, 0, 1_000_000_000_000, 100_000)
    // A WAGE BUDGET THAT IS NOT A WEEKLY FIGURE. Careers started before the fix
    // carry `transfer budget * 0.9 + 2.5m` in a field the game prints as "/wk"
    // and compares against a weekly bill - sixteen times the real number at
    // Harlequins. Recompute it for any save whose budget is wildly out of
    // proportion to the wages the club actually pays, and leave a sane one alone.
    {
      const bill = c.players.reduce((t: number, id: number) => {
        const p = s.players[id]
        return p && !p.acad ? t + (Number.isFinite(p.wage) ? p.wage : 0) : t
      }, 0)
      if (bill > 0 && c.wageBudget > bill * 4) {
        c.wageBudget = Math.max(50_000, Math.round((bill * 1.18) / 1_000) * 1_000)
      }
    }
    c.boardConfidence = num(c.boardConfidence, 0, 100, 55)
    c.capacity = Math.max(1, int(c.capacity, 1, 10_000_000, 10_000))
  }
  // a fixture needs two sides that exist and a week inside the season
  const realTeam = (id: unknown) =>
    typeof id === 'string' && (!!s.clubs[id] || NATIONS.some(n => n.code === id))
  s.fixtures = s.fixtures.filter(f => realTeam(f.homeId) && realTeam(f.awayId))
  for (const f of s.fixtures) f.week = int(f.week, 1, SEASON_WEEKS, 1)

  // ---- and the standings have to match the results ----
  for (const comp of Object.values(s.comps)) {
    if (!comp || comp.type !== 'league' || !Array.isArray(comp.table)) continue
    const wrong = comp.table.some(r => {
      if (!r || typeof r !== 'object') return true
      if (!Number.isFinite(r.p) || r.w + r.d + r.l !== r.p) return true
      const played = s.fixtures.filter(f =>
        f.compId === comp.id && f.played && !f.stage &&
        (f.homeId === r.teamId || f.awayId === r.teamId)).length
      return r.p !== played
    })
    if (wrong) rebuildTable(comp, s.fixtures, s)
  }

  s.shortlist ??= []
  // ??= is not enough here: a save holding a STRING in this field passes the
  // null check and then throws on the first property assignment, because you
  // cannot create a property on a primitive. Replace anything that is not an
  // object outright.
  if (!s.staff || typeof s.staff !== 'object' || Array.isArray(s.staff)) {
    s.staff = { assistant: 0, physio: 0, scout: 0, attack: 0, defence: 0, scrumCoach: 0, kicking: 0, academyCoach: 0 }
  }
  if (!s.mgr || typeof s.mgr !== 'object' || Array.isArray(s.mgr)) {
    s.mgr = { m: 0, w: 0, d: 0, l: 0, trophies: [], finishes: [], signings: 0, spent: 0 }
  }
  s.staff.attack ??= 0
  s.staff.defence ??= 0
  s.staff.scrumCoach ??= 0
  s.staff.kicking ??= 0
  s.staff.academyCoach ??= 0
  s.mgr ??= { m: 0, w: 0, d: 0, l: 0, trophies: [], finishes: [], signings: 0, spent: 0 }
  s.mgr.moms ??= 0
  // every career started before origins existed came up the coaching route
  s.mgrOrigin ??= 'coach'
  s.vacancies ??= []
  s.devFocus ??= []
  s.natTeam ??= null
  s.natOffer ??= null
  s.natLineup ??= null
  s.objectives ??= ['youth', 'derby']
  s.finHist ??= []
  s.boardOwed ??= false
  // facilities moved onto the clubs (every club in the world has an estate,
  // and taking a new job means inheriting that club's buildings). Levels the
  // manager already paid for at his own club are kept, whichever is higher.
  // A tactical dial that is absent, null or not a number reads as the middle of
  // the dial. The match engine clamps these too, but healing them on the way in
  // means the sliders on the tactics screen have something to point at as well -
  // a save written before a dial existed used to leave the UI reading NaN.
  // Found by scripts/sheetfuzz.ts.
  const dial = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 50)
  for (const c of Object.values(s.clubs)) {
    // a club with no tactic at all - later code reads tactic.roles and threw
    if (!c.tactic || typeof c.tactic !== 'object') {
      c.tactic = {
        style: 50, tempo: 50, kicking: 50, aggression: 50,
        lineup: Array.from({ length: 23 }, () => null), roles: [],
      }
    }
    if (c.tactic) {
      c.tactic.style = dial(c.tactic.style)
      c.tactic.tempo = dial(c.tactic.tempo)
      c.tactic.kicking = dial(c.tactic.kicking)
      c.tactic.aggression = dial(c.tactic.aggression)
      if (!Array.isArray(c.tactic.lineup)) c.tactic.lineup = Array.from({ length: 23 }, () => null)
    }
    if (!c.facilities) c.facilities = initFacilities(c, s.seed)
  }
  if (s.facilities && Object.keys(s.facilities).length) {
    const uc = s.clubs[s.userClubId]
    if (uc) {
      for (const [fid, lvl] of Object.entries(s.facilities) as [FacilityId, number][]) {
        uc.facilities = { ...(uc.facilities ?? {}), [fid]: Math.max(lvl, uc.facilities?.[fid] ?? 0) }
      }
    }
    s.facilities = {}
  }
  s.decisions ??= []
  s.analyst ??= null
  s.analystRecord ??= { right: 0, wrong: 0 }
  s.commission ??= null
  s.scoutFinds ??= null
  s.facilityBuild ??= null
  s.facilityAskCooldown ??= 0
  // the backroom staff became people: give every level already paid for a face
  seedStaffPeople(s)
  s.celebration ??= null
  s.records ??= {}
  s.mentors ??= []
  s.chem ??= {}
  s.grudges ??= []
  s.review ??= null
  s.fanMood ??= 60
  s.hof ??= []
  s.scoutFocus ??= null
  s.slAlerted ??= []
  s.pledges ??= []
  s.intakeClass ??= null
  s.preContracts ??= []
  s.takeover ??= null
  s.newOwnerUntil ??= null
  s.derbyBook ??= {}
  s.annals ??= s.review ? [s.review] : []
  s.crisisAt ??= {}
  seedNatRank(s)
  s.natConfidence ??= s.natTeam ? 60 : null
  s.tenureStart ??= s.season
  s.legendOf ??= []
  s.vsBook ??= {}
  s.gateRecord ??= null
  s.potyRoll ??= []
  s.courtedAt ??= 0
  s.courtedBy ??= null
  s.vowedAt ??= 0
  s.agency ??= { seniors: [], kids: [], best: {} }
  for (const c of Object.values(s.clubs)) { c.captain ??= null; c.vice ??= null; c.legends ??= []; c.marquee ??= []; c.tactic.roles ??= []; if (c.id !== s.userClubId) c.coach ??= 'The Head Coach' }
  const PERS = ['Professional', 'Loyal', 'Ambitious', 'Mercenary', 'Temperamental', 'Leader'] as const
  for (const p of Object.values(s.players)) {
    p.pers ??= PERS[p.id % PERS.length]
    p.sc ??= p.clubId === s.userClubId ? 100 : 30
    p.onLoan ??= false
    p.retiring ??= false
    p.debutPending ??= null
    p.ca0 ??= p.ca
    p.rust ??= 0
    p.loanFrom ??= null
    p.acad ??= false
    p.stats.mins ??= 0
    // the Player of the Month window (SeasonStats.mSum). Starting an old save at
    // zero costs at most one award decided on a short window, which is a great
    // deal better than the old one decided on rolling season form.
    p.stats.mSum ??= 0
    p.stats.mApps ??= 0
    // academy men move onto development deals. A live save was carrying a whole
    // academy on first-team money, which is what made the user's club insolvent
    // by simply playing its fixtures (see playerWage).
    if (p.acad) p.wage = playerWage(p.ca, p.age, true)
    if (p.trait === undefined) p.trait = deriveTrait(p)
    p.hist ??= deriveHist(p)
    p.caps ??= deriveCaps(p)
  }
  // CRITICAL: restore the player-id counter. Only newGame resets it, so a
  // cold-started session that loads a save would otherwise mint new player
  // ids from 1, silently overwriting existing players at the next intake.
  const maxPid = Object.keys(s.players).reduce((m, k) => Math.max(m, Number(k)), 0)
  resetIds(maxPid + 1)

  // leagues added in later builds: inject their clubs & squads so existing
  // careers gain them (fixtures/tables arrive at the next season rebuild)
  const rng = mulberry32(0xadd1e ^ (s.season * 977 + s.week))
  for (const def of LEAGUE_DEFS()) {
    for (const rc of def.clubs) {
      if (s.clubs[rc.id]) continue
      const club: Club = {
        id: rc.id, name: rc.name, short: rc.short, city: rc.city,
        country: rc.country, stadium: rc.stadium, capacity: rc.capacity, capacity0: rc.capacity,
        colors: rc.colors, rep: rc.rep, leagueId: def.id,
        budget: rc.budget, balance: Math.round(rc.budget * 0.6),
        players: [],
        tactic: { style: 50, tempo: 50, kicking: 50, aggression: 50, lineup: new Array(23).fill(null) },
        wageBudget: Math.round(rc.budget * 0.9 + 2_500_000),
        boardConfidence: 70,
        captain: null,
        coach: regenName(rng, rc.country === 'EUR' ? 'ENG' : rc.country, worldNames(s)),
      }
      for (const rp of rc.players) {
        const p = buildPlayer(rp, club.id, (0xadd1e ^ hashString(rc.id)) + club.players.length * 13, s.season)
        s.players[p.id] = p
        club.players.push(p.id)
      }
      s.clubs[club.id] = club
      club.tactic.lineup = autoSelect(s, club.players.map(id => s.players[id]).filter(Boolean))
    }
  }

  // squads were raised to 38 seniors / 42 men (user feedback: too thin) -
  // existing careers get the same depth once, fringe quality, thinnest
  // positions first. Saves stamped at the short-lived 38 standard top up too
  if ((s.squadDepth ?? 0) < 42) {
    s.squadDepth = 42
    const FILL = ['LP', 'HK', 'TP', 'LK', 'LK', 'FL', 'FL', 'N8', 'SH', 'FH', 'CE', 'CE', 'WG', 'WG', 'FB'] as const
    for (const club of Object.values(s.clubs)) {
      let guard = 0
      while (club.players.length < 42 && guard++ < 14) {
        const byPos: Record<string, number> = {}
        for (const id of club.players) {
          const p = s.players[id]
          if (p) byPos[p.pos] = (byPos[p.pos] ?? 0) + 1
        }
        const pos = [...FILL].sort((a, b) => (byPos[a] ?? 0) - (byPos[b] ?? 0))[0]
        const p = buildPlayer(
          {
            name: regenName(rng, club.country, worldNames(s)), pos, age: 21 + Math.floor(rng() * 9),
            nat: club.country, q: Math.max(42, club.rep - 16 + Math.floor(rng() * 10)),
            gk: (pos === 'FH' || pos === 'FB') && rng() < 0.3,
          },
          club.id, 0xdee9 + club.players.length * 31 + guard, s.season)
        s.players[p.id] = p
        club.players.push(p.id)
      }
    }
  }

  // F23: a save written before philosophies existed has 96 dugouts sitting on
  // flat 50s. Give each of them the idea its squad suits. The club you manage is
  // skipped, so your own dials survive the load untouched.
  //
  // AFTER the league injection and the squad top-up above, deliberately: the
  // choice reads the balance of the squad, so asking before the new clubs have
  // players would hand every one of them the coin-toss fallback.
  seedPhilosophies(s)
  // F30: a save written before the commercial department existed has no deals at
  // all. Without this it would lose every penny of sponsorship on load, because
  // weeklyCentral no longer pays it. Inherited fully sold at market rate, which
  // is exactly what the flat formula used to pay.
  seedDeals(s)

  // THE GATES MATCH THE DEAL (user: "the naming rights for the stadium have
  // been sold in game - why is it not updating in game?"). A live naming
  // deal signed before signOffer renamed anything left the deal card and the
  // stadium line in permanent disagreement - heal on load, idempotently, so
  // the sponsor the Finances page has always named is the one over the
  // gates. New worlds agree from day one (seedDeals derives the inherited
  // sponsor from the data's own name where it carries one).
  {
    const d = s.deals?.naming
    const club = s.clubs[s.userClubId]
    if (d && club && d.until >= s.season && !club.stadium.startsWith(d.sponsor)) {
      applyStadiumName(s, d.sponsor)
    }
  }

  // The academy became a 27-man team with its own A League (feedback 10G), so an
  // existing career gets the same academy in the same shape.
  //
  // PER CLUB, not per save. The first cut stamped s.acadDepth and skipped the work
  // if the save already carried it - which meant the 24 clubs the natl1/jl1
  // migration injects a few lines above, and every club a future build adds, came
  // into the world with no academy at all and no way to field an A League side.
  // topUpAcademy is a no-op on a full academy, so asking all 101 costs nothing.
  for (const club of Object.values(s.clubs)) topUpAcademy(s, club, rng, 0xACAD)
  ensureAcademyLeague(s)

  // clubs injected by a later build get an estate too
  for (const c of Object.values(s.clubs)) c.facilities ??= initFacilities(c, s.seed)
  // the catchment anchor. An existing career may already have extended its
  // ground, and shrinking the anchor retroactively would tell the manager his
  // own stand should never have been built - so today's capacity is the anchor
  for (const c of Object.values(s.clubs)) c.capacity0 ??= c.capacity

  // pre-2025 former clubs (old-boy stories): fills only players still unset.
  // First, take back the ones the seeder should never have written: exClub is
  // only ever set by seedExClubs, so on a hand-written player it is always an
  // invented history (the briefing claimed Nick David left Northampton and
  // Ollie Sleightholme left Harlequins - neither happened). Strip it; moves
  // made inside this career live in p.career and are untouched.
  for (const p of Object.values(s.players)) {
    if (p?.real && p.exClub) { p.exClub = null; delete p.exApps }
  }
  seedExClubs(s)

  // showpiece finals moved to neutral grounds: a save carrying an unplayed
  // final from an older build still has it at the higher seed's place, so
  // stamp the venue now. finalVenue is a pure function of seed and season,
  // which is what lets a mid-season save agree with a fresh one.
  for (const f of s.fixtures) {
    if (f.stage === 'F' && !f.played && !f.venue && s.clubs[f.homeId]) {
      const v = finalVenue(s, f.compId)
      if (v) f.venue = v
    }
  }

  ensureCaptains(s, true)
  return s
}

/**
 * Is this actually a rugby career, or just a file?
 *
 * migrate() heals a great deal - a missing list, a dial that is not a number, a
 * team sheet that is not an array - because all of those describe a real career
 * written by an older build. What it cannot invent is the world itself. A save
 * with no clubs, no players or no competitions in it has nothing to play, and
 * pretending otherwise produced headlines reading "undefined round-up" and a
 * career that fell over a few weeks later.
 *
 * Refusing it is the honest answer: the slot reads as empty, the title screen
 * offers a new career, and nothing half-loads. Found by scripts/savefuzz.ts.
 */
export function isPlayable(s: GameState | null | undefined): boolean {
  if (!s || typeof s !== 'object') return false
  const has = (v: unknown) => !!v && typeof v === 'object' && Object.keys(v as object).length > 0
  if (!has(s.clubs) || !has(s.players) || !has(s.comps)) return false
  if (typeof s.userClubId !== 'string' || !s.clubs[s.userClubId]) return false
  return true
}

export async function loadGame(slot: string): Promise<GameState | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(slot)
    req.onsuccess = () => {
      db.close()
      if (!req.result) { resolve(null); return }
      let healed: GameState | null = null
      try {
        healed = migrate(req.result.state as GameState)
      } catch (e) {
        // a file too damaged even to heal reads as an empty slot rather than
        // taking the app down on the way to the title screen
        console.error('save could not be read', e)
        resolve(null)
        return
      }
      resolve(isPlayable(healed) ? healed : null)
    }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

export async function listSaves(): Promise<SaveMeta[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => {
      db.close()
      // The store also holds the live-match records now (slot::live), which are
      // not saves and have no meta. Without this filter the Load screen would
      // list an undefined row for every career with a match in progress.
      resolve((req.result ?? [])
        .filter((r: { meta?: SaveMeta }) => !!r && !!r.meta && typeof r.meta.slot === 'string')
        .map((r: { meta: SaveMeta }) => r.meta)
        .sort((a, b) => b.savedAt - a.savedAt))
    }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

export async function deleteSave(slot: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(slot)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}
