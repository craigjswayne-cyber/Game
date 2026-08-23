// The Manager's Handbook: every system in the game, explained in plain
// language, with the real numbers where a number helps.
//
// This exists because the only explanation the game offered was a single
// welcome veil that closes on the first tap, in front of facilities, coaching
// badges, exams, analyst reads, commissioned scouting, match preparation,
// player roles, partnership chemistry, mentoring, traits, pledges, grudges and
// a decisions ledger. A player who cannot find out what a thing does will not
// use it, and a system nobody uses may as well not be there.
//
// Every figure below was read out of the code, not remembered. If a coefficient
// changes, the entry changes with it.

/* q, a, label and sub are all i18n KEYS. The English is in
   src/locales/en.json under `handbook`; every other language answers to it.
   The Handbook screen searches the TRANSLATED text, not these keys. */
export type HandbookCat = 'match' | 'squad' | 'market' | 'club' | 'career'

export interface HandbookEntry {
  cat: HandbookCat
  q: string
  a: string
}

export const HANDBOOK_CATS: { id: HandbookCat; label: string; sub: string }[] = [
  { id: 'match', label: 'handbook.catMatch', sub: 'handbook.catMatchSub' },
  { id: 'squad', label: 'handbook.catSquad', sub: 'handbook.catSquadSub' },
  { id: 'market', label: 'handbook.catMarket', sub: 'handbook.catMarketSub' },
  { id: 'club', label: 'handbook.catClub', sub: 'handbook.catClubSub' },
  { id: 'career', label: 'handbook.catCareer', sub: 'handbook.catCareerSub' },
]

