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
import * as you from './screens/you.js'
import * as mindset from './screens/mindset.js'
import * as shopping from './screens/shopping.js'
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
  { pattern: '/shopping', screen: shopping, tab: 'nutrition' },
  { pattern: '/mindset', screen: mindset, tab: 'tracker' },
  { pattern: '/mindset/:id', screen: mindset.detail, tab: 'tracker' },
  { pattern: '/habit/:id', screen: mindset.habit, tab: 'tracker' },
  // Tab five is three screens behind one segmented control, and each of these
  // is a way in that lands on the right segment.
  { pattern: '/you', screen: you.feedView, tab: 'you' },
  { pattern: '/community', screen: you.feedView, tab: 'you' },
  { pattern: '/account', screen: you.progressView, tab: 'you' },
  { pattern: '/coaching', screen: you.coachingView, tab: 'you' },
  { pattern: '/welcome', screen: onboarding, chrome: false },
])

const root = document.getElementById('app')

/* The intake owns the whole screen until it is finished: no tab bar to escape
   through, because a half answered profile makes every other tab lie. */
start(root, (path) => (get().onboarded ? (path === '/welcome' ? '/home' : null) : '/welcome'))

registerWorker()
