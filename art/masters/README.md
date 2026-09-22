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
| 6 | Kicking Enclosure | | Not started |
| 7 | Analysis & Briefing Suite | | Not started |
| 8 | Centre of Excellence | | Not started |
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

**Level 5 palette drift, and the fix that mostly works.** The gym's and the recovery centre's level
5 images rendered with grass roughly 35% darker in the green channel than their own levels 0 to 4,
despite an explicit numeric grass value in the prompt. The theory was that aspirational wording
("world-class", "excessive", "the most expensive thing on the campus") drives a darker, more
cinematic render that overrides the colour instruction. The training paddock's level 5 prompt was
written with no superlatives at all, as a plain extension of level 4, and the shortfall fell from
35% to 12%. So: write every remaining level 5 with no superlatives, and add an instruction that the
grass BLUE channel must not rise, which is where the residual drift shows.

| Facility | L5 green | Set's green | Shortfall |
| --- | --- | --- | --- |
| Gym | 97 | 145-150 | -34% |
| Recovery Centre | 95 | 149-152 | -37% |
| Training Paddock | 130 | 147-154 | -12% |

**The authoritative pitch reference is `playing-surface/playing-surface-L2.png`.** Every asset
containing a pitch is generated from it and measured against the coordinates in that folder's
README. Two stadium levels do not match it; `stadium/README.md` says which and by how much.

Canvas is 1254 x 1254 for every asset. The site contract — hedge, 6 m perimeter path, four
mid-edge connector stubs, four corner trees, sun to the north-west with shadows down and to the
right — is identical across every facility and every level.
