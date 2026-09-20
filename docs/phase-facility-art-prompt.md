# PHASE: RUGBY MANAGER — FACILITY ART GENERATION PROMPT (for ChatGPT / image generation)

How to use this document:

1. Paste **PART A (MASTER LOCK)** into a new ChatGPT conversation on its own. Wait for it to confirm.
2. Then paste **one line at a time** from **PART C (ASSET QUEUE)**.
3. Re-paste PART A after every 4–5 images. Image models drift; the lock has to be refreshed.
4. When generating Level N, attach your **accepted Level N-1 image** and say: "same plot, same camera, same lighting, same boundary, this is the next upgrade level."
5. Reject and regenerate against **PART E (QC GATE)**. Do not accept a near-miss — one accepted near-miss becomes the reference for everything after it.

---

## PART A — MASTER LOCK

> You are the art director for PHASE: Rugby Manager, a premium mobile rugby-management game.
> We are producing a single coherent set of 60 facility assets: 10 facility types x 6 upgrade levels.
> These rules are LOCKED. Do not reinterpret them, simplify them, or vary them for visual interest.
> Consistency is the art direction. Confirm you have understood before generating anything.

### A1. CAMERA — LOCKED, NEVER CHANGES

- TRUE ORTHOGRAPHIC TOP-DOWN. The camera is exactly 90 degrees above the ground, pointing straight down.
- This is an architectural site plan view, like a satellite image or a scale model shot from directly overhead.
- ZERO perspective. No vanishing points. No converging lines. No foreshortening.
- NOT isometric. NOT three-quarter. NOT tilted. NOT rotated. NOT angled.
- Every major horizontal edge stays horizontal. Every major vertical edge stays vertical.
- Buildings do not lean, taper, or show their walls. You see roofs, ground and shadows only.
- Depth comes from shadow, material, texture and landscaping — never from perspective.
- The camera is identical for all 10 facilities and all 6 levels. It never moves, zooms or rotates.

### A2. CANVAS AND PLOT — LOCKED

- Canvas: square, 1:1, rendered at 2048 x 2048.
- Every asset shows the SAME plot: a square site measuring 160 metres x 160 metres.
- The plot fills the canvas edge to edge. Scale is therefore 12.8 pixels per metre, identical in every image.
- The site boundary is a clipped dark-green hedge, 1.5m thick, running the full perimeter.
- Inside the hedge, a 6m wide pale paving perimeter path runs around all four sides.
- A Level 0 and a Level 5 asset must look like the same physical plot photographed from the same fixed position.
- Never zoom in for detail. Never zoom out for large buildings. The plot always fills the frame identically.

### A3. EDGE CONNECTION CONTRACT — LOCKED (this is what lets tiles join)

Every single asset must carry identical edge geometry so any facility can sit next to any other facility on the campus grid:

- At the EXACT MIDPOINT of all four edges (north, south, east, west), the hedge is broken by a 6m gap.
- Through each gap runs a 6m wide pale paving connector stub, flush to the canvas edge.
- Each stub is flanked by two low stone bollards.
- At each of the four corners of the plot, a single mature tree with a soft shadow.
- The perimeter path, the four stubs, the hedge and the corner trees are IDENTICAL in every one of the 60 assets, including empty Level 0 plots.
- The PRIMARY ENTRANCE is always the SOUTH (bottom) stub. It is 1m wider and has a pale stone threshold slab.
- Nothing ever crosses or blocks a stub.

This is the connection system. Facilities join through the stubs, so plots can be chained into roads, avenues, courtyards and campus blocks in any arrangement.

### A4. LIGHTING — LOCKED

- One sun, positioned to the NORTH-WEST (upper-left of frame), high, roughly 60 degrees elevation.
- Every shadow falls down and to the RIGHT (south-east). Same direction, every asset, every level.
- Shadows are soft-edged, cool-toned, roughly 18% opacity.
- Shadow length is proportional to real building height, which is how the player reads storeys from above.
- Clear bright overcast-to-sunny daylight. No night. No floodlights lit. No dusk. No weather.
- Never change lighting to make a facility look more dramatic.

### A5. LOCKED COLOUR PALETTE

Use only these values. Do not introduce new hues.

