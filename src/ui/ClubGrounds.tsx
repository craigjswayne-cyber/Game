import { FACILITY_INFO, MAX_FACILITY, type Club, type FacilityId } from '../game/model'
import { t } from '../game/i18n'

/**
 * ---- THE CLUB, SEEN FROM THE AIR ----
 *
 * Owner: "the club infrastructure could be visually much stronger", with a
 * city-builder's campus map as the reference.
 *
 * WHAT THIS WAS, AND WHY IT CHANGED. Until now every mark on this map was
 * drawn in code: isometric boxes built out of three shaded faces, a kit of
 * roof furniture, and an emoji laid on top of each roof to say what the
 * building was. The file carried a long argument for that approach - nine
 * facilities at six levels is 54 states before the ground and the builders,
 * and no sane amount of art covers it - and the argument was wrong, because
 * the owner had already drawn all 54. Ten ladders, nine facilities and the
 * ground, six stages each, painted. They sat in the conversation while the
 * game drew coloured boxes, and the owner's verdict on the result was the
 * correct one: "the visual is crap".
 *
 * So the drawing code is gone, about 880 lines of it, and this file now places
 * the owner's art. scripts/sprites.mjs is the pipeline that cuts the ladders
 * into the 60 sprites in ./sprites, and it carries the detail of how.
 *
 * WHAT IS UNCHANGED, and matters more than the art: the estate on screen is
 * still the estate in the save. Every plot reads its own level out of
 * club.facilities and the ground reads its capacity, so a gym at level 1 is
 * the shed the board paid for and a gym at level 5 is the building they paid
 * for later. A picture that did not move when the number moved would be
 * wallpaper.
 *
 * ---- THE PROJECTION ----
 *
 * A 2:1 isometric grid, the one every game of this kind uses: a tile twice as
 * wide as it is tall, so a square plot lands as a diamond.
 *
 *     screen x = OX + (gx - gy) * TW/2
 *     screen y = OY + (gx + gy) * TH/2
 *
 * Read (gx + gy) as DEPTH: it rises towards the viewer, which makes the
 * painter's sort one line rather than a z-buffer. That sort matters more now
 * than it did with boxes - these tiles carry their own landscaping and overlap
 * their neighbours, so drawing them out of order puts a hedge in front of a
 * building that stands behind it.
 */

/**
 * THE SPRITES, ALL SIXTY, BY NAME. Eager because the map needs whichever nine
 * levels the save happens to hold and there is no telling which until it is
 * read; what is eager here is the URL, not the image, so the bundle gains 60
 * short strings and the browser still fetches only the nine on screen.
 */
const SPRITES = import.meta.glob('./sprites/*.webp', {
  eager: true, query: '?url', import: 'default',
}) as Record<string, string>
const sprite = (id: string, lvl: number): string | undefined =>
  SPRITES[`./sprites/${id}-${Math.max(0, Math.min(5, lvl))}.webp`]

/** What scripts/sprites.mjs measured off the art it cut: the canvas each
 *  ladder shares, and the largest ground plate in it. */
import PLATES from './sprites/plates.json'
type Plate = { w: number; h: number; pw: number; ph: number }

/** Tile width and height in screen units. 2:1, and the whole layout is in
 *  these - change them and everything below still lands. */
const TW = 92
const TH = 46
const OX = 180
const OY = 64

const iso = (gx: number, gy: number): [number, number] =>
  [OX + (gx - gy) * TW / 2, OY + (gx + gy) * TH / 2]

/** A quad on the ground plane, given in grid coordinates. iso(-0.5, -0.5) is
 *  the top corner of cell (0,0), so a whole 4x4 estate is (-0.5 .. 3.5). */
const quad = (a: number, b: number, c: number, d: number): string => {
  const p: [number, number][] = [iso(a, b), iso(c, b), iso(c, d), iso(a, d)]
  return `M ${p.map(([x, y]) => `${x},${y}`).join(' L ')} Z`
}
/** One cell, inset by `pad` cells on every side. */
const cell = (gx: number, gy: number, pad = 0): string =>
  quad(gx - 0.5 + pad, gy - 0.5 + pad, gx + 0.5 - pad, gy + 0.5 - pad)

/**
 * WHERE EVERYTHING STANDS. The grass is kept together down the left and front
 * - the playing surface, the paddock and the kicking enclosure are fields
 * rather than buildings, and a club whose pitches are scattered between its
 * offices does not look like a club. The buildings run round the top and the
 * right, and the ground takes the middle four plots.
 *
 * The three scenery plots are gone with the drawing code. They existed because
 * a campus of nine bare boxes read as a circuit board and it needed trees; the
 * owner's tiles arrive with their own hedges, trees and parked cars, so the
 * scenery would now be a second, worse set of trees beside the real ones.
 */
