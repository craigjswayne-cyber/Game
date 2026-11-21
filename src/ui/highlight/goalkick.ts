// Where a kick at goal is taken from (1.9.16, owner: "kicking at goal, the
// placement seems too far back? It should be to get the best angle").
//
// THE LAW. A conversion is taken on a line through the place the try was
// grounded, parallel to the touchlines, and the kicker chooses how far back
// he goes. A penalty at goal is taken from the mark, and a mark inside five
// metres of the goal line is brought out to the five-metre line.
//
// THE ANGLE. The posts are 5.6 m apart, so each upright is a = 2.8 m from the
// middle. From x metres back on a line d metres from the middle, the posts
// fill the angle
//     atan((d + a) / x) - atan((d - a) / x)
// which is widest (set the derivative to nought) at x = sqrt(d*d - a*a) when
// d > a: all but as far back as the try was wide. Inside the posts there is
// no such point, the nearer the wider, and what keeps a kicker back is the
// bar three metres up and the chasers coming off the goal line. So he takes
// it CON_NEAR out under the posts, walks back along the line as the try gets
// wider, and stops at CON_FAR, where the length of the kick starts to cost
// more than the angle gives.
//
// Drawing only: the kick is decided by the engine before any of this is read.

/** half the gap between the uprights, in metres */
export const POST_HALF = 2.8
/** as near as a conversion is taken: over the bar and clear of the chase */
export const CON_NEAR = 11
/** as far back as a kicker goes for his angle */
export const CON_FAR = 30

/** the angle the posts fill, in radians, from `back` metres out on a line
 *  `wide` metres from the middle of the posts */
export function goalAngle(wide: number, back: number): number {
  const d = Math.abs(wide), x = Math.max(0.01, back)
  return Math.atan((d + POST_HALF) / x) - Math.atan((d - POST_HALF) / x)
}

/** How far from the goal line a conversion is taken, in metres, for a try
 *  grounded `wide` metres from the middle of the posts. */
export function conversionBack(wide: number): number {
  const d = Math.abs(wide)
  const best = d > POST_HALF ? Math.sqrt(d * d - POST_HALF * POST_HALF) : 0
  return Math.max(CON_NEAR, Math.min(CON_FAR, best))
}

/** How far from the goal line a penalty at goal is taken, in metres: the
 *  mark itself (`markOut` metres out), never walked back for the angle. */
export function penaltyBack(markOut: number): number {
  return Math.max(5, Math.min(60, markOut))
}