| Element | Hex |
|---|---|
| Pitch turf base | `#4E9E46` |
| Pitch mow stripe (light) | `#5BC551` |
| Pitch line markings | `#FFFFFF` |
| Rough grass / verge | `#6AA85C` |
| Hedge | `#2F5D34` |
| Tree canopy | `#3C7A42` |
| Paving / paths | `#D8D3C8` |
| Service tarmac / road | `#5A5E63` |
| Road markings | `#E8E4DA` |
| Building render / walls | `#EDEAE3` |
| Timber cladding | `#B08A5E` |
| Standing-seam metal roof | `#9AA1A8` |
| Dark slate roof | `#3E4449` |
| Glass / rooflight | `#7FA8BE` |
| Deep navy accent | `#1F3A5F` |
| Solar panel | `#2B3440` |
| Running track surface | `#B2543F` |
| Sand / infill | `#D9C9A3` |
| Pool water | `#4E8FA8` |
| Shadow | black @ 18% |

### A6. VISUAL LANGUAGE

- Premium, architectural, sporting, modern, restrained, tactile, intelligent, believable.
- Take the DISCIPLINE of premium games such as Monument Valley — strong composition, deliberate geometry, restrained colour, controlled detail, clean silhouettes. Do NOT copy its style or palette.
- Clean flat-shaded forms with subtle material texture. Crisp edges. Deliberate negative space.
- NOT photoreal. NOT cartoon. NOT fantasy. NOT a property brochure. NOT a SaaS dashboard. NOT generic AI architecture.
- No clutter. No random decoration. No objects without a function.

### A7. MASTER RUGBY PITCH — LOCKED GEOMETRY AND MARKINGS

Wherever a pitch appears it is IDENTICAL, in every asset, at every level. Real-life regulation rugby union markings, drawn accurately.

Dimensions:
- Field of play: 100m long x 70m wide.
- In-goal area: 10m deep at each end.
- Total pitch: 120m long x 70m wide. Ratio 1.714:1. A true rectangle. Never square, never stretched.
- The pitch is LANDSCAPE, centred in the 160m plot: 20m of margin left and right, 45m top and bottom.

Lines — all white, 100mm wide, painted on grass:
- Two touchlines (the long sides) — solid, full length.
- Two dead-ball lines (the short ends) — solid, full width.
- Two goal lines — solid, full width, 10m in from each dead-ball line.
- Two 22-metre lines — solid, full width, 22m in from each goal line.
- Halfway line — solid, full width, at the exact centre.
- Two 10-metre lines — DASHED, full width, 10m either side of the halfway line.
- Two 5-metre lines — DASHED, running the LENGTH of the pitch, 5m in from each touchline.
- Two 15-metre lines — DASHED, running the LENGTH of the pitch, 15m in from each touchline.
- Short perpendicular dash marks where the 5m and 15m lines meet the 22m lines, the 10m lines and the halfway line.
- Short 5m dash marks parallel to and 5m in front of each goal line.

Goalposts — REQUIRED AT BOTH ENDS, never one end only:
- A pair of white uprights standing ON each goal line, centred on the width of the pitch.
- Uprights 5.6m apart, with a crossbar 3m above the ground joining them.
- Seen from directly overhead they read as two white post footings on the goal line, the crossbar as a short white bar between them, and a soft shadow cast down-right onto the in-goal grass.
- Both ends are identical and mirrored about the halfway line.

Mowing:
- Alternating mown stripes running ACROSS the pitch (parallel to the try lines), 5m wide, alternating `#4E9E46` and `#5BC551`. Very low contrast.

The pitch NEVER changes between facilities or between levels. Do not redesign it, restyle it, add markings, remove markings, move markings, change its proportions, or change its orientation.

### A8. LEVEL 0 RULE — LOCKED

- STADIUM Level 0: the master pitch, goalposts at both ends, and NOTHING else. No stands, no seating, no buildings.
- PLAYING SURFACE Level 0: the master pitch on a basic maintained grass surface. No buildings.
- ALL EIGHT OTHER FACILITIES at Level 0: a COMPLETELY EMPTY PLOT. Mown rough grass, the perimeter hedge, the perimeter path, the four connector stubs, the four corner trees. Nothing else. No buildings, no sheds, no shacks, no equipment, no foundations, no markings.
- Never invent a building at Level 0 where an empty plot is specified.

### A9. PROGRESSION RULE