const PLOTS: { id: FacilityId; gx: number; gy: number }[] = [
  { id: 'academy', gx: 1, gy: 0 },
  { id: 'briefing', gx: 2, gy: 0 },
  { id: 'gym', gx: 3, gy: 0 },
  { id: 'recovery', gx: 3, gy: 1 },
  { id: 'kicking', gx: 0, gy: 2 },
  { id: 'hospitality', gx: 3, gy: 2 },
  { id: 'paddock', gx: 0, gy: 3 },
  { id: 'pitch', gx: 1, gy: 3 },
  { id: 'shop', gx: 2, gy: 3 },
]

/**
 * THE GROUND'S SIX STAGES ARE CAPACITY BANDS, not a facility level. It is the
 * one thing on this campus the board does not build in levels - it adds SEATS
 * (requestExpansion, season.ts), anywhere from a few hundred to a new stand -
 * so the ladder is read off the seat count instead. The bands sit where the
 * real grounds in the database sit, so moving up one is a thing that happens
 * across a career rather than never or constantly.
 */
const GROUND_TIERS = [45_000, 26_000, 17_000, 11_000, 6_000]
const groundTier = (cap: number): number => {
  const i = GROUND_TIERS.findIndex(n => cap >= n)
  return i < 0 ? 0 : 5 - i
}

/** How much of each cell is street. The rest is the plot. */
const ROAD = 13

/**
 * One tile, stood on its plot.
 *
 * FITTED TO ITS PLATE, NOT TO ITS IMAGE. The first version drew every sprite
 * at one width and stood it on the bottom of its cell, which assumed two
 * things about the art that are not true: that the plate fills the image, and
 * that the plate is a 2:1 diamond like the grid. Measured, the ten ladders'
 * plates run from 1.35 wide-to-tall to 2.08, because each sheet was rendered
 * at its own camera angle. On a 2:1 lattice the flat ones spilled over their
 * neighbours and the steep ones left holes, which is what made the estate
 * look crooked.
 *
 * So the plate is what gets fitted. Each ladder is scaled until its widest
 * plate sits inside the cell with the road still showing on every side, and
 * the image is then placed so that plate's CENTRE - not the image's bottom
 * edge - lands on the centre of the plot. One scale for all six levels, so a
 * plot does not change size when the club builds on it.
 */
function Tile({ id, lvl, gx, gy, cells = 1 }: {
  id: string; lvl: number; gx: number; gy: number; cells?: number
}) {
  const href = sprite(id, lvl)
  const p = (PLATES as Record<string, Plate>)[id]
  if (!href || !p) return null
  const [x, y] = iso(gx, gy)
  const innerW = TW * cells - ROAD
  const innerH = TH * cells - ROAD / 2
  /* Fitted on width, with the height allowed a quarter more than the cell
     before it starts to bind. Fitting on both at once let the steepest plates
     - the playing surface at 1.35 wide-to-tall - shrink to two thirds the
     width of the shallowest, so the estate read as plots of assorted sizes.
     A plate a little taller than its cell laps into the street, which is what
     isometric tiles do and what the painter's sort is for; a plate two thirds
     the width of its neighbour just looks wrong. */
  const k = Math.min(innerW / p.pw, (innerH * 1.25) / p.ph)
  const w = p.w * k, h = p.h * k
  // the plate's near vertex sits half a plate below the centre of the plot
  const foot = y + (p.ph * k) / 2
  return <image href={href} x={x - w / 2} y={foot - h} width={w} height={h} />
}

