import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import { listSaves, loadGame, deleteSave, type SaveMeta } from '../../game/save'
import { seasonLabel } from '../../game/model'
import { LANGS, t } from '../../game/i18n'
import { BrandMark } from '../components'
import { dismiss, dismissed, isAndroidShell } from '../../game/shell'

export default function Menu() {
  const go = useStore(s => s.go)
  const setNewGender = useStore(s => s.setNewGender)
  const newGender = useStore(s => s.newGender)
  const setGame = useStore(s => s.setGame)
  const lang = useStore(s => s.lang)
  const supporter = useStore(s => s.supporter)
  const setLang = useStore(s => s.setLang)
  const [saves, setSaves] = useState<SaveMeta[]>([])
  const [showLoad, setShowLoad] = useState(false)

  useEffect(() => { void listSaves().then(setSaves) }, [])

  const load = async (slot: string, keepPlace = false) => {
    const g = await loadGame(slot)
    if (g) setGame(g, slot, keepPlace)
  }

  return (
    <div className="title-screen">
      <BrandMark size={60} />
      <hr className="rules" />
      <h1><b>PHASE</b><br />RUGBY MANAGER</h1>
      {/* set in caps at the user's request, so it reads as a strapline under the
          title rather than as a sentence someone left there */}
      <div className="tagline">{t('menu.tagline')}</div>
      {/* the release under the strapline reads from the same build stamp as the
          footer (vite.config.ts defines it from package.json), so the version
          on the tin can never drift from the version in the box */}
      <div className="muted" style={{ marginTop: 10, letterSpacing: 1 }}>{__BUILD_TAG__.split(' ')[0]}</div>
      <hr className="rules" />
      <div className="menu-btns">
        {(() => {
          // One tap back into the most recent save, landing on the screen it was
          // left on. Opening the game asks this question rather than answering it:
          // for a while the app honoured the same bookmark automatically on a cold
          // start, which skipped the title screen entirely and made this tile
          // unreachable. A refresh still resumes in place - see store.resume.
          const newest = [...saves].sort((a, b) => b.savedAt - a.savedAt)[0]
          if (!newest) return null
          return (
            <button className="btn gold continue-tile" onClick={() => void load(newest.slot, true)}>
              {/* one line, always: the longest club name in the game is
                  "Montpellier Hérault Rugby" and a manager can be called
                  anything, so the line ellipsises rather than wrapping */}
              <div className="ct-line">{t('menu.continue', { manager: newest.managerName, club: newest.club })}</div>
              <div className="ct-sub">{t('menu.savedAt', { season: seasonLabel(newest.season), week: newest.week })}</div>
            </button>
          )
        })()}
        {/* WHICH GAME (v1.5, rebuilt in v1.5.2). The owner: "IT SHOULD BE A
            SELECTION ON THE MAIN PAGE AND YOU CAN ONLY COACH IN MENS TEAM OR A
            WOMENS TEAM AT ONE TIME." It is asked here rather than inside the
            wizard because it is not a setting inside a career, it is which
            career you are starting: a save holds one game and cannot change
            (src/game/gender.ts), and the club list on the wizard's first
            screen already has to know the answer.

            v1.5 asked it as two doors, "New Career" above "Women's Game", on
            the reasoning that two doors cannot be got wrong. What that shape
            actually said was that one game is the game and the other is an
            afterthought hanging off the bottom of it (owner, v1.5.2: "new
            career is right but womens underneath feels wrong ... how do we
            incorporate it so its a choice like languages"). So the two games
            are one segmented control now, side by side and the same size as
            each other, and the single New Career button under it starts
            whichever one is lit. The hint line stays: the control says which
            game, and the line says why the choice is worth caring about.

            The men's button keeps the exact words "New Career". Fifty-two
            browser harnesses click text=New Career to start a game, and
            Playwright matches that as a SUBSTRING, so no other element on this
            screen may contain that phrase - scripts/womensui.ts counts the
            matches and fails at two. The segments say "Men's Game" and
            "Women's Game", which is also why the women's segment keeps its
            .new-career-w class: the harness picks it by class, because
            text="Women's Game" would match the hint line as well. */}
        <div className="new-career-pick">
          <div className="game-pick" role="radiogroup" aria-label={t('menu.whichGame')}>
            {(['m', 'w'] as const).map(g => (
              <button key={g} type="button" role="radio" aria-checked={newGender === g}
                className={`${g === 'w' ? 'new-career-w' : 'new-career-m'}${newGender === g ? ' sel' : ''}`}
                onClick={() => setNewGender(g)}>
                {t(g === 'w' ? 'menu.newCareerWomen' : 'menu.newCareerMen')}
              </button>
            ))}
          </div>
          <button className={saves.length ? 'btn ghost' : 'btn gold'}
            style={saves.length ? { color: 'var(--text-primary)', borderColor: 'var(--border-strong)', fontSize: 15 } : { fontSize: 16, padding: '13px' }}
            onClick={() => go('newgame')}>
            {t('menu.newCareer')}
          </button>
          <div className="meta new-career-hint">{t('menu.newCareerHint')}</div>
        </div>
        {saves.length > 0 && (
          <button className="btn ghost" style={{ color: 'var(--text-primary)', borderColor: 'var(--border-strong)', fontSize: 15 }}
            onClick={() => setShowLoad(!showLoad)}>
            {t('menu.loadCareer')}
          </button>
        )}
        {/* FIRST RUN OF THE NEW PLAY APP (v1.2.9): a player who backed up in
            the old one needs to find Import before they start a fresh career
            and lose heart. Only in the Android shell, only with nothing saved,
            and only until it is put away. */}
        {isAndroidShell() && saves.length === 0 && !dismissed('rm-import-hint') && (
          <div className="card" style={{ borderLeft: '4px solid var(--gold)', textAlign: 'left' }}>
            <div className="fact-label">{t('menu.importHintTitle')}</div>
            <div className="meta" style={{ marginTop: 3 }}>{t('menu.importHintBody')}</div>
            <div className="btn-row" style={{ margin: '10px 0 0' }}>
              <button className="btn ghost" onClick={() => { dismiss('rm-import-hint'); setSaves([...saves]) }}>{t('menu.importHintNo')}</button>
              <button className="btn gold" style={{ flex: 1.6 }} onClick={() => go('saves')}>{t('menu.importHintGo')}</button>
            </div>
          </div>
        )}
        {showLoad && saves.map(s => (
          <div key={s.slot} style={{ display: 'flex', gap: 6 }}>
            <button className="btn" style={{ flex: 1, background: 'var(--surface-3)' }} onClick={() => void load(s.slot)}>
              {s.managerName} - {s.club}
              <div style={{ fontSize: 11, opacity: .8 }}>{t('menu.savedAt', { season: seasonLabel(s.season), week: s.week })}</div>
            </button>
            <button className="btn danger" style={{ padding: '0 12px' }}
              onClick={() => void deleteSave(s.slot).then(() => listSaves().then(setSaves))}>✕</button>
          </div>
        ))}
      </div>
      {/* Language stays on the title screen so it can be answered BEFORE a
          career exists - a French speaker should never have to start one in
          English to find the switch. Text size used to sit above it and no
          longer does: Settings owns that now, and one control in two places
          is one place too many (owner, v1.2.3: "remove text size from the
          main menu now we have it in settings"). Language is the exception
          because Settings is unreachable until a career is running.

          The labels are written in their own language ("Français", not
          "French"): somebody hunting for their language is scanning for the
          word they would use for it. */}
      <div className="lang-row" style={{ marginTop: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <span className="muted" style={{ fontSize: 12, letterSpacing: 1 }}>{t('menu.language')}</span>
        {/* a dropdown, not a button row (owner, v1.2.0: "languages to be a
            drop down menu"): five names no longer fit across a phone, and a
            native select is the one control every platform renders well at
            the bottom of a title screen. Each option keeps its own lang
            attribute so a screen reader pronounces Français in French and
            日本語 in Japanese. */}
        <select className="inline-input lang-select" value={lang}
          aria-label={t('menu.language')}
          style={{ fontSize: 13, padding: '4px 10px', lineHeight: 1.2 }}
          onChange={ev => setLang(ev.target.value as typeof lang)}>
          {LANGS.map(l => (
            <option key={l.code} value={l.code} lang={l.code}>{l.label}</option>
          ))}
        </select>
      </div>
      {/* The mark somebody paid for. It is deliberately the whole of what the
          purchase shows: a line on the screen they see most, and nothing
          anywhere that another player could be measured against. */}
      {supporter && (
        <div className="supporter-mark" style={{ marginTop: 18 }}>★ {t('supporter.badge')}</div>
      )}
      <div style={{ marginTop: 22, fontSize: 11, opacity: .65 }}>
        {t('menu.disclaimer')}
      </div>
      {/* WHICH BUILD IS THIS? Two phones, two people, and no way to tell a stale
          tab from a fresh deploy except by hunting for a feature. Stamped in at
          build time by vite.config.ts, and deliberately the quietest thing on
          the screen. */}
      <div className="build-tag">{__BUILD_TAG__}</div>
    </div>
  )
}
