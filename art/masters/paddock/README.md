# PHASE Training Paddock — LOCKED master set

Six images, levels 0 to 5. **Frozen.** `CHECKSUMS.md5` verifies with `md5sum -c CHECKSUMS.md5`.
Canvas 1254 x 1254.

| Level | File | Content |
| --- | --- | --- |
| 0 | `paddock-L0.png` | Empty plot |
| 1 | `paddock-L1.png` | Small building, outdoor half pitch with one set of posts |
| 2 | `paddock-L2.png` | Bigger building, same half pitch, contact area |
| 3 | `paddock-L3.png` | Training moves indoors: hall with a glazed roof over a synthetic pitch |
| 4 | `paddock-L4.png` | Larger hall, solar array, wider ancillary wing |
| 5 | `paddock-L5.png` | Hall fills the site, interior zoned for pitch, strength, sprint lanes |

## `paddock-L0.png` is the reusable EMPTY PLOT

This facility is the only one that starts bare, so its level 0 is the canonical empty plot: mown
grass, hedge, 6 m perimeter path, four connector stubs with bollards, wider south stub with
threshold slab, four corner trees, nothing else. Built area measures 4.4% of the interior, which is
the site furniture alone. Reuse it as the starting plot for any later facility that begins empty,
rather than generating another.

## Measured growth and palette

| Level | Built | Detail density | Median grass RGB | Stub reach N / S / W / E (m) |
| --- | --- | --- | --- | --- |
| 0 | 4.4% | 0.066 | 80, 147, 37 | 83.5 / 83.5 / 83.5 / 83.5 |
| 1 | 24.3% | 0.120 | 74, 151, 42 | 83.5 / 43.9 / 83.5 / 83.5 |
| 2 | 29.7% | 0.148 | 75, 151, 41 | 83.5 / 43.3 / 83.5 / 83.5 |
| 3 | 49.9% | 0.178 | 73, 153, 36 | 28.9 / 43.7 / 34.9 / 31.9 |
| 4 | 51.9% | 0.226 | 70, 154, 34 | 30.5 / 39.3 / 30.1 / 26.8 |
| 5 | 61.7% | 0.280 | 63, 130, 71 | 24.9 / 30.1 / 19.2 / 19.1 |

All four stubs connect at every level. The tightest is 19.1 m at level 5, comfortably clear of the
apron ring.

## The level 5 palette fix — it works, partially

The previous two facilities both had a level 5 that broke the palette badly. The theory recorded
then was that aspirational wording ("world-class", "excessive", "the most expensive thing on the
campus") was driving a darker, more cinematic render that overrode the colour instruction. This
run's level 5 prompt carried **no superlatives at all** and described the level as a plain
extension of level 4.

Result, comparing each level 5 against its own set:

| Facility | L5 green channel | Set's green | Shortfall | Detail jump over L4 |
| --- | --- | --- | --- | --- |
| Gym | 97 | 145–150 | −34% | +103% |
| Recovery Centre | 95 | 149–152 | −37% | +39% |
| Training Paddock | 130 | 147–154 | **−12%** | **+24%** |

The break is much reduced but not gone. Level 5's grass still reads `63,130,71` against `70-80,
147-154, 34-42` across the other five: about 12% darker in green, and its blue channel is roughly
double, so it is also cooler and less saturated.

Conclusion for the remaining facilities: keep writing level 5 with no superlatives, and add an
explicit instruction that the BLUE channel of the grass must not rise, since that is what shifts.
Removing the aspirational wording is worth roughly two thirds of the fix.

## Known deviations, accepted

1. **Level 5 palette**, as above: grass `63,130,71` against the set's `~74,151,38`.
2. **Two soft steps in the growth curve.** Level 1 to 2 moves 24.3% to 29.7%, and level 3 to 4
   moves 49.9% to 51.9%. Neither stalls, but both are modest next to the 24.3, 49.9 and 61.7 jumps
   around them. Levels 2 and 4 are the weakest reads in the ladder.

## Site contract

Hedge, 6 m perimeter path, four mid-edge connector stubs, bollards, wider south stub with
threshold slab, four corner trees. Central mass growing outward behind a 6 m apron ring the stubs
run in to meet. Sun high to the north-west, every shadow down and to the right. No text, no people,
no vehicles.
