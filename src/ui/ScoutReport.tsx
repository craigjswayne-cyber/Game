// The scout report card on a player page (recruit.ts). Rows, not paragraphs:
// a label and what the staff believe, never a hidden number. It grows as the
// scouts learn more, and it says how far to trust it.
import type { GameState, Player } from '../game/model'
import { scoutReport, type Note } from '../game/recruit'
import { persName, t } from '../game/i18n'

const band = (r: [number, number]) => (r[0] === r[1] ? String(r[0]) : `${r[0]}-${r[1]}`)
const noteWord = (n: Note, kind: 's' | 'c') => t(`recruit.${kind}_${n}`)

export default function ScoutReportCard({ game, p }: { game: GameState; p: Player }) {
  const r = scoutReport(game, p)
  const club = r.talk ? game.clubs[r.talk.clubId] : null
  const tone = (c: string) => ({ color: `var(--${c})`, fontWeight: 700 })
  const rows: [string, React.ReactNode][] = [
    [t('recruit.confidence'), <b style={r.confidence === 'low' ? tone('gold') : undefined}>{t(`recruit.conf_${r.confidence}`)}</b>],
    [t('recruit.strengths'), r.stage === 0 ? <span className="muted">{t('recruit.notSeen')}</span>
      : r.strengths.length ? r.strengths.map(n => noteWord(n, 's')).join(' · ') : <span className="muted">{t('recruit.nothing')}</span>],
    [t('recruit.concerns'), r.concerns.length ? r.concerns.map(n => noteWord(n, 'c')).join(' · ')
      : <span className="muted">{t(r.stage === 0 ? 'recruit.notSeen' : 'recruit.nothing')}</span>],
    [t('recruit.personality'), r.pers ? <b>{persName(r.pers)}</b> : <span className="muted">{t('recruit.persPending')}</span>],
    [t('recruit.level'), <b>{band(r.level)}</b>],
    [t('recruit.ceiling'), r.ceiling ? <b>{band(r.ceiling)}</b> : <span className="muted">{t('recruit.noRead')}</span>],
    [t('recruit.upside'), <>
      {r.upside ? <b>{t(`recruit.up_${r.upside}`)}</b> : <span className="muted">?</span>}
      {' · '}{t('recruit.risk')}{' '}
      <b style={r.risk === 'high' ? tone('text-negative') : r.risk === 'low' ? tone('text-positive') : undefined}>{t(`recruit.risk_${r.risk}`)}</b>
    </>],
    [t('recruit.fit'), r.fit
      ? <b style={r.fit === 'excellent' ? tone('text-positive') : r.fit === 'doubtful' ? tone('text-negative') : undefined}>{t(`recruit.fit_${r.fit}`)}</b>
      : <span className="muted">{t('recruit.notSeen')}</span>],
    [t('recruit.agent'), <b style={r.agent === 'cool' ? tone('text-negative') : r.agent === 'warm' ? tone('text-positive') : undefined}>{t(`recruit.agent_${r.agent}`)}</b>],
  ]
  if (r.talk && club) rows.push([t('recruit.rival'), <span style={{ color: 'var(--gold)' }}>{t(`recruit.talk_${r.talk.read}`, { club: club.short })}</span>])
  return (
    <div className="card scout-report">
      <div className="fact-label">{t('recruit.title')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(84px, max-content) 1fr', gap: '3px 10px', fontSize: 13, marginTop: 4 }}>
        {rows.map(([label, value], i) => (
          <div key={i} style={{ display: 'contents' }}>
            <span className="muted">{label}</span>
            <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
