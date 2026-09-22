# PHASE facility art — locked masters

One folder per facility. Each holds its six level images, a `README.md` recording the measured
geometry and any accepted deviations, a `locked.json` of the same in machine-readable form, and
`CHECKSUMS.md5`.

A locked set is frozen. Do not regenerate, retouch, rescale or re-crop its files.

| # | Facility | Folder | Status |
| --- | --- | --- | --- |
| 1 | Playing Surface | `playing-surface/` | Locked |
| 2 | Stadium | `stadium/` | Locked |
| 3 | Strength & Conditioning Gym | `gym/` | Locked |
| 4 | Recovery Centre | `recovery/` | Locked |
| 5 | Training Paddock | `paddock/` | Locked |
| 6 | Kicking Enclosure | `kicking/` | Locked |
| 7 | Analysis & Briefing Suite | `analysis/` | Locked |
| 8 | Centre of Excellence | `academy/` | Locked |
| 9 | Hospitality & Boxes | | Not started |
| 10 | Club Shop & Megastore | | Not started |

**The campus site plan — use the recovery centre's, not the gym's.** The gym split the plot into
four quadrants around a cross of routes; it kept the stubs clear but divided the square. The
recovery centre replaced it with one central mass that grows outward until it fills the plot, ringed
by a 6 m apron that the four stubs run straight in to meet. That fills the square AND keeps all four
stubs connected, which the quadrant plan could not do at once. `recovery/README.md` has the wording.

**The empty plot is `paddock/paddock-L0.png`.** The training paddock is the only facility that
starts bare, so its level 0 is the canonical empty plot. Reuse it for any later facility that begins
empty rather than generating another.

**The level 5 palette pins repair a render; they do not prevent one.** The centre of excellence
carried all three pins in its first-pass prompt and its level 5 still came back at `41,113,51`,
green 23% short and blue above the cap. The same three pins had produced a clean `74,151,39` on the
analysis suite — but there they were a CORRECTION pass on an already-generated image, with the
accepted level 4 attached to sample from. The generator weights a reference image far above a number
it reads. **Plan for it: generate level 5 normally, expect it dark, then run the correction pass
from `analysis/README.md`. Budget one extra generation per facility.**

**Name a facility's signature feature in the DO NOT ADD list of every earlier level.** The analysis
suite's circular auditorium was specified for level 5 and arrived at level 3, leaving levels 3 and 4
near-identical. The centre of excellence forbade its accommodation rooflight rhythm explicitly in
steps 3 and 4, and it landed exactly at level 4. This is the reliable control on progression pacing.

**The level 5 palette recipe — three pins, all required in a correction pass.** Every facility's level 5 rendered darker
or colder than its own levels 0 to 4 until all three of these were in the prompt together. Each pin
fixes a different failure, so a partial recipe still fails.

1. No superlatives. Write level 5 as a plain extension of level 4, never "world-class", "excessive"
   or "the most expensive thing on the campus".
2. The grass BLUE channel must stay at or below 45. This stops the green going cold and grey.
3. The grass GREEN channel must be at least 140 and close to 147. This stops it going dark, which
   is a separate failure that pins 1 and 2 do not touch.

| Facility | Superlatives dropped | Blue capped | Green floored | L5 green vs its set |
| --- | --- | --- | --- | --- |
| Gym | no | no | no | -34% |
| Recovery Centre | no | no | no | -37% |
| Training Paddock | yes | no | no | -12% |
| Kicking Enclosure | yes | yes | no | -6%, unverifiable |
| Analysis, first try | yes | yes | no | -17% |
| Analysis, regenerated | yes | yes | yes | +4% |

`analysis/README.md` has the correction prompt that fixed it without touching the layout.

**The authoritative pitch reference is `playing-surface/playing-surface-L2.png`.** Every asset
containing a pitch is generated from it and measured against the coordinates in that folder's
README. Two stadium levels do not match it; `stadium/README.md` says which and by how much.

Canvas is 1254 x 1254 for every asset. The site contract — hedge, 6 m perimeter path, four
mid-edge connector stubs, four corner trees, sun to the north-west with shadows down and to the
right — is identical across every facility and every level.