export default function ClubGrounds({ club, buildingId, selected, onPick }: {
  club: Club
  /** the facility the builders are on site for, if any */
  buildingId: FacilityId | null
  selected: FacilityId | null
  onPick: (fid: FacilityId) => void
}) {
  const lvl = (fid: FacilityId) => club.facilities?.[fid] ?? 0
  const cap = Math.max(2_000, club.capacity)

  /** Painter's order: back to front, which on this grid is depth ascending.
   *  The ground sits at the centre of the four plots it covers, so it takes
   *  their depth and lands between the back row and the front one. */
  const order = [...PLOTS].sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy) || a.gx - b.gx)
  const back = order.filter(p => p.gx + p.gy < 3)
  const front = order.filter(p => p.gx + p.gy >= 3)

  /** One plot, drawn at whatever it currently is. */
  const draw = (p: { id: FacilityId; gx: number; gy: number }) => {
    const fid = p.id
    const l = lvl(fid)
    const [x, y] = iso(p.gx, p.gy)
    const building = buildingId === fid
    const on = selected === fid
    return (
      <g key={fid} className={`gplot${on ? ' on' : ''}${building ? ' building' : ''}`}
        onClick={() => onPick(fid)} role="button" tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(fid) } }}
        aria-label={`${t(FACILITY_INFO[fid].name)} · ${t('world.infLevelOf', { n: l, max: MAX_FACILITY })}`}>
        <Tile id={fid} lvl={l} gx={p.gx} gy={p.gy} />
        {/* THE TAP TARGET IS THE PLOT, NOT THE PICTURE. An <image> with
            transparent corners still takes a tap on those corners, so nine
            overlapping rectangles would steal each other's taps along every
            shared edge. The diamond is the footprint the eye sees. */}
        <path className="ghit" d={`M ${x},${y - TH / 2} L ${x + TW / 2},${y} L ${x},${y + TH / 2} L ${x - TW / 2},${y} Z`} />
        {/* THE CRANE SAYS SO. A build takes weeks and the only sign of one used
            to be a line of text on a card; here the plot itself is a site. */}
        {building && (
          <g className="gcrane">
            <path d={`M ${x - 2},${y - 4} L ${x - 2},${y - 62} L ${x + 26},${y - 62}`}
              stroke="var(--gold)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d={`M ${x + 22},${y - 62} L ${x + 22},${y - 50}`} stroke="var(--gold)" strokeWidth="1.6" />
          </g>
        )}
        {/* The level, as the same pips the cards use, drawn small under the
            plot. Five dots is the whole scale, so a glance across the campus
            reads as a glance down the list. */}
        <g className="gpips">
          {Array.from({ length: MAX_FACILITY }).map((_, i) => (
            <circle key={i} cx={x - 14 + i * 7} cy={y + TH / 2 - 2} r="2.1"
              fill={i < l ? 'var(--gold)' : 'var(--border)'} />
          ))}
        </g>
      </g>
    )
  }

  return (
    /* THE BOX IS MEASURED, NOT GUESSED. The first cut carried 43 units of
       empty sky above the estate and 59 below it, which on a phone is most of
       a thumb of nothing inside a framed card. These are the real extents:
       the ground's roof reaches y = -9, the front plots' pips end at 205, and
       the paddock and the gym put the sides at -10 and 370. */
    /* SLICE, NOT MEET. The estate is a diamond, so a box drawn round it is
       nearly twice as wide as it is tall and its left and right points hold
       nothing but verge. Fitted whole into a phone-width card that left about
       450px of empty card under it - most of a thumb of nothing, on the tab
       whose entire job is this picture. Slicing lets the card be as tall as
       it likes and crops the two tips, which is the only part there is
       nothing in. */
    <svg className="grounds" viewBox="-26 4 412 240" preserveAspectRatio="xMidYMid slice" role="img"
      aria-label={t('world.infGroundsAlt', { club: club.short })}>
      {/* ---- THE ROADS ----
          The one thing that made the reference read as a CAMPUS and this read
          as a pile of buildings. Its plots each sit on their own island with
          tarmac between them; ours were drawn a shade wider than their own
          cell so their plates met, on the theory that a tile set should not
          show its grid. That is right for terrain and wrong for an estate: a
          club is a set of separate places you walk between, and with the
          plates fused there was nothing to walk on and nine buildings read as
          one block.

          So the ground plane comes back, the tiles are drawn INSIDE their
          cells rather than over the edges, and what shows in between is a
          road. It is one surface under everything rather than a path per gap,
          because a road network that meets itself at the corners is what
          makes the estate look connected. */}
      {/* NO DIAMOND OF LAND. There was one here, and at the size the map is
          read its left and right points ran off the card and were sliced into
          two flat wedges - a green lozenge behind the estate rather than
          ground under it. The land is the card's own background now, so it
          runs to every edge the way the reference's terrain does, and the
          only shape with corners is the estate itself. */}
      {/* STREETS, NOT A SLAB. The first version tarmacked the whole estate and
          stood the plots on it as islands, which made the grey the subject:
          a car park with buildings in it. The reference does the opposite -
          its blocks are large and green and the roads between them are thin -
          so the road is a lattice of strips along the grid lines and
          everything they do not cover stays land. */}
      {/* ---- THE WORLD RUNS PAST THE FRAME ----
          Owner: "there's a weird slant on the game". Measured, nothing on
          this screen is rotated or skewed - no transform, no clip-path, and
          the cards, tabs, type and navigation are all exactly orthogonal. The
          slant is the COMPOSITION: an isometric estate drawn to its own edges
          is a diamond, and a diamond floating inside a rectangle reads as a
          tilt against everything square around it.

          The reference does not have that problem, and not because its grid
          is any less diagonal - because its world fills the screen and is
          cropped by it, so there is no lozenge to see. So the ground plane and
          the street grid are drawn over a span half again wider than the
          estate. The roads leave the picture instead of stopping at a point,
          the canvas corners hold land rather than void, and what the frame
          shows is a rectangle of world with the club in the middle of it. */}
      {/* ---- THE STREETS ----
          Inside the wall they are the estate's own, at full strength. Beyond
          it they are the roads that get you here, at a third of it.

          Two earlier attempts were worse. Stopping them at the wall left the
          club as a diamond on an empty field, which is the floating shape the
          owner was seeing. Carrying the whole grid out instead, a block past
          the estate in both directions, filled the canvas corners with a
          lattice of empty blocks - a suburb, and exactly the city-builder
          look the brief rules out. A radial mask to fade them was no better:
          the estate's own side vertices sit further from the centre than the
          frame's corners do, so any fade tight enough to dim the outskirts
          was already dimming the club.

          Opacity on a second group is the control that actually fits the
          shape of the problem. */}
      {OUTER.map(k => {
        const c = k - 0.5, r = ROAD / (2 * TW)
        return (
          <g key={k}>
            <path d={quad(c - r, -1.9, c + r, -0.5)} className="g-road out" />
            <path d={quad(c - r, 3.5, c + r, 4.9)} className="g-road out" />
            <path d={quad(-1.9, c - r, -0.5, c + r)} className="g-road out" />
            <path d={quad(3.5, c - r, 4.9, c + r)} className="g-road out" />
            <path d={quad(c - r, -0.5, c + r, 3.5)} className="g-road" />
            <path d={quad(-0.5, c - r, 3.5, c + r)} className="g-road" />
            <path d={`M ${iso(c, -0.42).join(',')} L ${iso(c, 3.42).join(',')}`} className="g-lane" />
            <path d={`M ${iso(-0.42, c).join(',')} L ${iso(3.42, c).join(',')}`} className="g-lane" />
          </g>
        )
      })}
      {/* The club's boundary. Without it the estate has no edge at all once
          the land runs past the frame, and a ground is a walled place. */}
      <path d={quad(-0.5, -0.5, 3.5, 3.5)} className="g-wall" />
      {/* THE CAR PARKS. Nine facilities on a sixteen-cell grid leaves three
          cells over, and bare road in them read as a hole rather than as
          space. A car park is the right thing to put there: every ground has
          them, it is a GROUND feature - flat, part of the road surface - and
          so it cannot clash with the painted tiles the way the old
          code-drawn trees did. One at the front, where a ground puts its
          entrance, and one across the two cells at the back. */}
      {PARKS.map(([gx, gy]) => (
        <g key={`${gx}${gy}`}>
          <path d={cell(gx, gy, 0.19)} className="g-park" />
          {[0, 1, 2, 3].map(i => {
            const t0 = -0.2 + i * 0.13
            return <path key={i}
              d={`M ${iso(gx + t0, gy - 0.19).join(',')} L ${iso(gx + t0, gy + 0.19).join(',')}`}
              className="g-bay" />
          })}
        </g>
      ))}
      {back.map(draw)}
      <Tile id="stadium" lvl={groundTier(cap)} gx={1.5} gy={1.5} cells={2} />
      {front.map(draw)}
    </svg>
  )
}

/** THE ESTATE'S OWN FIVE STREETS EACH WAY, AND NO OTHERS. Extending the grid
 *  a block past the club as well gave the canvas corners a full lattice of
 *  empty blocks, which is a suburb rather than a setting. These are the same
 *  streets that run between the plots, simply carried out of the picture, so
 *  what is beyond the wall reads as the roads that get you there. */
const OUTER = [0, 1, 2, 3, 4]

/** ONE CAR PARK, AT THE ENTRANCE. There were three, one per empty cell, and
 *  at full cell size they read as two enormous grey wedges either end of the
 *  estate - more tarmac than the whole road network. The reference has plain
 *  green blocks in it too; the two cells at the back are simply land now, and
 *  the park that remains is the one a ground actually has, by the gate, drawn
 *  small enough to sit IN its block rather than be it. */
const PARKS: [number, number][] = [[3, 3]]
