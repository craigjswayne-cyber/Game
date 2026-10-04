import { useStore } from '../store'
import { fmtMoney, seasonLabel } from '../game/model'
import { t } from '../game/i18n'
import { eraBuilt } from '../game/turning'
import type { Era } from '../game/arcbook'

/** WHAT DID I BUILD HERE? (1.8.4, turning.ts) One era on one card: the
 *  sentence, two lines of what it built, the men who mattered, and the few
 *  turning points. The Legacy screen shows every era; the club page shows
 *  the one in progress. The biggest win and the worst defeat are not here:
 *  The Book holds the career's, and the worst defeat of the era comes back
 *  as a turning point when it was the low point a better season followed. */
export function EraCard({ e, live }: { e: Era; live: boolean }) {
  const game = useStore(s => s.game)!
  const b = eraBuilt(game, e)
  const made = b.grads != null
    ? (b.grads > 0 ? t('arc.builtGrads', { n: b.grads }) + (b.capped ? ` (${t('arc.builtCapped', { n: b.capped })})` : '') : null)
    : (b.capped > 0 ? `${t('arc.eraIntl')} ${b.capped}` : null)
  const line1 = [
    t('arc.builtSeasons', { n: b.seasons }), t('arc.wdl', { w: b.w, d: b.d, l: b.l }),
    b.cups ? t('arc.builtCups', { n: b.cups }) : null,
    b.up ? t('arc.builtUp', { n: b.up }) : null,
    b.down ? t('arc.builtDown', { n: b.down }) : null,
  ].filter(Boolean).join(' · ')
  const line2 = [
    made,
    e.rs ? t('arc.builtFee', { fee: fmtMoney(e.rs.fee), player: e.rs.n }) : null,
    e.id ? t('arc.knownAs', { label_k: `arc.repute.${e.id}` }) : null,
  ].filter(Boolean).join(' · ')
  return (
    <div className="card era-card">
      <div className="fact-label">
        {e.cn} · {seasonLabel(e.f)}{e.t !== e.f ? ` - ${seasonLabel(e.t)}` : ''}{live ? ` · ${t('arc.eraSoFar')}` : ''}
      </div>
      <div style={{ fontWeight: 700, fontSize: 14, margin: '3px 0 4px' }}>{t(e.sk, e.sv)}</div>
      <div className="meta era-built">{line1}</div>
      {line2 && <div className="meta era-built">{line2}</div>}
      {e.gp && <div className="dash-line"><span className="dl-t">{t('arc.eraPlayer')}</span><b>{e.gp.n}</b></div>}
      {e.rv && <div className="dash-line"><span className="dl-t">{t('arc.eraRival')}</span><b>{e.rv}</b></div>}
      {b.tps.length > 0 && (
        <div className="era-turns" style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
          <div className="fact-label">{t('tp.era')}</div>
          {b.tps.map(tp => (
            <div key={tp.s} className="meta tp-row" style={{ marginTop: 3 }}>
              <b>{seasonLabel(tp.s)}</b> {t(tp.k, tp.v)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
