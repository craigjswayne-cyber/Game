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
  { id: 'lineout_general', name: 'Lineout General', short: 'LIN', desc: 'Runs the air. Lineout up.' },
  { id: 'enforcer_lock', name: 'Enforcer', short: 'ENF', desc: 'Brings the nasty. Breakdown up, cards flirt.' },
]
const BACK_ROW: RoleDef[] = [
  { id: 'jackal_role', name: 'Jackal', short: 'JKL', desc: 'First to every ruck. Breakdown up.' },
  { id: 'carrier', name: 'Ball Carrier', short: 'CAR', desc: 'Hard metres every time. Attack up.' },
  { id: 'stopper', name: 'Defensive Anchor', short: 'DEF', desc: 'Tackles everything that moves. Defence up.' },
]
const SCRUM_HALF: RoleDef[] = [
  { id: 'box_kicker', name: 'Box Kicker', short: 'BOX', desc: 'Pins the corners. Kicking game up.' },
  { id: 'sniper', name: 'Sniper', short: 'SNP', desc: 'Darts from the base. Attack up, kicking eases.' },
]
const FLY_HALF: RoleDef[] = [
  { id: 'kicking_general', name: 'Kicking General', short: 'KGN', desc: 'Plays the corners all day. Kicking well up.' },
  { id: 'playmaker', name: 'Playmaker', short: 'PLY', desc: 'Flat to the line, ball in hand. Attack up, defence eases.' },
]
const CENTRES: RoleDef[] = [
  { id: 'crash', name: 'Crash Ball', short: 'CRB', desc: 'Over the gain line. Breakdown support up.' },
  { id: 'distributor', name: 'Distributor', short: 'DST', desc: 'Hands through the gap. Attack up.' },
]
const BACK_THREE: RoleDef[] = [
  { id: 'finisher', name: 'Finisher', short: 'FIN', desc: 'Feed him and he scores. Attack edge up.' },
  { id: 'aerial', name: 'Aerial Specialist', short: 'AIR', desc: 'Owns the high ball. Defence and kick-chase up.' },
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
