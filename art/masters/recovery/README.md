# PHASE Recovery Centre — LOCKED master set

Six images, levels 0 to 5. **Frozen.** `CHECKSUMS.md5` verifies with `md5sum -c CHECKSUMS.md5`.
Canvas 1254 x 1254. No rugby pitch at any level, which is correct for this facility.

| Level | File | Content |
| --- | --- | --- |
| 0 | `recovery-L0.png` | One small timber treatment cabin, centred, gravel path from the south stub |
| 1 | `recovery-L1.png` | Bigger cabin, apron ring laid in, one plunge tub on a deck |
| 2 | `recovery-L2.png` | Rendered building with timber wing, two contrast pools, plant enclosure |
| 3 | `recovery-L3.png` | Indoor hydrotherapy pool under a long glazed roof, outdoor pools retained |
| 4 | `recovery-L4.png` | Larger block with solar array, cryotherapy wing, three-pool courtyard |
| 5 | `recovery-L5.png` | Glazed complex filling the site, pool garden across the southern third |

## The site plan — use this one, not the quadrant plan

This facility replaced the gym's cross-and-quadrants layout with a central mass, because the
quadrant plan divided the plot into four and the facility was wanted to fill the square.

> The facility is ONE CENTRAL COMPOSITION, centred on the canvas, growing outward in every
> direction as levels rise until it nearly fills the plot. A 6 m paved apron ring runs around it.
> Each of the four connector stubs runs straight inward in a short line to meet that ring. Those
> four runs and the ring are permanent and nothing is built on them. Everything else sits inside
> the ring.

It fills the square and keeps all four stubs connected, which the quadrant plan could not do at
once. Prefer it for the remaining facilities.

## Measured growth

Percentage of the plot interior that is built rather than grass. Monotonic, with no stalled level.

| Level | Built | Detail density | Median grass RGB |
| --- | --- | --- | --- |
| 0 | 8.2% | 0.078 | 75, 151, 32 |
| 1 | 24.1% | 0.113 | 75, 151, 35 |
| 2 | 35.9% | 0.156 | 73, 149, 38 |
| 3 | 46.4% | 0.198 | 73, 150, 37 |
| 4 | 54.1% | 0.225 | 69, 152, 33 |
| 5 | 80.5% | 0.313 | **30, 95, 27** |

## Stub connectivity

How far each stub runs in from the canvas edge before meeting the built mass. All four connect at
every level; the figures fall as the facility grows, which is expected.

| Level | North | South | West | East |
| --- | --- | --- | --- | --- |
| 0 | 67.7 m | 83.5 m | 83.5 m | 83.5 m |
| 1 | 57.2 m | 83.5 m | 83.5 m | 83.5 m |
| 2 | 41.2 m | 67.9 m | 83.5 m | 83.5 m |
| 3 | 42.9 m | 62.3 m | 83.5 m | 43.2 m |
| 4 | 38.4 m | 58.3 m | 38.7 m | 31.5 m |
| 5 | 14.5 m | 40.7 m | 32.4 m | 15.6 m |

## Known deviation, accepted

**Level 5 breaks the palette.** Its grass reads `30,95,27` against `69-75, 149-152, 32-38` across
the other five, about 60% darker, and its detail density is 39% above level 4. Beside the rest it
reads as a different art style.

This is the second facility in a row where level 5 alone breaks the palette, and it happened
**despite the level 5 prompt carrying an explicit numeric grass value**. The pin is not the fix.

Working theory, recorded so the remaining facilities can avoid it: the trigger is aspirational
language. Both failing level 5 prompts used "world-class", "most expensive-looking on the campus"
and "excessive". The generator appears to answer that with a richer, darker, more cinematic render
that overrides a colour instruction further down the prompt. For the remaining facilities, write
level 5 as a plain extension of level 4 with no superlatives at all.

## Site contract

Hedge, 6 m perimeter path, four mid-edge connector stubs, bollards, wider south stub with
threshold slab, four corner trees. Sun high to the north-west, every shadow down and to the right.
No text, no people, no vehicles.
