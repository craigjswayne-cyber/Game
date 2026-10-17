// The academy intake: the user's class, rolled at the week-30 preview and
// delivered in the summer, and every other club's.
import { acadCeiling } from '../academy'
import { assignPersonality, deriveAttrs, nextPid, playerValue } from '../attributes'
import { intakePicks } from '../devnews'
import { genderOf } from '../gender'
import { identityIntakeBonus } from '../identity'
import { emptyStats, facLevel, type GameState, type Player, type Pos } from '../model'
import { nationByCode, regenName, worldNames } from '../nations'
import { clamp, pick, type Rng } from '../rng'
import { scoutPa } from '../scout'

export const YOUTH_POS: Pos[] = ['LP', 'HK', 'TP', 'LK', 'LK', 'FL', 'FL', 'N8', 'SH', 'FH', 'CE', 'CE', 'WG', 'WG', 'FB']

/** Deep rugby nations produce slightly better kids: without this, national
 *  pecking order converges to who has the most domestic clubs. */
function natTalentBonus(country: string): number {
  const rep = nationByCode(country)?.rep ?? 70
  return Math.floor((rep - 70) / 6)
}

/** Roll the user's next academy class. Fixed at the week-30 preview so the
 *  coach's forecast and intake day always tell the same story. */
export function rollIntakeClass(state: GameState, rng: Rng): NonNullable<GameState['intakeClass']> {
  const club = state.clubs[state.userClubId]
  if (!club) return []
  const coe = facLevel(state, 'academy')
  const n = 2 + Math.floor(rng() * 3)
  const out: NonNullable<GameState['intakeClass']> = []
  for (let i = 0; i < n; i++) {
    const pos = pick(rng, YOUTH_POS)
    const q = 38 + Math.floor(rng() * 22) + Math.floor(club.rep / 12) + Math.round(coe * 1.2) + natTalentBonus(club.country) + identityIntakeBonus(state)
    // A wonderkid every couple of seasons rather than every four (user: "there
    // should be more wonderkids in academy's"). The balance holds because the
    // flag is only a CEILING: whether he ever reaches it is now down to the
    // facilities, the coaching, a mentor and his own character (devFactor), so
    // a more generous intake makes more stories, not more free superstars.
    const wonder = rng() < 0.13 + coe * 0.02
    out.push({
      name: regenName(rng, club.country === 'NZL' && club.id === 'moana' ? 'SAM' : club.country, worldNames(state), genderOf(state)),
      pos, age: 17 + Math.floor(rng() * 2), q,
      pa: wonder ? clamp(87 + Math.floor(rng() * 13), q + 20, 99) : clamp(Math.min(q + 12 + Math.floor(rng() * rng() * 30), acadCeiling(club, rng)), q, 99),
      gk: (pos === 'FH' || pos === 'FB') && rng() < 0.4,
      wonder,
    })
  }
  return out
}

const paStars = (pa: number) => pa >= 88 ? 5 : pa >= 80 ? 4 : pa >= 71 ? 3 : pa >= 62 ? 2 : 1

