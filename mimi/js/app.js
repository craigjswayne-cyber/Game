/*
 * BOOT.
 *
 * Route table, service worker, and the one decision made at startup: a person
 * who has not been through the intake sees the intake and nothing else, because
 * every screen behind it is built out of answers they have not given yet.
 */
import { get } from './state.js'
import { defineRoutes, start } from './router.js'
import { registerWorker } from './offline.js'

import * as home from './screens/home.js'
import * as workouts from './screens/workouts.js'
import * as program from './screens/program.js'
import * as session from './screens/session.js'
import * as exercise from './screens/exercise.js'
import * as tracker from './screens/tracker.js'
import * as nutrition from './screens/nutrition.js'
import * as recipe from './screens/recipe.js'
import * as account from './screens/account.js'
import * as mindset from './screens/mindset.js'
import * as community from './screens/community.js'
import * as coaching from './screens/coaching.js'
import * as onboarding from './screens/onboarding.js'

defineRoutes([
  { pattern: '/home', screen: home, tab: 'home' },
  { pattern: '/workouts', screen: workouts, tab: 'workouts' },
  { pattern: '/program/:id', screen: program, tab: 'workouts' },
  { pattern: '/session/:programId/:week/:dayId', screen: session, tab: 'workouts' },
  { pattern: '/exercise/:id', screen: exercise, tab: 'workouts' },
  { pattern: '/tracker', screen: tracker, tab: 'tracker' },
  { pattern: '/nutrition', screen: nutrition, tab: 'nutrition' },
  { pattern: '/recipe/:id', screen: recipe, tab: 'nutrition' },
  { pattern: '/account', screen: account, tab: 'account' },
  { pattern: '/mindset', screen: mindset, tab: 'home' },
  { pattern: '/mindset/:id', screen: mindset.detail, tab: 'home' },
  { pattern: '/community', screen: community, tab: 'home' },
  { pattern: '/coaching', screen: coaching, tab: 'home' },
  { pattern: '/welcome', screen: onboarding, chrome: false },
])

const root = document.getElementById('app')

/* The intake owns the whole screen until it is finished: no tab bar to escape
   through, because a half answered profile makes every other tab lie. */
start(root, (path) => (get().onboarded ? (path === '/welcome' ? '/home' : null) : '/welcome'))

registerWorker()
