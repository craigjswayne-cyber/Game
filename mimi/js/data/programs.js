/*
 * Mimi's programs. Each one is a repeating week: the same session titles run
 * for `weeks` weeks, and `progression` says what changes as the weeks go by,
 * which is how a four line data file becomes an eight week block.
 *
 * `env` and `level` drive the filters on the Workouts tab, so a person who said
 * "home only, beginner" during onboarding never has to scroll past a barbell.
 */
export const PROGRAMS = [
  {
    id: 'strong-foundations',
    title: 'Strong Foundations',
    subtitle: 'Full body strength, three days a week',
    weeks: 8,
    env: 'gym',
    level: 'beginner',
    disciplines: ['strength'],
    goals: ['strength', 'lifestyle'],
    minutes: 50,
    blurb: 'The block I put every new client through. Three full body days, the same six lifts every week, and a number that goes up. Nothing clever, and that is the point.',
    progression: 'Weeks 1 to 2 learn the pattern. Weeks 3 to 6 add load while the reps hold. Weeks 7 to 8 drop a set and push the top weight.',
    days: [
      { id: 'd1', title: 'Day 1: Lower', focus: 'Squat pattern', minutes: 50, work: [
        { ex: 'gob-squat', sets: 3, reps: '8', rest: 90, note: 'Warm up set first, not counted.' },
        { ex: 'bb-squat', sets: 4, reps: '6', rest: 150 },
        { ex: 'rdl', sets: 3, reps: '10', rest: 120 },
        { ex: 'split-squat', sets: 3, reps: '10 each', rest: 90 },
        { ex: 'dead-bug', sets: 3, reps: '8 each', rest: 45 },
      ] },
      { id: 'd2', title: 'Day 2: Upper', focus: 'Push and pull', minutes: 45, work: [
        { ex: 'db-press', sets: 4, reps: '8', rest: 120 },
        { ex: 'lat-pull', sets: 4, reps: '10', rest: 120 },
        { ex: 'sh-press', sets: 3, reps: '10', rest: 90 },
        { ex: 'row-1arm', sets: 3, reps: '12 each', rest: 90 },
        { ex: 'face-pull', sets: 3, reps: '15', rest: 45 },
      ] },
      { id: 'd3', title: 'Day 3: Hinge and glutes', focus: 'Posterior chain', minutes: 50, work: [
        { ex: 'hip-thrust', sets: 4, reps: '10', rest: 120 },
        { ex: 'rdl', sets: 3, reps: '8', rest: 120, note: 'Heavier than day one.' },
        { ex: 'walk-lunge', sets: 3, reps: '12 each', rest: 90 },
        { ex: 'kb-swing', sets: 4, reps: '15', rest: 60 },
        { ex: 'plank', sets: 3, reps: '40 sec', rest: 45 },
      ] },
    ],
  },
  {
    id: 'home-reset',
    title: 'Home Reset',
    subtitle: 'Four weeks, no equipment past a band',
    weeks: 4,
    env: 'home',
    level: 'beginner',
    disciplines: ['strength', 'hybrid'],
    goals: ['lifestyle', 'fatloss'],
    minutes: 30,
    blurb: 'For the weeks when the gym is not happening. Thirty minutes, a mat, a band if you have one, and four sessions that leave you better than they found you.',
    progression: 'Add two reps a set each week. Week 4 repeats week 3 with a slower lowering count.',
    days: [
      { id: 'd1', title: 'Day 1: Lower body', focus: 'Legs and glutes', minutes: 30, work: [
        { ex: 'gob-squat', sets: 4, reps: '12', rest: 60, note: 'A rucksack with books in it counts.' },
        { ex: 'glute-bridge', sets: 4, reps: '15', rest: 60 },
        { ex: 'split-squat', sets: 3, reps: '10 each', rest: 60 },
        { ex: 'plank', sets: 3, reps: '30 sec', rest: 45 },
      ] },
      { id: 'd2', title: 'Day 2: Upper body', focus: 'Push and pull', minutes: 28, work: [
        { ex: 'push-up', sets: 4, reps: '8', rest: 75, note: 'Hands on the sofa arm is a rep that counts.' },
        { ex: 'band-row', sets: 4, reps: '12', rest: 75 },
        { ex: 'sh-press', sets: 3, reps: '12', rest: 60 },
        { ex: 'pallof', sets: 3, reps: '10 each', rest: 45 },
      ] },
      { id: 'd3', title: 'Day 3: Full body flow', focus: 'Everything, moving', minutes: 30, work: [
        { ex: 'walk-lunge', sets: 3, reps: '16', rest: 60 },
        { ex: 'push-up', sets: 3, reps: '10', rest: 60 },
        { ex: 'glute-bridge', sets: 3, reps: '20', rest: 45 },
        { ex: 'mtn-climb', sets: 3, reps: '30 sec', rest: 45 },
        { ex: 'hollow', sets: 3, reps: '25 sec', rest: 45 },
      ] },
      { id: 'd4', title: 'Day 4: Conditioning', focus: 'Heart rate up', minutes: 24, work: [
        { ex: 'burpee', sets: 5, reps: '8', rest: 60 },
        { ex: 'mtn-climb', sets: 5, reps: '40 sec', rest: 60 },
        { ex: 'kb-swing', sets: 5, reps: '15', rest: 60, note: 'Swap for jump squats if you have no bell.' },
      ] },
    ],
  },
  {
    id: 'hybrid-eight',
    title: 'Hybrid Eight',
    subtitle: 'Lift heavy, run easy, eight weeks',
    weeks: 8,
    env: 'gym',
    level: 'intermediate',
    disciplines: ['hybrid', 'strength'],
    goals: ['strength', 'endurance'],
    minutes: 55,
    blurb: 'Two strength days that keep your numbers, two engine days that build the thing most lifters are missing. The conditioning is deliberately easy. Trust it.',
    progression: 'Strength: add 2.5kg when every set hits the top of the rep range. Engine: hold the same pace, add three minutes a week.',
    days: [
      { id: 'd1', title: 'Day 1: Lower strength', focus: 'Squat and hinge', minutes: 55, work: [
        { ex: 'bb-squat', sets: 5, reps: '5', rest: 180 },
        { ex: 'rdl', sets: 4, reps: '8', rest: 120 },
        { ex: 'split-squat', sets: 3, reps: '8 each', rest: 90 },
        { ex: 'pallof', sets: 3, reps: '12 each', rest: 45 },
      ] },
      { id: 'd2', title: 'Day 2: Engine', focus: 'Steady aerobic', minutes: 40, work: [
        { ex: 'row-erg', sets: 1, reps: '20 min', rest: 0, note: 'Nose breathing pace. If you cannot talk, slow down.' },
        { ex: 'incline-walk', sets: 1, reps: '15 min', rest: 0 },
        { ex: 'dead-bug', sets: 3, reps: '10 each', rest: 45 },
      ] },
      { id: 'd3', title: 'Day 3: Upper strength', focus: 'Press and pull', minutes: 50, work: [
        { ex: 'db-press', sets: 5, reps: '6', rest: 150 },
        { ex: 'lat-pull', sets: 4, reps: '8', rest: 120 },
        { ex: 'sh-press', sets: 4, reps: '8', rest: 90 },
        { ex: 'row-1arm', sets: 3, reps: '10 each', rest: 90 },
        { ex: 'face-pull', sets: 3, reps: '15', rest: 45 },
      ] },
      { id: 'd4', title: 'Day 4: Intervals', focus: 'Hard, then honest rest', minutes: 35, work: [
        { ex: 'ski-erg', sets: 8, reps: '250m', rest: 90 },
        { ex: 'kb-swing', sets: 4, reps: '20', rest: 75 },
        { ex: 'hollow', sets: 3, reps: '30 sec', rest: 45 },
      ] },
    ],
  },
  {
    id: 'pilates-strong',
    title: 'Pilates Strong',
    subtitle: 'Six weeks of mat work with load',
    weeks: 6,
    env: 'home',
    level: 'intermediate',
    disciplines: ['pilates'],
    goals: ['lifestyle', 'endurance'],
    minutes: 35,
    blurb: 'Classical mat work with enough strength in it to change something. Three sessions a week, all of them on the floor, all of them harder than they look.',
    progression: 'Hold each position five seconds longer each week. Week 6 runs the whole series without a break between exercises.',
    days: [
      { id: 'd1', title: 'Day 1: Centre', focus: 'Deep core', minutes: 32, work: [
        { ex: 'pilates-100', sets: 1, reps: '100 pumps', rest: 60 },
        { ex: 'roll-up', sets: 3, reps: '6', rest: 45 },
        { ex: 'dead-bug', sets: 3, reps: '10 each', rest: 45 },
        { ex: 'hollow', sets: 3, reps: '25 sec', rest: 45 },
      ] },
      { id: 'd2', title: 'Day 2: Hips and seat', focus: 'Glutes and lateral hip', minutes: 35, work: [
        { ex: 'side-kick', sets: 3, reps: '12 each', rest: 45 },
        { ex: 'glute-bridge', sets: 4, reps: '15', rest: 45 },
        { ex: 'split-squat', sets: 3, reps: '10 each', rest: 60 },
        { ex: 'pallof', sets: 3, reps: '10 each', rest: 45 },
      ] },
      { id: 'd3', title: 'Day 3: Long spine', focus: 'Back body and posture', minutes: 34, work: [
        { ex: 'swimmer', sets: 3, reps: '40 sec', rest: 45 },
        { ex: 'roll-up', sets: 3, reps: '8', rest: 45 },
        { ex: 'band-row', sets: 3, reps: '15', rest: 60 },
        { ex: 'plank', sets: 3, reps: '45 sec', rest: 45 },
      ] },
    ],
  },
  {
    id: 'hiit-express',
    title: 'HIIT Express',
    subtitle: 'Twenty minutes, four weeks, anywhere',
    weeks: 4,
    env: 'home',
    level: 'advanced',
    disciplines: ['hiit', 'hybrid'],
    goals: ['fatloss', 'endurance'],
    minutes: 20,
    blurb: 'For the days with twenty minutes in them and nothing else. Short, unpleasant, over quickly, and it keeps the streak alive.',
    progression: 'Week 1 and 2: 40 seconds on, 20 off. Week 3: 45 on, 15 off. Week 4: back to 40 on and go faster.',
    days: [
      { id: 'd1', title: 'Day 1: Full body burner', focus: 'Circuit, four rounds', minutes: 20, work: [
        { ex: 'burpee', sets: 4, reps: '40 sec', rest: 20 },
        { ex: 'gob-squat', sets: 4, reps: '40 sec', rest: 20 },
        { ex: 'push-up', sets: 4, reps: '40 sec', rest: 20 },
        { ex: 'mtn-climb', sets: 4, reps: '40 sec', rest: 60 },
      ] },
      { id: 'd2', title: 'Day 2: Lower body burner', focus: 'Legs, five rounds', minutes: 22, work: [
        { ex: 'walk-lunge', sets: 5, reps: '40 sec', rest: 20 },
        { ex: 'glute-bridge', sets: 5, reps: '40 sec', rest: 20 },
        { ex: 'kb-swing', sets: 5, reps: '40 sec', rest: 60 },
      ] },
      { id: 'd3', title: 'Day 3: Core and conditioning', focus: 'Trunk under fatigue', minutes: 18, work: [
        { ex: 'mtn-climb', sets: 4, reps: '40 sec', rest: 20 },
        { ex: 'hollow', sets: 4, reps: '30 sec', rest: 20 },
        { ex: 'plank', sets: 4, reps: '45 sec', rest: 20 },
        { ex: 'burpee', sets: 4, reps: '30 sec', rest: 60 },
      ] },
    ],
  },
]

export const programById = (id) => PROGRAMS.find((p) => p.id === id) || null
