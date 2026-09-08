import { useStore } from '../../store'
import { SectionTitle } from '../components'
import { DEV_CONTACT } from '../../game/bugreport'
import { adBridgePresent, billingBridgePresent, tillOpen } from '../../game/monetise'
import { nativePlatform } from '../../game/shell'
import { t } from '../../game/i18n'

/**
 * About and legal: the page a store reviewer looks for, and the page a player
 * ends up on when they want to know who made this and what it does with their
 * data.
 *
 * Four things live here because they have nowhere better to be, and because
 * having them SOMEWHERE reachable is the difference between a listing that
 * passes review and one that comes back:
 *
 *   the build, so a bug report can name it;
 *   the privacy policy, one tap away rather than only on a store page - it
 *     ships in public/ and is served from this same origin, so reading it costs
 *     no request to anybody else and works on a plane;
 *   what the game is not - unofficial, unaffiliated, no badges, real names used
 *     for identification and nothing else;
 *   the way to say something to a human, which is the same address the bug
 *     report screen uses.
 */
export default function About() {
  const platform = nativePlatform()
  const storeOn = billingBridgePresent()
  const adsOn = adBridgePresent()
  const go = useStore(s => s.go)

  return (
    <>
      <SectionTitle sub={t('about.sub')}>{t('about.title')}</SectionTitle>

      <div className="card">
        <div className="fact-label">{t('about.buildLabel')}</div>
        <div className="meta">{__BUILD_TAG__}</div>
      </div>

      <div className="card">
        <div className="fact-label">{t('about.unofficialLabel')}</div>
        <div className="meta">{t('about.unofficialBody')}</div>
      </div>

      <div className="card">
        <div className="fact-label">{t('about.privacyLabel')}</div>
        <div className="meta">{t('about.privacyBody')}</div>
        {/* same origin, shipped in public/: no request to anybody else, and it
            opens offline once the app has been opened once */}
        <a className="btn ghost block" style={{ marginTop: 8 }} href="./privacy.html" target="_blank" rel="noreferrer">
          {t('about.privacyBtn')}
        </a>
      </div>

      {/* one card, one line, one door (v1.1.4: the store speaks for itself) */}
      {tillOpen() && (
        <div className="card">
          <div className="fact-label">{t('about.storeLabel')}</div>
          <div className="meta">{t('about.storeBody')}</div>
          <button className="btn gold block" style={{ marginTop: 8 }} onClick={() => go('supporter')}>
            {t('about.storeBtn')}
          </button>
        </div>
      )}

      {/* ---- WHAT THE SHELL BROUGHT WITH IT ----
          Reported from a phone: "the store on iPhone doesn't seem to be
          working" and "ads aren't showing". Both come from the app AROUND the
          game - StoreKit or Play Billing for one, AdMob for the other - and
          both are injected by the native shell at boot. When the shell is
          built without them the game sees nothing and, until now, said
          nothing: the store row simply did not render and the adverts simply
          did not appear, with no way to tell a missing bridge from a working
          one that had nothing to show. The packaging walkthrough even warns
          about it - "if PhaseBilling.m is not in the target, the purchase
          bridge is invisible to the game and every product reads unavailable,
          with no error anywhere to tell you why".
          This is that error. Inside a native shell only, because in a browser
          neither is expected and saying so would read as a fault. */}
      {platform && (
        <div className="card">
          <div className="fact-label">{t('about.bridgeLabel')}</div>
          <div className="meta">{t('about.bridgeBody')}</div>
          <div className="meta bridge-line" style={{ marginTop: 6 }}>
            {t('about.bridgeShell', { platform })}
          </div>
          <div className="meta bridge-line">
            {t('about.bridgeStore')}: <b style={{ color: storeOn ? 'var(--positive)' : 'var(--text-negative)' }}>
              {t(storeOn ? 'about.bridgeOn' : 'about.bridgeOff')}
            </b>
          </div>
          <div className="meta bridge-line">
            {t('about.bridgeAds')}: <b style={{ color: adsOn ? 'var(--positive)' : 'var(--text-negative)' }}>
              {t(adsOn ? 'about.bridgeOn' : 'about.bridgeOff')}
            </b>
          </div>
        </div>
      )}

      <div className="card">
        <div className="fact-label">{t('about.contactLabel')}</div>
        <div className="meta">{t('about.contactBody')}</div>
        <a className="btn ghost block" style={{ marginTop: 8 }} href={`mailto:${DEV_CONTACT}`}>{DEV_CONTACT}</a>
      </div>

      <div className="muted" style={{ padding: '4px 16px 0', fontSize: 12 }}>{t('about.thanks')}</div>
      <div className="spacer" />
    </>
  )
}
