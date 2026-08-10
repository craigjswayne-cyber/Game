import { useEffect, useRef, type ReactNode } from 'react'
import { clubCode, type GameState, type Player } from '../game/model'
import { flagOf } from '../game/nations'
import { kitPattern, type KitPattern } from '../game/kits'


/**
 * ---- THE FAB RUGBY BALL ----
 *
 * The mark is the ball, tilted, white leather with a heavy keyline, sitting inside
 * a pale ring on the brand blue. It replaced a shield with goalposts and initials
 * on it, which was three ideas fighting for 64 pixels and unreadable at rail size.
 *
 * It was crimson and gold for one afternoon, matching the artwork it came from,
 * until the user asked for blue, white and grey back. The SHAPE is the logo; the
 * colours belong to the palette, and a crimson roundel on a navy masthead is two
 * brands arguing.
 *
 * Drawn rather than shipped as an image, for two reasons that both matter on a
 * phone: it is a few hundred bytes inside the bundle instead of a request, and it
 * stays sharp at every size from the 20px masthead to the 512px install icon.
 *
 * The two hooks inside the ball are the light catching the leather, not seams.
 * They are what makes it read as a ball at 20px, where actual lacing turns to mud.
 */
export function BrandMark({ size = 64, inverse = false }: { size?: number; inverse?: boolean }) {
  const disc = inverse ? '#1b3468' : '#2e57ab'
  const ring = inverse ? '#eef3fb' : '#dbe6f6'
  const line = inverse ? '#0d1f3f' : '#1b3468'
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden style={{ flexShrink: 0 }}>
      <circle cx="32" cy="32" r="32" fill={disc} />
      <circle cx="32" cy="32" r="26" fill="none" stroke={ring} strokeWidth="3.4" />
      {/* the ball: an ellipse rotated off the horizontal, keylined in deep navy */}
      <g transform="rotate(-32 32 32)">
        <ellipse cx="32" cy="32" rx="16.2" ry="22.6" fill={line} />
        <ellipse cx="32" cy="32" rx="13.6" ry="20.0" fill="#ffffff" />
        {/* the light on the leather: one hook top-left, one bottom-right */}
        <path d="M31.4 12.4 C24.4 18.6 22.0 25.8 22.6 33.6 C24.4 26.6 26.4 20.4 33.2 13.8 Z" fill={line} />
        <path d="M32.6 51.6 C39.6 45.4 42.0 38.2 41.4 30.4 C39.6 37.4 37.6 43.6 30.8 50.2 Z" fill={line} />
      </g>
    </svg>
  )
}

/**
 * ---- A STORY, IN PARAGRAPHS ----
 *
 * User: "news graphics seem so messy, tidy them up. use paragraphs."
 *
 * Splitting on newlines is not enough, because most stories do not have any. The
 * engine writes them as one block and lets them wrap, so a five-name scouting
 * round-up arrives as eight unbroken lines. Rendering that as a single <p> is
 * honest to the source and unreadable on a phone.
 *
 * So: honour the newlines where they exist, and where a block is long, break it at
 * sentence ends into paragraphs of a few sentences each. Splitting on ". " before a
 * capital keeps initials and abbreviations together, and the grouping means a
 * two-sentence story is left alone rather than being chopped into stubs.
 *
 * This is presentation only. It reads the body and never rewrites it: every
 * character of the original survives, in order.
 */
