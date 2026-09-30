// Drawn national flags - no emoji (owner, 1.8.2: nation flags were the last
// emoji left in the UI). Each flag is simple geometry on a 24x16 field:
// stripes, crosses, saltires, discs and a canton, drawn to read at the size
// they sit at beside a nation's name, not as heraldic artwork. Rounded
// corners and a hairline edge so a white flag (England, Japan, Georgia) still
// has an outline on a light card and a dark one.
import { useId, type ReactNode } from 'react'
import { nationByCode, nationName } from '../game/nations'

const W = 24
const H = 16

/** five-pointed star as a polygon, point up */
const star = (cx: number, cy: number, r: number) => {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const d = i % 2 ? r * 0.42 : r
    pts.push(`${(cx + d * Math.cos(a)).toFixed(2)},${(cy + d * Math.sin(a)).toFixed(2)}`)
  }
  return pts.join(' ')
}

const Star = ({ x, y, r, fill = '#fff' }: { x: number; y: number; r: number; fill?: string }) => <polygon points={star(x, y, r)} fill={fill} />

const hStripes = (cols: string[]) => cols.map((c, i) => <rect key={i} x="0" y={(i * H) / cols.length} width={W} height={H / cols.length + 0.05} fill={c} />)
const vStripes = (cols: string[]) => cols.map((c, i) => <rect key={i} x={(i * W) / cols.length} y="0" width={W / cols.length + 0.05} height={H} fill={c} />)

/** the Union canton the Pacific and Australasian flags carry, in the top
 *  left quarter; a nested svg clips its arms to the quarter */
const UnionCanton = () => (
  <svg x="0" y="0" width="12" height="8" viewBox="0 0 12 8">
    <rect width="12" height="8" fill="#012169" />
    <path d="M0 0L12 8M12 0L0 8" stroke="#fff" strokeWidth="1.6" />
    <path d="M0 0L12 8M12 0L0 8" stroke="#C8102E" strokeWidth=".55" />
    <path d="M6 0V8M0 4H12" stroke="#fff" strokeWidth="2.6" />
    <path d="M6 0V8M0 4H12" stroke="#C8102E" strokeWidth="1.5" />
  </svg>
)

const Plus = ({ x, y }: { x: number; y: number }) => <path d={`M${x} ${y - 1.5}V${y + 1.5}M${x - 1.5} ${y}H${x + 1.5}`} stroke="#E8112D" strokeWidth=".9" />

// Wales: a red dragon passant on white over green. A silhouette of a dozen
// points rather than the real beast: at 11px tall the shape (head, raised
// wings, curled tail) is all that can read anyway.
const DRAGON = 'M4.2 6.6L6 5.2L7.2 5.6L8.4 7.4L11 7.2L12 3.2L14 5.4L16 3.4L15.6 7.4L18 7.8L19.8 6L20.6 6.6L18.6 9.2L16 9.6L16.6 12L15.2 12L14.4 10L10.6 10L10 12L8.6 12L8.8 9.4L7.4 8L6.4 7.4L4.2 7.6Z'

const MAPLE = '12,3.4 12.9,5.1 14.2,4.7 13.8,7 15.6,6.1 15.2,7.6 16.5,8.1 13.4,10.2 13.7,11 12.3,10.8 12.3,12.8 11.7,12.8 11.7,10.8 10.3,11 10.6,10.2 7.5,8.1 8.8,7.6 8.4,6.1 10.2,7 9.8,4.7 11.1,5.1'

