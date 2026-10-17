// The commentary's line pools. Split out of matchEngine.ts, which re-exports
// the public parts.
import type { MatchEvent, Player } from '../model'
import { FW_POS } from './energy'

export interface SimResult {
  events: MatchEvent[]
  motmId: number | null
}

export const TRY_LINES = [
  'comm.try1',
  'comm.try2',
  'comm.try3',
  'comm.try4',
  'comm.try5',
  'comm.try6',
  'comm.try7',
  'comm.try8',
  'comm.try9',
  'comm.try10',
  'comm.try11',
  'comm.try12',
  'comm.try13',
  'comm.try14',
  'comm.try15',
  'comm.try16',
  'comm.try17',
  'comm.try18',
  'comm.try19',
  'comm.try20',
  'comm.try21',
  'comm.try22',
  'comm.try23',
  'comm.try24',
  'comm.try25',
  'comm.try26',
]
/** try lines only a forward finishes (the maul, the pick-and-go), and the
 *  ones only a back does (outpacing, chips, the wraparound) */
const TRY_FWD_ONLY = new Set(['comm.try4', 'comm.try15', 'comm.tryWet5'])
const TRY_BACK_ONLY = new Set(['comm.try9', 'comm.try14', 'comm.try17', 'comm.try19', 'comm.tryWet1'])
export function fitTryLine(k: string, scorer: Player): string {
  const fwd = FW_POS.has(scorer.pos)
  // picking from the base is a number eight's or a scrum-half's try
  if (k === 'comm.try10' && !fwd && scorer.pos !== 'SH') return 'comm.try6'
  // "in comes the blindside wing" names a wing
  if (k === 'comm.try22' && scorer.pos !== 'WG') return fwd ? 'comm.try1' : 'comm.try6'
  if (!fwd && TRY_FWD_ONLY.has(k)) return 'comm.try6'
  if (fwd && TRY_BACK_ONLY.has(k)) return 'comm.try1'
  return k
}
export const TRY_LINES_WET = [
  'comm.tryWet1',
  'comm.tryWet2',
  'comm.tryWet3',
  'comm.tryWet4',
  'comm.tryWet5',
]
export const TRY_LINES_DERBY = [
  'comm.tryDerby1',
  'comm.tryDerby2',
  'comm.tryDerby3',
  'comm.tryDerby4',
  'comm.tryDerby5',
]
export const PEN_LINES = [
  'comm.pen1',
  'comm.pen2',
  'comm.pen3',
  'comm.pen4',
  'comm.pen5',
  'comm.pen6',
  'comm.pen7',
  'comm.pen8',
  'comm.pen9',
  'comm.pen10',
  'comm.pen11',
]
/** the lines that claim range, and the plain line each becomes for a kicker without it */
export const PEN_LONG: Record<string, string> = { 'comm.pen4': 'comm.pen1', 'comm.pen6': 'comm.pen2', 'comm.pen9': 'comm.pen3' }
/** the same idea for a line that claims WEATHER. pen11 has the kicker wiping
 *  mud off the ball and rain off his face, and nothing stopped it firing under
 *  a clear sky - the try bank has had TRY_LINES_WET since the beginning and the
 *  penalty bank never got the equivalent. Same shape as PEN_LONG: a swap after
 *  the draw, so no extra call on the stream and every seeded match keeps its
 *  fingerprint. */
export const PEN_WET: Record<string, string> = { 'comm.pen11': 'comm.pen5' }
export const CON_LINES = [
  'comm.con1',
  'comm.con2',
  'comm.con3',
  'comm.con4',
  'comm.con5',
  'comm.con6',
  'comm.con7',
  'comm.con8',
]
/** try lines that put the ball under the posts, and conversion lines that
 *  put the kicker on the touchline: the two never follow each other. Since
 *  1.8.12 neither line names the posts (owner: the clip showed the try nowhere
 *  near them), but the swap stays so the line sequence, and the fingerprint
 *  built from it, are unchanged */
