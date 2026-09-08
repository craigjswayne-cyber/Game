/*
 * The Mindset section: short guided pieces, journal prompts and one breathing
 * pattern per session. `kind` decides which player the screen renders.
 */
export const SESSIONS = [
  {
    id: 'ground-5',
    title: 'Five minute ground',
    kind: 'breath',
    minutes: 5,
    theme: 'Grounding',
    pattern: { in: 4, hold: 4, out: 6, rounds: 12 },
    blurb: 'For the twenty minutes before a session when your head is still at work.',
    script: ['Sit or stand, feet flat, weight even.', 'Name five things you can see, without judging any of them.', 'Now follow the circle: in for four, hold for four, out for six.', 'When the mind wanders, that is not failure. Coming back is the exercise.'],
  },
  {
    id: 'box-breath',
    title: 'Box breathing',
    kind: 'breath',
    minutes: 4,
    theme: 'Nervous system',
    pattern: { in: 4, hold: 4, out: 4, rounds: 14 },
    blurb: 'Four in, four hold, four out. Used before lifts and before hard conversations.',
    script: ['Nose breathing throughout.', 'Equal counts, no straining at the top.', 'If four is a fight, drop to three. Ease is the goal.'],
  },
  {
    id: 'body-scan',
    title: 'Ten minute body scan',
    kind: 'audio',
    track: 'body-scan-10.m4a',
    minutes: 10,
    theme: 'Recovery',
    blurb: 'Lie down after a hard session and give the nervous system somewhere to land.',
    script: ['Start at the feet. Notice, do not fix.', 'Move up a section at a time: calves, thighs, hips, belly, ribs, shoulders, jaw.', 'Anywhere holding, exhale into it twice and move on.', 'Finish at the crown. Two minutes of nothing at all.'],
  },
  {
    id: 'the-restart',
    title: 'The restart',
    kind: 'journal',
    minutes: 8,
    theme: 'Habit shift',
    blurb: 'For the week after a week you missed. Written so you stop paying for it twice.',
    prompts: [
      'What actually got in the way? Be specific, not moral about it.',
      'What is the smallest version of the session that would still have counted?',
      'What is the one thing you will protect this week, even if everything else slips?',
    ],
  },
  {
    id: 'mirror-work',
    title: 'The way you talk to yourself',
    kind: 'journal',
    minutes: 8,
    theme: 'Mental health',
    blurb: 'The internal commentary is training too, and most people never programme it.',
    prompts: [
      'Write the sentence you said to yourself the last time you missed a session.',
      'Would you say it to someone you love? Write what you would say to them instead.',
      'Which of those two sentences gets you back in the gym on Monday?',
    ],
  },
  {
    id: 'why-anchor',
    title: 'Find the anchor',
    kind: 'journal',
    minutes: 10,
    theme: 'Motivation',
    blurb: 'Motivation runs out. An anchor does not. This is how you find yours.',
    prompts: [
      'Finish this: in a year, I want to be able to ...',
      'Who else is better off when you are looking after yourself?',
      'What does the day after the goal actually look like?',
    ],
  },
  {
    id: 'sleep-wind',
    title: 'Winding down',
    kind: 'audio',
    track: 'winding-down-6.m4a',
    minutes: 6,
    theme: 'Sleep',
    blurb: 'Nothing here trains harder than a full night of sleep. Set the conditions for it.',
    script: ['Screens down an hour before, or dimmed if that is not realistic.', 'Write tomorrow list now, so the head has somewhere to put it.', 'Room cool, room dark.', 'If sleep does not come in twenty minutes, get up, low light, boring book.'],
  },
]

export const sessionById = (id) => SESSIONS.find((s) => s.id === id) || null

/*
 * THE DAILY GRATITUDE PROMPT.
 *
 * One question a day, picked from the person's own seed so it is the same
 * question all day and a different one tomorrow. Two minutes, one box, saved
 * to the journal with everything else.
 */
export const GRATITUDE = [
  'Name one thing your body did for you today that you did not have to think about.',
  'Who made your week easier? Have you told them?',
  'What is one thing you own that you would miss more than you expect?',
  'What went right today that you would not have noticed a year ago?',
  'Which part of today would past you have been glad to hear about?',
  'What is something hard you are glad you did anyway?',
  'Name a small comfort you had today. Sit with it for a second.',
  'What is one thing about your training you can be proud of this week?',
  'Who are you becoming, and what did today add to that?',
  'What is worth being grateful for that you usually take as given?',
]

export function gratitudeFor(seed = 0, date = new Date()) {
  const day = Math.floor(date.getTime() / 86400000)
  return GRATITUDE[Math.abs(seed + day) % GRATITUDE.length]
}

/*
 * HABIT FORMATION GUIDES. Short, practical, and each one names the thing that
 * usually goes wrong rather than the theory.
 */
export const HABIT_GUIDES = [
  {
    id: 'stack-it',
    title: 'Stack it onto something',
    minutes: 3,
    body: [
      'A new habit needs an existing one to hang from. After the kettle goes on, not at eight in the morning.',
      'Write it as: after I [thing I already do], I will [new thing].',
      'The mistake is picking an anchor you only do sometimes. Pick the one you have never missed.',
    ],
  },
  {
    id: 'two-minute',
    title: 'Make it two minutes',
    minutes: 3,
    body: [
      'The version of the habit you will do on your worst day is the one to write down.',
      'Not a session, putting your shoes on. Not the whole list, one line of it.',
      'Consistency first, size later. Size is the easy half.',
    ],
  },
  {
    id: 'never-twice',
    title: 'Never miss twice',
    minutes: 2,
    body: [
      'Missing once is an accident. Missing twice is the start of the new pattern.',
      'The rule is not "be perfect". The rule is that the day after a miss is non negotiable, at whatever size it takes.',
      'This is the only habit rule that matters over a year.',
    ],
  },
  {
    id: 'friction',
    title: 'Move the friction',
    minutes: 3,
    body: [
      'You do not need more willpower, you need fewer steps between you and the thing.',
      'Kit by the door. Bottle filled the night before. Programme already open on the phone.',
      'Then do the reverse for what you want less of: add steps, add distance, add a lock screen.',
    ],
  },
]

export const habitById = (id) => HABIT_GUIDES.find((h) => h.id === id) || null

/* The eight prompts the daily mood log offers under the face picker. */
export const MOODS = [
  { id: 'strong', label: 'Strong' },
  { id: 'steady', label: 'Steady' },
  { id: 'tired', label: 'Tired' },
  { id: 'anxious', label: 'Anxious' },
  { id: 'low', label: 'Low' },
]
