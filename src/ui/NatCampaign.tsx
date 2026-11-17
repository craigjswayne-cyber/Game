import { useStore } from '../store'
import { t, compLabel } from '../game/i18n'
import { nationName } from '../game/nations'
import { NAT_SQUAD_FLOOR, natEligible } from '../game/country'
import { announceSquad, answerCampEvent, canAnnounce, natWinNow, type CampAnswer } from '../game/natwin'
import { teamShort } from '../game/matchEngine'
import { weekDate } from '../game/model'
import { Veil } from './Veil'
import { SectionTitle } from './components'
import { acc } from './accent'

const ANSWERS: Record<string, CampAnswer[]> = { rest: ['a', 'b'], curfew: ['a', 'b', 'c'], scare: ['a', 'b'], bolter: ['a', 'b'] }

/**
 * THE WINDOW, AS A CAMPAIGN (1.9.14, natwin.ts). One card at the head of the
 * national squad, on Club & Country and behind the Team screen's Country
 * switch: where the window has got to, what the union wants from it, the
 * announcement, the camp's one event, and the review when it closes.
 */
export function NatCampaign() {
  const game = useStore(s => s.game)!
  const touch = useStore(s => s.touch)
  const { persist } = useStore.getState()
  useStore(s => s.tick)
  const w = natWinNow(game)
  if (!game.natTeam || !w) return null
  const nat = w.nat
  const named = (game.natSquads[nat] ?? []).length
  const played = w.w + w.d + w.l
  const steps: { k: string; done: boolean; now: boolean }[] = [
    { k: 'stepCamp', done: true, now: false },
    { k: 'stepSquad', done: named >= NAT_SQUAD_FLOOR, now: named < NAT_SQUAD_FLOOR },
    { k: 'stepAnnounce', done: w.announced, now: named >= NAT_SQUAD_FLOOR && !w.announced },
    { k: 'stepTests', done: w.tests > 0 && played >= w.tests, now: w.announced && played < w.tests },
    { k: 'stepReview', done: !!w.review, now: !w.review && w.tests > 0 && played >= w.tests },
  ]
  const ev = w.event
  const p = ev ? game.players[ev.playerId] : null
  const evVars = { name: p?.name ?? '', club: p?.clubId ? teamShort(game, p.clubId) : '' }
  const save = () => { void persist(); touch() }
  return (
    <>
      <div className="card nat-campaign" data-nat-campaign style={{ ...acc('var(--gold)') }}>
        <div className="fact-label">{compLabel(game.comps[w.comp]?.name) ?? t('natwin.title')} · {weekDate(game.season, w.start).slice(0, -5)}</div>
        <ol className="nc-steps" aria-label={t('natwin.title')}>
          {steps.map(s => (
            <li key={s.k} className={s.done ? 'done' : s.now ? 'now' : ''} data-step={s.k}>
              <span className="nc-dot" aria-hidden="true">{s.done ? '✓' : ''}</span>
              <span>{t(`natwin.${s.k}`)}</span>
            </li>
          ))}
        </ol>
        {w.tests > 0 && (
          <div className="nc-target" data-nc-target>
            <b>{t('natwin.target', { target: w.target, tests: w.tests })}</b>
            <span className="meta"> {t('natwin.progress', { w: w.w, d: w.d, l: w.l })}</span>
          </div>
        )}
        {canAnnounce(game, NAT_SQUAD_FLOOR) && (
          <button type="button" className="btn gold block" data-nc-announce style={{ marginTop: 10 }}
            onClick={() => { announceSquad(game, natEligible(game).slice(0, 12)); save() }}>
            {t('natwin.announce')}
          </button>
        )}
        {!w.announced && named < NAT_SQUAD_FLOOR && (
          <div className="meta" style={{ marginTop: 6 }}>{t('natwin.nameFirst', { floor: NAT_SQUAD_FLOOR })}</div>
        )}
        {w.announced && w.reveal && (
          <button type="button" className="btn ghost tiny" style={{ marginTop: 6 }}
            onClick={() => { w.reveal!.seen = false; touch() }}>{t('natwin.revealAgain')}</button>
        )}
      </div>

      {ev && p && (
        <div className="card nat-event" data-nc-event={ev.kind} style={{ ...acc('var(--info)') }}>
          <div className="fact-label">{t('natwin.eventTitle')}</div>
          <div style={{ margin: '4px 0 8px' }}>{t(`natwin.ev_${ev.kind}`, evVars)}</div>
          {ev.answer ? (
            <div className="meta" data-nc-answered>{t(`natwin.ev_${ev.kind}_${ev.answer}_done`, evVars)}</div>
          ) : (
            <div className="nc-answers">
              {ANSWERS[ev.kind].map(a => (
                <button key={a} type="button" className="btn ghost" data-nc-answer={a}
                  onClick={() => { if (answerCampEvent(game, a, NAT_SQUAD_FLOOR)) save() }}>
                  {t(`natwin.ev_${ev.kind}_${a}`, evVars)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {w.review && !w.review.seen && (
        <div className="card nat-review" data-nc-review={w.review.met ? 'met' : 'missed'}
          style={{ ...acc(w.review.met ? 'var(--text-positive)' : 'var(--text-negative)') }}>
          <div className="fact-label">{t('natwin.reviewTitle')}</div>
          <h3 style={{ margin: '4px 0' }}>{t(w.review.met ? 'natwin.reviewMet' : 'natwin.reviewMissed')}</h3>
          <div className="meta">{t('natwin.progress', { w: w.w, d: w.d, l: w.l })} {t('natwin.target', { target: w.target, tests: w.tests })}</div>
          <div className="meta">{t('natwin.reviewConf', { delta: (w.review.delta > 0 ? '+' : '') + w.review.delta, conf: w.review.conf })}</div>
          {w.review.broken && <div className="meta">{t('natwin.reviewBroken')}</div>}
          {w.review.warned && <div className="meta" style={{ color: 'var(--text-negative)', fontWeight: 700 }}>{t('natwin.reviewWarned')}</div>}
          <button type="button" className="btn ghost tiny" style={{ marginTop: 6 }}
            onClick={() => { w.review!.seen = true; save() }}>{t('natwin.gotIt')}</button>
        </div>
      )}

      {w.reveal && !w.reveal.seen && (
        <Veil onClose={() => { w.reveal!.seen = true; save() }}>
          <div className="grab" />
          <div className="nc-reveal" data-nc-reveal={w.reveal.tone}>
            <SectionTitle sub={t(`natwin.tone_${w.reveal.tone}`)}>{t('natwin.revealTitle', { nat: nationName(nat) })}</SectionTitle>
            {(['debuts', 'recalls', 'omitted'] as const).map(k => (
              <div key={k} className="nc-reveal-row">
                <div className="fact-label">{t(`natwin.reveal_${k}`)}</div>
                <div className="meta">{w.reveal![k].length ? w.reveal![k].map(id => game.players[id]?.name ?? '?').join(', ') : t('natwin.none')}</div>
              </div>
            ))}
            <button type="button" className="btn gold block" style={{ marginTop: 12 }}
              onClick={() => { w.reveal!.seen = true; save() }}>{t('natwin.revealDone')}</button>
          </div>
        </Veil>
      )}
    </>
  )
}