- The plot never changes. The facility GROWS inside it.
- Each level must visibly evolve from the one before: the previous level's structures should still be recognisable, extended or absorbed, not demolished and replaced by something unrelated.
- Progression is expressed through footprint, building size, storeys (read via shadow length), equipment, materials, landscaping quality, technology and architectural sophistication.

### A10. NO TEXT

The artwork contains NO text of any kind: no labels, no facility names, no level numbers, no signage lettering, no numbers, no UI, no statistics, no logos, no team branding, no sponsor boards, no watermarks. UI is added separately by the game.

### A11. NO PEOPLE, NO VEHICLES

No players, no crowds, no figures, no cars, no vans, no random props. Service yards and parking bays may be drawn as empty marked ground.

---

## PART B — PER-ASSET REQUEST TEMPLATE

> Generate PHASE facility asset: **[FACILITY NAME] — LEVEL [N]**.
> Apply the MASTER LOCK exactly: true orthographic 90-degree top-down, zero perspective, 2048x2048 square, the same 160m x 160m plot, the same perimeter hedge, the same 6m perimeter path, the same four mid-edge 6m connector stubs, the same four corner trees, sun from the north-west with all shadows falling down-right, the locked palette, no text, no people, no vehicles.
> Content for this level: **[LEVEL DESCRIPTION FROM PART C]**
> This must read as the same plot as Level [N-1], developed further.

---

## PART C — ASSET QUEUE (60 assets)

### 01 — PLAYING SURFACE
- **L0** — The master pitch on a basic maintained grass surface. Plain mown grass margins. Goalposts at both ends. No buildings, no equipment.
- **L1** — Same pitch, visibly better turf: even colour, crisp mow stripes, a small gravel maintenance hardstanding tucked against the west margin.
- **L2** — Improved turf with drainage and irrigation: a discreet grid of pop-up sprinkler heads in the margins, a narrow drainage channel along both touchline margins, a small maintenance store to the west.
- **L3** — Elite surface: full irrigation ring main visible as a faint paved service strip, a covered maintenance compound to the west, precision mow stripes, edge-of-pitch sand banding.
- **L4** — Premium surface: advanced drainage grid, irrigation plant building to the west, rolled pitch-protection covers stored in neat cylinders along the north margin, paved perimeter service track around the whole pitch.
- **L5** — World-class surface: hybrid turf with a perfect uniform finish, full paved service track, irrigation and drainage plant building, ground-source undersoil heating manifolds shown as a discreet paved plant bay, stacked pitch-protection decking on the north and south margins.

### 02 — STADIUM
- **L0** — The master pitch only, goalposts at both ends. NO stands, no seating, no buildings, no perimeter structures.
- **L1** — Basic spectator infrastructure: a single low open terrace along the north touchline, a simple rail perimeter fence around the pitch, a small turnstile block at the south entrance.
- **L2** — Small stadium: covered stands along both touchlines with pale standing-seam metal roofs, a modest concourse at the south end.
- **L3** — Community stadium: substantial roofed stands on both touchlines and a smaller stand behind the east in-goal, concourse ring, floodlight pylons at the four pitch corners (unlit), service yard to the west.
- **L4** — Established professional stadium: continuous roofed seating on all four sides with a small break at the west, a two-storey main stand on the north side with a deeper roof and longer shadow, players' tunnel, media compound, coach parking bays.
- **L5** — Premium professional stadium: a fully enclosed continuous bowl, deep cantilevered standing-seam roof ringing the pitch, a glazed executive tier along the north stand, four integrated corner floodlight masts, landscaped south plaza, full service road ring. The pitch remains the exact master pitch, unchanged.

### 03 — STRENGTH & CONDITIONING GYM
- **L0** — EMPTY PLOT.
- **L1** — Basic outdoor training area: a rectangular rubber-matted platform with a simple steel lifting rig, a short sled track, an open steel storage container to the west. No enclosed building.
- **L2** — Small professional gym: a single-storey rendered box with a standing-seam roof and two long rooflights, the outdoor platform retained to its south, paved approach from the south entrance.
- **L3** — Expanded performance centre: the L2 box extended eastwards into an L-shaped plan, a 40m outdoor sprint track in `#B2543F` along the south edge, small plant enclosure to the west.
- **L4** — Elite performance hub: a large two-storey rectangular building with a deep roof, an array of dark `#2B3440` SOLAR PANELS covering the southern half of the roof in a neat grid, glazed rooflights to the north, covered sled lane, sprint track retained.
- **L5** — World-class facility: a full-width two-storey building with a sculpted roof plane, an extensive solar array across the whole southern roof, a green roof section to the north, an indoor sprint hall read as a long clerestory-lit wing, covered outdoor platform, landscaped courtyard between the wings.

