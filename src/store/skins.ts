import { adBridgePresent, hasSupporter, tillOpen } from '../game/monetise'
import type { Gender } from '../game/gender'

/** THE SKINS, and the one that means "leave it alone".
 *  Each non-default value is a class on the app root; the colours themselves
 *  live in src/ui/tokens.css, which is the only file in the game allowed to
 *  hold a hex. Adding one here without adding the block there gets an
 *  unstyled app, so scripts/skinprobe.ts checks the two lists agree. */
export const SKINS = ['default', 'midnight', 'heritage', 'stealth'] as const
export type Skin = typeof SKINS[number]
export const MGR_GENDER_KEY = 'rm-mgr-gender'
/** The last pronoun this device chose, and 'm' for a device that has never
 *  been asked - which is every save from before v1.5.1 and every fresh
 *  install. */
export function readMgrGender(): Gender {
  try { return localStorage.getItem(MGR_GENDER_KEY) === 'w' ? 'w' : 'm' } catch { return 'm' }
}

export const SKIN_KEY = 'rm-skin'
export function readSkin(): Skin {
  try {
    const v = localStorage.getItem(SKIN_KEY)
    return (SKINS as readonly string[]).includes(v ?? '') ? v as Skin : 'default'
  } catch { return 'default' }
}

/** THE GREEN ONE IS EVERYBODY'S. The other three are Pro Manager's, and they
 *  are the reason to buy it: a purchase nobody can see is a purchase nobody
 *  talks about, and a skin is on screen every second of play. Nothing about
 *  the rugby changes either way - this is paint, and the game underneath is
 *  the same game, which is the line the store row has to hold to.
 *
 *  The CHOICE is never rewritten. A player whose entitlement has not been
 *  restored yet - a fresh install, an offline launch, the second between
 *  boot and the store answering - keeps what they picked; they simply wear
 *  the green one until the receipt turns up. Downgrading the saved value
 *  would turn a slow network into a lost preference. */
const FREE_SKIN: Skin = 'default'

/** IS A PRO MANAGER PERK OUT OF REACH RIGHT NOW?
 *
 *  Locked only where there is somewhere to buy it. The website has no store
 *  and no adverts, so there is nothing to sell and nothing to remove: taking
 *  a perk away there would be a feature deleted for no gain, and a locked
 *  card whose only door leads onto a shop that is shut. tillOpen() is the
 *  same question the Store shelves already ask.
 *
 *  Every Pro perk asks this one function, so there is one answer to keep
 *  right rather than one per perk. */
/*
 *  AND ONLY WHERE PRO MANAGER IS ON THE SHELF (1.8.1). The Store shows the
 *  Pro Manager row only when an advert bridge exists, because selling the
 *  absence of adverts in a build that has none is the dishonesty v1.1.3 took
 *  out (storeprobe holds it). A build with a till and no adverts therefore
 *  locked the skins behind a product it would never offer, and "Get the other
 *  three" opened a Store with nothing on it that unlocked them. No product,
 *  no lock: the same reasoning as the website above. */
export function proLocked(): boolean { return tillOpen() && adBridgePresent() && !hasSupporter() }

export function skinLocked(s: Skin): boolean { return s !== FREE_SKIN && proLocked() }

/** SAVED GAME PLANS: TWO, FOR EVERYONE (owner, v1.8.3: "only give me 2 save
 *  custom plan options - tidy it up").
 *
 *  It was three free and six with Pro, and the row under the quick plans was
 *  a second row of buttons doing nearly the same job as the first. Cutting the
 *  free tier alone would not have fixed what the owner was looking at: the web
 *  build has no billing bridge, so tillOpen() is false, proLocked() is false,
 *  and every web player was being handed the PRO number. Two is therefore the
 *  Pro number as well, and saved plans stop being a Pro perk - no adverts and
 *  the three locked skins still are. The upsell chip that sat at the end of
 *  the row went with it: with one number there is nothing to unlock.
 *
 *  Plans saved into the old slots C through F are not deleted, only hidden,
 *  the same way a chosen skin survives an entitlement that has not restored
 *  yet. planSlots() stays a function so the row still asks once per render. */
const FREE_PLANS = 2
const PRO_PLANS = 2
export function planSlots(): number { return proLocked() ? FREE_PLANS : PRO_PLANS }
/** What the app actually wears, as opposed to what was chosen. */
export function effectiveSkin(chosen: Skin): Skin { return skinLocked(chosen) ? FREE_SKIN : chosen }
