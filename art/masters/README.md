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
| 5 | Training Paddock | | Not started |
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

**No facility needs a master empty plot any more.** Every facility now starts with one small
building rather than bare ground, so the standalone empty plot that gym level 0 was going to
provide is no longer a dependency.

**Level 5 breaks the palette, twice running.** The gym's and the recovery centre's level 5 images
both render with grass roughly 60% darker than their own levels 0 to 4, despite an explicit numeric
grass value in the prompt. The working theory is that aspirational wording ("world-class",
"excessive", "the most expensive thing on the campus") triggers a darker, more cinematic render that
overrides the colour instruction. Write level 5 as a plain extension of level 4, with no
superlatives.

**The authoritative pitch reference is `playing-surface/playing-surface-L2.png`.** Every asset
containing a pitch is generated from it and measured against the coordinates in that folder's
README. Two stadium levels do not match it; `stadium/README.md` says which and by how much.

Canvas is 1254 x 1254 for every asset. The site contract — hedge, 6 m perimeter path, four
mid-edge connector stubs, four corner trees, sun to the north-west with shadows down and to the
right — is identical across every facility and every level.
