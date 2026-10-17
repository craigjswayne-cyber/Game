// The forecast's icon and its word, shared by both previews and the live view.

import { t } from '../../../game/i18n'

export const WEATHER_ICON: Record<string, string> = { Dry: 'sun', Damp: 'rain', Rain: 'rain', Wind: 'wind', Snow: 'snow' }

/** The forecast in words. The VALUE stays English everywhere it is stored or
 *  compared - the engine reads fixture.weather - and only the label moves. */
export const weatherWord = (w: string): string => t(`matchday.wx${w}`)