export const UNDER_POSTS = new Set(['comm.try5', 'comm.try21'])
export const TOUCHLINE_CON = new Set(['comm.con3', 'comm.con8'])
export const FLAVOR_GRASSROOTS = [
  'comm.flavGrass1',
  'comm.flavGrass2',
  'comm.flavGrass3',
  'comm.flavGrass4',
  'comm.flavGrass5',
  'comm.flavGrass6',
  'comm.flavGrass7',
  'comm.flavGrass8',
]

export const FLAVOR_PACIFIC = [
  'comm.flavPac1',
  'comm.flavPac2',
  'comm.flavPac3',
  'comm.flavPac4',
  'comm.flavPac5',
  'comm.flavPac6',
]

export const FLAVOR = [
  'comm.flav1',
  'comm.flav2',
  'comm.flav3',
  'comm.flav4',
  'comm.flav5',
  'comm.flav6',
  'comm.flav7',
  'comm.flav8',
  'comm.flav9',
  'comm.flav10',
  'comm.flav11',
  'comm.flav12',
  'comm.flav13',
  'comm.flav14',
  'comm.flav15',
  'comm.flav16',
  'comm.flav17',
  'comm.flav18',
  'comm.flav19',
  'comm.flav20',
  'comm.flav21',
  'comm.flav22',
  'comm.flav23',
  'comm.flav24',
  'comm.flav25',
  'comm.flav26',
]
export const FLAVOR_WET = [
  'comm.flavWet1',
  'comm.flavWet2',
  'comm.flavWet3',
  'comm.flavWet4',
  'comm.flavWet5',
  'comm.flavWet6',
]
/** the light moments (1.7.4, owner: "need more humour in the game"): a dog on
 *  the pitch, a lost boot, a seagull that will not move. Rare, about one in
 *  thirty atmosphere lines, so a match has one now and then and never a set. */
export const FLAVOR_FUN = ['comm.fun1', 'comm.fun2', 'comm.fun3', 'comm.fun4', 'comm.fun5', 'comm.fun6']
export const FLAVOR_WIND = [
  'comm.flavWind1',
  'comm.flavWind2',
  'comm.flavWind3',
  'comm.flavWind4',
]
export const FLAVOR_DERBY = [
  'comm.flavDerby1',
  'comm.flavDerby2',
  'comm.flavDerby3',
  'comm.flavDerby4',
  'comm.flavDerby5',
]
export const TIRED_LINES = [
  'comm.tired1',
  'comm.tired2',
  'comm.tired3',
  'comm.tired4',
]

/**
 * ---- THE MATCH, CALLED AS IT IS PLAYED (1.8.0) ----
 *
 * The owner asked for more commentary, about 100 to 150 lines a match. A watched match
 * used to be about 48 lines, most of them scores and the odd atmosphere line,
 * so four minutes of rugby could pass in one sentence. These banks describe
 * the rugby the engine is already playing: where the ball is (ctx.field), who
 * has been winning it (the tick's scoring roll), the kicks from hand it now
 * counts, the restarts after a score, the set piece the match sheet derives.
 *
 * WORDS ONLY. Every pick in here is ctx.crng, the commentary's own dice, and
 * every line is stamped at the minute the clock has already reached (see
 * colour() below), so a watched match and the same fixture played silently
 * stay the same match (scripts/detailprobe.ts). Nothing here reads a line
 * back or changes a number.
 *
 * Grouped by where the ball is, so a line never puts a side in the wrong 22.
 */
