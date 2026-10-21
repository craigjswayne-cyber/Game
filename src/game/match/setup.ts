// Building a side for kick-off: the weather on its units, the modifiers and
// the try scorer. Split out of matchEngine.ts.
import type { GameState, Player, Weather } from '../model'
import { ROLE_FX, rolesForSlot } from '../roles'
import { facLevel } from '../model'
import { standing } from '../authority'
import { bondCohesion } from '../bonds'
import { repetitionFatigue } from '../oppcoach'
import { EXPLOITED_BY } from '../analyst'
import { clamp, wpick, type Rng } from '../rng'
import { KNOCK_ENERGY } from '../knock'
import { DEFAULT_LINEOUT, DEFAULT_SCRUM, ROUTINE_BY_ID, routineEffect } from '../playbook'
import { moveTempoF } from '../moves'
import { actualSplit } from '../bench'
import { styleDrain, styleFitsRel, stylesOf } from '../styles'
import { wetness } from '../conditions'
import { HABITS, HABITS_OFF, habitFx } from '../habits'
import { TANK_K, lineupFor, teamUnits } from './selection'

/** TIRED LEGS COST SOMETHING (owner, 1.9.5: the varied condition, "with a
 *  real cost for tired legs"). The tank used to stop at 50 however tired a
 *  man was, so 20% condition kicked off exactly as fresh as 33%, and an XV
 *  nobody rotated paid nothing more for the next week's knackered men. Under
 *  the floor he now keeps half the shortfall: 33% and up is as it was, 20%
 *  starts at 45 rather than 50. The floor itself stays (setup's note below
 *  on why it is load-bearing), only softened. */
const TANK_SOFT = 0.5
const TANK_FLOOR = 50
/** the tank a man kicks off with from his condition */
export function kickoffTank(c0: number): number {
  const raw = 100 - (100 - c0) * TANK_K
  return raw >= TANK_FLOOR ? raw : TANK_FLOOR - (TANK_FLOOR - raw) * TANK_SOFT
}
import { type SideCtx, aggPenRisk, fieldLineup, freshMods, personnelKey } from './side'

/** WHAT THE SKY DOES TO THE UNITS (conditions.ts), one place for kick-off and
 *  every rebuild: wet weather is forward weather, a damp day a third of it,
 *  wind takes a little off the kicking game; and the men who relish a heavy
 *  pitch (habits.ts) find a little more when it is wet. */
export function weatherUnits(state: GameState, side: SideCtx, weather: Weather | null) {
  if (!weather) return
  if (weather === 'Rain' || weather === 'Snow') {
    side.units.attack *= weather === 'Snow' ? 0.86 : 0.90
    side.units.breakdown *= 1.04
  } else if (weather === 'Damp') {
    side.units.attack *= 0.965
    side.units.breakdown *= 1.013
  }
  if (weather === 'Wind') side.units.kicking *= 0.92
  const wet = wetness(weather)
  if (wet > 0) {
    const shirts = fieldLineup(side).slice(0, 15).map(id => (id != null && side.onPitch.has(id) ? state.players[id] ?? null : null))
    side.units.attack *= habitFx(state.seed, shirts, wet).mudAtk
  }
}

