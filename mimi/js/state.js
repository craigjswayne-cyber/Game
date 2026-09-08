/*
 * ONE STORE, ONE KEY, ONE SAVE.
 *
 * Everything the app knows about a person lives in a single object, written to
 * localStorage under mimi.v1 after every mutation. There is no server in this
 * prototype, which means:
 *
 *   - the shape here is the contract a real backend would have to honour, so it
 *     is written as if it were going over the wire (plain JSON, no Dates, no
 *     Maps, ids everywhere);
 *   - a person's data never leaves their device, so nothing here needs consent
 *     copy it does not already have.
 *
 * Reads go through get(). Writes go through update(), which takes a function,
 * saves, and tells the router to repaint. Nothing mutates state directly.
 */
import { iso, addDays, uid } from './util.js'

const KEY = 'mimi.v1'
const VERSION = 1

const defaults = () => ({
  v: VERSION,
  createdOn: iso(),
  onboarded: false,
  profile: {
    name: '',
    level: 'beginner',            // beginner | intermediate | advanced
    environment: 'both',          // home | gym | both
    disciplines: ['strength'],    // strength | hybrid | pilates | hiit | conditioning
    goals: ['strength'],          // strength | fatloss | endurance | lifestyle
    sex: 'female',
    age: 28,
    heightCm: 167,
    startWeightKg: 68,
    targetWeightKg: 64,
    activity: 'moderate',         // sedentary | light | moderate | active | athlete
    macroGoal: null,              // cut | maintain | bulk, set on the nutrition tab; null means derive it from goals
    waterGoalMl: 2500,
    stepGoal: 8000,
    measurements: { waistCm: null, hipsCm: null, chestCm: null, thighCm: null },
  },
  /* one entry per day the person touched, keyed YYYY-MM-DD */
  days: {},
  /* set logs, keyed `${programId}:${dayId}` */
  logs: {},
  enrolment: null,                // { programId, startedOn, completed: [dayId] }
  favourites: { recipes: [], exercises: [] },
  downloads: [],                  // programIds held for offline
  community: { posts: [], liked: [] },
  coaching: { plan: null, checkins: [], messages: [] },
  mindset: { completed: [], journal: [] },
  settings: {
    health: { steps: true, energy: true, water: false },
    reminders: true,
    quoteSeed: Math.floor(Math.random() * 1000),
  },
})

let state = load()
const listeners = new Set()

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return seed(defaults())
    const saved = JSON.parse(raw)
    return migrate(saved)
  } catch (err) {
    console.warn('Made by Mimi: save unreadable, starting fresh.', err)
    return seed(defaults())
  }
}

/* A save from an older build keeps whatever it had and gains whatever it lacks,
   one level deep, which is as far as this schema has ever needed. */
function migrate(saved) {
  const base = defaults()
  const merged = { ...base, ...saved, v: VERSION }
  for (const k of ['profile', 'favourites', 'community', 'coaching', 'mindset', 'settings']) {
    merged[k] = { ...base[k], ...(saved[k] || {}) }
  }
  merged.profile.measurements = { ...base.profile.measurements, ...(saved.profile?.measurements || {}) }
  merged.settings.health = { ...base.settings.health, ...(saved.settings?.health || {}) }
  return merged
}

/* The community feed is not empty on day one: a lonely feed reads as a broken
   feed. These three are clearly labelled as sample posts in the UI. */
function seed(s) {
  const now = Date.now()
  s.community.posts = [
    { id: uid(), author: 'Rosie K', body: 'Week 4 of Strong Foundations done. First time I have squatted 60kg and it moved.', at: now - 5400000, likes: 12, sample: true },
    { id: uid(), author: 'Amara T', body: '14 day water streak. I did not think that would be the habit that changed the most.', at: now - 18000000, likes: 8, sample: true },
    { id: uid(), author: 'Jess M', body: 'Rest day, long walk, 9k steps, no guilt. Mindset section is doing something.', at: now - 79200000, likes: 21, sample: true },
  ]
  s.coaching.messages = [
    { id: uid(), from: 'mimi', body: 'Welcome in. Fill out your first check-in when you have a quiet five minutes and I will build your week around it.', at: now - 3600000 },
  ]
  return s
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch (err) {
    // A full or blocked store must not take the screen down with it.
    console.warn('Made by Mimi: could not save.', err)
  }
}

export const get = () => state

export function update(fn) {
  const next = fn(state)
  if (next) state = next
  persist()
  listeners.forEach((l) => l(state))
  return state
}

export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }

export function reset() {
  state = seed(defaults())
  persist()
  listeners.forEach((l) => l(state))
}

/* ---- day records ---------------------------------------------------- */

export const emptyDay = () => ({ waterMl: 0, steps: 0, mood: null, todos: [], workouts: [], weightKg: null })

export const dayOf = (date) => state.days[date] || emptyDay()

export function editDay(date, fn) {
  return update((s) => {
    const day = { ...emptyDay(), ...(s.days[date] || {}) }
    fn(day)
    s.days[date] = day
    return s
  })
}

/* ---- derived numbers ------------------------------------------------ */

/* Consecutive days, counting back from today, on which a workout was logged.
   Today not being done yet does not break a streak; yesterday not being done
   does. */
export function workoutStreak(today = iso()) {
  const done = (d) => (state.days[d]?.workouts?.length || 0) > 0
  let cursor = done(today) ? today : addDays(today, -1)
  let n = 0
  while (done(cursor)) { n++; cursor = addDays(cursor, -1) }
  return n
}

/* Same shape, for the habit the person is most likely to drop first. */
export function waterStreak(today = iso()) {
  const goal = state.profile.waterGoalMl || 2000
  const hit = (d) => (state.days[d]?.waterMl || 0) >= goal
  let cursor = hit(today) ? today : addDays(today, -1)
  let n = 0
  while (hit(cursor)) { n++; cursor = addDays(cursor, -1) }
  return n
}

export function weightSeries() {
  const points = Object.entries(state.days)
    .filter(([, d]) => typeof d.weightKg === 'number')
    .map(([date, d]) => ({ date, kg: d.weightKg }))
    .sort((a, b) => a.date.localeCompare(b.date))
  if (!points.length && state.profile.startWeightKg) {
    return [{ date: state.createdOn, kg: state.profile.startWeightKg }]
  }
  return points
}

export function lastNDays(n, today = iso()) {
  return Array.from({ length: n }, (_, i) => addDays(today, -(n - 1 - i)))
}
