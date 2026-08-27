import { useStore } from '../../store'
import { seasonLabel } from '../../game/model'
import { SectionTitle } from '../components'
import { t } from '../../game/i18n'

/**
 * The Annual: the forced page between seasons (user: "when a season is
 * complete - there should be a forced page that says 'ready for a new
 * season?' Records of the last season should be backed up").
 *
 * The rollover has already done the backing up by the time this renders - the
 * honours are in the Roll of Honour, the campaign is in the Annals, the record
 * books have their new lines - so the page's job is to SAY so, show the year's
 * champions, and hold the door until the manager walks through it. The stamp
 * (game.annual) is set by the rollover and cleared only by the button below,
 * so Continue cannot wander into August by accident.
 */
export default function Annual() {
  const game = useStore(s => s.game)!
  const back = useStore(s => s.back)
  const touch = useStore(s => s.touch)
  const season = game.annual?.season ?? game.season - 1
  const honours = game.history.filter(h => h.season === season)
  const myPots = game.mgr.trophies.filter(t => t.season === season)
  const label = seasonLabel(season)

  return (
    <>
      <SectionTitle sub={t('week.annualSub')}>
        {t('week.annualTitle', { label })}
      </SectionTitle>
      {(game.licensed || game.uncapped) && (
        <div className="muted" style={{ padding: '0 16px 4px', fontSize: 12 }}>
          {game.licensed ? '🎓 ' : ''}{game.uncapped ? '🖋 ' : ''}
          {[game.licensed && t('till.stampLicensed'), game.uncapped && t('till.stampCharter')].filter(Boolean).join(' · ')}
        </div>
      )}
      <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
        <div className="meta" style={{ fontSize: 12.5 }}>
          {myPots.length > 0
            ? t('week.annualSilver', { n: myPots.length === 1 ? t('week.annualOneTrophy') : t('week.annualNTrophies', { n: myPots.length }) })
            : t('week.annualNoSilver')}
          {' '}{t('week.annualRest')}
        </div>
      </div>

      {honours.length > 0 && (
        <>
          <SectionTitle sub={t('week.annualRollSub')}>{t('week.annualRoll', { label })}</SectionTitle>
          <div className="card" style={{ padding: '6px 12px' }}>
            {honours.map((h, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 0', borderTop: i ? '1px solid var(--border)' : undefined }}>
                <span className="meta">{game.comps[h.compId]?.name ?? h.compId.toUpperCase()}</span>
                <b style={{ fontSize: 12.5, color: (game.clubs[h.champion]?.id ?? h.champion) === game.userClubId ? 'var(--info)' : undefined }}>
                  {game.clubs[h.champion]?.name ?? h.champion}
                </b>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ padding: '14px 14px 0' }}>
        <button className="btn gold block" onClick={() => {
          // the one door out: clear the stamp and pop back onto the new
          // season's Monday, which landOnNextWeek left underneath this page
          game.annual = undefined
          touch()
          back()
        }}>
          {t('week.annualStart', { label: seasonLabel(game.season) })}
        </button>
      </div>
      <div className="spacer" />
    </>
  )
}
