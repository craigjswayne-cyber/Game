// The Test windows and the national squads. Split out of season.ts, which
// re-exports the public parts.
import type { Competition, GameState, Player } from '../model'
import { W, genderOf } from '../gender'
import { islesCoach, isleTour } from '../isles'
import { windowSpan } from '../calendar'
import { buildPlayer } from '../attributes'
import { NAT_DEPTH, NAT_SQUAD_FLOOR, NAT_SQUAD_SIZE, homeBased, clubQuotaLeft, conflictedClub, federationList, federationPick, releaseClubDuty, withFrontRow, nationByCode, nationNameIn, nationVars, regenName, worldNames } from '../nations'
import { isMyClub } from '../model'
import { clamp, type Rng } from '../rng'
import { tIn } from '../i18n'

// ------------------------------------------------------------------
// Internationals
// ------------------------------------------------------------------

export interface Window { start: number; end: number; nations: string[]; size: number }

/** Call-up windows for the competitions that actually exist this season.
 *  Exported for the country desk: call-up and drop need the window's squad
 *  cap, and the screen needs to know whether a window is open at all. */
export function activeWindows(state: GameState): Window[] {
  // THE SPANS COME FROM calendar.ts (1.6.5). They used to be computed here as
  // "first fixture week minus one", which put the summer camps in week 43 -
  // the finals week - so every finalist's internationals left the week before
  // the final. Each competition's span is now declared once, next to the
  // weeks it plays, with the invariant that checks the two agree.
  const gender = genderOf(state)
  const nationsOf: Record<string, (c: Competition) => string[]> = {
    trc: () => ['NZL', 'RSA', 'AUS', 'ARG'],
    aut: () => ['ENG', 'FRA', 'IRE', 'SCO', 'WAL', 'ITA', 'NZL', 'RSA', 'AUS', 'ARG', 'FIJ', 'JPN'],
    sn: () => ['ENG', 'FRA', 'IRE', 'SCO', 'WAL', 'ITA'],
  }
  const out: Window[] = []
  for (const id of ['wc', 'trc', 'pnc', 'aut', 'sn', W + 'sn', W + 'p4', W + 'aut', W + 'sum', 'tour', 'lions', W + 'lions']) {
    const comp = state.comps[id]
    if (!comp) continue
    const span = windowSpan(id, gender)
    if (!span) continue
    out.push({ start: span[0], end: span[1], nations: (nationsOf[id] ?? (c => c.teamIds))(comp), size: NAT_SQUAD_SIZE })
  }
  return out
}

