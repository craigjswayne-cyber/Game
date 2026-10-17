/**
 * ---- THE HIGHLIGHT, NOT THE WHOLE MATCH (1.8.0) ----
 *
 * Owner, 28 Sep 2026: "We are going to need to rethink the animation for the
 * game. Its erratic, not good enough for release. We are aiming for football
 * manager level of animation. Smooth and show tries properly, then just
 * commentary only." The always-on pitch redrew thirty men for every line of
 * commentary, and a line of commentary is not a moment of play: most of them
 * are a ruck, a kick to touch or a bit of colour, so the picture lurched from
 * one guessed shape to the next all afternoon.
 *
 * So the pitch now appears only for a highlight, as FM Mobile does it, and a
 * highlight is played as a piece of animation rather than a series of
 * snapshots:
 *
 *   SMOOTH BY CONSTRUCTION. Every position on screen is a pure function of the
 *   clip's clock. The ball runs an eased path through the build-up (the real
 *   field positions of the lines before the try), stopping at each ruck; each
 *   player stands in a formation worked out from where the ball was a moment
 *   ago (a lag of 0.1 to 0.6 s, longer for men further from the ball), so the
 *   team flows after the ball instead of teleporting. Nothing is ever set: a
 *   frame drawn late is simply the right picture a little later.
 *
 *   A TRY: the build-up phases, a tackle and a ruck at each, then the finish
 *   run to the line with the cover chasing, the grounding, and the banner.
 *   A KICK AT GOAL (Extended): the kicker, the flight, GOOD or WIDE.
 *   INTO THE 22 (Extended): the carries that got there.
 *
 * The commentary under the clip is revealed in time with it (onReveal), so the
 * words describe what the pitch is showing.
 */


/*
 * ---- ROUND TWO (owner, 27 Sep 2026: "much better") ----
 *
 *   THE WHOLE PITCH, STILL. "Use the full pitch camera and lock it": the view
 *   is the field from dead-ball line to dead-ball line and never moves.
 *   THE REFEREE is on it, trailing the ball.
 *   THROUGH THE GAP, NOT OVER PEOPLE. The finisher's line bends through the
 *   widest gap in the defence, nobody stands inside anybody else (a soft push
 *   apart every frame), and the men he beats dive and go to ground.
 *   MORE PASSES. A backs move is three passes along the line (a 3 on 2): the
 *   ball travels faster than the defence can drift, and the last man is over.
 *   THE TRY THE COMMENTARY CALLED. The engine's own line says how the try was
 *   scored, so the clip plays that: an intercept run from halfway, a maul
 *   driven over from a lineout, a chip and regather, a grubber, a crossfield
 *   kick to the wing, a charge-down pounced on.
 *   THE TRY IS ONLY CALLED WHEN THE BALL IS DOWN. Nothing else is written
 *   over the pitch: the "Can they make it?" and maul captions were taken off
 *   at the owner's request (1.8.0).
 *   AN ATTACK THAT DID NOT SCORE ends as it did: the full-back's last-gasp
 *   tackle, or the ball turned over.
 *   THE LAST TEN MINUTES OF A CLOSE MATCH bring the pitch on in Key Moments
 *   too, for the kicks and the attacks that decide it.
 */

// The highlight is split by concern under src/ui/highlight/: the clip's
// types, choosing and building a clip, the geometry, the shapes and moves,
// the bake that plays it out, the canvas drawing and the component. This file
// keeps every name it has always exported.
export type { ClipKind, ClipStyle, ClipSpec, ClipLabels } from './highlight/types'
export { type HighlightLevel, lateAndClose, momentAt, nextMoment, buildClip } from './highlight/build'
export { type Timeline, clipTimeline, clipLength, frameAt } from './highlight/bake'
export { CLIP_MOVES } from './highlight/plays'
export { HighlightClip } from './highlight/Clip'
export { refereeColour, tokenColor } from './highlight/draw'