export function paragraphs(body: string): string[] {
  const blocks = (body ?? '').split('\n').map(t => t.trim()).filter(Boolean)
  const out: string[] = []
  for (const block of blocks) {
    if (block.length <= 220) { out.push(block); continue }
    // sentence ends: . ! or ? then a space then something that starts a sentence
    const parts = block.split(/(?<=[.!?])\s+(?=[A-Z0-9"'\u00c0-\u017f])/)
    let buf = ''
    for (const part of parts) {
      buf = buf ? `${buf} ${part}` : part
      if (buf.length >= 150) { out.push(buf); buf = '' }
    }
    if (buf) {
      // a short tail joins the paragraph before it rather than sitting alone
      if (out.length && buf.length < 60) out[out.length - 1] += ` ${buf}`
      else out.push(buf)
    }
  }
  return out.length ? out : ['']
}

/**
 * A section heading, with an optional right-hand slot for the one action that
 * belongs to the section.
 *
 * The slot exists because a lone button on its own row costs 36px of a 390px
 * screen for a single word. Auto-Pick Best XV belongs to the Starting XV, so
 * it sits on the Starting XV's heading.
 */
export function SectionTitle({ children, sub, right }: { children: ReactNode; sub?: string; right?: ReactNode }) {
  return (
    <div className="section-title">
      <span>{children}</span>
      {sub && <span className="sub">{sub}</span>}
      {right && <span className="sect-act">{right}</span>}
    </div>
  )
}

/**
 * A control block that stays put while a long list scrolls underneath it.
 *
 * The squad runs to nearly five screenfuls, so the view tabs and the filter
 * chips were three flicks away from whoever you were looking at: to switch to
 * the Stats columns you scrolled back to the top, and to come back you
 * scrolled down again. The chips wrap on a narrow phone, so the block's height
 * cannot be a constant - it publishes itself as --stickyh, which the table's
 * own sticky column header sits directly beneath.
 */
export function StickyControls({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const root = document.documentElement
    const publish = () => root.style.setProperty('--stickyh', `${el.offsetHeight}px`)
    publish()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(publish)
    ro.observe(el)
    return () => { ro.disconnect(); root.style.removeProperty('--stickyh') }
  }, [])
  return <div className="sticky-controls" ref={ref}>{children}</div>
}

const FORWARD = new Set(['LP', 'HK', 'TP', 'LK', 'FL', 'N8'])

export function PosBadge({ pos }: { pos: string }) {
  return <span className={`pos-badge${FORWARD.has(pos) ? '' : ' back'}`}>{pos}</span>
}

export function FormPill({ v }: { v: number }) {
  const bg = v >= 7.5 ? '#2f7d4f' : v >= 6 ? '#6f8f4f' : v >= 4.5 ? '#8a7a3a' : '#9b2c2c'
  return <span className="form-pill" style={{ background: bg }}>{v.toFixed(1)}</span>
}

export function Nat({ code }: { code: string }) {
  return <span title={code}>{flagOf(code)}</span>
}

/** Star display for overall ability, CM-style (out of 5). */
export function Stars({ ca }: { ca: number }) {
  const n = Math.round(((ca - 40) / 60) * 10) / 2
  const full = Math.max(0, Math.floor(n))
  const half = n - full >= 0.5
  // FIXED-WIDTH CELLS. The half glyph is narrower than the star, so a rating
  // with a half in it rendered a narrower block and the column's edge wandered
  // row to row (user screenshot: "the stars have gone out of alignment at
  // number 20" - row 20 was the one three-star man in a list of halves).
  // Every glyph gets the same 1em cell, so five cells is five ems on every row.
  return (
    <span style={{ color: '#a8841a', fontSize: 11 }}>
      {Array.from({ length: 5 }, (_, i) => {
        const lit = i < full
        const isHalf = i === full && half
        return (
          <span key={i} style={{ display: 'inline-block', width: '1em', textAlign: 'center',
            color: lit || isHalf ? undefined : 'var(--star-empty)' }}>
            {isHalf ? '½' : '★'}
          </span>
        )
      })}
    </span>
  )
}

export function availabilityTag(p: Player, week: number): { txt: string; color: string } | null {
  if (p.injury) return { txt: `INJ ${Math.max(0, p.injury.until - week)}w`, color: '#9b2c2c' }
  if (p.bans > 0) return { txt: `BAN ${p.bans}`, color: '#9b2c2c' }
  if (p.natSquad) return { txt: 'INTL', color: '#a8841a' }
  if ((p.rust ?? 0) > 0) return { txt: `⚠ RUSTY ${p.rust}w`, color: '#a8841a' }
  if (p.loanFrom) return { txt: 'ON LOAN HERE', color: '#3a68c4' }
  return null
}

export function AvailTag({ p, g }: { p: Player; g: GameState }) {
  const t = availabilityTag(p, g.week)
  if (!t) return null
  return <span style={{ color: t.color, fontWeight: 700, fontSize: 10.5 }}>{t.txt}</span>
}

export function attrClass(v: number): string {
  return v >= 16 ? 'elite' : v >= 12 ? 'good' : v <= 7 ? 'poor' : ''
}

/** Small club-colour swatch shown next to team names. */
export function TeamDot({ g, teamId }: { g: GameState; teamId: string }) {
  const c = g.clubs[teamId]
  if (!c) return null
  return (
    <span
      className="team-dot"
      style={{ background: `linear-gradient(135deg, ${c.colors[0]} 55%, ${c.colors[1]} 55%)` }}
    />
  )
}

interface CrestClub {
  id: string
  short: string
  colors: [string, string]
}

const SHIELD = 'M12 1.5 L21.5 4.5 V13 C21.5 19 17.5 22.5 12 24.5 C6.5 22.5 2.5 19 2.5 13 V4.5 Z'
// inset line for the heraldic double border
const SHIELD_IN = 'M12 3.7 L19.6 6.1 V13 C19.6 17.7 16.4 20.6 12 22.3 C7.6 20.6 4.4 17.7 4.4 13 V6.1 Z'

/** Shield field decoration derived from how the club actually wears its colours. */
function CrestField({ pattern, c2 }: { pattern: KitPattern; c2: string }) {
  switch (pattern) {
    case 'hoops': return (<><rect x="0" y="7" width="24" height="4" fill={c2} /><rect x="0" y="15" width="24" height="4" fill={c2} /></>)
    case 'stripes': return (<><rect x="5" y="0" width="4" height="26" fill={c2} /><rect x="15" y="0" width="4" height="26" fill={c2} /></>)
    case 'quarters': return (<><rect x="12" y="0" width="12" height="13" fill={c2} /><rect x="0" y="13" width="12" height="13" fill={c2} /></>)
    case 'sash': return <path d="M-2 21 L26 7 L26 13 L-2 27 Z" fill={c2} />
    case 'halves': return <rect x="12" y="0" width="12" height="26" fill={c2} />
    default: return <rect x="0" y="0" width="24" height="7" fill={c2} />
  }
}

/**
 * Club crest: a heraldic shield generated from the club's kit pattern and
 * colours, with an enamelled sheen, a metallic gold ring, an inset hairline
 * and a condensed monogram. No PNG lookup - the old logos/<id>.png attempt
 * 404'd on every club (the folder ships empty) and left blank crests on slow
 * phones while the error event was pending.
 */
export function Crest({ club, size = 16, mr = 6 }: { club: CrestClub; size?: number; mr?: number }) {
  const pattern = kitPattern(club.id)
  const [c1, c2] = club.colors
  // A single initial cannot tell sixteen B clubs apart: Bath and Bristol both
  // read as a navy "B" in the club picker, and Sale and Saracens both as "S".
  // A three-letter code (BAT, BRI, SAL, SAR) takes the 101 clubs from 20
  // distinct labels to 89, and matches the touchline codes the pitch already
  // draws. Only at sizes with room for it: below 30px the crest always sits
  // beside the club's name in text, where one letter is plenty.
  const letters = club.short.replace(/[^A-Za-z]/g, '').toUpperCase()
  const wide = size >= 30
  // clubCode for the three-letter form, so the badge, the touchline and the team
  // sheet all show the same NOR
  const letter = wide ? clubCode(club.short) : (letters.slice(0, 1) || 'R')
  const clip = `crest-${club.id}`
  const gloss = `gloss-${club.id}`
  const gold = `gold-${club.id}`
  return (
    <svg
      viewBox="0 0 24 26"
      width={size}
      height={Math.round((size * 26) / 24)}
      style={{ verticalAlign: '-3px', marginRight: mr, flexShrink: 0 }}
      aria-hidden
    >
      <defs>
        <clipPath id={clip}><path d={SHIELD} /></clipPath>
        {/* Sheen only, no wash. The old gradient laid 26% black over the
            bottom half of every shield, which took the club's colour and
            greyed it - Bath's blue and Gloucester's cherry-and-white both
            arrived at the same muddy middle (user: "the colours should be
            clearer and more vivid"). A highlight in the top third reads as
            enamel without costing any saturation. */}
        <linearGradient id={gloss} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".34" />
          <stop offset=".3" stopColor="#fff" stopOpacity=".08" />
          <stop offset=".55" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".08" />
        </linearGradient>
        <linearGradient id={gold} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f0dc95" />
          <stop offset=".45" stopColor="#c9a227" />
          <stop offset="1" stopColor="#8a6a12" />
        </linearGradient>
      </defs>
      <path d={SHIELD} fill={c1} />
      <g clipPath={`url(#${clip})`}>
        <CrestField pattern={pattern} c2={c2} />
        <rect x="0" y="0" width="24" height="26" fill={`url(#${gloss})`} />
      </g>
      {/* A thinner ring and a thinner casing: between them they were eating
          4px of a 24px shield, so a third of the colour field was frame. */}
      <path d={SHIELD} fill="none" stroke="rgba(0,0,0,.34)" strokeWidth="1.8" />
      <path d={SHIELD} fill="none" stroke={`url(#${gold})`} strokeWidth="1.1" />
      <path d={SHIELD_IN} fill="none" stroke="rgba(255,255,255,.34)" strokeWidth=".55" />
      {/* The monogram asked for PT Sans Narrow, which this app never loads, so
          it fell back to whatever narrow face the phone had - one more reason
          the initials looked soft. It is the theme font now, heavier, larger,
          pure white, and outlined with a thin stroke rather than the fat one
          that was closing up the counters at 7px. */}
      <text
        x="12" y={wide ? 16.6 : 16.4} textAnchor="middle"
        fontFamily="'Space Grotesk', 'Segoe UI', sans-serif"
        fontWeight="700" fontSize={wide ? 8.6 : 12.4} letterSpacing={wide ? '-.35' : '.1'}
        fill="#ffffff" stroke="rgba(0,0,0,.55)" strokeWidth={wide ? 0.7 : 1.1}
        paintOrder="stroke"
        style={{ paintOrder: 'stroke' }}
      >{letter}</text>
    </svg>
  )
}

/** Home kit jersey rendered from the club's real pattern and colours. */
export function Jersey({ club, size = 44 }: { club: CrestClub; size?: number }) {
  const [c1, c2] = club.colors
  const pattern = kitPattern(club.id)
  const clip = `kit-${club.id}`
  const BODY = 'M14 8 L20 4 H28 L34 8 L38 14 L33 17 L32 15 V30 H16 V15 L15 17 L10 14 Z'
  return (
    <svg viewBox="0 0 48 34" width={size} height={Math.round(size * 34 / 48)} aria-hidden
      style={{ flexShrink: 0 }}>
      <defs><clipPath id={clip}><path d={BODY} /></clipPath></defs>
      <path d={BODY} fill={c1} />
      <g clipPath={`url(#${clip})`}>
        {pattern === 'hoops' && (<><rect x="8" y="12" width="32" height="4" fill={c2} /><rect x="8" y="20" width="32" height="4" fill={c2} /><rect x="8" y="28" width="32" height="4" fill={c2} /></>)}
        {pattern === 'stripes' && (<><rect x="18" y="2" width="4" height="32" fill={c2} /><rect x="26" y="2" width="4" height="32" fill={c2} /></>)}
        {pattern === 'quarters' && (<><rect x="24" y="0" width="16" height="17" fill={c2} /><rect x="8" y="17" width="16" height="17" fill={c2} /></>)}
        {pattern === 'sash' && <path d="M10 26 L38 6 L38 12 L14 30 L10 30 Z" fill={c2} />}
        {pattern === 'halves' && <rect x="24" y="0" width="16" height="34" fill={c2} />}
        {/* sleeves in the second colour for contrast */}
        <path d="M14 8 L10 14 L15 17 L17 12 Z" fill={c2} opacity=".9" />
        <path d="M34 8 L38 14 L33 17 L31 12 Z" fill={c2} opacity=".9" />
      </g>
      <path d={BODY} fill="none" stroke="rgba(0,0,0,.35)" strokeWidth="1.2" />
      <path d="M20 4 L24 8 L28 4" fill="none" stroke="#f7f3e8" strokeWidth="1.6" />
    </svg>
  )
}

/** Crest by team id - clubs get shields, nations fall back to flags. */
export function CrestT({ g, teamId, size = 16 }: { g: GameState; teamId: string; size?: number }) {
  const c = g.clubs[teamId]
  if (!c) return <span style={{ marginRight: 5 }}>{flagOf(teamId)}</span>
  return <Crest club={c} size={size} />
}

/** Colour for an attribute bar by value. */
export function attrBarColor(v: number): string {
  if (v >= 16) return 'linear-gradient(90deg, #e3b92e, #a8841a)'
  if (v >= 12) return 'linear-gradient(90deg, #3f9463, #2f7d4f)'
  if (v >= 8) return 'linear-gradient(90deg, #9aa89f, #7d8b82)'
  return 'linear-gradient(90deg, #c9beab, #b3a78f)'
}
