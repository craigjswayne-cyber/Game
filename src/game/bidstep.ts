// The money steppers on a player's page (1.9.16).
//
// Owner: "player value is 30k, I hit -100k, it now says 100k as the cost? Bug -
// check all bidding". The fee stepper had one pair of steps (100k and 500k)
// and a hard floor of 100k, so the minus button on a 30k player RAISED the
// bid to 100k, and no bid below 100k could be made at all. The wage stepper
// had the same shape: 500 a week steps and a 500 floor, so minus on a 300 a
// week academy lad put his wage UP.
//
// The rule both now obey: a minus never raises the figure, and the steps are
// sized to the money on the table.

/** The small and big step for a fee of this size. */
export function feeSteps(ref: number): [number, number] {
  if (ref < 250_000) return [5_000, 25_000]
  if (ref < 1_000_000) return [25_000, 100_000]
  return [100_000, 500_000]
}

/** A fee after one press. `delta` is signed. A bid can be taken all the way
 *  down to nothing (owner, 21 Nov 2026: "have you added value starting at
 *  0?"): what the club makes of a bid of nothing is the club's answer to give,
 *  not the stepper's. It never goes below nothing. */
export function stepFee(bid: number, delta: number, _ref?: number): number {
  return Math.max(0, bid + delta)
}

/** The weekly-wage step at this wage. */
export function wageStep(wage: number): number {
  if (wage < 1_000) return 50
  if (wage < 5_000) return 250
  return 500
}

/** A wage after one press down: never below one step, never above itself. */
export function wageDown(wage: number): number {
  // step by the band the wage is LEAVING, so 1,000 goes to 950, not 750
  const step = wageStep(wage - 1)
  return Math.max(Math.min(wage, 50), wage - step)
}

/** "25k", "500k", "1m": the label on a step button. */
export function stepLabel(n: number): string {
  return n >= 1_000_000 ? `${n / 1_000_000}m` : `${n / 1_000}k`
}

/** A fee rounded to a figure a chairman would say out loud. Fees were all
 *  rounded to the nearest 50k, which is right for a two-million man and wrong
 *  for a 30k one: his club's lowest price came out at 50k, ABOVE the 30k it
 *  was asking, and a 20k man's came out at nothing. From half a million up
 *  the rounding is what it always was. A fee that is something never rounds
 *  to nothing. */
export function cleanFee(x: number): number {
  if (!(x > 0)) return 0
  const grain = x >= 500_000 ? 50_000 : x >= 50_000 ? 5_000 : 1_000
  return Math.max(grain, Math.round(x / grain) * grain)
}
