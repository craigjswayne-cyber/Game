// Positional roles, FM-style but for rugby: each shirt can be told HOW to
// play his position. Small, honest effects - selection still rules.

export interface RoleDef { id: string; name: string; short: string; desc: string }

// Props and the hooker were sharing one list, so the game offered to turn your
// hooker into a Mobile Prop. A hooker's job is the throw and the link play; he
// gets his own two.
const PROPS: RoleDef[] = [
  { id: 'scrummager', name: 'Scrummager', short: 'SCR', desc: 'Lives for the set piece. Scrum up, a touch less around the park.' },
  { id: 'mobile', name: 'Mobile Prop', short: 'MOB', desc: 'A front-rower with wheels. Attack up, scrum eases off.' },
]
const HOOKER: RoleDef[] = [
  { id: 'thrower', name: 'Lineout Thrower', short: 'THR', desc: 'The throw is his job and he drills it. Lineout up, scrum eases.' },
  { id: 'link', name: 'Link Man', short: 'LNK', desc: 'A hooker who plays like a flanker. Attack and breakdown up, scrum eases.' },
]
const LOCKS: RoleDef[] = [
  { id: 'lineout_general', name: 'Lineout General', short: 'LIN', desc: 'Runs the air. Lineout up, and his eyes are up there rather than on the floor.' },
  { id: 'enforcer_lock', name: 'Enforcer', short: 'ENF', desc: 'Brings the nasty. Breakdown up, cards flirt.' },
]
const BACK_ROW: RoleDef[] = [
  { id: 'jackal_role', name: 'Jackal', short: 'JKL', desc: 'First to every ruck. Breakdown up, but he is over the ball rather than in the line.' },
  { id: 'carrier', name: 'Ball Carrier', short: 'CAR', desc: 'Hard metres every time. Attack up; carrying is not clearing rucks.' },
  { id: 'stopper', name: 'Defensive Anchor', short: 'DEF', desc: 'Tackles everything that moves. Defence up, attack eases.' },
]
const SCRUM_HALF: RoleDef[] = [
  { id: 'box_kicker', name: 'Box Kicker', short: 'BOX', desc: 'Pins the corners. Kicking game up, less ball through the hands.' },
  { id: 'sniper', name: 'Sniper', short: 'SNP', desc: 'Darts from the base. Attack up, kicking eases.' },
]
const FLY_HALF: RoleDef[] = [
  { id: 'kicking_general', name: 'Kicking General', short: 'KGN', desc: 'Plays the corners all day. Kicking well up.' },
  { id: 'playmaker', name: 'Playmaker', short: 'PLY', desc: 'Flat to the line, ball in hand. Attack up, defence eases.' },
]
const CENTRES: RoleDef[] = [
  { id: 'crash', name: 'Crash Ball', short: 'CRB', desc: 'Over the gain line. Breakdown support up, a little less width.' },
  { id: 'distributor', name: 'Distributor', short: 'DST', desc: 'Hands through the gap. Attack up, defence eases.' },
]
const BACK_THREE: RoleDef[] = [
  { id: 'finisher', name: 'Finisher', short: 'FIN', desc: 'Feed him and he scores. Attack edge up, defence eases.' },
  { id: 'aerial', name: 'Aerial Specialist', short: 'AIR', desc: 'Owns the high ball. Defence and kick-chase up, less of a threat with it in hand.' },
]

/** Role options per XV slot (0-14 in lineup order). */
export function rolesForSlot(slot: number): RoleDef[] {
  if (slot === 1) return HOOKER
  if (slot <= 2) return PROPS
  if (slot <= 4) return LOCKS
  if (slot <= 7) return BACK_ROW
  if (slot === 8) return SCRUM_HALF
  if (slot === 9) return FLY_HALF
  if (slot === 11 || slot === 12) return CENTRES
  return BACK_THREE // 10, 13, 14 - the back three
}

export const ROLE_BY_ID: Record<string, RoleDef> = Object.fromEntries(
  [...PROPS, ...HOOKER, ...LOCKS, ...BACK_ROW, ...SCRUM_HALF, ...FLY_HALF, ...CENTRES, ...BACK_THREE]
    .map(r => [r.id, r]),
)


/**
 * WHAT A ROLE DOES, in one table the engine and the screen both read.
 *
 * It lived as a switch inside matchEngine.applyModifiers, and eleven of the
 * seventeen cases were a strictly free upgrade - a rise with nothing debited
 * against it. Measured before this: the free stack was worth +6.0 points a
 * match at Northampton and moved the win rate from 50.9% to 60.0%, and NO AI
 * CLUB HAD EVER SET A SINGLE ROLE, so the whole thing was an edge only the
 * manager could take. The in-game coach recommended taking it.
 *
 * Every role now trades. A role is a way of playing the position, not a better
 * version of the player: telling a lock to run the air means his eyes are up
 * rather than on the floor, and telling a winger to own the high ball means he
 * is a smaller threat with it in hand. The rises are unchanged - the costs are
 * new - so a chosen role is still an edge, just a priced one.
 *
 * 'card' is card risk, everything else is a unit multiplier.
 */
export type RoleFx = Partial<Record<'scrum' | 'lineout' | 'breakdown' | 'attack' | 'defence' | 'kicking' | 'card', number>>

export const ROLE_FX: Record<string, RoleFx> = {
  // the six that already traded, unchanged
  scrummager: { scrum: 1.02, attack: 0.997 },
  mobile: { attack: 1.008, scrum: 0.988 },
  thrower: { lineout: 1.03, scrum: 0.99 },
  link: { attack: 1.01, breakdown: 1.008, scrum: 0.985 },
  enforcer_lock: { breakdown: 1.012, card: 1.04 },
  sniper: { attack: 1.01, kicking: 0.99 },
  kicking_general: { kicking: 1.03, attack: 0.995 },
  playmaker: { attack: 1.012, defence: 0.995 },
  // the eleven that were free
  lineout_general: { lineout: 1.025, breakdown: 0.992 },
  jackal_role: { breakdown: 1.015, defence: 0.994 },
  carrier: { attack: 1.008, breakdown: 0.996 },
  stopper: { defence: 1.01, attack: 0.994 },
  box_kicker: { kicking: 1.02, attack: 0.99 },
  crash: { breakdown: 1.01, attack: 0.995 },
  distributor: { attack: 1.008, defence: 0.995 },
  finisher: { attack: 1.006, defence: 0.996 },
  aerial: { defence: 1.008, kicking: 1.01, attack: 0.988 },
}
