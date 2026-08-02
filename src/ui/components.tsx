import type { ReactNode } from 'react'
import type { GameState, Player } from '../game/model'
import { flagOf } from '../game/nations'
import { hashString } from '../game/rng'

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

/**
 * Deterministic heraldic crest for a club: shield in club colours with a
 * field pattern chosen from the club id (halves, sash, chief, chevron,
 * quarters), gold border and a condensed monogram.
 */
export function Crest({ club, size = 16, mr = 6 }: { club: CrestClub; size?: number; mr?: number }) {
  const v = hashString(club.id) % 5
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
        {v === 0 && <rect x="12" y="0" width="12" height="26" fill={c2} />}
        {v === 1 && <path d="M-2 21 L26 7 L26 13 L-2 27 Z" fill={c2} />}
        {v === 2 && <rect x="0" y="0" width="24" height="8" fill={c2} />}
        {v === 3 && <path d="M0 10 L12 16 L24 10 L24 15 L12 21 L0 15 Z" fill={c2} />}
        {v === 4 && (<><rect x="12" y="0" width="12" height="13" fill={c2} /><rect x="0" y="13" width="12" height="13" fill={c2} /></>)}
      </g>
      <path d={SHIELD} fill="none" stroke="#c9a227" strokeWidth="1.5" />
      <text
        x="12" y="16" textAnchor="middle"
        fontFamily="'Barlow Condensed', 'Arial Narrow', sans-serif"
        fontWeight="700" fontSize="11.5"
        fill="#f7f3e8" stroke="rgba(0,0,0,.55)" strokeWidth="1.6"
        paintOrder="stroke"
      >{letter}</text>
    </svg>
  )
}

/** Crest by team id — clubs get shields, nations fall back to flags. */
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
