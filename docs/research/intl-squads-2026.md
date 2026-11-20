# International squads and caps, autumn 2026

Research log for `src/data/intl2026.ts` (owner, 1.9.16). One section per
union. A figure goes in the data file only when a source here gives it.

## How to research a union (what works from this environment)

- Search first. A page can only be fetched when its exact address came back as
  a search result; a remembered address is refused.
- The union's own announcement is the squad. englandrugby.com news pages
  refuse the fetch, so the squad came from a news site quoting the RFU list
  and was cross-checked against a second one.
- Caps: the union's Wikipedia page has a "Current squad" table with caps and a
  "caps updated" date. Search "<Nation> national rugby union team" so the page
  comes back as a result, then fetch it. Wikipedia's "2026 Six Nations
  Championship squads" page gives caps for six unions as of 5 Feb 2026.
- Caps wanted: the count before the autumn 2026 Tests (the day a career
  starts). For England that is the table dated 18 July 2026.

## England (men) - done, 9 caps to confirm

- Squad: 36 named 2 Nov 2026, 20 forwards and 16 backs. Sources: rugby365
  ("Borthwick names 36-man England squad for Australia Test", 2 Nov 2026) and
  Planet Rugby (same day); the two lists agree name for name. Out from the
  October camp: Noah Caluori, Max Ojomoh, Kepu Tuipulotu, Alex Mitchell
  (injured), Archie McParland. One uncapped: Greg Fisilau.
- Caps: Wikipedia, England national rugby union team, "Caps updated 18 July
  2026 (after Argentina v England)".
- Still to confirm (null in the file): Fin Baxter, Ben Curry, Maro Itoje,
  Tom Pearson, Will Stuart, Fraser Dingwall, Will Joseph, Joe Marchant,
  Harry Randall. Known floors from Wikipedia's Six Nations page (5 Feb 2026):
  Itoje 97, Dingwall 7.

### Found for the player audit (not yet changed in the squad files)

- Vilikesa Sela is in the world as FIJ; England named him (uncapped) in 2026.
- Benhard Janse van Rensburg is in the world as RSA; he has 2 England caps.
- Noah Caluori (Saracens wing, 2 England caps) is not in the world.
- Club moves the 2 Nov squad list shows for 2026-27: George Furbank at
  Harlequins, George Martin at Saracens, Joe Marchant at Sale, Luke
  Cowan-Dickie at Sale. Check each against the squad files.
- Greg Fisilau (Exeter), Emmanuel Iyogun (Northampton), Arthur Clark and
  Will Joseph (Gloucester), Kepu Tuipulotu, Archie McParland: confirm present.

## To do, in this order

Men: France, Ireland, Scotland, Wales, Italy, South Africa, New Zealand,
Australia, Argentina, Fiji, Japan, then Samoa, Tonga, USA, Canada.
Women: England, France, Ireland, Scotland, Wales, Italy, New Zealand,
Australia, USA, Canada (check `testNationsIn` for the ten in a women's world).
