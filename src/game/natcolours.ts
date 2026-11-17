// ---- A NATION'S COLOURS AND ITS ANTHEM (1.9.14) ----
//
// Owner: the international stage "needs to be improved and distinct". A Test
// was played in the token kit (the pitch reads kit colours from game.clubs,
// which holds no nations), and the only occasion before kick-off was one line
// of text. These are the colours each side traditionally plays in, close
// enough to be recognised on a small pitch, and the anthem sung before its
// Tests, by title. Titles are proper names: every language prints them as
// they are. A side that answers with a challenge after the anthems (the haka
// and its Pacific counterparts) names it, so the walk-out can show it.
export interface NatColours {
  /** shirt, then the second colour (shorts, trim) */
  kit: [string, string]
  anthem: string | null
  /** the challenge laid down after the anthems, if this side has one */
  challenge?: string
}

export const NAT_COLOURS: Record<string, NatColours> = {
  RSA: { kit: ['#006a4e', '#ffb81c'], anthem: "Nkosi Sikelel' iAfrika" },
  NZL: { kit: ['#111111', '#ffffff'], anthem: 'God Defend New Zealand', challenge: 'haka' },
  IRE: { kit: ['#00843d', '#ffffff'], anthem: "Ireland's Call" },
  FRA: { kit: ['#1f3c88', '#ffffff'], anthem: 'La Marseillaise' },
  ENG: { kit: ['#ffffff', '#1d2a5d'], anthem: 'God Save the King' },
  ARG: { kit: ['#75aadb', '#ffffff'], anthem: 'Himno Nacional Argentino' },
  SCO: { kit: ['#0e1e46', '#ffffff'], anthem: 'Flower of Scotland' },
  AUS: { kit: ['#ffcd00', '#00843d'], anthem: 'Advance Australia Fair' },
  FIJ: { kit: ['#ffffff', '#111111'], anthem: 'God Bless Fiji', challenge: 'Cibi' },
  ITA: { kit: ['#0066cc', '#ffffff'], anthem: "Il Canto degli Italiani" },
  WAL: { kit: ['#d30731', '#ffffff'], anthem: 'Hen Wlad Fy Nhadau' },
  GEO: { kit: ['#8b1e3f', '#ffffff'], anthem: 'Tavisupleba' },
  JPN: { kit: ['#d7001a', '#ffffff'], anthem: 'Kimigayo' },
  SAM: { kit: ['#0055a4', '#ffffff'], anthem: 'The Banner of Freedom', challenge: 'Siva Tau' },
  TGA: { kit: ['#c10000', '#ffffff'], anthem: "Ko e Fasi 'o e Tu'i 'o e 'Otu Tonga", challenge: 'Sipi Tau' },
  USA: { kit: ['#0a3161', '#ffffff'], anthem: 'The Star-Spangled Banner' },
  CAN: { kit: ['#d80621', '#111111'], anthem: 'O Canada' },
  URU: { kit: ['#5eb6e4', '#111111'], anthem: 'Himno Nacional de Uruguay' },
  POR: { kit: ['#c8102e', '#046a38'], anthem: 'A Portuguesa' },
  ESP: { kit: ['#c60b1e', '#ffc400'], anthem: 'Marcha Real' },
  ROU: { kit: ['#fcd116', '#002b7f'], anthem: 'Deșteaptă-te, române!' },
  NAM: { kit: ['#003580', '#ffffff'], anthem: 'Namibia, Land of the Brave' },
  CHL: { kit: ['#d52b1e', '#0039a6'], anthem: 'Himno Nacional de Chile' },
  // the touring XV of the four unions has no anthem of its own
  LIO: { kit: ['#c8102e', '#ffffff'], anthem: null },
}

/** A nation's kit, or null for a club (or a code with none on file). Women's
 *  sides wear their union's colours: the code is the code. */
export function natKit(code: string): [string, string] | null {
  return NAT_COLOURS[code]?.kit ?? null
}
export function natAnthem(code: string): string | null {
  return NAT_COLOURS[code]?.anthem ?? null
}
export function natChallenge(code: string): string | null {
  return NAT_COLOURS[code]?.challenge ?? null
}
