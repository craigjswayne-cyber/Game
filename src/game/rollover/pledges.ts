// Promises the manager made that outlive the season they were made in.
import { preseasonWeeksFor } from '../calendar'
import type { Gender } from '../gender'
import { LAST_PLEDGE_WEEK, SEASON_WEEKS, type Pledge } from '../model'

/** The promises that fall due past the end of the season just closed, moved
 *  onto the new one: the same number of weeks still owed, counted from the
 *  end of the world's own pre-season (two weeks in the women's game,
 *  three in the men's), with appearances counted from zero because the season
 *  stats have just been wiped. `season` is the new season. Exported for the
 *  probe. */
export function carryPledges(pledges: Pledge[], season: number, gender: Gender = 'm'): Pledge[] {
  return pledges
    .filter(pl => pl.kind !== 'start' && pl.season === season - 1 && pl.due > LAST_PLEDGE_WEEK)
    .map(pl => ({
      ...pl,
      season,
      week: pl.week - SEASON_WEEKS,
      due: preseasonWeeksFor(gender).length + Math.max(1, pl.due - SEASON_WEEKS),
      baseApps: 0,
    }))
}
