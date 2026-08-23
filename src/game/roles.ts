// Positional roles, FM-style but for rugby: each shirt can be told HOW to
// play his position. Small, honest effects - selection still rules.
//
// name/short/desc are i18n KEYS, not words: this table is built once at module
// load and the language can change afterwards. The screen calls t() on them.
// English wording is in src/locales/en.json under `roles`.

export interface RoleDef { id: string; name: string; short: string; desc: string }

// Props and the hooker were sharing one list, so the game offered to turn your
// hooker into a Mobile Prop. A hooker's job is the throw and the link play; he
// gets his own two.
const PROPS: RoleDef[] = [
  { id: 'scrummager', name: 'roles.scrummager', short: 'roles.scrummagerShort', desc: 'roles.scrummagerDesc' },
  { id: 'mobile', name: 'roles.mobile', short: 'roles.mobileShort', desc: 'roles.mobileDesc' },
]
const HOOKER: RoleDef[] = [
  { id: 'thrower', name: 'roles.thrower', short: 'roles.throwerShort', desc: 'roles.throwerDesc' },
  { id: 'link', name: 'roles.link', short: 'roles.linkShort', desc: 'roles.linkDesc' },
]
const LOCKS: RoleDef[] = [
  { id: 'lineout_general', name: 'roles.lineout_general', short: 'roles.lineout_generalShort', desc: 'roles.lineout_generalDesc' },
  { id: 'enforcer_lock', name: 'roles.enforcer_lock', short: 'roles.enforcer_lockShort', desc: 'roles.enforcer_lockDesc' },
]
const BACK_ROW: RoleDef[] = [
  { id: 'jackal_role', name: 'roles.jackal_role', short: 'roles.jackal_roleShort', desc: 'roles.jackal_roleDesc' },
  { id: 'carrier', name: 'roles.carrier', short: 'roles.carrierShort', desc: 'roles.carrierDesc' },
  { id: 'stopper', name: 'roles.stopper', short: 'roles.stopperShort', desc: 'roles.stopperDesc' },
]
const SCRUM_HALF: RoleDef[] = [
  { id: 'box_kicker', name: 'roles.box_kicker', short: 'roles.box_kickerShort', desc: 'roles.box_kickerDesc' },
  { id: 'sniper', name: 'roles.sniper', short: 'roles.sniperShort', desc: 'roles.sniperDesc' },
]
const FLY_HALF: RoleDef[] = [
  { id: 'kicking_general', name: 'roles.kicking_general', short: 'roles.kicking_generalShort', desc: 'roles.kicking_generalDesc' },
  { id: 'playmaker', name: 'roles.playmaker', short: 'roles.playmakerShort', desc: 'roles.playmakerDesc' },
]
const CENTRES: RoleDef[] = [
  { id: 'crash', name: 'roles.crash', short: 'roles.crashShort', desc: 'roles.crashDesc' },
  { id: 'distributor', name: 'roles.distributor', short: 'roles.distributorShort', desc: 'roles.distributorDesc' },
]
const BACK_THREE: RoleDef[] = [
  { id: 'finisher', name: 'roles.finisher', short: 'roles.finisherShort', desc: 'roles.finisherDesc' },
  { id: 'aerial', name: 'roles.aerial', short: 'roles.aerialShort', desc: 'roles.aerialDesc' },
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
