// The scout report card on a player page (recruit.ts). Rows, not paragraphs:
// what the staff believe, split into what they know and what they cannot tell
// yet, never a hidden number. It grows as the scouts learn more, and its
// confidence figure is the share of his attributes it has exactly right.
import type { GameState, Player } from '../game/model'
import { scoutReport, sideStyleKeys, type Note } from '../game/recruit'
import { persName, t } from '../game/i18n'
import { rewardedAvailable } from '../game/monetise'
import { canInsideWord } from '../game/rewarded'
import { useStore } from '../store'
import { RewardedButton } from './components'

const band = (r: [number, number]) => (r[0] === r[1] ? String(r[0]) : `${r[0]}-${r[1]}`)
const noteWord = (n: Note, kind: 's' | 'c') => t(`recruit.${kind}_${n}`)

export default function ScoutReportCard({ game, p, onMsg }: { game: GameState; p: Player; onMsg?: (s: string) => void }) {
  const rewardInside = useStore(s => s.rewardInside)
  const r = scoutReport(game, p)
  const club = r.talk ? game.clubs[r.talk.clubId] : null
  const tone = (c: string) => ({ color: `var(--${c})`, fontWeight: 700 })
  const style = sideStyleKeys(game).map(k => t(k)).join(' · ')
  const rows: [string, React.ReactNode][] = [
    [t('recruit.strengths'), r.stage === 0 ? <span className="muted">{t('recruit.notSeen')}</span>
      : r.strengths.length ? r.strengths.map(n => noteWord(n, 's')).join(' · ') : <span className="muted">{t('recruit.nothing')}</span>],
    [t('recruit.concerns'), r.concerns.length ? r.concerns.map(n => noteWord(n, 'c')).join(' · ')
      : <span className="muted">{t(r.stage === 0 ? 'recruit.notSeen' : 'recruit.nothing')}</span>],
  ]
  if (r.pers) rows.push([t('recruit.personality'), <b>{persName(r.pers)}</b>])
  rows.push([t('recruit.level'), <>
    <b>{band(r.level)}</b>{' · '}{t('recruit.ceiling')}{' '}
    {r.ceiling ? <b>{band(r.ceiling)}</b> : <span className="muted">?</span>}
  </>])
  rows.push([t('recruit.upside'), <>
    {r.upside ? <b>{t(`recruit.up_${r.upside}`)}</b> : <span className="muted">?</span>}
    {' · '}{t('recruit.risk')}{' '}
    <b style={r.risk === 'high' ? tone('text-negative') : r.risk === 'low' ? tone('text-positive') : undefined}>{t(`recruit.risk_${r.risk}`)}</b>
  </>])
  if (r.fit) rows.push([t('recruit.fit'), <>
    <b style={r.fit === 'excellent' ? tone('text-positive') : r.fit === 'doubtful' ? tone('text-negative') : undefined}>{t(`recruit.fit_${r.fit}`)}</b>
    <span className="muted"> ({style})</span>
  </>])
  rows.push([t('recruit.agent'), <b style={r.agent === 'cool' ? tone('text-negative') : r.agent === 'warm' ? tone('text-positive') : undefined}>{t(`recruit.agent_${r.agent}`)}</b>])
  // THE AGENT'S INSIDE WORD (1.8.2, rewarded.ts): on the same line, never a
  // block of its own, and only where a provider exists and the ledger allows
  if (r.talk && club) rows.push([t('recruit.rival'), <>
    <span style={{ color: 'var(--gold)' }}>{t(`recruit.talk_${r.talk.read}`, { club: club.short })}</span>
    {rewardedAvailable('inside') && canInsideWord(game, p.id) && (
      <>{' '}<RewardedButton place="inside" className="btn ghost tiny spot" style={{ marginLeft: 2, verticalAlign: 'baseline' }} label={t('till.watchInside')}
        onDone={out => {
          const msg = out === 'completed' ? t(rewardInside(p.id) ? 'till.insideDone' : 'till.favourGone', { name: p.name })
            : t(out === 'skipped' ? 'till.spotSkipped' : 'till.spotUnavailable')
          onMsg?.(msg)
        }} /></>
    )}
  </>])
  return (
    <div className="card scout-report">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <span className="fact-label">{t('recruit.title')}</span>
        <span style={{ fontSize: 12, ...(r.confPct < 30 ? tone('gold') : { fontWeight: 700 }) }}>{t('recruit.confPct', { n: r.confPct })}</span>
      </div>
      <div className="muted" style={{ fontSize: 11, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>{t('recruit.known')}</div>
      {/* two columns of rows where the screen is wide enough (a landscape
          phone), one on a portrait phone: the card stays one glance tall */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '3px 16px', fontSize: 13, marginTop: 2 }}>
        {rows.map(([label, value], i) => (
          <div key={i} style={{ display: 'flex', gap: 10, minWidth: 0 }}>
            <span className="muted" style={{ flex: '0 0 96px' }}>{label}</span>
            <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{value}</span>
          </div>
        ))}
      </div>
      {r.unknown.length > 0 && (
        <div style={{ display: 'flex', gap: 10, fontSize: 13, marginTop: 6 }}>
          <span className="muted" style={{ flex: '0 0 96px' }}>{t('recruit.unknownTitle')}</span>
          <span style={{ minWidth: 0 }}>{r.unknown.map(u => t(`recruit.u_${u}`)).join(' · ')}</span>
        </div>
      )}
    </div>
  )
}
