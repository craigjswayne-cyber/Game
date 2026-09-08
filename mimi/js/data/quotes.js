/*
 * The rotating quotes. One is chosen per screen per day from a per-person seed,
 * so the Home card and the Mindset card differ from each other but neither
 * changes on every repaint, which would make the app feel restless.
 */
export const QUOTES = [
  { text: 'Discipline is choosing what you want most over what you want now.', by: 'Mimi' },
  { text: 'You do not have to be good at it. You have to be willing to be new at it.', by: 'Mimi' },
  { text: 'The session you do tired is worth two of the ones you plan when rested.', by: 'Mimi' },
  { text: 'Consistency is not doing it perfectly. It is doing it again.', by: 'Mimi' },
  { text: 'Your body hears everything your mind says. Watch the tone.', by: 'Mimi' },
  { text: 'Small hinges swing big doors. Water, sleep, steps, protein.', by: 'Mimi' },
  { text: 'Rest is part of the programme, not a break from it.', by: 'Mimi' },
  { text: 'Nobody is coming. That is the bad news and the whole of the good news.', by: 'Mimi' },
  { text: 'Strong is a habit before it is a feeling.', by: 'Mimi' },
  { text: 'Two percent better, on the days you can. Level, on the days you cannot.', by: 'Mimi' },
  { text: 'You are allowed to start again as many times as it takes.', by: 'Mimi' },
  { text: 'Comparison is a tax on your own progress. Stop paying it.', by: 'Mimi' },
  { text: 'The weight will move when the habit does.', by: 'Mimi' },
  { text: 'Show up for the version of you who is six months ahead.', by: 'Mimi' },
]

/* A deterministic pick: same person, same day, same screen, same quote. */
export function quoteFor(screen, seed = 0, date = new Date()) {
  const day = Math.floor(date.getTime() / 86400000)
  let h = seed + day
  for (const ch of screen) h = (h * 31 + ch.charCodeAt(0)) % 100000
  return QUOTES[Math.abs(h) % QUOTES.length]
}
