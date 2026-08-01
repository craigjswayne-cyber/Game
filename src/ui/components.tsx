import type { ReactNode } from 'react'
import type { GameState, Player } from '../game/model'
import { flagOf } from '../game/nations'

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
      <span style={{ color: '#c9bfa4' }}>{'★'.repeat(Math.max(0, 5 - full - (half ? 1 : 0)))}</span>
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