const DRAW: Record<string, () => ReactNode> = {
  RSA: () => <>
    <rect width={W} height={H / 2} fill="#E03C31" />
    <rect y={H / 2} width={W} height={H / 2} fill="#001489" />
    <path d="M-1 -1L9.5 8L-1 17M9.5 8H25" fill="none" stroke="#fff" strokeWidth="5.4" />
    <path d="M-1 -1L9.5 8L-1 17M9.5 8H25" fill="none" stroke="#007749" strokeWidth="3.2" />
    <polygon points="0,1.8 7.1,8 0,14.2" fill="#FFB81C" />
    <polygon points="0,3.3 5.4,8 0,12.7" fill="#000" />
  </>,
  NZL: () => <>
    <rect width={W} height={H} fill="#012169" />
    <UnionCanton />
    {[[18, 3.2, 1.3], [15.6, 7, 1.2], [20.6, 6.4, 1.1], [18, 12.4, 1.4]].map(([x, y, r], i) => <g key={i}><Star x={x} y={y} r={r + 0.45} /><Star x={x} y={y} r={r} fill="#C8102E" /></g>)}
  </>,
  // Ireland plays as one island under the IRFU's own flag, not the
  // tricolour. A plain green field quartered by a thin white cross, for the
  // four provinces, stands for that without borrowing either state's flag.
  IRE: () => <>
    <rect width={W} height={H} fill="#169B62" />
    <path d="M12 0V16M0 8H24" stroke="#fff" strokeWidth="1.4" />
  </>,
  FRA: () => <>{vStripes(['#002395', '#fff', '#ED2939'])}</>,
  ENG: () => <>
    <rect width={W} height={H} fill="#fff" />
    <path d="M12 0V16M0 8H24" stroke="#CE1124" strokeWidth="3.2" />
  </>,
  ARG: () => <>
    {hStripes(['#74ACDF', '#fff', '#74ACDF'])}
    <circle cx="12" cy="8" r="1.9" fill="#F6B40E" />
  </>,
  SCO: () => <>
    <rect width={W} height={H} fill="#005EB8" />
    <path d="M0 0L24 16M24 0L0 16" stroke="#fff" strokeWidth="3" />
  </>,
  AUS: () => <>
    <rect width={W} height={H} fill="#012169" />
    <UnionCanton />
    <Star x={6} y={12.2} r={2.2} />
    <Star x={18} y={3} r={1.2} /><Star x={15.4} y={7} r={1.2} /><Star x={20.8} y={6.2} r={1.2} />
    <Star x={18} y={13} r={1.3} /><Star x={19.6} y={9.2} r={.7} />
  </>,
  FIJ: () => <>
    <rect width={W} height={H} fill="#68BFE5" />
    <UnionCanton />
    <path d="M15.5 4.5H21.5V9.5Q21.5 12.5 18.5 13.6Q15.5 12.5 15.5 9.5Z" fill="#fff" />
    <path d="M18.5 4.5V13.5M15.5 7H21.5" stroke="#CE1126" strokeWidth=".9" />
  </>,
  ITA: () => <>{vStripes(['#009246', '#fff', '#CE2B37'])}</>,
  WAL: () => <>
    <rect width={W} height={H / 2} fill="#fff" />
    <rect y={H / 2} width={W} height={H / 2} fill="#00AB39" />
    <path d={DRAGON} fill="#D30731" />
  </>,
  GEO: () => <>
    <rect width={W} height={H} fill="#fff" />
    <path d="M12 0V16M0 8H24" stroke="#E8112D" strokeWidth="2.6" />
    <Plus x={5.5} y={3.6} /><Plus x={18.5} y={3.6} /><Plus x={5.5} y={12.4} /><Plus x={18.5} y={12.4} />
  </>,
  JPN: () => <>
    <rect width={W} height={H} fill="#fff" />
    <circle cx="12" cy="8" r="4.8" fill="#BC002D" />
  </>,
  SAM: () => <>
    <rect width={W} height={H} fill="#CE1126" />
    <rect width="12" height="8" fill="#002B7F" />
    <Star x={6} y={1.9} r={1} /><Star x={4} y={4.2} r={1} /><Star x={8.2} y={3.8} r={1} /><Star x={6} y={6.4} r={1.1} /><Star x={7.2} y={5} r={.55} />
  </>,
  TGA: () => <>
    <rect width={W} height={H} fill="#C10000" />
    <rect width="10" height="7.5" fill="#fff" />
    <path d="M5 1.4V6.1M2.6 3.75H7.4" stroke="#C10000" strokeWidth="1.4" />
  </>,
  USA: () => <>
    {hStripes(['#B22234', '#fff', '#B22234', '#fff', '#B22234', '#fff', '#B22234', '#fff', '#B22234', '#fff', '#B22234', '#fff', '#B22234'])}
    <rect width="10.4" height={(H * 7) / 13} fill="#3C3B6E" />
    {[1.8, 4, 6.2].map(y => [1.8, 4, 6.2, 8.4].map(x => <circle key={`${x}-${y}`} cx={x + (y === 4 ? 1.1 : 0)} cy={y} r=".45" fill="#fff" />))}
  </>,
  CAN: () => <>
    <rect width={W} height={H} fill="#fff" />
    <rect width="6" height={H} fill="#D80621" />
    <rect x="18" width="6" height={H} fill="#D80621" />
    <polygon points={MAPLE} fill="#D80621" />
  </>,
  URU: () => <>
    {hStripes(['#fff', '#0038A8', '#fff', '#0038A8', '#fff', '#0038A8', '#fff', '#0038A8', '#fff'])}
    <rect width="9" height={(H * 5) / 9} fill="#fff" />
    <circle cx="4.5" cy={(H * 5) / 18} r="2.3" fill="#FCD116" stroke="#7B3F00" strokeWidth=".3" />
  </>,
  POR: () => <>
    <rect width={W} height={H} fill="#FF0000" />
    <rect width="9.6" height={H} fill="#006600" />
    <circle cx="9.6" cy="8" r="3.4" fill="none" stroke="#FFE900" strokeWidth="1.1" />
    <path d="M8.1 6.2H11.1V8.8Q11.1 10.4 9.6 10.9Q8.1 10.4 8.1 8.8Z" fill="#fff" stroke="#FF0000" strokeWidth=".5" />
  </>,
  ESP: () => <>
    <rect width={W} height={H} fill="#AA151B" />
    <rect y="4" width={W} height="8" fill="#F1BF00" />
  </>,
  ROU: () => <>{vStripes(['#002B7F', '#FCD116', '#CE1126'])}</>,
  NAM: () => <>
    <rect width={W} height={H} fill="#009A44" />
    <polygon points="0,0 24,0 0,16" fill="#003580" />
    <path d="M-1 16.7L25 -.7" stroke="#fff" strokeWidth="5.6" />
    <path d="M-1 16.7L25 -.7" stroke="#D21034" strokeWidth="3.8" />
    <circle cx="4.6" cy="4.2" r="1.8" fill="#FFCE00" />
  </>,
  CHL: () => <>
    <rect width={W} height={H} fill="#fff" />
    <rect y="8" width={W} height="8" fill="#D52B1E" />
    <rect width="8" height="8" fill="#0039A6" />
    <Star x={4} y={4.2} r={2} />
  </>,
  // The touring Isles XV is an invitational side, not a union, and has no
  // flag. A neutral crest: a red field with a quartered red and white shield,
  // borrowing no union's marks.
  LIO: () => <>
    <rect width={W} height={H} fill="#B3152B" />
    <path d="M8 2.5H16V8.5Q16 12.6 12 14Q8 12.6 8 8.5Z" fill="#fff" />
    <rect x="8" y="2.5" width="4" height="5.8" fill="#B3152B" />
    <path d="M12 8.3H16V8.5Q16 12.6 12 14Z" fill="#B3152B" />
    <path d="M8 2.5H16V8.5Q16 12.6 12 14Q8 12.6 8 8.5Z" fill="none" stroke="#fff" strokeWidth=".9" />
  </>,
}

/**
 * A nation's flag, drawn. `size` is the height in px; the flag is 3:2.
 * An unknown code draws a neutral grey field, never a gap.
 */
export function Flag({ code, size = 12 }: { code: string; size?: number }) {
  const clip = `flag${useId().replace(/:/g, '')}`
  const name = nationByCode(code) ? nationName(code) : code
  const draw = DRAW[code]
  return (
    <svg className="flag" width={(size * W) / H} height={size} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={name}
      style={{ verticalAlign: '-0.1em', flexShrink: 0, overflow: 'hidden' }}>
      <title>{name}</title>
      <clipPath id={clip}><rect width={W} height={H} rx="2" /></clipPath>
      <g clipPath={`url(#${clip})`}>
        {draw ? draw() : <rect width={W} height={H} fill="#8E9593" />}
      </g>
      {/* the hairline: a mid-grey that shows against white card and dark card */}
      <rect x=".35" y=".35" width={W - 0.7} height={H - 0.7} rx="1.7" fill="none" stroke="rgba(128,128,128,.55)" strokeWidth=".7" />
    </svg>
  )
}
