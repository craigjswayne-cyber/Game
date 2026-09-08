/*
 * TAB 5: community, analytics and the private coaching portal.
 *
 * Three things that belong to the person rather than to the programme, behind
 * one segmented control. Each segment is a body() exported by its own module,
 * so the feed, the charts and the portal stay separate files and this one only
 * decides which is on screen.
 *
 * The segment is module state, and the three deep links (/community, /you,
 * /coaching) set it on the way in, so a link from Home lands on the right one.
 */
import { esc } from '../util.js'
import { get } from '../state.js'
import { pageHead } from '../ui.js'
import * as community from './community.js'
import * as account from './account.js'
import * as coaching from './coaching.js'

let seg = 'feed'

/* Each segment is a route of its own. Making the control navigate rather than
   set a variable is what keeps the back button, a shared link and a repaint all
   agreeing about which one is open. */
const SEGMENTS = [
  { id: 'feed', label: 'Community', to: '/community', mod: community },
  { id: 'progress', label: 'Progress', to: '/account', mod: account },
  { id: 'coaching', label: '1-1', to: '/coaching', mod: coaching },
]

const current = () => SEGMENTS.find((x) => x.id === seg) || SEGMENTS[0]

const SUBS = {
  feed: 'Wins, encouragement and the odd honest bad week',
  progress: 'Your graphs, your settings, your data',
  coaching: 'Check in, get seen, get told the truth',
}

export function render() {
  const name = get().profile.name
  return `<main class="page stack">
    ${pageHead(seg === 'coaching' ? '1-1 with Mimi' : name ? `${name}'s corner` : 'You', SUBS[seg])}
    <div class="seg" role="group" aria-label="Section">
      ${SEGMENTS.map((x) => `<button data-nav="${x.to}" data-seg="${x.id}" aria-pressed="${seg === x.id}">${esc(x.label)}</button>`).join('')}
    </div>
    ${current().mod.body()}
  </main>`
}

export function mount(root) {
  current().mod.mount(root)
}

/* The three ways in. Each sets the segment, then renders the same screen. */
const view = (id) => ({
  render(params) { seg = id; return render(params) },
  mount(root, params) { return mount(root, params) },
})

export const feedView = view('feed')
export const progressView = view('progress')
export const coachingView = view('coaching')
