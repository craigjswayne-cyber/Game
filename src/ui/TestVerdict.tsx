import { useStore } from '../store'
import { t } from '../game/i18n'
import { nationName } from '../game/nations'
import { testConfDelta } from '../game/nattest'
import { Flag } from './flags'
import { acc } from './accent'

/**
 * A TEST'S FULL TIME (1.9.14, nattest.ts). The result, the world ranking
 * either side of it, the union's reaction, and the caps it handed out: what a
 * Test means beyond the score, which the screen used to leave to a list of
 * every other result that week.
 */
export function TestVerdict({ fxId }: { fxId: number }) {
  const game = useStore(s => s.game)
  const L = game?.natLastTest
  if (!game || !L || L.fxId !== fxId) return null
  const res = L.us > L.them ? 'win' : L.us < L.them ? 'loss' : 'draw'
  const moved = L.rankBefore && L.rankAfter ? L.rankBefore - L.rankAfter : 0
  const pts = Math.round((L.ptsAfter - L.ptsBefore) * 100) / 100
  // the union's reaction: what the settle applied, or (before it has run) the
  // same rule read now
  const delta = L.confDelta ?? (game.natConfidence != null ? testConfDelta(game, L.nat, L.opp, L.us, L.them) : null)
  const conf = L.conf ?? (game.natConfidence != null && delta != null ? Math.max(0, Math.min(100, game.natConfidence + delta)) : null)
  const name = (id: number) => game.players[id]?.name ?? '?'
  return (
    <div className="card test-verdict" data-test-verdict={res} style={{ ...acc(res === 'win' ? 'var(--text-positive)' : res === 'loss' ? 'var(--text-negative)' : 'var(--gold)') }}>
      <div className="fact-label">{t('testft.title')}</div>
      <h3 className="tv-score">
        <Flag code={L.nat} size={18} /> {nationName(L.nat)} {L.us}–{L.them} {nationName(L.opp)} <Flag code={L.opp} size={18} />
      </h3>
      <div className="tv-rows">
        {L.rankAfter > 0 && (
          <div data-tv-rank>
            <span className="muted">{t('testft.ranking')}</span>{' '}
            <b>{t('testft.rankNo', { n: L.rankAfter })}</b>{' '}
            <span className={moved > 0 ? 'up' : moved < 0 ? 'down' : 'muted'}>
              {moved > 0 ? t('testft.rankUp', { n: moved }) : moved < 0 ? t('testft.rankDown', { n: -moved }) : t('testft.rankSame')}
              {' · '}{t('testft.pts', { pts: (pts >= 0 ? '+' : '') + pts.toFixed(2) })}
            </span>
          </div>
        )}
        {conf != null && delta != null && (
          <div data-tv-union>
            <span className="muted">{t('testft.union')}</span>{' '}
            <b>{Math.round(conf)}</b>{' '}
            <span className={delta > 0 ? 'up' : delta < 0 ? 'down' : 'muted'}>({delta > 0 ? '+' : ''}{delta})</span>
          </div>
        )}
      </div>
      {L.debuts.length > 0 && (
        <div className="meta" data-tv-debuts style={{ marginTop: 6 }}>
          {t('testft.debuts', { n: L.debuts.length, names: L.debuts.map(name).join(', ') })}
        </div>
      )}
      {L.caps.map(c => (
        <div key={c.id} className="meta" data-tv-cap>{t('testft.capMilestone', { name: name(c.id), n: c.n })}</div>
      ))}
    </div>
  )
}