/** Tactic + weather + coaching modifiers, applied to freshly computed units. */
export function applyModifiers(state: GameState, side: SideCtx, weather: Weather | null) {
  const club = state.clubs[side.teamId]
  // FROM A CLEAN BASE EVERY TIME. This runs at kick-off and again on every
  // recompute, and the figures below are only ASSIGNED on some paths: a Test
  // side has no club, so its tempo, card and penalty risk were never reset and
  // each recompute multiplied the layered mods into them again, and the
  // coaching block ADDS its goal-kicking bonus. A side that changed personnel
  // five times kicked with five coaching bonuses. Resetting here, to exactly
  // the values mkSide starts from, is what makes a recompute idempotent: the
  // kick-off numbers are unchanged and the tenth rebuild lands where the
  // first did. The penalty price reads refPenF, which carries the referee and
  // the crowd, so nothing beginMatch folded in is lost.
  side.goalBonus = 0
  side.tempoF = 1
  side.drainF = 1
  side.cardRisk = 0.012
  side.aggF = 0
  side.penRisk = aggPenRisk(0, side.refPenF ?? 1)
  // who is actually out there: a sent-off captain does not lead, a man in the
  // bin does not call the lineouts and a hot head in the stand cannot be sent
  // off again. At kick-off this is the XV, so nothing changes there.
  const present = (id: number | null | undefined): id is number => id != null && side.onPitch.has(id)
  // and the shirts as the units read them, an HIA stand-in in his (fieldLineup)
  const shirts = fieldLineup(side).slice(0, 15)
  /**
   * ---- THE TRAINING PITCH (owner, v1.8.1) ----
   *
   * "Good pitch equals good prep - bad pitch means in game effect on
   * breakdowns and skills."
   *
   * This facility was called the Playing Surface and did exactly one thing:
   * shaved a few per cent off the user's injury roll at home, while the
   * screen advertised "3.5% fewer breakdowns at home" that no line of code
   * delivered. A placebo control with a label on it.
   *
   * It is the TRAINING pitch now, which is the honest version: a squad that
   * does its ruck work on a bog arrives on Saturday rusty at the breakdown
   * and heavy-handed, and one with a true surface arrives sharp. So it reads
   * off the side's OWN club - the pitch you train on travels with you - and
   * it cuts both ways around level three, because a bad pitch is a real cost
   * and not merely an absent bonus.
   *
   * Every club in the world has one, so this is read per side rather than
   * through facLevel, which only ever answers for the manager's club.
   */
  if (club) {
    const lvl = club.facilities?.pitch ?? 0
    side.units.breakdown *= 0.955 + lvl * 0.018
    side.units.attack *= 0.97 + lvl * 0.012
  }
  // a happy dressing room plays for each other; a sour one hesitates
  if (club) {
    const xv = shirts.map(id => id != null ? state.players[id] : null).filter(Boolean)
    if (xv.length) {
      const avgMor = xv.reduce((s, p) => s + p!.morale, 0) / xv.length
      const mF = 1 + (avgMor - 6.5) * 0.009 // roughly ±3% at the extremes
      side.units.attack *= mF
      side.units.defence *= mF
      // close friends side by side, or two men not speaking (bonds.ts): ±0.6% at most
      const bF = bondCohesion(state, club.id, shirts)
      side.units.attack *= bF
      side.units.defence *= bF
    }
  }
  if (club) {
    const tac = club.tactic
    /**
     * A dial is a 0-100 number, and every one of them is multiplied into a unit
     * score, then into tempoF, then into how hard the side runs - which is how
     * every player's fitness is spent. So a dial that is not a number does not
     * sit quietly in a field: it turns the whole squad's condition to NaN, for
     * the rest of the save.
     *
     * Two ways to get there, and the second is the one that matters: a corrupted
     * save, or a save written before the field existed, where the dial is simply
     * absent. Found by scripts/sheetfuzz.ts, which broke the dials both ways.
     *
     * Clamping here, at the one place all four are read, beats trusting a dozen
     * call sites to have checked. Anything unreadable reads as the middle of the
     * dial, which is the same as no instruction at all.
     */
    const f = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(100, v)) - 50 : 0) / 50 // -1..1
    // TEMPO IS A TRADE BOTH WAYS (1.8.14). Slow used to buy defence (+3% at
    // the bottom of the dial) as well as 22% less running, for 5% of attack:
    // held all season it took the seventh-best squad in the Premier Division
    // to an average finish of 3.9th, from 5.8th. Slowing the game down now
    // costs more going forward, buys nothing at the back, and saves half as
    // much legs; playing fast still costs a little shape in defence.
    // A PLAN THE SQUAD CANNOT PLAY (1.8.14, owner's balance brief: "bad tactics
    // with great players should be punished"). Measured before it: the
    // strongest squad in France finished exactly as high playing the opposite
    // of its strengths as playing to them. A squad has a natural shape - read
    // off its own units, backs against pack, where the world's squads run from
    // about -0.04 (a pack side) to +0.22 (a back three side), mean 0.05, sd 0.064 - and a
    // style dial more than 15 away from it costs up to 6% of attack (at 45
    // away) and half that of the breakdown. Read before the dials move the units, so the dial cannot
    // chase its own tail. Every club, the same rule.
    const fwdU = (side.units.scrum + side.units.breakdown + side.units.lineout) / 3
    const lean = (side.units.attack - fwdU) / Math.max(1e-6, (side.units.attack + fwdU) / 2)
    const natural = 50 + clamp((lean - 0.05) / 0.064, -2, 2) * 20
    const styleV = Number.isFinite(tac.style) ? clamp(tac.style, 0, 100) : 50
    const misfit = clamp((Math.abs(styleV - natural) - 15) / 30, 0, 1) * 0.06
    side.styleMisfit = misfit
    const tf = f(tac.tempo)
    side.units.attack *= (1 - misfit) * (1 + f(tac.style) * 0.06 + tf * (tf < 0 ? 0.08 : 0.05) - f(tac.kicking) * 0.035)
    side.units.breakdown *= 1 - misfit * 0.5
    side.units.scrum *= 1 - f(tac.style) * 0.05
    side.units.breakdown *= 1 + f(tac.aggression) * 0.06 - f(tac.style) * 0.03 - f(tac.kicking) * 0.02
    side.units.kicking *= 1 + f(tac.kicking) * 0.1
    side.units.defence *= 1 - Math.max(0, tf) * 0.03
    side.tempoF = 1 + tf * 0.12
    side.cardRisk = 0.012 + f(tac.aggression) * 0.006
    side.aggF = f(tac.aggression)
    side.penRisk = aggPenRisk(side.aggF, side.refPenF ?? 1)
    // THE WITHOUT-BALL SYSTEM (18D, FM26's split shapes translated). Line
    // speed is a trade priced in the engine's own currencies: a blitz brings
    // pressure (defence up) and gives the referee offside creep to look at
    // (penalties up, a touch more card risk); a passive drift concedes the
    // gain line quietly and keeps the penalty count down. 50 is literally
    // absent - f(50) is zero on every term - so a save that has never touched
    // the dial plays the old game bit for bit, and the fingerprint holds it
    // there. Defensive WIDTH is the other half and lives in beginMatch,
    // because it is a matchup read against the opponent's attacking shape.
    const dl = f(tac.defLine ?? 50)
    side.units.defence *= 1 + dl * 0.04
    side.penRisk *= 1 + dl * 0.12
    side.cardRisk += dl * 0.002
    // THE BREAKDOWN (1.7.3, owner: "breakdown commitments", attack and defence
    // separately). Both are trades, both exactly nothing at 50.
    //   COMMIT - how many you send into your own ruck. Many: the ball is safe
    //   (your breakdown counts for more when you have it) but those men are
    //   not in the attacking line. Few: the reverse, and quick ball goes wide.
    //   CONTEST - how hard you go after theirs. Counter-rucking and jackalling
    //   make your breakdown bite on their ball, but the men on the floor are
    //   not in the defensive line, and a fussy referee (refPenF above 1) sees
    //   more of it: penalties up, and a little more card risk.
    const rc = f(tac.ruckCommit ?? 50)
    side.units.attack *= 1 - rc * 0.035
    side.ruckSecure = 1 + rc * 0.1
    const rk = f(tac.ruckContest ?? 50)
    side.units.defence *= 1 - rk * 0.03
    side.ruckContest = 1 + rk * 0.1
    // 0.11 from 1.8.0 (was 0.1): an own-half penalty now goes to touch rather
    // than at the posts, so each one conceded costs a little less and the full
    // contest had drifted to +3.2 a match against balanced (kickbreakprobe;
    // 0.12 fixed that but left draws one game under bandcheck's floor).
    side.penRisk *= 1 + rk * 0.11 * (side.refPenF ?? 1)
    side.cardRisk += rk * 0.0015

    // The called set-piece routines (F2). What you get is the routine's ceiling
    // scaled by how well drilled it is and how sick of it the analysts are.
    const lo = routineEffect(club, tac.lineoutCall ?? DEFAULT_LINEOUT)
    const sc = routineEffect(club, tac.scrumCall ?? DEFAULT_SCRUM)
    side.units.lineout *= lo.mult
    side.units.scrum *= sc.mult
    for (const [id, e] of [[tac.lineoutCall ?? DEFAULT_LINEOUT, lo], [tac.scrumCall ?? DEFAULT_SCRUM, sc]] as const) {
      const r = ROUTINE_BY_ID[id]
      if (!r) continue
      // a routine that eats time feeds the forwards and starves the backs
      // the side effects follow the same competence curve, so a shape you cannot
      // execute does not hand you its upside either. Tempo was applied in
      // full until 1.8.1, so an undrilled maul still saved the legs a drilled
      // one does; now the saving (tempo under 1) needs the competence and a
      // cost (over 1) is paid whether the shape comes off or not.
      if (r.attack) side.units.attack *= 1 + (r.attack - 1) * Math.max(0, e.q)
      if (r.tempo) side.tempoF *= r.tempo < 1 ? 1 + (r.tempo - 1) * Math.max(0, e.q) : r.tempo
    }
    // the attacking moves' legs (moves.ts), on the routine's rule; exactly 1
    // for a club with no calls
    side.tempoF *= moveTempoF(state, club)

    // THE STYLES (1.8.2, styles.ts): what this side plays with and without
    // the ball, how well the men in the shirts suit it, and the legs it
    // costs. Read here so a substitution or a change of style re-reads it.
    const sty = stylesOf(state, club)
    if (sty) {
      const at = (shirt: number, a: keyof Player['a']) => {
        const pid = shirts[shirt - 1]
        const p = pid != null ? state.players[pid] : undefined
        return p ? p.a[a] : null
      }
      // a man's attributes do not move during a match, so the fit only
      // changes with the shirts or the styles: kept until one of them does
      // (perfprobe, 1.8.16: every rebuild scored the XV twice over)
      const k = `${sty.atk}|${sty.def}|${shirts.join(',')}`
      if (side.styFit?.k !== k) {
        const [atkFit, defFit] = styleFitsRel([sty.atk, sty.def], at)
        side.styFit = { k, atkFit, defFit }
      }
      side.sty = { ...sty, atkFit: side.styFit.atkFit, defFit: side.styFit.defFit }
      side.tempoF *= styleDrain(sty)
    }

    // The kicking game (F3). A designated kicker is a decision; the automatic
    // pick of whoever has the best attribute is not.
    // Read against the SHIRTS, not against who is on the pitch this minute: a
    // first-choice kicker sitting out ten in the bin is still the first-choice
    // kicker, and goalKicker() finds a stand-in while he sits and hands the tee
    // back when he returns. Keyed on onPitch, a rebuild during his ten minutes
    // quietly demoted him for the rest of the match. At kick-off the two sets
    // are the same, so the pick there is unchanged.
    const named = (tac.kickers ?? []).find(id => id != null && side.lineup.slice(0, 15).includes(id) && !state.players[id]?.injury)
    if (named != null) side.units.kickerId = named
    // exit strategy: how you play your way out of your own 22
    switch (tac.exit) {
      case 'box': side.units.kicking *= 1.05; side.units.attack *= 0.985; break
      case 'long': side.units.kicking *= 1.03; side.units.defence *= 1.01; side.units.attack *= 0.99; break
      case 'counter': side.units.attack *= 1.03; side.units.defence *= 0.98; break
      case 'fifty22': side.units.kicking *= 1.06; side.units.attack *= 0.97; break
      default: break
    }
  }
  // positional roles: how each shirt is told to play. Every one of them trades
  // something (game/roles.ts ROLE_FX, which the Tactics screen reads too, so the
  // description a manager taps and the effect he gets cannot drift apart).
  if (club?.tactic.roles) {
    for (let i = 0; i < 15; i++) {
      const r = club.tactic.roles[i]
      if (!r || shirts[i] == null) continue
      // A ROLE HAS TO BE LEGAL FOR THE SHIRT. rolesForSlot is the rule and it was
      // enforced only in Tactics.tsx, so fifteen jackals were one save-edit away
      // and measured +7.1 points a match. An engine rule a screen can bypass is
      // not a rule - the same standard signFreeAgent's header sets.
      if (!rolesForSlot(i).some(d => d.id === r)) continue
      const fx = ROLE_FX[r]
      if (!fx) continue
      if (fx.scrum) side.units.scrum *= fx.scrum
      if (fx.lineout) side.units.lineout *= fx.lineout
      if (fx.breakdown) side.units.breakdown *= fx.breakdown
      if (fx.attack) side.units.attack *= fx.attack
      if (fx.defence) side.units.defence *= fx.defence
      if (fx.kicking) side.units.kicking *= fx.kicking
      if (fx.card) side.cardRisk *= fx.card
    }
  }

  // hot heads walk the disciplinary tightrope every week
  for (const id of shirts) {
    const p = present(id) ? state.players[id] : null
    if (p?.trait === 'Hot Head') side.cardRisk += 0.002
  }
  // a proper captain in the XV steadies the ship and keeps discipline;
  // when he's missing, the vice-captain leads at half the effect
  const xvIds = shirts.filter(present)
  const leader = club?.captain != null && xvIds.includes(club.captain)
    ? { p: state.players[club.captain], f: 1 }
    : club?.vice != null && xvIds.includes(club.vice)
      ? { p: state.players[club.vice], f: 0.5 }
      : null
  if (leader?.p && leader.p.a.lea >= 12) {
    const f = 1 + (leader.p.a.lea - 11) * 0.0022 * leader.f // up to ~+2% at lea 20
    side.units.attack *= f
    side.units.defence *= f
    side.cardRisk *= 1 - 0.07 * leader.f
  }
  // The leadership group (F11). A portfolio is not extra strength, it is
  // concentration: the man who has taken the lineout calls or the defensive
  // system moves a slice of the side's general leadership onto his own area and
  // off the generic pair. So naming a group is a choice about where
  // responsibility sits, not a free upgrade, and a world where nobody names one
  // is exactly where it was.
  if (club?.leaders) {
    const onField = new Set(shirts.filter(present))
    for (const [area, id] of Object.entries(club.leaders)) {
      if (id == null || !onField.has(id)) continue
      const h = state.players[id]
      if (!h || h.a.lea < 12) continue // authority has to be earned
      const give = 0.009 * clamp((h.a.lea - 11) / 9, 0, 1)
      switch (area) {
        case 'pack':
          side.units.attack *= 1 - give * 0.5
          side.units.defence *= 1 - give * 0.5
          side.units.scrum *= 1 + give * 0.6
          side.units.lineout *= 1 + give * 0.6
          side.units.breakdown *= 1 + give * 0.5
          break
        case 'defence':
          side.units.attack *= 1 - give
          side.units.defence *= 1 + give
          break
        case 'attack':
          side.units.defence *= 1 - give
          side.units.attack *= 1 + give
          break
        case 'culture':
          // no unit moves at all: his portfolio is the room, and it is paid for
          // in the unit portfolio he is therefore not holding
          side.cardRisk *= 1 - 0.09 * clamp((h.a.lea - 11) / 9, 0, 1)
          break
      }
    }
  }
  // ---- EVERY OTHER CLUB HAS COACHES TOO ----
  //
  // Measured by scripts/stackprobe.ts, and it is the reason that probe exists.
  // A manager who used the whole toolbox won the league NINE TIMES OUT OF NINE
  // from a mid-table club, mean finishing position 1.00, on every seed. The
  // cause is directly below: facLevel() reads the user's club and nothing else,
  // and the backroom block is gated on side.isUser, so a full staff and level-5
  // facilities were worth five to ten percent on every unit AGAINST A WORLD
  // WHERE NO CLUB COULD EVER HAVE ANY. The manager was not out-coaching his
  // rivals; he was the only club in the sport with a coaching department.
  //
  // So a professional club now turns up with professional coaches. This is a
  // baseline, not a mirror: it is deliberately FLAT with only a light tilt for
  // reputation, because making it scale hard with rep would amplify the gap
  // between rich and poor and stratify the league - a balance regression wearing
  // a realism costume. Every Premier Division side has an attack coach; what varies
  // between them is less than reputation suggests.
  //
  // What is left as the manager's genuine edge is the part that is a DECISION
  // rather than a purchase: the weekly match preparation below, the analyst's
  // read, and the team sheet. Your staff roughly match theirs. Your choices are
  // yours.
  //
  // KEYED ON THE CLUB, NOT ON side.isUser, and the difference is not academic.
  // When this was written a sleepwalking manager's fixtures were simmed with
  // isUser false for BOTH sides - so gating on the flag handed the manager's
  // own club a free coaching department on exactly the weeks he could not be
  // bothered to turn up. (simMatch now marks his club as the user's side, as
  // every other path does, but a Test week or any future caller that names
  // another side must still not hand his club this baseline.) Measured before this line was fixed: a giant's
  // sleepwalk board bottomed at 31.3 instead of 16.3 and sackings fell from 2
  // in 6 to 1 in 6, which is the change making absenteeism SAFER. The user's
  // club is the user's club whoever is pressing the buttons.
  //
  // Deterministic: reputation only, no draw from the shared stream.
  //
  // And a club the manager has been sacked by is not his any more: userClubId
  // still names it while he is out of work, and it played with neither his
  // staff nor anybody else's, a few per cent weaker than every other side.
  if (side.teamId !== state.userClubId || state.unemployed) {
    const rep = state.clubs[side.teamId]?.rep ?? 60
    // 0 at rep 40, 1 at rep 90, so the tilt is gentle and bounded at both ends
    const tilt = clamp((rep - 40) / 50, 0, 1)
    const coach = 0.026 + 0.014 * tilt
    side.units.attack *= 1 + coach
    side.units.defence *= 1 + coach
    side.units.scrum *= 1 + coach * 0.9
    side.units.lineout *= 1 + coach * 0.9
    side.units.kicking *= 1 + coach * 0.8
    side.goalBonus = (side.goalBonus ?? 0) + coach * 0.22
  }

  // THE ROOM CARRIES OUT WHAT IT BELIEVES IN (1.8.14, authority.ts EXEC_BITE).
  // Keyed on the club like the coaching baseline above: the manager's club
  // plays with the room he has, whoever is pressing the buttons.
  if (side.teamId === state.userClubId && !state.unemployed) {
    const ex = standing(state).execution
    side.units.attack *= ex
    side.units.defence *= ex
    side.units.breakdown *= ex
  }

  // your backroom staff sharpen the matchday units (club only - Test
  // weeks mean borrowed players, not your own coaching department)
  if (side.isUser && side.teamId === state.userClubId && state.staff) {
    const s = state.staff
    // (1.8.14: a level is 1.3%, from 1.6%, so a fully badged department is
    // worth what the best AI club's flat coaching is - 3.9% against 4.0% -
    // rather than more. A full house measured +5 to +11 points of win rate
    // over an empty one, more than any decision the manager made)
    side.units.attack *= 1 + (s.attack ?? 0) * 0.013
    side.units.defence *= 1 + (s.defence ?? 0) * 0.013
    side.units.scrum *= 1 + (s.scrumCoach ?? 0) * 0.013
    side.units.lineout *= 1 + (s.scrumCoach ?? 0) * 0.013
    side.units.kicking *= 1 + (s.kicking ?? 0) * 0.016
    side.goalBonus = (s.kicking ?? 0) * 0.012 + facLevel(state, 'kicking') * 0.005
    // swagger tax: a squad drunk on its own headlines turns up flat
    if ((state.pressTone ?? 0) >= 4) {
      side.units.attack *= 0.965
      side.units.defence *= 0.965
    }
    // this week's match preparation: a focused edge, always with a trade -
    // and a proper briefing room makes the message stick
    const prepF = 1 + facLevel(state, 'briefing') * 0.15
    switch (state.matchPrep) {
      case 'attack': side.units.attack *= 1 + 0.035 * prepF; side.units.defence *= 0.99; break
      case 'defence': side.units.defence *= 1 + 0.035 * prepF; side.units.attack *= 0.99; break
      case 'setpiece': side.units.scrum *= 1 + 0.04 * prepF; side.units.lineout *= 1 + 0.04 * prepF; side.units.attack *= 0.99; break
      case 'fitness': side.drainF = 0.92 - facLevel(state, 'briefing') * 0.006; break
      case 'recovery': break // its work was done in the training week
    }
    // The analyst's read has to be worth something on the day, or the briefing
    // room, the assistant, the accuracy model and the followed/right/wrong ledger
    // are all decoration. It was decoration: matchPrep handed out the same flat
    // bonus whether the read was sound or nonsense, so the opponent's actual soft
    // spot never entered the match at all. Measured across forty fixtures before
    // this existed, following a sound read scored an aggregate margin of 359 and
    // ignoring it scored 429 - not a small effect, no effect, with the difference
    // being noise around zero.
    //
    // So homework pays, and only when it is right AND acted on. Same week, same
    // opponent, the recommended prep actually set. Deliberately modest: a good
    // week's work on top of the prep bonus, not a cheat code, and it does nothing
    // at all for a manager who follows a read his analyst got wrong.
    const read = state.analyst
    if (read && read.right && read.abs === state.season * 100 + state.week &&
        read.oppId !== side.teamId && state.matchPrep === read.prep) {
      // 0.03 until 16D, when the last-quarter surge quietly raised what a
      // fitness week is worth (fresher legs meet a bigger late-game pot) and
      // the analystprobe measured the homework edge collapsing to +0.9 points
      // a SEASON against always-prep-fitness. Homework has to beat the safe
      // default when the read is sound, or the whole analyst chain is
      // decoration again. Re-measured at 0.045: +36.9 points a season, ahead
      // in 10 of 12 paired seasons.
      // 0.07 from 1.8.0: the same collapse again, in two steps. E5-E9 took
      // the edge from +78.7 points a season to +27.3, and kicks from hand,
      // charge-downs and the two-layer contest took it to -14.0 and then
      // -0.3 (following sound reads was worth nothing against a fitness
      // week). At 0.07: +44.4, ahead in 14 of 24 paired seasons.
      // 0.09 from 1.8.14: the fatigue rebalance (a fresher starting tank,
      // condition costing less per point) made a fitness week relatively
      // stronger again, and the edge read -4.5 a season over 48 seasons.
      // Measured on the same 48: 0.09 reads +31.3 (ahead in 30), 0.11 +44.9.
      //
      // This is OUR half of the edge. Their half, the soft spot itself giving
      // a little more (x0.955), is layered once at kick-off in beginMatch; the
      // two together are the one correct read. Until 1.8.1 kick-off also put
      // x1.03 on our OWN unit of the same name, so a read of their defence
      // lifted our defence as well as our attack: one read paid twice, once
      // on a unit it had nothing to do with.
      const homework = 0.09 * prepF
      side.units[EXPLOITED_BY[read.unit]] *= 1 + homework
    }
  }
  weatherUnits(state, side, weather)
  // THE MEN'S HABITS (habits.ts): secret, centred on the world, read off the
  // men actually out there, so a sub or a card re-reads them
  {
    const hx = HABITS.on ? habitFx(state.seed, shirts.map(id => (present(id) ? state.players[id] ?? null : null)), 0) : HABITS_OFF
    side.units.lineout *= hx.lineout
    side.penRisk *= hx.pen
    side.units.defence *= hx.defence
    side.handsF = hx.hands
  }
  // Anything the match itself layered on goes back on last. Without this, a
  // substitution in the 68th minute silently erased the bench plan that had
  // just been applied at the 64th, because recomputeSideUnits starts over.
  if (side.mods) {
    side.units.scrum *= side.mods.scrum
    side.units.lineout *= side.mods.lineout
    side.units.breakdown *= side.mods.breakdown
    side.units.attack *= side.mods.attack
    side.units.defence *= side.mods.defence
    side.units.kicking *= side.mods.kicking
    side.tempoF *= side.mods.tempo
    side.cardRisk *= side.mods.card
  }
}

