import { useStore } from '../../store'
import { SectionTitle } from '../components'
import { weekDate } from '../../game/model'
import { OFFICE_OUTLET } from '../../game/media'
import { t } from '../../game/i18n'

/* THE QUESTIONS AND THE ANSWERS STAY AS THEY WERE ASKED. A press item is written
   into the save the week it is put to you, and the reaction is filed beside the
   answer you gave - a career's paperwork keeps the language it was written in
   (docs/i18n.md). Everything the screen says around them follows the reader. */

export default function Press() {
  const game = useStore(s => s.game)!
  const answer = useStore(s => s.answerPressOption)
  const go = useStore(s => s.go)

  const open = game.press.filter(p => !p.answered).reverse()
  const past = game.press.filter(p => p.answered).reverse().slice(0, 12)

  return (
    <>
      {open.length === 0 && (
        <div className="muted" style={{ padding: 14 }}>{t('world.prQuiet')}</div>
      )}
      {open.map(item => (
        <div key={item.id}>
          <div className="press-outlet">
            {item.outlet === OFFICE_OUTLET ? t('world.prOffice') : t('world.prAsks', { outlet: item.outlet })}
          </div>
          <div className="press-q">“{item.question}”</div>
          {item.playerId != null && game.players[item.playerId] && (
            <button className="muted" style={{ padding: '0 14px 8px', fontWeight: 600, color: 'var(--info)' }}
              onClick={() => go('player', item.playerId!)}>
              {t('world.prView', { player: game.players[item.playerId].name })}
            </button>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 14px 14px' }}>
            {item.options.map((o, i) => (
              <button key={i} className="btn ghost" style={{ textAlign: 'left' }}
                onClick={() => answer(item.id, i)}>
                “{o.label}”
              </button>
            ))}
          </div>
          <hr style={{ border: 'none', borderTop: '2px solid var(--border-strong)', margin: '0 14px' }} />
        </div>
      ))}
      {past.length > 0 && (
        <>
          <SectionTitle>{t('world.prRecentCoverage')}</SectionTitle>
          {past.map(item => (
            <div key={item.id} className="news-item open">
              <div className="when">{item.outlet === OFFICE_OUTLET ? t('world.prPrivate') : item.outlet} · {weekDate(item.season, item.week)}</div>
              <div className="subj" style={{ fontWeight: 400 }}>“{item.question}”</div>
              <div className="body">{t('world.prYouSaid', { answer: item.answerLabel ?? '', reaction: item.reaction ?? '' })}</div>
            </div>
          ))}
        </>
      )}
      <div className="spacer" />
    </>
  )
}
