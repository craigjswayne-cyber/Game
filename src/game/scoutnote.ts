// The scout's line on one man. A leaf moved out of commission.ts so that
// scoutrecs (which commission imports) can write a note without importing
// commission back; commission.ts re-exports both.

/** The scout's line, stored as a key and its fragments rather than a sentence:
 *  it sits in the save and is read on the Transfer Centre for weeks. */
export interface NoteRef {
  k: string
  open_k: string
  body_k: string
  grade_k: string
  growth_k: string
  /** so it can be passed straight to t() as its own variables */
  [x: string]: string
}

/** The scout's line on one man, as a key and its variables.
 *
 *  STORED in state.scoutFinds and read on the Transfer Centre for weeks
 *  afterwards, so it cannot be prose: it would be the scout speaking English
 *  inside a French report. The three-way pick stays deterministic on the same
 *  rng draws it always took. */
export function noteFor(grade: number, upside: number, rng: () => number): NoteRef {
  const openers = ['news.noteOpen1', 'news.noteOpen2', 'news.noteOpen3']
  const bodies = grade >= 3 ? ['news.noteA1', 'news.noteA2', 'news.noteA3']
    : grade === 2 ? ['news.noteB1', 'news.noteB2', 'news.noteB3']
    : grade === 1 ? ['news.noteC1', 'news.noteC2', 'news.noteC3']
    : ['news.noteD1', 'news.noteD2', 'news.noteD3']
  const open_k = openers[Math.floor(rng() * 3)]
  const body_k = bodies[Math.floor(rng() * bodies.length)]
  return {
    k: 'news.scoutNote', open_k, body_k,
    grade_k: `news.grade${grade}`,
    growth_k: upside >= 12 ? 'news.notePlenty' : upside >= 6 ? 'news.noteSome' : 'common.nothing',
  }
}