export function mkSide(state: GameState, teamId: string, userTeamId: string | null, fxId: number, big: boolean): SideCtx {
  // A COPY, not the club's sheet (user: "if you make subs in matches when it
  // loads back to the first team page - the original starting team should be
  // selected"). lineupFor hands back club.tactic.lineup BY REFERENCE for the
  // user's club, and every substitution, injury cover and finisher writes
  // side.lineup in place - so an afternoon's changes were being written into
  // the saved team sheet, and the Team screen greeted the manager with his
  // finishing XV: the winger who came off the bench standing in the flanker's
  // slot. The match owns its own sheet; the saved one is the manager's.
  const lineup = lineupFor(state, teamId).slice()
  const ratings = new Map<number, number>()
  const onPitch = new Set<number>()
  const energy = new Map<number, number>()
  lineup.slice(0, 15).forEach(id => {
    if (id != null) {
      ratings.set(id, 6 + ratingJitter(fxId, id))
      onPitch.add(id)
      // The 50 floor means a knackered starter kicks off almost as fresh as a
      // rested one, which is half of why the bench is a trap (see eF below).
      // DROPPING IT TO 25 WAS TRIED AND REVERTED: it made results swing hard
      // enough that stanceprobe's board stopped clawing back a broken promise
      // and trustprobe's near-even season lurched 26 -> 6 instead of drifting.
      // The floor is load-bearing for the board's read of a season, which is
      // not something a bench fix should be quietly deciding.
      // carrying a knock (knock.ts): he starts short of his usual tank
      const knockF = state.players[id]?.knock ? KNOCK_ENERGY : 1
      // HALF OF LAST WEEK IS IN THE LEGS, NOT ALL OF IT (1.8.14). The tank
      // started at his condition, so 80% condition was 80% of a tank on top of
      // the 4% the craft term takes: one tired week cost a side 18 points of
      // win rate. A night's sleep and a team run give some of it back.
      // THREE QUARTERS, NOT HALF (1.8.17, TANK_K, with FIT_W above): half let
      // the same tired XV go out every week at almost no cost.
      const c0 = state.players[id]?.cond ?? 85
      energy.set(id, kickoffTank(c0) * knockF)
    }
  })
  const units = teamUnits(state, lineup, { fxId, big })
  const benchIds = new Set<number>()
  const seatOf = new Map<number, number>()
  lineup.slice(15).forEach((id, seat) => {
    if (id != null) { benchIds.add(id); seatOf.set(id, seat) }
  })
  const side: SideCtx = {
    teamId, lineup, units,
    score: 0, tries: 0, ratings, onPitch, yellowUntil: new Map(), binned: new Set(), sent: 0, short: 0,
    cardRisk: 0.012, penRisk: 0.115, aggF: 0,
    poss: 0, pens: 0, consPens: 0, pressure: 12,
    energy, tempoF: 1, drainF: 1, goalBonus: 0,
    exIds: new Set(),
    isUser: teamId === userTeamId,
    mods: freshMods(),
    // the split the bench ACTUALLY is, not the one that was chosen: five of the
    // eight seats take whoever you put in them, so the men in the shirts decide.
    // Read off this match's 23, not the stored sheet (see actualSplit, 1.8.1)
    split: actualSplit(state, state.clubs[teamId], lineup),
    benchIds, seatOf,
  }
  applyModifiers(state, side, null)
  // REPETITION FATIGUE (pillar 2): a high-intensity habit held for weeks is
  // paid for in petrol. Set once here - the substitution rebuild re-runs
  // applyModifiers, not mkSide, so this can never compound. 1.0 exactly in a
  // fresh world, which is what keeps the fingerprint on the old stream.
  // the CLUB is the club, whoever pressed the button. isUser was false for both
  // sides when the assistant settled a fixture, so delegating a week skipped
  // the penalty entirely - the same isUser-versus-teamId trap the coaching
  // department comment above was written about. Keyed on the club it holds
  // whoever the caller names as the user's side.
  if (side.teamId === state.userClubId) side.repF = repetitionFatigue(state)
  // the XV start their stints at the kick-off, and the units just built are
  // the units of this personnel, so the first tick has nothing to rebuild
  side.since = new Map([...onPitch].map(id => [id, 0]))
  side.played = new Map()
  side.unitsKey = personnelKey(side)
  return side
}