/** a side running it out of its own 22 */
export const PBP_DEEP = ['comm.pbpDeep1', 'comm.pbpDeep2', 'comm.pbpDeep3', 'comm.pbpDeep4', 'comm.pbpDeep5', 'comm.pbpDeep6']
/** phase play between the 22s */
export const PBP_MID = [
  'comm.pbpMid1', 'comm.pbpMid2', 'comm.pbpMid3', 'comm.pbpMid4', 'comm.pbpMid5', 'comm.pbpMid6',
  'comm.pbpMid7', 'comm.pbpMid8', 'comm.pbpMid9', 'comm.pbpMid10', 'comm.pbpMid11', 'comm.pbpMid12',
]
/** close to their line */
export const PBP_RED = [
  'comm.pbpRed1', 'comm.pbpRed2', 'comm.pbpRed3', 'comm.pbpRed4', 'comm.pbpRed5',
  'comm.pbpRed6', 'comm.pbpRed7', 'comm.pbpRed8', 'comm.pbpRed9', 'comm.pbpRed10',
]
/** the breakdown, anywhere */
export const PBP_RUCK = [
  'comm.pbpRuck1', 'comm.pbpRuck2', 'comm.pbpRuck3', 'comm.pbpRuck4', 'comm.pbpRuck5',
  'comm.pbpRuck6', 'comm.pbpRuck7', 'comm.pbpRuck8', 'comm.pbpRuck9', 'comm.pbpRuck10',
]
/** a count of phases: {n} is the phase count, a word choice like the rest */
export const PBP_PHASES = ['comm.pbpPhases1', 'comm.pbpPhases2', 'comm.pbpPhases3', 'comm.pbpPhases4', 'comm.pbpPhases5', 'comm.pbpPhases6']
/** the side without the ball, as a unit */
export const DEF_SET = [
  'comm.defSet1', 'comm.defSet2', 'comm.defSet3', 'comm.defSet4', 'comm.defSet5',
  'comm.defSet6', 'comm.defSet7', 'comm.defSet8', 'comm.defSet9', 'comm.defSet10',
]
/** a named tackler: always a man the tackle count already has making hits */
export const DEF_HIT = ['comm.defHit1', 'comm.defHit2', 'comm.defHit3', 'comm.defHit4', 'comm.defHit5', 'comm.defHit6', 'comm.defHit7', 'comm.defHit8']
/** the set piece the match sheet derives (matchStats): words, no count moves */
export const SP_LINEOUT = [
  'comm.lineout1', 'comm.lineout2', 'comm.lineout3', 'comm.lineout4', 'comm.lineout5',
  'comm.lineout6', 'comm.lineout7', 'comm.lineout8', 'comm.lineout9', 'comm.lineout10',
]
export const SP_SCRUM = [
  'comm.scrum1', 'comm.scrum2', 'comm.scrum3', 'comm.scrum4', 'comm.scrum5',
  'comm.scrum6', 'comm.scrum7', 'comm.scrum8', 'comm.scrum9', 'comm.scrum10',
]
/** UNCONTESTED SCRUMS HAVE NO CONTEST (release QA after 1.8.16): a match the
 *  referee had made uncontested at kick-off still had the scrum going
 *  forward, a wheel, a reset, a shove, a penalty at the scrum and a prop
 *  "who will make the scrum creak". Under Law 3 nobody pushes and nobody is
 *  penalised for it. These are the words that stay true; the other pools
 *  below lose their contest lines the same way. Commentary dice only: no
 *  result moves. */
