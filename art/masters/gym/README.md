# PHASE Strength & Conditioning Gym — LOCKED master set

Six images, levels 0 to 5. **Frozen.** Do not regenerate, retouch, rescale or re-crop these
files. `CHECKSUMS.md5` holds the MD5 of each as locked; `md5sum -c CHECKSUMS.md5` verifies.

Canvas 1254 x 1254, matching every other master set. No rugby pitch appears at any level, which
is correct for this facility.

| Level | File | Content |
| --- | --- | --- |
| 0 | `gym-L0.png` | One small single-storey gym building, north-west, gravel track from the south stub |
| 1 | `gym-L1.png` | Bigger building, two rubber pads with racks and barbells, cross of routes laid in |
| 2 | `gym-L2.png` | Bigger again, full outdoor yard with tyres, plates, racks, sleds, sprint track |
| 3 | `gym-L3.png` | Large building with solar array, covered sprint lane, sprint track |
| 4 | `gym-L4.png` | Solar retained, second training compound, additional landscaping |
| 5 | `gym-L5.png` | Three-storey glass building, running track circuit, developed quadrants |

## The site plan — adopt this for the remaining facilities

This is the first facility where all four connector stubs stay clear at every level. It was not
achieved by asking the generator to keep them clear, which failed repeatedly on the playing
surface and the stadium. It was achieved structurally:

> The four connector stubs run inward along the two canvas centre lines, north to south and east
> to west, as 6 m paving routes meeting at a central paved court roughly 20 m square. Those routes
> and the court are permanent and nothing is ever built on them. Every building and every piece of
> equipment sits in one of the four quadrants between them and never crosses a centre line. Where
> a surface such as a running track must cross a route, the route wins and is carried across it at
> grade as a marked crossing.

Measured result — longest obstruction in pixels on the clearest line through each stub band.
Anything under about 15 px is bollards and hedge edge, not a blockage.

| Level | North | South | West | East |
| --- | --- | --- | --- | --- |
| 0 | 0 | 0 | 1 | 0 |
| 1 | 0 | 0 | 1 | 0 |
| 2 | 0 | 0 | 1 | 0 |
| 3 | 0 | 0 | 0 | 0 |
| 4 | 0 | 0 | 1 | 0 |
| 5 | 3 | 0 | 2 | 6 |

## Known deviations, accepted

Measured, reported, and locked in as they stand.

**1. Level 5 breaks the palette and the detail level.** Grass colour and small-detail density,
sampled across each whole image:

| Level | Median grass RGB | Detail density |
| --- | --- | --- |
| 0 | 95, 150, 55 | 0.076 |
| 1 | 86, 148, 45 | 0.101 |
| 2 | 82, 149, 43 | 0.134 |
| 3 | 79, 145, 46 | 0.154 |
| 4 | 77, 145, 39 | 0.195 |
| 5 | **32, 97, 32** | **0.396** |

Levels 0 to 4 hold one palette. Level 5's grass is about 35% darker and a different hue, and its
detail density is double level 4's and five times level 0's. Shown beside the others in an upgrade
screen it reads as a different art style. It is the flagship image for the facility, so this is
the deviation most likely to need revisiting.

**2. The build runs about one level early.** The sprint track appears at level 2, specified for
level 3. The solar array appears at level 3, specified for level 4.

**3. Level 4's two storeys do not read.** Two floors were the defining change for that level. From
directly overhead the cue is a shadow roughly twice as long as the single-storey structures, plus
a set-back upper floor reading as two stacked bands. Neither is present; level 4 reads as level 3
with more landscaping.

**4. Level 5 carries recovery content.** Its south-east quadrant holds a swimming pool, timber
decking and a planted garden, which belong to the Recovery Centre, not to a gym.

## Outstanding dependency

The original plan had this facility's level 0 double as the **master empty plot** reused as level
0 for seven other facilities. Level 0 now carries a building, so that image does not exist. It
must be generated once as a standalone asset before the remaining facilities are started, or each
of them will invent its own starting plot and the set will diverge.

## Site contract

Hedge, 6 m perimeter path, four mid-edge connector stubs, bollards, wider south stub with
threshold slab, four corner trees. Sun high to the north-west, every shadow down and to the right.
No text, no people, no vehicles.
