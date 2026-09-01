import { useStore } from '../../store'
import { SKINS, type Skin } from '../../store'
import { SectionTitle } from '../components'
import { LANGS, getLang, t } from '../../game/i18n'

/**
 * SETTINGS. Above Report a Bug in the manager's menu, because it is the page a
 * player looks for before they conclude something is broken.
 *
 * It holds the choices that change how the game LOOKS and nothing that changes
 * how it plays - the skin, the floodlights and the language. Everything here is
 * stored on the device rather than in the save, so a career carried to another
 * phone arrives in that phone's colours and its owner's language.
 *
 * THE SWATCHES ARE THE REAL TOKENS. Each card paints itself from the same CSS
 * variables the skin ships, scoped by the skin's own class, so the preview
 * cannot drift from the theme: if a colour changes in tokens.css this page
 * changes with it, and if a skin were ever missing from tokens.css its card
 * would render unstyled and say so loudly.
 */

/** The four choices, in the order they are offered. `default` is the built-in
 *  pair the floodlight button switches between; the rest are whole palettes. */
const SKIN_KEYS: Record<Skin, { name: string; line: string }> = {
  default: { name: 'settings.skinDefault', line: 'settings.skinDefaultLine' },
  midnight: { name: 'settings.skinMidnight', line: 'settings.skinMidnightLine' },
  heritage: { name: 'settings.skinHeritage', line: 'settings.skinHeritageLine' },
  stealth: { name: 'settings.skinStealth', line: 'settings.skinStealthLine' },
}

/** A row of the colours that carry meaning, drawn in the skin being offered.
 *  Five swatches, because five is what the eye can compare at a glance: the
 *  page behind, a card on it, the button, a win and a loss. */
function Swatches({ skin }: { skin: Skin }) {
  return (
    <div className={`skin-swatches skin-${skin}`} aria-hidden="true">
      <i style={{ background: 'var(--canvas)' }} />
      <i style={{ background: 'var(--surface-1)' }} />
      <i style={{ background: 'var(--primary)' }} />
      <i style={{ background: 'var(--positive)' }} />
      <i style={{ background: 'var(--danger)' }} />
      <i style={{ background: 'var(--gold)' }} />
    </div>
  )
}

export default function Settings() {
  const skin = useStore(s => s.skin)
  const setSkin = useStore(s => s.setSkin)
  const night = useStore(s => s.night)
  const toggleNight = useStore(s => s.toggleNight)
  const lang = useStore(s => s.lang)
  const setLang = useStore(s => s.setLang)
  const textScale = useStore(s => s.textScale)
  const setTextScale = useStore(s => s.setTextScale)

  return (
    <>
      <SectionTitle sub={t('settings.sub')}>{t('settings.title')}</SectionTitle>

      {/* ---- the skins ---- */}
      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 14 }}>{t('settings.skin')}</div>
        <div className="meta" style={{ marginTop: 1 }}>{t('settings.skinLine')}</div>
      </div>
      {SKINS.map(s => (
        <button key={s} className={`card skin-card${skin === s ? ' on' : ''}`}
          aria-pressed={skin === s} onClick={() => setSkin(s)}>
          <div className="skin-card-top">
            <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{t(SKIN_KEYS[s].name)}</div>
              <div className="meta" style={{ marginTop: 1 }}>{t(SKIN_KEYS[s].line)}</div>
            </div>
            {skin === s && <span className="chip" style={{ flexShrink: 0, color: 'var(--gold)', fontWeight: 700 }}>✓</span>}
          </div>
          <Swatches skin={s} />
        </button>
      ))}

      {/* ---- floodlights: the same switch as the title bar, said in words ----
          The icon in the header is quicker once you know what it is; this is
          where somebody who does not goes looking. Only offered for the
          built-in pair, because each skin below is a dark palette in its own
          right and has no daylight twin to switch to. */}
      {skin === 'default' && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>{night ? '🌙' : '☀️'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{t('settings.floodlights')}</div>
              <div className="meta" style={{ marginTop: 1 }}>{t(night ? 'settings.floodOn' : 'settings.floodOff')}</div>
            </div>
          </div>
          <button className="btn ghost block" style={{ marginTop: 8 }} onClick={toggleNight}>
            {t(night ? 'settings.goDay' : 'settings.goNight')}
          </button>
        </div>
      )}

      {/* ---- language: the same picker as the title screen ----
          THE SELECT GETS ITS OWN LINE. Sitting it beside the label made a
          three-way fight for one row's width between an icon, a sentence and
          a native picker that will not shrink - and the sentence lost, coming
          out one word per line down the left with the picker overlapping it.
          Exactly the fault the Sugar Daddy row had. Stacked, every language
          name fits at every type size, in all five languages. */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>🌐</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{t('menu.language')}</div>
            <div className="meta" style={{ marginTop: 1 }}>{t('settings.langLine')}</div>
          </div>
        </div>
        <select className="inline-input lang-select" value={lang} aria-label={t('menu.language')}
          style={{ width: '100%', marginTop: 8, fontSize: 13, padding: '6px 10px', lineHeight: 1.2 }}
          onChange={ev => setLang(ev.target.value as typeof lang)}>
          {LANGS.map(l => <option key={l.code} value={l.code} lang={l.code}>{l.label}</option>)}
        </select>
      </div>

      {/* ---- type size: three steps, the same ones the title screen offers ---- */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>🔠</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{t('settings.textSize')}</div>
            <div className="meta" style={{ marginTop: 1 }}>{t('settings.textSizeLine')}</div>
          </div>
        </div>
        <div className="btn-row" style={{ marginTop: 8 }}>
          {[1, 1.15, 1.3].map(v => (
            <button key={v} className={`btn ${textScale === v ? 'gold' : 'ghost'}`}
              style={{ flex: 1 }} aria-pressed={textScale === v}
              onClick={() => setTextScale(v)}>
              {t(v === 1 ? 'settings.textNormal' : v === 1.15 ? 'settings.textBigger' : 'settings.textBiggest')}
            </button>
          ))}
        </div>
      </div>

      <div className="muted" style={{ padding: '10px 16px', fontSize: 12 }}>
        {t('settings.fineprint', { lang: LANGS.find(l => l.code === getLang())?.label ?? '' })}
      </div>
      <div className="spacer" />
    </>
  )
}