export function youthIntake(state: GameState, rng: Rng) {
  // the user's class was fixed at the week-30 preview - deliver it verbatim,
  // with the report card the plain arrival note never was
  const userClub = state.clubs[state.userClubId]
  if (userClub) {
    const spec = state.intakeClass?.length ? state.intakeClass : rollIntakeClass(state, rng)
    const report: string[] = []
    const reportRows: { k: string; [x: string]: string | number }[] = []
    const seenPa: number[] = []
    spec.forEach((s, i) => {
      const raw = { name: s.name, pos: s.pos, age: s.age, nat: userClub.country, q: s.q, gk: s.gk }
      const a = deriveAttrs(raw, state.seed + state.season * 977 + i)
      const p: Player = {
        id: nextPid(),
        name: s.name, pos: s.pos, alt: [], age: s.age, nat: userClub.country, clubId: userClub.id,
        a,
        ca: s.wonder ? clamp(s.q + 8, 1, 78) : s.q,
        pa: s.pa,
        q0: s.q,
        intl: false, gk: s.gk,
        form: 6, morale: 7, cond: 100, sharp: 50,
        injury: null, bans: 0, natSquad: false,
        wage: 600, contractEnds: state.season + 3,
        value: 0, stats: emptyStats(), career: [], transferListed: false, youth: true, acad: true,
        pers: assignPersonality(rng, a),
        sc: 100,
        // 1.8.1: the season he joins, for the summer sign-or-release decision
        acadJoined: state.season + 1,
      }
      p.value = playerValue(p.ca, p.age, p.pa, p.pos, undefined, undefined, p.caps)
      state.players[p.id] = p
      userClub.players.push(p.id)
      // THE STARS ARE THE COACHES' READ (1.8.2): a seventeen-year-old's
      // ceiling is an estimate (scout.ts paRange), so the report card grades
      // the estimate, never the number behind it
      const seen = paStars(Math.round(scoutPa(state, p)))
      seenPa.push(scoutPa(state, p))
      report.push(`${'★'.repeat(seen)}${'☆'.repeat(5 - seen)} ${p.name} - ${p.pos}, ${p.age}`)
      reportRows.push({
        k: 'news.intakeRow',
        stars: `${'★'.repeat(seen)}${'☆'.repeat(5 - seen)}`,
        name: p.name, pos: p.pos, age: p.age,
      })
      if (s.wonder) {
        state.news.push({
          id: state.nextId++, week: 1, season: state.season + 1, type: 'youth', read: false,
          subject: `WONDERKID: the academy has struck gold`,
          body: `The coaches are calling ${p.name} (${p.age}, ${p.pos}) the best prospect the academy has produced in a generation. Handle him right - game time, a development focus, patience - and he could be anything.`,
          k: 'news.wonderkid', v: { player: p.name, age: p.age, pos: p.pos },
          playerId: p.id,
        })
      }
    })
    const intake = userClub.players.slice(-spec.length).map(id => state.players[id]).filter((x): x is Player => !!x)
    const best = Math.max(0, ...seenPa)
    const grade = best >= 96 ? 'A' : best >= 90 ? 'B' : best >= 82 ? 'C' : best >= 74 ? 'D' : 'E'
    state.news.push({
      id: state.nextId++, week: 1, season: state.season + 1, type: 'youth', read: false,
      subject: `Intake day: the class arrives - grade ${grade}`,
      body: [
        `The academy has promoted this year's crop. The coaches' potential ratings:`,
        ...report,
        grade === 'A' ? `A vintage year. Protect them from the vultures and this class will define the club.`
          : grade === 'B' ? `A strong group - at least one of these boys should make the first team his own.`
          : grade === 'C' ? `A decent, honest class. Squad players, with a chance one over-delivers.`
          : grade === 'D' ? `A thin year. The coaches are already talking about next season's group.`
          : `A year to forget. The academy coach has asked that nobody frame this list.`,
      ].join('\n'),
      k: 'news.intakeDay',
      v: { grade, rows_ll: JSON.stringify(reportRows), verdict_k: `news.intakeDay${grade}` },
    })
    intakePicks(state, intake)
    state.intakeClass = null
  }

  for (const club of Object.values(state.clubs)) {
    if (club.id === state.userClubId) continue
    const n = 2 + Math.floor(rng() * 3)
    for (let i = 0; i < n; i++) {
      const pos = pick(rng, YOUTH_POS)
      const q = 38 + Math.floor(rng() * 22) + Math.floor(club.rep / 12) + natTalentBonus(club.country)
      const raw = {
        name: regenName(rng, club.country === 'NZL' && club.id === 'moana' ? 'SAM' : club.country, worldNames(state), genderOf(state)),
        pos, age: 17 + Math.floor(rng() * 2), nat: club.country, q,
        gk: (pos === 'FH' || pos === 'FB') && rng() < 0.4,
      }
      const a = deriveAttrs(raw, state.seed + state.season * 977 + i)
      // one in fifty, capped near the club's own ceiling (1.6.3): at one in twelve with an
      // 87-99 ceiling, a hundred AI academies minted seventy future stars a summer
      const wonder = rng() < 0.02
      const p: Player = {
        id: nextPid(),
        name: raw.name, pos, alt: [], age: raw.age, nat: raw.nat, clubId: club.id,
        a,
        ca: wonder ? clamp(q + 8, 1, 78) : q,
        pa: wonder ? clamp(Math.min(87 + Math.floor(rng() * 13), acadCeiling(club, rng) + 10), q + 20, 99) : clamp(Math.min(q + 12 + Math.floor(rng() * rng() * 30), acadCeiling(club, rng)), q, 99),
        q0: q,
        intl: false, gk: !!raw.gk,
        form: 6, morale: 7, cond: 100, sharp: 50,
        injury: null, bans: 0, natSquad: false,
        wage: 600, contractEnds: state.season + 3,
        value: 0, stats: emptyStats(), career: [], transferListed: false, youth: true, acad: true,
        pers: assignPersonality(rng, a),
        sc: 15,
        // 1.8.1: the season he joins, for the summer sign-or-release decision
        acadJoined: state.season + 1,
      }
      p.value = playerValue(p.ca, p.age, p.pa, p.pos, undefined, undefined, p.caps)
      state.players[p.id] = p
      club.players.push(p.id)
    }
  }
  // a few unattached young gems drift into the free-agent pool each season
  for (let i = 0; i < 3; i++) {
    const nats = ['FIJ', 'GEO', 'TGA', 'SAM', 'USA', 'URU']
    const nat = pick(rng, nats)
    const pos = pick(rng, YOUTH_POS)
    const q = 54 + Math.floor(rng() * 12)
    const raw = { name: regenName(rng, nat, worldNames(state), genderOf(state)), pos, age: 18 + Math.floor(rng() * 3), nat, q, gk: rng() < 0.15 }
    const a = deriveAttrs(raw, state.seed + state.season * 3011 + i)
    const p: Player = {
      id: nextPid(),
      name: raw.name, pos, alt: [], age: raw.age, nat, clubId: null,
      a, ca: q, pa: clamp(84 + Math.floor(rng() * 14), q + 12, 99), q0: q,
      intl: false, gk: !!raw.gk,
      form: 6, morale: 7, cond: 100, sharp: 50,
      injury: null, bans: 0, natSquad: false,
      wage: 900, contractEnds: state.season, value: 0,
      stats: emptyStats(), career: [], transferListed: false, youth: true,
      pers: assignPersonality(rng, a), sc: 10,
    }
    p.value = playerValue(p.ca, p.age, p.pa, p.pos, undefined, undefined, p.caps)
    state.players[p.id] = p
  }
}
