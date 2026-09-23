# PHASE Hospitality & Boxes — LOCKED master set

Six images, levels 0 to 5. **Frozen.** `CHECKSUMS.md5` verifies with `md5sum -c CHECKSUMS.md5`.
Canvas 1254 x 1254. No rugby pitch at any level, which is correct for this facility.

| Level | File | Content |
| --- | --- | --- |
| 0 | `hospitality-L0.png` | One small hospitality cabin on the axis, gravel path |
| 1 | `hospitality-L1.png` | White peaked marquee, mirrored service blocks, deck, planting |
| 2 | `hospitality-L2.png` | Permanent single-storey suite, glazed south front, terrace |
| 3 | `hospitality-L3.png` | Larger suite, covered terrace, formal mirrored gardens |
| 4 | `hospitality-L4.png` | Two storeys, single row of glazed box bays, arrival canopy |
| 5 | `hospitality-L5.png` | Double-tiered glass boxes, axial atrium, reflecting pool, gardens |

## Measured

| Level | Built | Detail density | Median grass RGB | Stub reach N / S / W / E (m) |
| --- | --- | --- | --- | --- |
| 0 | 8.6% | 0.065 | 73, 150, 27 | 72.9 / 83.5 / 83.5 / 75.6 |
| 1 | 28.4% | 0.100 | 75, 145, 34 | 83.5 / 83.5 / 83.5 / 83.5 |
| 2 | 31.5% | 0.129 | 77, 150, 37 | 48.8 / 83.5 / 83.5 / 83.5 |
| 3 | 41.3% | 0.150 | 67, 148, 35 | 41.1 / 83.5 / 83.5 / 83.5 |
| 4 | 51.9% | 0.198 | **37, 124, 8** | 18.9 / 47.2 / 74.3 / 74.1 |
| 5 | 69.2% | **0.376** | **9, 91, 33** | 16.0 / 37.5 / 83.5 / 83.5 |

Growth is monotonic, 8.6% to 69.2%. All four stubs connect at every level.

## Known deviation, accepted — the worst palette break in the project

**Two levels are off, not one.** Levels 0 to 3 hold the set palette cleanly at green 145-150.
Level 4 falls to green 124, a 16% shortfall with red down at 37. Level 5 falls to green 91, a 39%
shortfall with red at 9 — the darkest asset in the whole project. Level 5's detail density of 0.376
is also the highest of any of the sixty assets, roughly double its own level 4.

**This is the first facility where the drift began at level 4.** Every earlier facility held the
palette through level 4 and broke only at level 5. The likely cause is that the executive-box level
is elaborate enough on its own to trip the same "showpiece" response that normally waits for level
5. Anything to watch for on the club shop: its level 4 megastore is a comparable step up.

Correction prompts for both levels, if this is ever revisited, are in the conversation record and
follow the pattern in `analysis/README.md`: attach the last good level, give the three grass numbers,
change nothing about the layout. Level 4 must be corrected first, then level 5 against the corrected
level 4.

## The axis symmetry held, but it cannot be measured here

This facility's signature is strict mirror symmetry about the entrance axis running north from the
south stub. By eye it holds at every level, and level 5 is the most formally symmetrical image in
the project.

A mirror-difference test was tried and is **not usable**: mirroring each image about its centre line
gives 16.9, 21.7, 28.1, 27.4, 43.4 and 61.4 for levels 0 to 5, rising steadily. That is a confound,
not a finding. The locked lighting puts every shadow down and to the right, so any added building
makes a left-right mirror test worse no matter how symmetrical the plan is. Judge this facility's
symmetry by eye, or by mirroring only the un-shadowed ground plane.

## Site contract

Hedge, 6 m perimeter path, four mid-edge connector stubs, bollards, wider south stub with threshold
slab, four corner trees. Central mass growing outward behind a 6 m apron ring the stubs run in to
meet, arranged in mirror symmetry about the axis. Sun high to the north-west, every shadow down and
to the right. No text, no people, no vehicles.
