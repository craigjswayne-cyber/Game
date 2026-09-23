# PHASE Stadium — LOCKED master set

Six images, levels 0 to 5. **Frozen.** Do not regenerate, retouch, rescale or re-crop these
files. `CHECKSUMS.md5` holds the MD5 of each as locked; `md5sum -c CHECKSUMS.md5` confirms
nothing has been swapped or re-encoded.

| Level | File | Content |
| --- | --- | --- |
| 0 | `stadium-L0.png` | Pitch, dugouts, rail perimeter fence |
| 1 | `stadium-L1.png` | Roofed north stand, dugouts, perimeter rail, small south-east block |
| 2 | `stadium-L2.png` | North, south and east stands, north-west compound |
| 3 | `stadium-L3.png` | Stands on all four sides, floodlight masts, corner service yards |
| 4 | `stadium-L4.png` | Continuous bowl with filled corners, solar, plant |
| 5 | `stadium-L5.png` | Premium bowl, glazed tier, arrival plaza, car parks, tree planting |

## Measured pitch geometry

Canvas 1254 x 1254, matching the playing-surface masters. Measured against
`art/masters/playing-surface`, where the locked goal-line span is **773.5 px** and the locked
dead-ball span is **900.5 px**.

| Level | Goal-line span | vs locked | Dead-ball span | vs locked | Halfway |
| --- | --- | --- | --- | --- | --- |
| 0 | 773.5 px | 100.0% | 900.5 px | 100.0% | 626.5 |
| 1 | 774.0 px | 100.1% | 900.5 px | 100.0% | 627.0 |
| 2 | 761.5 px | 98.4% | 872.5 px | 96.9% | 626.5 |
| 3 | 772.0 px | 99.8% | 875.0 px | 97.2% | 626.5 |
| 4 | 646.5 px | **83.6%** | 749.5 px | **83.2%** | 626.5 |
| 5 | 549.0 px | **71.0%** | 634.0 px | **70.4%** | 625.5 |

The halfway line holds within 1.5 px of the locked 627.0 in all six, so the pitch stays centred
in every level. The pitch is never off-axis; where it deviates it is uniformly scaled.

## Known deviations, accepted

Measured, reported, and locked in as they stand.

**1. The pitch shrinks at levels 4 and 5.** Levels 0, 1 and 3 carry the locked pitch. Level 2 is
1.6% small. Levels 4 and 5 are scaled down uniformly — every marking symmetric about the halfway
line, every span off by the same factor — to 83.6% and 71.0% of the locked size. The Level 5
pitch is 29% smaller than the Level 0 pitch.

Cause: the plot gives the pitch 20 m of margin east and west and 45 m north and south. A
wraparound bowl with filled corners does not fit in 20 m on the short sides, so the pitch was
reduced instead of the stands.

Consequence to design around: shown in sequence in an upgrade screen, the ground appears to
shrink as the club grows. If that reads badly in the game, levels 4 and 5 are the two to redo,
pinning the pitch to 72% of canvas width and 45% of its height and capping east and west stands
at 16 m deep.

**2. Level 0 is not a bare pitch.** It carries two dugouts and a rail perimeter fence. The
specification was pitch and goalposts only. This softens the level 0 to level 1 step and is
inconsistent with the eight empty-plot facilities that follow.

**3. The build runs about one level early.** Level 2 already has east stands, level 3 has all
four sides, and level 4 is a closed bowl, which was specified as level 5 content. The ladder
compresses towards the top.

## Which levels are safe as a pitch reference

Use `stadium-L0.png`, `stadium-L1.png` or `stadium-L3.png` if a later asset needs a stadium
pitch to match against. Do not use L4 or L5 for that purpose; their pitches are off-scale.
The authoritative pitch reference remains `art/masters/playing-surface/playing-surface-L2.png`.

## Site contract

Hedge, 6 m perimeter path, four mid-edge connector stubs, bollards, wider south stub with
threshold slab, four corner trees. Sun high to the north-west, every shadow down and to the
right. No text, no people, no vehicles.