### 04 — RECOVERY CENTRE
- **L0** — EMPTY PLOT.
- **L1** — Small basic recovery facility: a single-storey timber-clad cabin with a shallow metal roof, a small paved apron, one cold plunge tub outside under a simple canopy.
- **L2** — Dedicated recovery centre: a rendered single-storey building roughly twice the L1 footprint, two outdoor plunge pools in `#4E8FA8`, a decked terrace, the original timber cabin retained as a wing.
- **L3** — Advanced centre: L-shaped building with a glazed treatment wing, one rectangular hydrotherapy pool under a glazed roof, two contrast pools outside, plant enclosure to the west.
- **L4** — Elite centre: a large building enclosing a 25m indoor hydrotherapy pool shown through a full-length glazed roof, an outdoor contrast-therapy courtyard with three pools, treatment wing to the east, discreet plant yard.
- **L5** — World-class centre: a two-storey complex, a glazed 25m hydrotherapy hall, a cryotherapy and altitude wing, an outdoor recovery garden with pools, decking and planting, a green roof over the treatment wing, solar array over the plant wing.

### 05 — TRAINING PADDOCK
- **L0** — EMPTY PLOT.
- **L1** — Basic training paddock: a plain grass training rectangle, a simple timber equipment store to the west, a scrum sled and a handful of tackle bags laid out neatly.
- **L2** — Developing environment: a properly mown and lined grass training area, a small changing cabin, a scrum machine on a hardstanding, marked grid cones, a rubber-matted contact zone.
- **L3** — Established paddock: a full-size grass training rectangle with mow stripes, a rendered single-storey pavilion to the south, contact zone with sleds and a ruck machine, a short covered store.
- **L4** — High-performance paddock: a full-size grass area plus a separate synthetic training strip in `#D9C9A3` infill along the east side, a two-storey pavilion with a deep roof, covered contact area, mobile camera gantry rails along the north edge.
- **L5** — World-class environment: multiple specialist zones — a full-size grass rectangle, a synthetic all-weather strip, a dedicated scrum and contact zone with permanent machines, a speed and agility lane in `#B2543F`, a two-storey pavilion with solar roof, camera gantries, and landscaped buffer planting between zones.

### 06 — KICKING ENCLOSURE
- **L0** — EMPTY PLOT.
- **L1** — Basic kicking area: a plain grass strip with ONE set of regulation goalposts, a simple ball bin, a low ball-stop net on the north boundary.
- **L2** — Developing enclosure: mown and lined kicking grass, TWO sets of goalposts at opposite ends of the strip, tall ball-stop netting on the north and east boundaries, a small timber store.
- **L3** — Established facility: multiple marked kicking stations radiating from a central tee area, two sets of posts, full-height perimeter ball-stop netting, a rendered single-storey store and a paved approach.
- **L4** — Premium kicking centre: a covered all-weather kicking bay with a standing-seam roof along the west side, two sets of posts, a synthetic kicking surface in `#D9C9A3`, marked distance arcs mown into the grass, full ball-stop netting, ball-return channels.
- **L5** — World-class specialist facility: an indoor kicking hall read as a long clerestory-lit building on the west, an outdoor synthetic kicking zone with two sets of posts, mown distance arcs, tracking-camera masts, full enclosure netting, solar roof on the hall, landscaped approach.

### 07 — ANALYSIS & BRIEFING SUITE
- **L0** — EMPTY PLOT.
- **L1** — Basic analysis office: a small single-storey rendered cabin with one rooflight, a paved path from the south entrance, a slim mast with a camera head beside it.
- **L2** — Dedicated suite: a rectangular single-storey building with a run of three rooflights and a small glazed entrance canopy, paved forecourt, two camera masts.
- **L3** — Performance analysis centre: an L-shaped single-storey building with a glazed briefing wing (visible as a large rooflight plane), a paved courtyard, a small server plant enclosure to the west.
- **L4** — Advanced centre: a two-storey building with a deep roof and a full-length north rooflight, a separate plant and server block with louvred roof, a landscaped courtyard, three camera masts, a discreet satellite dish array on the plant roof.
- **L5** — Elite analysis and briefing centre: a two-storey complex around a planted courtyard, a large auditorium-style briefing wing read as a curved-roof volume with a circular rooflight, a glazed link bridge, a server block with solar roof, camera masts and a neat paved arrival plaza.