/**
 * The little jitter on a player's opening match rating.
 *
 * This used to be `let _n = 0; _n = (_n + 1) % 7` - a MODULE-LEVEL COUNTER, and
 * that made the ratings of a match depend on how many matches had been simulated
 * before it in the same process. Two consequences, both found by measuring rather
 * than reading:
 *
 *   - the same fixture played twice in one session produced DIFFERENT ratings
 *     (player 258 opened on 5.90 in one run and 6.00 in the next)
 *   - so ratings could never be reproduced, which is what makes replaying a match
 *     after a page reload impossible: the scoreline would come back identical and
 *     every rating on the page would be subtly wrong
 *
 * scripts/fingerprint.ts never saw it, because the fingerprint compares SCORES
 * and this only reaches ratings. Ratings are not cosmetic though: they feed the
 * season's ratingSum, the average a player is judged on, and Player of the Month.
 *
 * Keyed on the fixture and the man instead, so it is the same every time anybody
 * asks, and no match can disturb another. Same seven values, same mean of zero.
 */
function ratingJitter(fxId: number, pid: number): number {
  let h = (Math.imul(fxId, 2654435761) ^ Math.imul(pid, 40503)) >>> 0
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0
  h ^= h >>> 16
  return ((h >>> 0) % 7 - 3) * 0.05
}

export function tryScorer(state: GameState, side: SideCtx, rng: Rng): Player | null {
  const ids = [...side.onPitch]
  const ps = ids.map(id => state.players[id]).filter(Boolean)
  if (!ps.length) return null
  const w = ps.map(p => {
    const posW: Record<string, number> = {
      WG: 5, FB: 3, CE: 3.4, FH: 1.4, SH: 1.8, N8: 2.2, FL: 2.2, HK: 2.0, LK: 1.2, LP: 0.7, TP: 0.7,
    }
    const fresh = 0.55 + 0.45 * ((side.energy.get(p.id) ?? 70) / 100)
    return (posW[p.pos] ?? 1) * (0.5 + p.a.pac / 20) * fresh * (p.trait === 'The Step' ? 1.8 : 1) * (side.exIds.has(p.id) ? 1.25 : 1)
  })
  return wpick(rng, ps, w)
}
