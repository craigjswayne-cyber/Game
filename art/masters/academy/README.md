# PHASE Centre of Excellence — LOCKED master set

Six images, levels 0 to 5. **Frozen.** `CHECKSUMS.md5` verifies with `md5sum -c CHECKSUMS.md5`.
Canvas 1254 x 1254. No rugby pitch at any level, which is correct for this facility.

| Level | File | Content |
| --- | --- | --- |
| 0 | `academy-L0.png` | One small classroom building, centred, gravel path |
| 1 | `academy-L1.png` | Teaching block, apron ring laid in, paved forecourt |
| 2 | `academy-L2.png` | Second block facing it across a paved courtyard |
| 3 | `academy-L3.png` | Third block closes the west: a U around a planted quad |
| 4 | `academy-L4.png` | Quadrangle closes; accommodation wing with its rooflight rhythm |
| 5 | `academy-L5.png` | Outer ring of wings fills the site around the quad |

## Measured

| Level | Built | Detail density | Median grass RGB | Stub reach N / S / W / E (m) |
| --- | --- | --- | --- | --- |
| 0 | 8.0% | 0.077 | 70, 150, 27 | 72.7 / 82.7 / 81.5 / 81.5 |
| 1 | 23.7% | 0.104 | 75, 151, 31 | 65.9 / 74.9 / 83.5 / 56.0 |
| 2 | 32.0% | 0.128 | 75, 151, 30 | 43.6 / 53.5 / 83.5 / 83.5 |
| 3 | 36.2% | 0.129 | 75, 147, 35 | 38.3 / 49.9 / 42.7 / 83.5 |
| 4 | 47.4% | 0.163 | 72, 146, 31 | 31.9 / 38.3 / 37.7 / 35.6 |
| 5 | 73.4% | 0.240 | **41, 113, 51** | 18.5 / 18.4 / 21.9 / 19.2 |

Built area runs 8.0% to 73.4%, the strongest growth curve in the project, with a 26-point final
step. All four stubs connect at every level, the tightest with 18.4 m to spare.

## What worked: the signature landed on schedule

This facility's marker is the accommodation wing's regular repeating rhythm of many small identical
rooflights, one per bedroom, and it was specified for level 4. **It appears at level 4 and not
before.** Level 3 is a clean U of three blocks with long rooflights and no repeated squares.

That was not luck. The analysis suite's signature, a circular auditorium specified for level 5,
turned up at level 3 and flattened the whole middle of that ladder. In response, steps 3 and 4 of
this run carried an explicit "DO NOT ADD: accommodation, a repeating rhythm of small rooflights"
line. Naming the signature feature in the earlier levels' forbidden list is what held it back.
**Do this for every facility with a distinguishing feature.**

## What did not work: the level 5 palette pins, used as prevention

This prompt carried all three pins from the start — no superlatives, blue capped at 45, green
floored at 140. Level 5 still came back at `41,113,51`: green 113 against the set's ~148, a 23%
shortfall, and blue 51, above the cap. **Both numeric pins failed.**

This corrects a conclusion recorded after the analysis suite. There, the same three pins produced a
clean level 5 at `74,151,39`. The difference is how they were used:

- On the analysis suite they were a **correction pass** on an already-generated image: "regenerate
  this, change only the rendering, here are the numbers", with the accepted level 4 attached.
- Here they were **prevention**, written into the first-pass prompt.

The generator appears to weight a reference image it can sample far above a number it reads. The
pins repair a bad render; they do not prevent one.

**Practical consequence for the remaining facilities:** generate level 5 normally, expect it dark,
then run the correction pass. Budget one extra generation per facility rather than trying to
prevent the problem in the first prompt.

## Known deviations, accepted

1. **Level 5 grass** reads `41,113,51` against the set's ~`73,148,31`. Green 23% short, blue 20
   above the cap. Detail density is 47% above level 4.
2. **Level 2 to level 3 is soft**, gaining 4.2 points of built area against 8.3, 11.2 and 26.0 for
   the other steps. The third block closing the U is a smaller move than the ones around it.

## Site contract

Hedge, 6 m perimeter path, four mid-edge connector stubs, bollards, wider south stub with threshold
slab, four corner trees. Central mass growing outward behind a 6 m apron ring the stubs run in to
meet. Sun high to the north-west, every shadow down and to the right. No text, no people, no
vehicles.
