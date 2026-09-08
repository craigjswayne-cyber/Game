/*
 * THE HEALTH BRIDGE.
 *
 * Apple HealthKit is a native API. A web page cannot read it, and no amount of
 * JavaScript will change that, so this file is the seam the native shell plugs
 * into rather than a pretend implementation.
 *
 * A shell (Capacitor, React Native, a WKWebView wrapper) sets:
 *
 *   window.MimiHealth = {
 *     available: true,
 *     read(kinds, isoDate) -> Promise<{ steps?, activeEnergyKcal?, waterMl? }>
 *     write(kind, value, isoDate) -> Promise<void>
 *   }
 *
 * with kinds drawn from HKQuantityTypeIdentifierStepCount,
 * ActiveEnergyBurned and DietaryWater. Until it does, available() is false and
 * every screen says so plainly instead of showing a number nobody supplied.
 */
export const bridge = () => (typeof window !== 'undefined' ? window.MimiHealth : null)

export const available = () => Boolean(bridge()?.available)

export async function readDay(date, kinds = ['steps', 'activeEnergyKcal']) {
  const b = bridge()
  if (!b?.available) return { ok: false, reason: 'no-bridge' }
  try {
    const data = await b.read(kinds, date)
    return { ok: true, data }
  } catch (err) {
    return { ok: false, reason: String(err?.message || err) }
  }
}

export async function writeWater(ml, date) {
  const b = bridge()
  if (!b?.available) return { ok: false, reason: 'no-bridge' }
  try {
    await b.write('waterMl', ml, date)
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: String(err?.message || err) }
  }
}
