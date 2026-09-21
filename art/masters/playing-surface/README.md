# PHASE Playing Surface — LOCKED master set

Six images, levels 0 to 5. **Frozen.** Do not regenerate, retouch, rescale or re-crop these
files. Everything else in the facility art system is measured against them.

`playing-surface-L2.png` is the **MASTER PITCH**. Attach it to every future generation that
contains a pitch, and to the Level 0 step of the eight empty-plot facilities for the site
furniture. Verify any new asset against it before accepting.

`CHECKSUMS.md5` holds the MD5 of each file as locked. Re-run `md5sum -c CHECKSUMS.md5` to
confirm nothing has been swapped or re-encoded.

| Level | File | Surface |
| --- | --- | --- |
| 0 | `playing-surface-L0.png` | Waterlogged bog: standing water, churned mud, thistles. Lines degraded but complete |
| 1 | `playing-surface-L1.png` | Reclaimed. Patchy turf, soft mow stripes, freshly re-marked lines |
| 2 | `playing-surface-L2.png` | Polished. Even turf, crisp stripes, roofed store. **MASTER PITCH** |
| 3 | `playing-surface-L3.png` | Irrigation. Sprinkler grid, four active sprays, plant building |
| 4 | `playing-surface-L4.png` | Heating. Three red grow-light rigs on the pitch |
| 5 | `playing-surface-L5.png` | Finished. Four rigs off-pitch, sprinklers running, covers, solar |

## Locked geometry

Canvas 1254 x 1254 px. Pitch outer width 900.5 px, nominal 120 m, so **7.50 px per metre**.

These are the consensus pixel coordinates across the set. Any new pitch asset must land on
them. Measured drift between the six levels is at most 1.5 px, about 0.2 m.

| Marking | x (px) | | Marking | y (px) |
| --- | --- | --- | --- | --- |
| Dead-ball, left | 176.5 | | North touchline | 309.0 |
| Goal line, left | 240.0 | | South touchline | 876.5 |
| 22 m, left | 420.0 | | | |
| 10 m, left | 546.5 | | | |
| Halfway | 627.0 | | | |
| 10 m, right | 707.0 | | | |
| 22 m, right | 833.5 | | | |
| Goal line, right | 1013.5 | | | |
| Dead-ball, right | 1077.0 | | | |

## Accepted deviations from regulation

Measured, then knowingly accepted as the PHASE house style. The set is internally consistent,
which is what matters for sixty assets. Do not "correct" these — a corrected pitch would no
longer agree with the locked masters.

| Element | Regulation | Locked |
| --- | --- | --- |
| Overall ratio | 1.714:1 | 1.590:1 |
| Field of play | 100 x 70 m | 100 x 73 m |
| In-goal depth | 10 m | 8.1 m |
| 22 m lines | 22 m from goal line | 23.3 m |
| Lengthwise dashed lines | 5 m and 15 m from touchline | 7.8 m and 17.9 m |
| Goalpost spacing | 5.6 m | ~10.7 m |

There is also a full-width dashed line about 10 m in from each goal line that is not a
regulation marking. It is part of the master.

## Known defect, accepted

The west connector stub is **blocked** in levels 2, 3, 4 and 5: the maintenance and plant
buildings sit on the middle of the west margin, across the stub route. Verified by scanning
the pixel rows through the stub axis in each file.

| Level | West stub |
| --- | --- |
| 0 | Clear |
| 1 | Clear |
| 2 | Blocked |
| 3 | Blocked |
| 4 | Blocked |
| 5 | Blocked |

Consequences to design around:

- The Playing Surface plot joins the campus on three edges, not four, at levels 2 and above.
- L2 is the master pitch, so anything generated from it will copy a building onto the west
  stub unless the prompt says otherwise. Every downstream prompt should carry an explicit
  instruction to keep all four stubs clear and to place west-side buildings in the south-west
  quadrant rather than on the margin centre.

The other three stubs are clear in all six files.

## Site contract

Identical in all six and in every other facility: clipped hedge to the full perimeter, a 6 m
pale paving path inside it, a 6 m paving connector stub at the exact midpoint of each of the
four edges running flush to the canvas edge, two stone bollards flanking each stub, the south
stub 1 m wider with a stone threshold slab, one mature tree at each corner. Sun high to the
north-west, every shadow falling down and to the right. No text, no people, no vehicles.