export function manageInternationals(state: GameState, rng: Rng) {
  for (const w of activeWindows(state)) {
    if (state.week === w.start) {
      // call-ups
      const userCalls: Player[] = []
      const lionsCalls: Player[] = []
      for (const nat of w.nations) {
        const HOME4 = ['ENG', 'IRE', 'SCO', 'WAL']
        // the user's own federation names its best REAL players, whatever
        // their age or rating - no floor keeps a young Scot at home while a
        // stand-in gets generated (user: "there should be no age limits or
        // restrictions on who should be picked"). AI nations keep the floor
        // so the wider Test world's squad quality is untouched.
        const usersNat = nat === state.natTeam || (nat === 'LIO' && islesCoach(state))
        // the squad, plus the next men in behind it
        const target = w.size + NAT_DEPTH
        const ranked = Object.values(state.players)
          .filter(p => (nat === 'LIO' ? HOME4.includes(p.nat) : p.nat === nat) &&
            // England and France pick from their own leagues, and the
            // federation's own list obeys the rule the coach obeys
            // (country.ts homeBased) - one predicate, or the announcement
            // names men the screen then refuses to keep
            p.clubId && homeBased(state, p, nat) && !p.injury && !p.onLoan &&
            (usersNat || p.ca >= 68))
          .sort((a, b) => b.ca - a.ca)
          // READ THE POOL DEEPER THAN THE SQUAD. This used to cut at w.size,
          // which made the count below useless as a test of a country's depth:
          // every nation on earth, England included, looked exactly 32 men
          // deep. Cut at squad-plus-depth and the number means what the next
          // line asks it to mean - how many men this country can actually put
          // forward.
        const pool = ranked.slice(0, target)
        // EMERGING NATIONS NEED A SQUAD AND SOMEBODY TO FIGHT FOR IT.
        //
        // Our club world does not carry enough home-based Georgians or Uruguayans
        // to field a Test squad, so they are generated. The first version stopped
        // the moment the squad was full, and that is the whole of this bug: every
        // qualified man in the country was IN the squad, natEligible came back
        // empty, and the country desk said "Nobody left standing outside camp".
        // Drop a man and he was instantly the only alternative to himself.
        //
        // Owner: "its saying nobody is fighting to get into the squad... if I drop
        // one player then they are the only ones available - this shouldn't be the
        // case."
        //
        // So it generates a POOL rather than a squad: the 32 who travel plus a
        // further NAT_DEPTH who did not make it and are visible on the desk as the
        // next men in. Only the best w.size are capped; the rest stay in the world
        // uncapped and callable, which is what makes selection a decision.
        // Big nations are untouched - their natural pool already runs to hundreds.
        //
        // The trigger is the POOL, not the squad. It used to fire only when a
        // nation could not nearly fill its 23, which meant Argentina - who can
        // field 34 qualified men and not a soul more - never generated anybody
        // and had exactly two players outside a 32-man camp. Thin is thin
        // whether you are two short of a squad or two short of a contest.
        if (nat !== 'LIO' && pool.length < target) {
          const natRep = nationByCode(nat)?.rep ?? 55
          const POS_CYCLE = ['LP', 'HK', 'TP', 'LK', 'LK', 'FL', 'FL', 'N8', 'SH', 'FH', 'CE', 'CE', 'WG', 'WG', 'FB'] as const
          let i = 0
          while (pool.length < target && i < target + 12) {
            const q = clamp(Math.round(natRep - 26 + rng() * 12), 40, 68)
            const hp = buildPlayer(
              {
                name: regenName(rng, nat, worldNames(state), genderOf(state)), pos: POS_CYCLE[i % POS_CYCLE.length],
                age: 22 + Math.floor(rng() * 9), nat, q,
                gk: (POS_CYCLE[i % POS_CYCLE.length] === 'FH') && rng() < 0.5,
              },
              null, state.seed + state.week * 131 + i * 17, state.season)
            state.players[hp.id] = hp
            pool.push(hp)
            i++
          }
        }
        // THE BEST OF THEM TRAVEL; THE REST ARE THE NEXT MEN IN. Re-sorted
        // because the generated players were pushed on the end rather than
        // merged in rating order, and a squad that is not the best of its own
        // pool is not a selection.
        pool.sort((a, b) => b.ca - a.ca)
        // ---- THE COACH NAMES HIS OWN SQUAD ----
        //
        // Owner, v1.1.17: "dont auto pick the squad, it should be the coaches
        // job to pick them."
        //
        // Every nation's squad was assembled here, the user's included, and the
        // country desk was handed a finished list to fiddle with. That is the
        // wrong way round for the one job the international game is FOR: the
        // squad is the decision, and it was being made for him before he saw a
        // name.
        //
        // So his nation's camp opens EMPTY and waits. Everybody else's is
        // picked exactly as before - thirty other federations naming squads is
        // world simulation, not a decision anybody is taking. The pool is still
        // built either way, because it is what the desk offers him to pick
        // from, and because the men in it need to exist.
        //
        // The camp cannot stay empty forever: nameNatSquad below fills it from
        // this same pool if the coach has not named it by the time a Test
        // arrives, so a Test is never played with twelve men.
        if (nat === state.natTeam) {
          state.natSquads[nat] = []
          state.natSent = []
          // the federation's own list, taken once as an AI federation takes it:
          // the yardstick the two-jobs rule measures him against all window
          state.natFed = { nat, ids: federationPick(state, nat, w.size).map(p => p.id) }
          // ...except for his own club's men the federation would take, when he
          // runs a club as well: they are released to camp as they would be to
          // any AI federation, so leaving them home is not his to decide (9.10)
          releaseClubDuty(state, nat, w.size)
          // THE SUMMONS, not an announcement. The federation is waiting on him
          // rather than handing him a team sheet, and it says so in the inbox
          // as well as holding Continue - one of those is a reminder and the
          // other is a wall, and a job this big deserves both.
          const v = { ...nationVars(nat), n: NAT_SQUAD_FLOOR }
          state.news.push({
            id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
            subject: tIn('en', 'news.natNameSubj', v),
            body: tIn('en', 'news.natName', v),
            k: 'news.natName', v,
          })
          continue
        }
        // the front row may come from below the depth cut: a third hooker is
        // picked before a twentieth back, however far down the list he sits
        // AND FROM BELOW THE RATING BAR (1.8.17). The pool only reads men rated
        // 68 and up, so a week with two hookers hurt left a country with one
        // fit hooker over the bar and a squad that could not name a legal 23
        // (frontrowsquadprobe: 4 of 182, once tiredness weighed more and the
        // knocks came a little more often). A federation calls up its next
        // fit front-rower whatever his rating rather than play uncontested;
        // they are only reached for when the squad is short.
        const frCover = Object.values(state.players)
          .filter(p => (nat === 'LIO' ? HOME4.includes(p.nat) : p.nat === nat) &&
            p.clubId && homeBased(state, p, nat) && !p.injury && !p.onLoan &&
            !ranked.includes(p) && ['LP', 'HK', 'TP'].some(f => p.pos === f || (p.alt as string[]).includes(f)))
          .sort((a, b) => b.ca - a.ca || a.id - b.id)
        const travelling = withFrontRow([...pool, ...ranked.slice(target), ...frCover], w.size)
        state.natSquads[nat] = travelling.map(p => p.id)
        for (const p of travelling) {
          p.natSquad = true
          p.morale = clamp(p.morale + 0.5, 1, 10) // the proudest phone call in rugby
          if (nat === 'LIO') {
            // no - THIS is the proudest phone call in rugby
            p.lions = (p.lions ?? 0) + 1
            p.morale = clamp(p.morale + 0.5, 1, 10)
            if (isMyClub(state, p.clubId)) lionsCalls.push(p)
          } else if (isMyClub(state, p.clubId)) userCalls.push(p)
        }
        // the national coach announces HIS squad - a proper occasion
        if (nat === state.natTeam || (nat === 'LIO' && islesCoach(state))) {
          const FWD = ['LP', 'HK', 'TP', 'LK', 'FL', 'N8']
          // the squad sheet is the men who TRAVEL - the pool now runs deeper
          // than the squad, and the next men in are not in the announcement
          const fwd = travelling.filter(p => FWD.includes(p.pos))
          const bks = travelling.filter(p => !FWD.includes(p.pos))
          const line = (p: Player) => `${p.name}${(p.caps ?? 0) > 0 ? ` (${p.caps})` : ' (uncapped)'}${p.clubId ? ` - ${state.clubs[p.clubId]?.short ?? ''}` : ''}`
          const newCaps = travelling.filter(p => (p.caps ?? 0) === 0).length
          state.news.push({
            id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
            subject: `Your ${nationNameIn('en', nat)} squad is announced`,
            k: 'news.natSquad',
            v: {
              ...nationVars(nat), n: travelling.length,
              caps_k: newCaps ? 'news.natSquadNew' : 'news.natSquadCapped', newCaps,
              fwd: fwd.map(line).join('; '), bks: bks.map(line).join('; '),
            },
            body: [
              `The federation has published your ${travelling.length}-man squad for the window. ${newCaps ? `${newCaps} uncapped name${newCaps > 1 ? 's' : ''} in the room.` : 'A fully capped group.'}`,
              `Forwards | ${fwd.map(line).join('; ')}`,
              `Backs | ${bks.map(line).join('; ')}`,
            ].join('\n'),
          })
        }
      }
      if (lionsCalls.length) {
        // the honour of a career deserves better than the generic list
        const tour = isleTour(state)?.name ?? 'the Isles tour'
        const names = lionsCalls.map(p => `${p.name}${(p.lions ?? 0) > 1 ? ` (tour number ${p.lions})` : ''}`).join(', ')
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
          subject: `LIONS: ${lionsCalls.length === 1 ? lionsCalls[0].name.split(' ').slice(-1)[0] : `${lionsCalls.length} of yours`} make the tour`,
          k: (state.season * 5 + state.week * 3) % 2 === 0 ? 'news.lionsCallA' : 'news.lionsCallB',
          v: {
            n: lionsCalls.length, names, tour,
            who: lionsCalls.length === 1 ? lionsCalls[0].name.split(' ').slice(-1)[0] : String(lionsCalls.length),
            subj_k: lionsCalls.length === 1 ? 'news.lionsSubjOne' : 'news.lionsSubjMany',
            is_k: lionsCalls.length === 1 ? 'news.isOne' : 'news.isMany',
            he_k: lionsCalls.length === 1 ? 'news.heOne' : 'news.heMany',
          },
          body: [
            (state.season * 5 + state.week * 3) % 2 === 0
              ? `The call every player in these islands dreams of: ${names} ${lionsCalls.length === 1 ? 'is' : 'are'} going on ${tour}. The whole club walks taller this morning.`
              : `The ${tour} squad is out, and the club's name is on it: ${names}. Training stopped for the announcement. Nobody minded.`,
            `${lionsCalls.length === 1 ? 'He' : 'They'} will be away for the tour window. Plan the run-in accordingly - and welcome back a Lion.`,
          ].join('\n'),
          playerId: lionsCalls[0].id,
        })
      }
      if (userCalls.length) {
        // several windows can open the same week - one combined item, not two
        const names = userCalls.map(p => `${p.name} (${p.nat})`).join(', ')
        const existing = state.news.find(n =>
          n.week === state.week && n.season === state.season && n.subject === 'International call-ups')
        if (existing) {
          existing.body += ` Also called up: ${names}.`
          // and the same names into the key's variables, or a French reader sees
          // the first window's list and never the second. The engine finds this
          // story by its English subject, which is why that stays put.
          if (existing.v) existing.v.names = `${existing.v.names}, ${names}`
        } else {
          state.news.push({
            id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
            subject: `International call-ups`,
            body: `The following players have been called up and will be unavailable during the international window: ${names}.`,
            k: 'news.callUps',
            v: { names },
          })
        }
      }
    }
    if (state.week === w.end + 1) {
      if (state.natLineup && w.nations.includes(state.natLineup.team)) state.natLineup = null
      const returnedMine: string[] = []
      const lionsHome: Player[] = []
      for (const nat of w.nations) {
        for (const id of state.natSquads[nat] ?? []) {
          const p = state.players[id]
          if (p) {
            p.natSquad = false
            // Test rugby empties the tank - returning internationals need
            // managing, not flogging
            p.cond = clamp(p.cond - 10, 20, 100)
            if (isMyClub(state, p.clubId)) {
              if (nat === 'LIO') lionsHome.push(p)
              else returnedMine.push(p.name)
            }
          }
        }
        delete state.natSquads[nat]
        if (nat === state.natTeam) { delete state.natSent; delete state.natFed }
      }
      if (lionsHome.length) {
        // a tour changes a player: he comes home a bigger presence
        const comp = isleTour(state)
        const seriesWon = comp?.champion === 'LIO'
        for (const p of lionsHome) {
          p.morale = clamp(p.morale + 0.6, 1, 10)
          p.a.lea = clamp(p.a.lea + 1, 1, 20)
        }
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
          subject: `The tourists come home${seriesWon ? ' as series winners' : ''}`,
          k: seriesWon ? 'news.lionsHomeWon' : 'news.lionsHome',
          v: {
            tour: comp?.name ?? 'the Isles tour',
            names: lionsHome.map(p => p.name).join(', '),
            him_k: lionsHome.length === 1 ? 'news.himOne' : 'news.himMany',
            come_k: lionsHome.length === 1 ? 'news.comesOne' : 'news.comeMany',
          },
          body: [
            `Back in club colours after ${comp?.name ?? 'the Isles tour'}: ${lionsHome.map(p => p.name).join(', ')}.`,
            seriesWon
              ? `A series win in the luggage, and the kind of standing money cannot buy. Expect ${lionsHome.length === 1 ? 'him' : 'them'} to walk taller here too.`
              : `Win or lose, a tour changes a player - ${lionsHome.length === 1 ? 'he comes' : 'they come'} back a bigger presence in this dressing room.`,
            `The medical staff still counsel care: a tour summer empties the tank like nothing else.`,
          ].join(' '),
          playerId: lionsHome[0].id,
        })
      }
      if (returnedMine.length) {
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'injury', read: false,
          subject: `Internationals return - leggy`,
          body: `Back in club colours: ${returnedMine.join(', ')}. The medical staff's advice is blunt: Test rugby empties the tank, and none of them are at full freshness this week. Rotate or risk it - your call.`,
          k: 'news.intlBack',
          v: { names: returnedMine.join(', ') },
        })
      }
    }
  }
}

