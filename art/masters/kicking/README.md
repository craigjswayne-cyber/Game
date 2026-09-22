# PHASE Kicking Enclosure — LOCKED master set

Six images, levels 0 to 5. **Frozen.** `CHECKSUMS.md5` verifies with `md5sum -c CHECKSUMS.md5`.
Canvas 1254 x 1254.

| Level | File | Content |
| --- | --- | --- |
| 0 | `kicking-L0.png` | One weathered set of posts on open grass, worn approach |
| 1 | `kicking-L1.png` | Lined kicking strip, one set of posts, low net to the north, small store |
| 2 | `kicking-L2.png` | Two sets of posts, full-height netting north and east, tee stations |
| 3 | `kicking-L3.png` | Fully enclosed: netting on all four sides, synthetic surface, distance arcs |
| 4 | `kicking-L4.png` | Covered kicking bay on the west with solar, ball-return channels |
| 5 | `kicking-L5.png` | Net canopy over the whole enclosure, indoor kicking hall with glazed roof |

## Measured

| Level | Built | Detail density | Stub reach N / S / W / E (m) |
| --- | --- | --- | --- |
| 0 | 4.9% | 0.069 | 83.5 / 83.5 / 83.5 / 83.5 |
| 1 | 18.6% | 0.105 | 83.5 / 41.9 / 83.5 / 83.5 |
| 2 | 24.0% | 0.127 | 83.5 / 33.6 / 83.5 / 83.5 |
| 3 | 47.9% | 0.160 | 83.5 / 34.1 / 83.5 / 83.5 |
| 4 | 58.6% | 0.195 | 83.5 / 31.7 / 29.9 / 83.5 |
| 5 | 60.7% | 0.224 | 83.5 / 24.8 / 18.7 / 15.9 |

All four stubs connect at every level. The tightest is 15.9 m at level 5.

## The net canopy is translucent, and that was checked

The defining feature of levels 3 to 5 is full-height ball-stop netting, and at level 5 a horizontal
net canopy over the whole enclosure. The risk was that it would render as a solid roof. It did not:
at level 5 the grass detector still finds green across the plot beneath the canopy, so the ground
reads through the mesh as intended.

The same property makes the grass colour hard to measure on this facility. Netted grass samples as
desaturated, which looks like a palette break but is not one. Corner patches are no help either, as
they contain the corner trees. Any future colour check on this set must sample grass outside the
enclosure, and at level 5 that is barely possible.

## Level 5 palette — the blue-channel pin appears to have held

This run's level 5 prompt used no superlatives and additionally pinned the grass BLUE channel,
following the training paddock result.

| Facility | L5 green | Its set's green | Shortfall |
| --- | --- | --- | --- |
| Gym | 97 | 145-150 | -34% |
| Recovery Centre | 95 | 149-152 | -37% |
| Training Paddock | 130 | 147-154 | -12% |
| Kicking Enclosure | 137 | 142-149 | **-6%** |

Level 4's grass, sampled outside the enclosure where netting cannot interfere, reads `69,154,43`:
blue channel 43 against the set's 32-45, a clean match and the best level 4 in the project.

Level 5 measures -6%, the smallest break so far, and the residual is consistent with canopy tint
rather than a render shift. **Treated as a success but not proven**, for the sampling reason above.
Carry both devices into the remaining facilities: no superlatives, and an explicit instruction that
the grass blue channel must not rise.

## Known deviation, accepted

**The final step is flat.** Built area moves 58.6% to 60.7% from level 4 to level 5, just 2.1
points, where every earlier step moved between 5 and 24. The canopy and the indoor hall are real
additions, but by footprint level 5 is barely larger than level 4, so the last upgrade reads thin
next to the others.

## Site contract

Hedge, 6 m perimeter path, four mid-edge connector stubs, bollards, wider south stub with
threshold slab, four corner trees. Central mass growing outward behind a 6 m apron ring the stubs
run in to meet. Sun high to the north-west, every shadow down and to the right. No text, no people,
no vehicles.
