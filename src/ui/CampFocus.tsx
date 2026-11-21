import { useStore } from '../store'
import { t } from '../game/i18n'
import { nationName } from '../game/nations'
import { campWindow, setCampFocus, weeksToSquad, deskNat } from '../game/country'
import { CAMP_FOCI, campFocus } from '../game/natcamp'
import { Flag } from './flags'
import { acc } from './accent'

/**
 * THE CAMP (1.9.14, natcamp.ts): the Country tab of Training & Staff, there
 * while the manager holds a national job (player feedback: "Couldn't see
 * training for my international team"). While the window is open, three
 * answers, one tap; between windows it says when the next camp opens.
 */
export function CampFocus() {
  const game = useStore(s => s.game)
  const touch = useStore(s => s.touch)
  useStore(s => s.tick)
  if (!game?.natTeam) return null
  // the tour party's camp on an Isles tour (1.9.16), not his country's
  const nat = deskNat(game) ?? game.natTeam
  const open = campWindow(game)
  const on = campFocus(game)
  return (
    <div className="card preplan" data-camp={open ? 'open' : 'closed'} style={{ ...acc('var(--primary)') }}>
      <h3><Flag code={nat} size={16} /> {t('camp.title', { nat: nationName(nat) })}</h3>
      {open ? (
        <>
          <div className="meta">{t('camp.sub')}</div>
          <div className="pp-opts" role="radiogroup" aria-label={t('camp.title', { nat: nationName(nat) })}>
            {CAMP_FOCI.map(f => (
              <button key={f} type="button" className={`pp-opt${on === f ? ' sel' : ''}`} role="radio" aria-checked={on === f} data-camp-focus={f}
                onClick={() => { setCampFocus(game, f); touch() }}>
                <b>{t(`camp.f_${f}`)}</b><small>{t(`camp.f_${f}Desc`)}</small>
              </button>
            ))}
          </div>
          <div className="meta" style={{ marginTop: 8 }}>{t(on ? 'camp.set' : 'camp.none')}</div>
        </>
      ) : (
        <div className="meta">{(() => {
          const wks = weeksToSquad(game)
          return wks == null ? t('camp.noneLeft') : t('camp.opensIn', { n: Math.max(0, wks) * 7 })
        })()}</div>
      )}
    </div>
  )
}
