import { useStore } from '../../store'
import { teamShort } from '../../game/matchEngine'
import { seasonLabel } from '../../game/model'
import { SectionTitle } from '../components'
import { t, compLabel } from '../../game/i18n'

// ephemeral competitions (rebuilt only in their years) vanish from the live
// registry between editions, so the roll needs its own memory of their names
const GONE_BUT_NOT_FORGOTTEN: Record<string, string> = {
  wc: 'week.compWc',
  lions: 'week.compLions',
  tour: 'week.compTour',
  aut: 'week.compAut',
  pnc: 'week.compPnc',
}

export default function History() {
  const game = useStore(s => s.game)!
  const rows = [...game.history].reverse()
  return (
    <>
      <SectionTitle sub={t('week.rollSub')}>{t('week.rollOfHonour')}</SectionTitle>
      {rows.length === 0 && (
        <div className="muted" style={{ padding: 14 }}>
          {t('week.noTrophiesYet')}
        </div>
      )}
      {/* no header over no rows (UI QA, 1.8.0): a bare SEASON / COMPETITION /
          CHAMPIONS strip under "no trophies yet" read as a table that failed
          to load, not as a roll that has not started */}
      {rows.length > 0 && <div className="tblwrap"><table className="dtable">
        <thead><tr><th>{t('profile.colSeason')}</th><th>{t('week.colCompetition')}</th><th>{t('week.colChampions')}</th></tr></thead>
        <tbody>
          {rows.map((h, i) => (
            <tr key={i}>
              <td>{seasonLabel(h.season)}</td>
              <td>{compLabel(game.comps[h.compId]?.name) ?? (GONE_BUT_NOT_FORGOTTEN[h.compId] ? t(GONE_BUT_NOT_FORGOTTEN[h.compId]) : h.compId)}</td>
              <td className="name">{teamShort(game, h.champion)}</td>
            </tr>
          ))}
        </tbody>
      </table></div>}
      <div className="spacer" />
    </>
  )
}
