import { useState } from 'react'
import { useStore } from '../../store'
import { clubCode, fmtMoney } from '../../game/model'
import type { GameState } from '../../game/model'
import { agencyKids, agencySeniors } from '../../game/agency'
import { seenValue } from '../../game/scout'
import { ClubLink, CrestT, Nat, PosBadge, SectionTitle } from '../components'
import { t } from '../../game/i18n'

/** The Scouting Agency: monthly world rankings, FM-style. */
/** What the movement arrows are measured from.
 *
 *  These tables are the CURRENT standings, recomputed every week; the snapshot
 *  behind the arrows only republishes every four (season.ts). Saying "since
 *  last month" while showing today's order is how the two ended up reading as
 *  out of sync, so the screen now names the week it is comparing against. */
export function sinceLine(game: GameState): string {
  const at = game.agency?.at
  if (!at) return t('world.agFirstList')
  const same = at.season === game.season
  return t(same ? 'world.agSinceThis' : 'world.agSinceLast', { week: at.week })
}

/** THE MOVEMENT CELL SAYS HOW FAR, OR NOTHING (1.8.1, UI sweep: "the
 *  movement column is mostly a lone dot"). Values and ratings move slowly, the
 *  snapshot only republishes every four weeks, so most rows hold their place
 *  and the column was a stripe of grey dots that said nothing, while the few
 *  rows that did move said only which way. A mover now shows how many places
 *  it climbed or fell, and a row that held still is left blank, so the eye
 *  goes straight to the ones that changed. With no earlier list to compare
 *  against (a first list) nothing is marked at all, rather than every row
 *  claiming to be a new entry. */
export function MoveCell({ from, to, compared }: { from: number; to: number; compared: boolean }) {
  let mark: React.ReactNode = null
  if (compared && from < 0) mark = <span style={{ color: 'var(--info)' }}>★</span>
  else if (compared && from > to) mark = <span style={{ color: 'var(--text-positive)' }}>▲{from - to}</span>
  else if (compared && from >= 0 && from < to) mark = <span style={{ color: 'var(--text-negative)' }}>▼{to - from}</span>
  return <td className="rk-move" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{mark}</td>
}

export default function Agency() {
  const game = useStore(s => s.game)!
  const go = useStore(s => s.go)
  const [tab, setTab] = useState<'seniors' | 'kids'>('seniors')

  const list = tab === 'seniors' ? agencySeniors(game) : agencyKids(game)
  const prev = tab === 'seniors' ? (game.agency?.seniors ?? []) : (game.agency?.kids ?? [])

  return (
    <>
      <div className="tab-bar">
        <button className={tab === 'seniors' ? 'active' : ''} onClick={() => setTab('seniors')}>{t('world.agWorldRankings')}</button>
        <button className={tab === 'kids' ? 'active' : ''} onClick={() => setTab('kids')}>{t('world.agWonderkids')}</button>
      </div>
      <SectionTitle sub={t(tab === 'seniors' ? 'world.agSeniorSub' : 'world.agKidSub')}>
        {t(tab === 'seniors' ? 'world.agSeniorTitle' : 'world.agKidTitle')}
      </SectionTitle>
      <div className="tblwrap"><table className="dtable ranks">
        {/* No High column. It shadowed the rank number one cell to its left and
            cost the width that pushed Club off a portrait screen (user: "we dont
            want a high column"). The movement arrow already tells the story. */}
        <thead><tr><th>{t('tables.colRank')}</th><th></th><th>{t('squad.colName')}</th><th>{t('squad.colPos')}</th><th></th><th>{t('transfers.colClub')}</th><th className="num">{t('squad.colValue')}</th></tr></thead>
        <tbody>
          {list.map((p, i) => {
            const prevIdx = prev.indexOf(p.id)
            const mine = p.clubId === game.userClubId
            return (
              <tr key={p.id} onClick={() => go('player', p.id)}
                style={mine ? { background: 'color-mix(in srgb, var(--gold) 14%, transparent)' } : undefined}>
                <td className="num" style={{ fontWeight: 700 }}>{i + 1}</td>
                <MoveCell from={prevIdx} to={i} compared={prev.length > 0} />
                <td className="name" style={mine ? { fontWeight: 800 } : undefined}>
                  {p.name}{tab === 'kids' ? ` (${p.age})` : ''}
                </td>
                <td><PosBadge pos={p.pos} /></td>
                <td><Nat code={p.nat} /></td>
                {/* THREE LETTERS, NOT ELEVEN (owner, v1.1.17: "make the teams
                    initials or first three letters of their name be used to
                    give space so you dont have to scroll right at all").
                    clubCode is the same code the crest beside it draws and the
                    touchline paints, so the badge and the text agree. */}
                <td className="muted"><CrestT g={game} teamId={p.clubId!} size={15} /><ClubLink g={game} clubId={p.clubId}>{clubCode(game.clubs[p.clubId!]?.short ?? '')}</ClubLink></td>
                <td className="num">{fmtMoney(seenValue(game, p))}</td>
              </tr>
            )
          })}
        </tbody>
      </table></div>
      <div className="meta" style={{ padding: '4px 16px', fontSize: 12 }}>
        {sinceLine(game)}{t('world.agFoot')}
      </div>
      <div className="spacer" />
    </>
  )
}
