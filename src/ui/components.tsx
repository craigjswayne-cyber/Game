import { useState, type ReactNode } from 'react'
import type { GameState, Player } from '../game/model'
import { flagOf } from '../game/nations'
import { kitPattern, type KitPattern } from '../game/kits'


/** The brand roundel: white circle, monogram, magazine-style. */
export function BrandMark({ size = 64, inverse = false }: { size?: number; inverse?: boolean }) {
  const bg = inverse ? '#2e57ab' : '#ffffff'
  const fg = inverse ? '#ffffff' : '#2e57ab'
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden style={{ flexShrink: 0 }}>
      <circle cx="32" cy="32" r="31" fill={bg} />
      <text
        x="31" y="42.5" textAnchor="middle"
        fontFamily="'Montserrat', 'Segoe UI', sans-serif"
        fontWeight="800" fontSize="26" letterSpacing="-1"
        fill={fg}
      >RM</text>
    </svg>
  )
}

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="section-title">
      <span>{children}</span>
      {sub && <span className="sub">{sub}</span>}
    </div>
  )
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
  return (
    <span style={{ color: '#a8841a', fontSize: 11, letterSpacing: 1 }}>
      {'★'.repeat(Math.min(5, full))}{half && full < 5 ? '½' : ''}
      <span style={{ color: 'var(--star-empty, #cfc4a9)' }}>{'★'.repeat(Math.max(0, 5 - full - (half ? 1 : 0)))}</span>
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

// clubs whose real logo file is known to be missing from public/logos/
const noLogo = new Set<string>()

/**
 * Club crest. If a real logo has been dropped into public/logos/<id>.png
 * it is used; otherwise a heraldic shield is generated with the club's
 * kit pattern and colours, gold border and condensed monogram.
 */
export function Crest({ club, size = 16, mr = 6 }: { club: CrestClub; size?: number; mr?: number }) {
  const [missing, setMissing] = useState(noLogo.has(club.id))
  if (!missing) {
    return (
      <img
        src={`${import.meta.env.BASE_URL}logos/${club.id}.png`}
        width={size}
        height={Math.round((size * 26) / 24)}
        style={{ verticalAlign: '-3px', marginRight: mr, flexShrink: 0, objectFit: 'contain' }}
        onError={() => { noLogo.add(club.id); setMissing(true) }}
        alt=""
      />
    )
  }
  const pattern = kitPattern(club.id)
  const [c1, c2] = club.colors
  const letter = (club.short.match(/[A-Za-z]/)?.[0] ?? 'R').toUpperCase()
  const clip = `crest-${club.id}`
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
      </defs>
      <path d={SHIELD} fill={c1} />
      <g clipPath={`url(#${clip})`}>
        <CrestField pattern={pattern} c2={c2} />
      </g>
      <path d={SHIELD} fill="none" stroke="#c9a227" strokeWidth="1.5" />
      <text
        x="12" y="16" textAnchor="middle"
        fontFamily="'PT Sans Narrow', 'Arial Narrow', sans-serif"
        fontWeight="700" fontSize="11.5"
        fill="#f7f3e8" stroke="rgba(0,0,0,.55)" strokeWidth="1.6"
        paintOrder="stroke"
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