export const HANDBOOK: HandbookEntry[] = [
  // ---------------- Match Day ----------------
  {
    cat: 'match',
    q: 'handbook.q1',
    a: 'handbook.a1',
  },
  {
    cat: 'match',
    q: 'handbook.q2',
    a: 'handbook.a2',
  },
  {
    cat: 'match',
    q: 'handbook.q3',
    a: 'handbook.a3',
  },
  {
    cat: 'match',
    q: 'handbook.q4',
    a: 'handbook.a4',
  },
  {
    cat: 'match',
    q: 'handbook.q5',
    a: 'handbook.a5',
  },
  {
    cat: 'match',
    q: 'handbook.q6',
    a: 'handbook.a6',
  },
  {
    cat: 'match',
    q: 'handbook.q7',
    a: 'handbook.a7',
  },
  {
    cat: 'match',
    q: 'handbook.q8',
    a: 'handbook.a8',
  },
  {
    cat: 'match',
    q: 'handbook.q9',
    a: 'handbook.a9',
  },
  {
    cat: 'match',
    q: 'handbook.q10',
    a: 'handbook.a10',
  },
  {
    cat: 'match',
    q: 'handbook.q11',
    a: 'handbook.a11',
  },
  {
    cat: 'match',
    q: 'handbook.q12',
    a: 'handbook.a12',
  },
  {
    cat: 'match',
    q: 'handbook.q13',
    a: 'handbook.a13',
  },
  {
    cat: 'match',
    q: 'handbook.q14',
    a: 'handbook.a14',
  },
  {
    cat: 'match',
    q: 'handbook.q15',
    a: 'handbook.a15',
  },
  {
    cat: 'match',
    q: 'handbook.q16',
    a: 'handbook.a16',
  },
  {
    cat: 'match',
    q: 'handbook.q17',
    a: 'handbook.a17',
  },
  {
    cat: 'match',
    q: 'handbook.q18',
    a: 'handbook.a18',
  },
  {
    cat: 'match',
    q: 'handbook.q19',
    a: 'handbook.a19',
  },
  {
    cat: 'match',
    q: 'handbook.q20',
    a: 'handbook.a20',
  },

  // ---------------- Squad ----------------
  {
    cat: 'squad',
    q: 'handbook.q21',
    a: 'handbook.a21',
  },
  {
    cat: 'squad',
    q: 'handbook.q22',
    a: 'handbook.a22',
  },
  {
    cat: 'squad',
    q: 'handbook.q23',
    a: 'handbook.a23',
  },

  {
    cat: 'squad',
    q: 'handbook.q24',
    a: 'handbook.a24',
  },
  {
    cat: 'squad',
    q: 'handbook.q25',
    a: 'handbook.a25',
  },
  {
    cat: 'squad',
    q: 'handbook.q26',
    a: 'handbook.a26',
  },
  {
    cat: 'squad',
    q: 'handbook.q27',
    a: 'handbook.a27',
  },
  {
    cat: 'squad',
    q: 'handbook.q28',
    a: 'handbook.a28',
  },
  {
    cat: 'squad',
    q: 'handbook.q29',
    a: 'handbook.a29',
  },
  {
    cat: 'squad',
    q: 'handbook.q30',
    a: 'handbook.a30',
  },
  {
    cat: 'squad',
    q: 'handbook.q31',
    a: 'handbook.a31',
  },
  {
    cat: 'squad',
    q: 'handbook.q32',
    a: 'handbook.a32',
  },
  {
    cat: 'squad',
    q: 'handbook.q33',
    a: 'handbook.a33',
  },
  {
    cat: 'squad',
    q: 'handbook.q34',
    a: 'handbook.a34',
  },
  {
    cat: 'squad',
    q: 'handbook.q35',
    a: 'handbook.a35',
  },
  {
    cat: 'club',
    q: 'handbook.q36',
    a: 'handbook.a36',
  },
  {
    cat: 'career',
    q: 'handbook.q37',
    a: 'handbook.a37',
  },
  {
    cat: 'career',
    q: 'handbook.q38',
    a: 'handbook.a38',
  },
  {
    cat: 'squad',
    q: 'handbook.q39',
    a: 'handbook.a39',
  },

  // ---------------- Market ----------------
  {
    cat: 'market',
    q: 'handbook.q40',
    a: 'handbook.a40',
  },
  {
    cat: 'market',
    q: 'handbook.q41',
    a: 'handbook.a41',
  },
  {
    cat: 'market',
    q: 'handbook.q42',
    a: 'handbook.a42',
  },
  {
    cat: 'market',
    q: 'handbook.q43',
    a: 'handbook.a43',
  },
  {
    cat: 'market',
    q: 'handbook.q44',
    a: 'handbook.a44',
  },
  {
    cat: 'market',
    q: 'handbook.q45',
    a: 'handbook.a45',
  },
  {
    cat: 'market',
    q: 'handbook.q46',
    a: 'handbook.a46',
  },
  {
    cat: 'market',
    q: 'handbook.q47',
    a: 'handbook.a47',
  },
  {
    cat: 'market',
    q: 'handbook.q48',
    a: 'handbook.a48',
  },

  // ---------------- The Club ----------------
  {
    cat: 'squad',
    q: 'handbook.q49',
    a: 'handbook.a49',
  },
  {
    cat: 'market',
    q: 'handbook.q50',
    a: 'handbook.a50',
  },
  {
    cat: 'club',
    q: 'handbook.q51',
    a: 'handbook.a51',
  },
  {
    cat: 'club',
    q: 'handbook.q52',
    a: 'handbook.a52',
  },
  {
    cat: 'club',
    q: 'handbook.q53',
    a: 'handbook.a53',
  },
  {
    cat: 'club',
    q: 'handbook.q54',
    a: 'handbook.a54',
  },
  {
    cat: 'club',
    q: 'handbook.q55',
    a: 'handbook.a55',
  },
  {
    cat: 'club',
    q: 'handbook.q56',
    a: 'handbook.a56',
  },
  {
    cat: 'club',
    q: 'handbook.q57',
    a: 'handbook.a57',
  },
  {
    cat: 'club',
    q: 'handbook.q58',
    a: 'handbook.a58',
  },
  {
    cat: 'club',
    q: 'handbook.q59',
    a: 'handbook.a59',
  },
  {
    cat: 'club',
    q: 'handbook.q60',
    a: 'handbook.a60',
  },
  {
    cat: 'club',
    q: 'handbook.q61',
    a: 'handbook.a61',
  },
  {
    cat: 'club',
    q: 'handbook.q62',
    a: 'handbook.a62',
  },
  {
    cat: 'club',
    q: 'handbook.q63',
    a: 'handbook.a63',
  },
  {
    cat: 'club',
    q: 'handbook.q64',
    a: 'handbook.a64',
  },

  // ---------------- Career ----------------
  {
    cat: 'career',
    q: 'handbook.q65',
    a: 'handbook.a65',
  },
  {
    cat: 'career',
    q: 'handbook.q66',
    a: 'handbook.a66',
  },
  {
    cat: 'career',
    q: 'handbook.q67',
    a: 'handbook.a67',
  },
  {
    cat: 'career',
    q: 'handbook.q68',
    a: 'handbook.a68',
  },
  {
    cat: 'career',
    q: 'handbook.q69',
    a: 'handbook.a69',
  },
  {
    cat: 'career',
    q: 'handbook.q70',
    a: 'handbook.a70',
  },
  {
    cat: 'career',
    q: 'handbook.q71',
    a: 'handbook.a71',
  },
  {
    cat: 'career',
    q: 'handbook.q72',
    a: 'handbook.a72',
  },
  {
    cat: 'career',
    q: 'handbook.q73',
    a: 'handbook.a73',
  },
  {
    cat: 'career',
    q: 'handbook.q74',
    a: 'handbook.a74',
  },
  {
    cat: 'career',
    q: 'handbook.q75',
    a: 'handbook.a75',
  },
  {
    cat: 'career',
    q: 'handbook.q76',
    a: 'handbook.a76',
  },
  {
    cat: 'career',
    q: 'handbook.q77',
    a: 'handbook.a77',
  },
  {
    cat: 'career',
    q: 'handbook.q78',
    a: 'handbook.a78',
  },
  {
    cat: 'career',
    q: 'handbook.q79',
    a: 'handbook.a79',
  },
]
