import { useStore } from '../../store'
import { seasonLabel } from '../../game/model'
import { SectionTitle } from '../components'

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
      <SectionTitle sub="the season is filed - honours, annals and record books all written up">
        The {label} Annual
      </SectionTitle>
      <div className="card" style={{ borderLeft: '4px solid var(--gold, #c9a227)' }}>
        <div className="meta" style={{ fontSize: 12.5 }}>
          {myPots.length > 0
            ? `A season with silverware in it: ${myPots.length === 1 ? 'one trophy' : `${myPots.length} trophies`} went in your cabinet, and the club will talk about it for years.`
            : 'No silverware this time, but every match, record and ledger from the campaign is safely on the books.'}
          {' '}The full story is in the Roll of Honour and your Annals on the Manager Legacy screen, where it will stay for the rest of the career.
        </div>
      </div>

      {honours.length > 0 && (
        <>
          <SectionTitle sub="who took what">Roll of Honour, {label}</SectionTitle>
          <div className="card" style={{ padding: '6px 12px' }}>
            {honours.map((h, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 0', borderTop: i ? '1px solid var(--hairline)' : undefined }}>
                <span className="meta">{game.comps[h.compId]?.name ?? h.compId.toUpperCase()}</span>
                <b style={{ fontSize: 12.5, color: (game.clubs[h.champion]?.id ?? h.champion) === game.userClubId ? 'var(--accent-ink)' : undefined }}>
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
          Ready for a new season? Start {seasonLabel(game.season)} ▸
        </button>
      </div>
      <div className="spacer" />
    </>
  )
}