export const SP_SCRUM_UNCONTESTED = ['comm.scrum1', 'comm.scrum8', 'comm.scrum9']
export const SCRUM_CONTEST_FLAV = new Set(['comm.flav4', 'comm.flav21'])
/** the kick-off after a score, taken by the side that conceded it */
export const RESTART = [
  'comm.restart1', 'comm.restart2', 'comm.restart3', 'comm.restart4', 'comm.restart5',
  'comm.restart6', 'comm.restart7', 'comm.restart8', 'comm.restart9', 'comm.restart10',
]
/** where the game is being played, now and then */
export const TERR_CAMPED = ['comm.terrCamped1', 'comm.terrCamped2', 'comm.terrCamped3', 'comm.terrCamped4', 'comm.terrCamped5']
export const TERR_MIDDLE = ['comm.terrMiddle1', 'comm.terrMiddle2', 'comm.terrMiddle3', 'comm.terrMiddle4', 'comm.terrMiddle5']
/** the last ten minutes, read off the scoreboard as it stands */
export const LATE_CHASE = ['comm.lateChase1', 'comm.lateChase2', 'comm.lateChase3', 'comm.lateChase4']
export const LATE_HOLD = ['comm.lateHold1', 'comm.lateHold2', 'comm.lateHold3', 'comm.lateHold4']
export const LATE_LEVEL = ['comm.lateLevel1', 'comm.lateLevel2', 'comm.lateLevel3']
/** a greasy ball, when it is raining */
export const PBP_WET = ['comm.pbpWet1', 'comm.pbpWet2', 'comm.pbpWet3', 'comm.pbpWet4', 'comm.pbpWet5']

/** KICKS FROM HAND (1.8.0), each one a kick the engine counted (kicksFromHand) */
export const KICK_EXIT = ['comm.kickExit1', 'comm.kickExit2', 'comm.kickExit3', 'comm.kickExit4', 'comm.kickExit5', 'comm.kickExit6', 'comm.kickExit7']
export const KICK_BOX = ['comm.kickBox1', 'comm.kickBox2', 'comm.kickBox3', 'comm.kickBox4', 'comm.kickBox5', 'comm.kickBox6', 'comm.kickBox7']
export const KICK_TOUCH = ['comm.kickTouch1', 'comm.kickTouch2', 'comm.kickTouch3', 'comm.kickTouch4', 'comm.kickTouch5', 'comm.kickTouch6']
export const KICK_LONG = ['comm.kickLong1', 'comm.kickLong2', 'comm.kickLong3', 'comm.kickLong4', 'comm.kickLong5', 'comm.kickLong6']
export const KICK_UP = ['comm.kickUp1', 'comm.kickUp2', 'comm.kickUp3', 'comm.kickUp4', 'comm.kickUp5', 'comm.kickUp6']
export const KICK_PIN = ['comm.kickPin1', 'comm.kickPin2', 'comm.kickPin3', 'comm.kickPin4', 'comm.kickPin5', 'comm.kickPin6']
/** the other side's answer to a kick, named for the man who fields it */
export const KICK_FIELD = ['comm.kickField1', 'comm.kickField2', 'comm.kickField3', 'comm.kickField4', 'comm.kickField5', 'comm.kickField6', 'comm.kickField7']

/** CHARGE-DOWNS (1.8.0): the block, the try that can come of it, and the
 *  four other ways the ball can land */
export const CHARGE_DOWN = ['comm.chargeDown1', 'comm.chargeDown2', 'comm.chargeDown3', 'comm.chargeDown4', 'comm.chargeDown5']
export const CHARGE_TRY_LINES = ['comm.tryCharge1', 'comm.tryCharge2', 'comm.tryCharge3', 'comm.tryCharge4']
export const CHARGE_LINEOUT = ['comm.chargeLineout1', 'comm.chargeLineout2', 'comm.chargeLineout3']
export const CHARGE_SCRUM = ['comm.chargeScrum1', 'comm.chargeScrum2', 'comm.chargeScrum3']
export const CHARGE_REGATHER = ['comm.chargeRegather1', 'comm.chargeRegather2', 'comm.chargeRegather3']
export const CHARGE_SAFE = ['comm.chargeSafe1', 'comm.chargeSafe2', 'comm.chargeSafe3']

/** DROP GOALS THAT MISS (1.8.0): the attempt was always rolled and counted as
 *  a kick at goal, and a miss said nothing at all */
export const DROP_MISS = ['comm.dropMiss1', 'comm.dropMiss2', 'comm.dropMiss3', 'comm.dropMiss4', 'comm.dropMiss5', 'comm.dropMiss6']
