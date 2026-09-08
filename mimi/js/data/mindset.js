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
    kind: 'read',
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
    kind: 'read',
    minutes: 6,
    theme: 'Sleep',
    blurb: 'Nothing here trains harder than a full night of sleep. Set the conditions for it.',
    script: ['Screens down an hour before, or dimmed if that is not realistic.', 'Write tomorrow list now, so the head has somewhere to put it.', 'Room cool, room dark.', 'If sleep does not come in twenty minutes, get up, low light, boring book.'],
  },
]

export const sessionById = (id) => SESSIONS.find((s) => s.id === id) || null

/* The eight prompts the daily mood log offers under the face picker. */
export const MOODS = [
  { id: 'strong', label: 'Strong' },
  { id: 'steady', label: 'Steady' },
  { id: 'tired', label: 'Tired' },
  { id: 'anxious', label: 'Anxious' },
  { id: 'low', label: 'Low' },
]