### 08 — CENTRE OF EXCELLENCE
- **L0** — EMPTY PLOT.
- **L1** — Basic academy facility: a single-storey rendered teaching cabin, a small grass training square, a paved path, a bicycle shelter.
- **L2** — Developing academy centre: two single-storey buildings — teaching and changing — around a small paved courtyard, a marked grass training area to the north.
- **L3** — Established academy campus: three connected two-storey blocks in a U-shape around a landscaped courtyard, a full grass training area to the north, a paved arrival forecourt to the south.
- **L4** — Elite centre of excellence: a four-block campus — education, accommodation, sports science and changing — arranged around a planted quadrangle, a grass training area, a small gym wing, solar arrays on two roofs, mature tree planting.
- **L5** — World-class development campus: a large indoor training hall with a full-length barrel roof on the north, a two-storey accommodation wing with a repeating rooflight rhythm, education and sports-science blocks, an analysis wing, a landscaped central quadrangle with paths and specimen trees, solar arrays, a covered walkway linking every block, and a formal paved arrival plaza at the south entrance.

### 09 — HOSPITALITY & BOXES
- **L0** — EMPTY PLOT.
- **L1** — Small premium marquee-style structure: a crisp white peaked marquee centred on the plot, a CENTRAL PAVED ENTRANCE PATH running due north from the south entrance stub to the marquee door, modest outdoor seating on a small timber deck, elegant clipped planting either side of the path.
- **L2** — Permanent hospitality suite: a single-storey rendered building with a glazed south elevation and a deep roof overhang, the central entrance path retained and widened, a paved terrace with planters.
- **L3** — Premium hospitality facility: a larger single-storey building with a glazed frontage and a generous covered terrace, formal landscaped gardens flanking the central path, a small service yard to the west.
- **L4** — Executive boxes: a two-storey linear building with a run of individual glazed box bays along the south elevation, a deep cantilevered roof, a terrace at ground level, formal gardens, a service yard and covered arrival canopy.
- **L5** — World-class DOUBLE-TIERED luxury glass box complex: a two-tier structure with an upper tier of glazed boxes set back from a lower tier, deep cantilevered roof planes reading as two stacked bands with distinct shadows, a full-width terrace, a glazed atrium at the centre of the south elevation on the central axis, formal landscaped gardens, reflecting pool, and a paved arrival plaza.

### 10 — CLUB SHOP & MEGASTORE
- **L0** — EMPTY PLOT.
- **L1** — Small basic club shop: a compact single-storey rendered unit with a simple pitched roof and a small glazed shopfront facing south, a short paved path from the south entrance, two planters.
- **L2** — Established club shop: a larger rectangular single-storey unit with a glazed south frontage, a paved forecourt with benches and planters, a small service door and bin store to the west.
- **L3** — Flagship club store: a substantially larger single-storey building with a continuous glazed south frontage, a deep entrance canopy, a paved plaza with formal planting, a service yard with marked delivery bay to the west.
- **L4** — Large megastore: a two-storey building with a long glazed frontage, a full-width entrance canopy, rooflights across the roof, a landscaped forecourt plaza, a service yard with two delivery bays and a goods canopy.
- **L5** — World-class destination megastore: a two-storey building with a sculpted roof and a double-height glazed atrium at the centre of the south frontage, a broad rooflight array, a solar array on the north roof, a generous paved arrival plaza with specimen trees, benches and planting, and a covered service yard. NO logos, NO branding, NO lettering of any kind.

---

## PART D — CONNECTOR TILES (optional, generate after the 60)

Same camera, same 160m x 160m plot, same hedge, same perimeter path, same four mid-edge stubs, same corner trees, same lighting, same palette. These are the pieces that let facilities be linked in a variety of ways, in the spirit of the city-builder layout:

1. **Straight avenue** — a 6m paved avenue running north-south between the north and south stubs, lined with regular street trees, mown grass either side.
2. **Crossroads plaza** — all four stubs meeting at a central circular paved plaza with a planted island.
3. **Corner** — a paved route curving from the south stub to the east stub, with planting on the inside of the curve.
4. **T-junction** — south, east and west stubs meeting at a small paved square.
5. **Tree grove** — no through route; mown grass, an informal grove of mature trees, a single path from the south stub to a small seating clearing.
6. **Formal garden** — a symmetrical paved parterre on the north-south axis, clipped hedging, four specimen trees.
7. **Car park** — a marked tarmac car park in `#5A5E63` with `#E8E4DA` bay markings, a tree-planted island, routes to the south and west stubs. No vehicles.
8. **Service yard** — a tarmac yard with marked delivery bays, a low screen wall, a bin and plant enclosure, routes to the west and south stubs.

---

## PART E — QC GATE (check before accepting any image)

Reject and regenerate if the answer to any of these is NO:

1. **Camera** — genuinely 90 degrees straight down? Are you seeing roofs and ground only, with no building walls visible?
2. **Perspective** — absolutely zero? No converging lines, no vanishing point, nothing isometric or tilted?
3. **Geometry** — is every major edge either perfectly horizontal or perfectly vertical?
4. **Plot** — same 160m square, same hedge, same 6m perimeter path?
5. **Connectors** — all four mid-edge 6m stubs present, at the exact midpoints, flush to the canvas edge, unblocked?
6. **Corners** — one mature tree at each of the four corners?
7. **Scale** — is the plot filling the frame identically to the previous asset? No zoom in, no zoom out?
8. **Lighting** — sun from the north-west, every shadow falling down and to the right?
9. **Palette** — only the locked colours?
10. **Progression** — does this level clearly evolve from the previous one rather than replace it?
11. **Pitch** — if present, is it the exact master pitch: 120m x 70m, 10m in-goals, real regulation markings, correct proportions, correct orientation?
12. **Posts** — goalposts present at BOTH ends, on the goal lines, centred, identical and mirrored?
13. **Level 0** — if this is a Level 0 for anything other than Stadium or Playing Surface, is the plot genuinely EMPTY?
14. **Text** — zero text, zero numbers, zero logos, zero signage, zero watermark?
15. **Population** — zero people, zero vehicles, zero random props?
16. **Premium** — does it read as deliberately art-directed, not generically AI-generated?

---

## PART F — PRACTICAL NOTES

- Image models will NOT hold this lock across 60 generations unaided. Expect drift, and expect to regenerate. Re-paste PART A every 4–5 images.
- The single most common failure will be the camera slipping into a three-quarter or isometric view. If that happens, reply with only: "Camera failure. Regenerate: true orthographic 90-degree top-down, straight down, no perspective, no isometric, you must see roofs and ground only, never walls."
- The second most common failure is invented markings on the pitch or goalposts at one end only.
- Generate the STADIUM L0 asset FIRST and get it perfect. It becomes your master pitch reference image — attach it to every subsequent pitch generation.
- Generate one facility's full 0–5 ladder in a single conversation, attaching the previous accepted level each time, so progression stays coherent.
- Generate every Level 0 empty plot from the same accepted empty-plot image so all eight are literally identical.

---

## APPENDIX — RESOLVED CONTRADICTIONS IN THE SOURCE BRIEF

Three conflicts existed between the master brief, the pitch reference image and the city-builder screenshot. Resolved as follows:

1. **Camera.** The screenshot reference is isometric; the master brief forbids isometric. Top-down orthographic wins, per the brief. Only the *connection system* is taken from the screenshot. (An orthographic top-down tile also mates on all four edges without the strict diamond alignment an isometric grid demands, so it is the better basis for the connection mechanic regardless.)
2. **Pitch markings.** The reference image draws only touchlines, dead-ball lines, goal lines, 22m lines, the halfway line, two lengthwise 5m dashed lines and goalposts — it omits the 10m and 15m lines. The instruction "pitch lines must be like real life" wins, so the full regulation set is specified. The reference image's own proportions are also stretched (its in-goals measure 20m and its "22m" lines sit at 19.5m), so the true metric geometry in the brief wins over the diagram's spacing.
3. **Level 0.** The brief gave the Recovery Centre and Training Paddock a "very small wooden shack" at Level 0. The instruction that every facility other than the stadium starts as an empty plot wins, so all eight non-pitch facilities are empty at Level 0.
