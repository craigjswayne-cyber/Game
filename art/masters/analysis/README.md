# PHASE Analysis & Briefing Suite — LOCKED master set

Six images, levels 0 to 5. **Frozen.** `CHECKSUMS.md5` verifies with `md5sum -c CHECKSUMS.md5`.
Canvas 1254 x 1254. No rugby pitch at any level, which is correct for this facility.

`analysis-L5.png` is the **regenerated** level 5. The first attempt was rejected on grass colour
and replaced; see below.

| Level | File | Content |
| --- | --- | --- |
| 0 | `analysis-L0.png` | One small office cabin, centred, one camera mast, gravel path |
| 1 | `analysis-L1.png` | Bigger office, apron ring laid in, two masts, paved forecourt |
| 2 | `analysis-L2.png` | Server and plant block with a four-dish array, three masts |
| 3 | `analysis-L3.png` | Circular ring building around a central rooflit court |
| 4 | `analysis-L4.png` | Larger ring building with solar array, eight-dish server block |
| 5 | `analysis-L5.png` | Separate circular auditorium, long office block, twelve-dish server block |

## Measured

| Level | Built | Detail density | Median grass RGB | Stub reach N / S / W / E (m) |
| --- | --- | --- | --- | --- |
| 0 | 7.9% | 0.069 | 68, 150, 33 | 72.4 / 82.0 / 82.7 / 71.5 |
| 1 | 23.3% | 0.098 | 64, 152, 32 | 65.6 / 74.9 / 59.5 / 56.4 |
| 2 | 28.5% | 0.119 | 78, 133, 39 | 44.3 / 71.7 / 47.2 / 44.8 |
| 3 | 33.8% | 0.136 | 74, 145, 29 | 35.3 / 52.4 / 48.3 / 45.5 |
| 4 | 41.3% | 0.157 | 72, 143, 27 | 28.1 / 46.9 / 42.0 / 37.5 |
| 5 | 56.7% | 0.190 | 74, 151, 39 | 83.5 / 36.3 / 55.3 / 83.5 |

All four stubs connect at every level.

## The level 5 palette recipe — completed here

This is the facility where the level 5 colour problem was finally solved, and it took THREE pins,
not one. Each earlier run had only part of the recipe:

| Facility | Superlatives dropped | Blue capped | Green floored | L5 green vs its set |
| --- | --- | --- | --- | --- |
| Gym | no | no | no | -34% |
| Recovery Centre | no | no | no | -37% |
| Training Paddock | yes | no | no | -12% |
| Kicking Enclosure | yes | yes | no | -6%, unverifiable |
| Analysis, first try | yes | yes | no | **-17%** |
| Analysis, regenerated | yes | yes | **yes** | **+4%** |

The first level 5 attempt here measured `49,121,42`. Note the blue channel was 42, inside the 45
cap, so that pin worked — the grass was not cold. It was simply **dark**, which is a separate
failure that dropping superlatives and capping blue do not address.

The correction prompt changed nothing about the layout and added a numeric floor on the green
channel: "the grass GREEN channel must be at least 140, and close to 147". The regenerated image
measures `74,151,39` — green inside the set's own 133-152 range, red on the set's band, blue under
the cap. Detail density also fell from 0.226 to 0.190.

**Use all three pins in every remaining level 5 prompt:**
1. No superlatives. Describe level 5 as a plain extension of level 4.
2. The grass BLUE channel must stay at or below 45.
3. The grass GREEN channel must be at least 140 and close to 147.

Side effect worth knowing: built area fell from 62.8% to 56.7% in the regeneration, because
stripping surplus planting also strips built surface. Still a clear step up from level 4's 41.3%.

## Known deviations, accepted

**1. The circular auditorium arrived two levels early.** It was specified as the level 5 signature,
the one round building in the whole campus. Instead the entire building became a ring at level 3
and stayed a ring at level 4, so those two levels read as the same donut slightly enlarged. Level 5
is the one that matches the brief: a separate circular auditorium, a rectangular office block and a
twelve-dish server block.

**2. Two soft steps follow from that.** Level 2 to 3 gains 5.3 points of built area and level 3 to 4
gains 7.5, against 15.4 and 15.4 for the steps either side.

**3. Level 4's two-storey change does not read.** With the ring form arriving early, the specified
contrast between a two-storey office block and a single-storey briefing hall never materialised.

## Site contract

Hedge, 6 m perimeter path, four mid-edge connector stubs, bollards, wider south stub with threshold
slab, four corner trees. Central mass growing outward behind a 6 m apron ring the stubs run in to
meet. Sun high to the north-west, every shadow down and to the right. No text, no people, no
vehicles.
