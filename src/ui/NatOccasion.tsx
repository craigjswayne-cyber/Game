import { useStore } from '../store'
import { t } from '../game/i18n'
import { nationName } from '../game/nations'
import { natKit } from '../game/natcolours'
import { natRankOrder } from '../game/natrank'
import { eraOf } from '../game/nattest'
import { termLines } from '../game/natera'
import { Flag } from './flags'
import { acc } from './accent'

/**
 * THE NATION'S COLOURS (1.9.14). Every national screen opens under a band in
 * the nation's two colours with its flag and the coach's title: the country
 * job looks like the country, not like the club with a flag on. The band is
 * decoration over the page's own surface, so the words keep its contrast.
 */
export function NatBand({ nat, sub }: { nat: string; sub?: string }) {
  const kit = natKit(nat) ?? ['#ffffff', '#1d2a5d']
  return (
    <div className="nat-band" data-nat-band={nat} style={{ ['--nb-a' as string]: kit[0], ['--nb-b' as string]: kit[1] }}>
      <div className="nb-stripe" aria-hidden="true" />
      <div className="nb-row">
        <Flag code={nat} size={22} />
        <div>
          <b>{nationName(nat)}</b>
          {sub && <div className="meta">{sub}</div>}
        </div>
      </div>
    </div>
  )
}

/**
 * THE UNVEILING. Taking a national job was a letter in the inbox; now the
 * union unveils its new head coach, says the three things it will judge the
 * tenure on, and (where there is a club as well) asks the one question the
 * job brings: do you carry on there.
 */
export function NatUnveiling() {
  const game = useStore(s => s.game)
  const touch = useStore(s => s.touch)
  const answerNatKeep = useStore(s => s.answerNatKeep)
  useStore(s => s.tick)
  const u = game?.natUnveil
  if (!game || !u || !game.natTeam || u.nat !== game.natTeam) return null
  const nat = game.natTeam
  const club = game.unemployed ? null : game.clubs[game.userClubId]
  const asking = !!(game.natKeepAsk && club)
  const rank = natRankOrder(game).indexOf(nat) + 1
  const close = () => { game.natUnveil = null; touch() }
  return (
    <div className="nat-unveil" role="dialog" aria-modal="true" aria-label={t('natera.unveilTitle', { nat: nationName(nat), g: game.mgrGender ?? 'm' })} data-nat-unveil>
      <NatBand nat={nat} sub={rank > 0 ? t('natera.worldNo', { n: rank }) : undefined} />
      <div className="nu-body">
        <div className="fact-label">{t('natera.unveilKicker')}</div>
        <h1>{t('natera.unveilTitle', { nat: nationName(nat), g: game.mgrGender ?? 'm' })}</h1>
        <p>{t('natera.unveilLine', { manager: game.managerName, nat: nationName(nat), g: game.mgrGender ?? 'm' })}</p>
        <div className="card nu-terms" style={{ ...acc('var(--gold)') }}>
          <div className="fact-label">{t('natera.termsTitle')}</div>
          <ol>
            {termLines(game).map(l => <li key={l.k}>{t(l.k, l.v)}</li>)}
          </ol>
          <div className="meta">{t('natera.termsSub')}</div>
        </div>
        {asking && club && (
          <div className="card">
            <b>{t('profile.natKeepAskTitle', { nat: nationName(nat) })}</b>
            <div className="meta">{t('profile.natKeepAskBody', { nat: nationName(nat), club: club.short })}</div>
            <div className="btn-row" style={{ marginTop: 10 }}>
              <button className="btn danger" onClick={() => { answerNatKeep(false); close() }}>{t('profile.natResignClub')}</button>
              <button className="btn gold" style={{ flex: 1.3 }} onClick={() => { answerNatKeep(true); close() }}>{t('profile.natKeepBoth')}</button>
            </div>
          </div>
        )}
      </div>
      {!asking && (
        <button type="button" className="btn gold block nu-go" data-nu-go onClick={close}>{t('natera.unveilGo')}</button>
      )}
    </div>
  )
}

/** THE ERA: this tenure's Tests, best ranking, first caps, titles, and the
 *  union's three terms with where each stands. */
export function NatEraCard() {
  const game = useStore(s => s.game)!
  useStore(s => s.tick)
  const nat = game.natTeam
  if (!nat) return null
  const rec = game.natRecord ?? { m: 0, w: 0, d: 0, l: 0 }
  const era = eraOf(game)
  const since = game.natTerm?.nat === nat ? game.natTerm.since : null
  const titles = game.mgr.trophies.filter(tr => game.comps[tr.compId]?.type === 'intl' && (since == null || tr.season >= since) &&
    game.comps[tr.compId]?.champion === nat).length
  const pct = rec.m ? Math.round((rec.w / rec.m) * 100) : 0
  return (
    <div className="card nat-era" data-nat-era style={{ ...acc('var(--gold)') }}>
      <div className="fact-label">{t('natera.eraTitle')}</div>
      <div className="ne-grid">
        <div><b>{rec.m}</b><span>{t('natera.eraTests')}</span></div>
        <div><b>{pct}%</b><span>{t('natera.eraWon')}</span></div>
        <div><b>{era?.bestRank ? `#${era.bestRank}` : '-'}</b><span>{t('natera.eraBest')}</span></div>
        <div><b>{era?.debuts.length ?? 0}</b><span>{t('natera.eraCaps')}</span></div>
        <div><b>{titles}</b><span>{t('natera.eraTitles')}</span></div>
      </div>
      <div className="fact-label" style={{ marginTop: 10 }}>{t('natera.termsTitle')}</div>
      <ul className="ne-terms">
        {termLines(game).map(l => (
          <li key={l.k} className={l.done ? 'done' : ''} data-term-done={l.done ? '1' : '0'}>
            <span aria-hidden="true">{l.done ? '✓' : '○'}</span> {t(l.k, l.v)}
          </li>
        ))}
      </ul>
    </div>
  )
}