/**
 * Top a short Test squad up to the floor, from the men actually available.
 *
 * Only ever the USER's nation - everyone else's is picked in full by
 * manageInternationals. Only ever when a Test for that nation falls this week,
 * because until then the empty sheet IS the job and filling it would be the
 * auto-pick the owner asked us to stop doing.
 */
export function fillShortNatSquad(state: GameState) {
  // not gated on employment: a coach between club jobs still has a country,
  // and its camp opens empty for him like anyone's (see natSquadHold)
  const nat = state.natTeam
  if (!nat) return
  const playing = state.fixtures.some(f =>
    !f.played && f.week === state.week && (f.homeId === nat || f.awayId === nat))
  if (!playing) return
  // (a club coach's due men went to camp when the window opened, 9.10. They
  // are not topped up again here: an AI federation picks once, at the start,
  // and a man who comes off the treatment table mid-window stays with his club)
  const size = activeWindows(state).find(w =>
    w.nations.includes(nat) && state.week >= w.start && state.week <= w.end)?.size ?? NAT_SQUAD_SIZE
  const named = state.natSquads[nat] ?? []
  if (named.length >= NAT_SQUAD_FLOOR) return
  const inCamp = new Set(named)
  const candidates = Object.values(state.players)
    .filter(p => !inCamp.has(p.id) && (nat === 'LIO' ? HOME4_NAT.includes(p.nat) : p.nat === nat) &&
      p.clubId && homeBased(state, p, nat) && !p.injury && !p.natSquad)
    .sort((a, b) => b.ca - a.ca)
  // the top-up obeys the same club quota the coach does (9.10), or naming a
  // short squad would let the federation's top-up do the raiding for him
  const fed = conflictedClub(state) ? federationList(state, nat, size) : []
  const spare: Player[] = []
  for (const p of candidates) {
    if (spare.length >= NAT_SQUAD_FLOOR - named.length) break
    if (clubQuotaLeft(state, nat, size, [...named, ...spare.map(q => q.id)], p.clubId!, fed) <= 0) continue
    spare.push(p)
  }
  if (!spare.length) return
  for (const p of spare) {
    named.push(p.id)
    p.natSquad = true
  }
  state.natSquads[nat] = named
  const v = { ...nationVars(nat), n: spare.length }
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
    subject: tIn('en', 'news.natFilledSubj', v),
    body: tIn('en', 'news.natFilled', v),
    k: 'news.natFilled', v,
  })
}

const HOME4_NAT = ['ENG', 'IRE', 'SCO', 'WAL']
