# PHASE Campus Map — background plate

`campus-plate.png`, 1086 x 1448, exactly 3:4 portrait. **Frozen.** `md5sum -c CHECKSUMS.md5`
verifies.

A small riverside town with ten empty square plots. The plots take the facility tiles from
`art/masters/<facility>/`, composited in at the player's current level. The plate itself carries
the roads, river, railway, station, bus interchange, planting and street furniture; the plots carry
nothing.

`plots.json` holds the measured rectangle of every plot. Use it rather than eyeballing coordinates.

## The ten plot rectangles

Measured as connected-component bounding boxes of flat plot grass at 1 px resolution, accurate to
about 1 px.

| Plot | x | y | w | h | w/h |
| --- | --- | --- | --- | --- | --- |
| 1 | 96 | 106 | 131 | 130 | 1.008 |
| 2 | 534 | 222 | 131 | 130 | 1.008 |
| 3 | 86 | 355 | 132 | 130 | 1.015 |
| 4 | 847 | 397 | 132 | 131 | 1.008 |
| 5 | 471 | 511 | 132 | 132 | 1.000 |
| 6 | 713 | 615 | 135 | 134 | 1.007 |
| 7 | 350 | 773 | 133 | 133 | 1.000 |
| 8 | 70 | 778 | 135 | 133 | 1.015 |
| 9 | 858 | 874 | 132 | 132 | 1.000 |
| 10 | 617 | 914 | 131 | 131 | 1.000 |

## How to composite

**Scale each tile into its own rectangle.** Do not assume a single shared plot size. Sizes vary
from 131 to 135 px wide and 130 to 134 tall, about 3%. Across a town that variance reads as natural;
forcing a common size would misalign tiles against their kerbs instead.

Each facility tile is 1254 x 1254 and carries its own hedge, 6 m perimeter path, four mid-edge
connector stubs and four corner trees. The plate deliberately draws none of those inside a plot, so
there is no doubling at the seam. The plate's paved crossing points sit at the midpoint of each plot
side, which is where each tile's stubs meet the road.

## What was established, and what could not be

**Axis alignment holds.** Every plot is square and upright across two generations, with bounding-box
fill between 0.973 and 0.986 — a rotated square measures 0.5 to 0.7. Curved roads never pulled a
plot off-axis, which was the main risk in moving from a grid layout to an organic one.

**Asking for identical plot sizes does not work.** A correction pass specifically requesting it left
the spread unchanged, merely redistributing it between width and height. Two other fixes in the same
pass did land: one plot's aspect went from 1.031 to 1.015, and a third river crossing was added. So
the generator will take a specific, local, describable correction and will not take a global
consistency constraint. Do not spend further passes on it.

## Open decision: scale

Plots are **12.1% of the canvas width**, so a 1254 px tile composites down to roughly a tenth of its
native size. At that scale a facility reads as roof colour and massing only — the sawtooth roof, the
accommodation rooflight rhythm, the glazed pool halls and the pitch markings are all lost.

That is correct for a zoomable overview the player pinches into. It is too small if this is the main
view. Deciding this changes the plate, not the tiles, so it can be settled later without touching
the sixty assets.

## Site contract

True orthographic, 90 degrees straight down, zero perspective. Sun high to the north-west, every
shadow down and to the right, matching all sixty facility tiles. No text, numbers, logos, signage,
people or vehicles.
