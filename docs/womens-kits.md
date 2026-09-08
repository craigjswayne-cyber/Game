# Women's kit colours, checked club by club (v1.5.4)

Every women's club in the game carries two hex colours, and the owner asked for
them to be checked one by one against what the real clubs wore last season.
This is the result of that check and the record of what was changed.

**How much to trust it.** The research ran through a network proxy that blocked
every club site, kit manufacturer and reference page it tried, so the findings
below come from search-result text rather than from pages read end to end.
Colours that are common knowledge for a well-known club (Leinster blue, the
Waratahs' sky blue, Harlequins' quartered magenta and light blue) are safe.
Shades marked *(approx)* and rows marked UNVERIFIED are not, and the ones marked
UNVERIFIED were deliberately LEFT ALONE in the data rather than guessed at.

**What was changed in v1.5.4:** twenty-four clubs, across the PWR, the Celtic
sides, the Pacific sides and the French Elite 1. See the table.

**What was not changed, and why:**
- Loughborough Lightning. The pink trim is plausible and the gold may belong to
  the change kit, but neither could be established well enough to act on.
- Canterbury. The game's "Canterbury RFC" could mean Matatū, whose colour is
  aquamarine, or the Canterbury province, who are red and black. Red and black
  is right for one of them, so it stays until somebody decides which.
- The twenty clubs of the English women's Championship used to wear the same
  blue and white, which was the biggest single defect in the data: a division
  with no visual identity, where every fixture was a colour clash. Seventeen have
  since been given their real club's colours (section 5). Thurrock, Novocastrians
  and Kenilworth still wear the placeholder, because no reachable source states
  their colours and the fix waits for a source rather than for an invention.

## 1. Premiership Women's Rugby (England) — 9 clubs

| Game name | Real club | Actual kit last season | Game hexes | Verdict | Should be |
|---|---|---|---|---|---|
| Gloucester RFC | Gloucester-Hartpury | Cherry-and-white hoops (Macron 25/26, chevron in the white hoops, black collar trim) | `#8b1a2b` / `#0e1c3d` | **WRONG** | `#8b1a2b` / `#ffffff` — navy is not a Gloucester playing colour; the second colour is white |
| Sarries RFC | Saracens Women | Black and red (Castore 25/26 home, worn by men and women) | `#0e0e0e` / `#c02f3a` | **RIGHT** | optional exact: `#000000` / `#be1824` |
| Bristol RFC | Bristol Bears Women | Club colours navy, red, white. 25/26 home (O'Neills) was a two-tone **blue** hooped shirt for both teams | `#0a2240` / `#c02f3a` | **RIGHT** | fine as club identity; if you want the literal 25/26 shirt it was navy + a lighter blue |
| Quins Rugby | Harlequins Women | Quartered magenta / light blue / chocolate / French grey (Castore 25/26 quartered shirt) | `#0a1e3c` / `#7b2d8e` | **WRONG** | `#c70750` / `#80bfea` — Quins play in magenta and light blue, not navy and purple |
| Ealing RFC | Ealing Trailfinders Women | Green and white home (women's version carries a purple accent); black/purple away | `#0e5a3a` / `#ffffff` | **RIGHT** | — |
| Exeter RFC | Exeter Chiefs Women | Black home, white change (25/26 kit shared with the men) | `#0e0e0e` / `#c9a227` | **WRONG** | `#0e0e0e` / `#ffffff` — yellow exists in the wider brand palette but is not the shirt's second colour |
| Loughborough RFC | Loughborough Lightning | 25/26 home: "African violet" purple with **pink** collar/chevron/sleeve trim. Black-green-gold is the *alternate* (Northampton Saints tie-in) | `#3b1d6e` / `#c9a227` | **CLOSE** | `#6d2e93` *(approx)* / `#e5397f` *(approx)* — the violet is lighter than `#3b1d6e`, and gold belongs to the change kit |
| Leicester RFC | Leicester Tigers Women | Green / white / red hooped shirt | `#0a5c36` / `#c02f3a` | **CLOSE** | `#0b4433` / `#ab1d2d` — official Tigers green is darker |
| Sale RFC | Sale Sharks Women | Navy with white | `#12295c` / `#ffffff` | **CLOSE** | `#0d2e4f` / `#ffffff` — official Sale navy is greener/darker |

## 2. Celtic / British sides — 6 clubs

The user-supplied mapping (Belfast = Ulster, Dublin = Leinster) points at the **IRFU interprovincial**
teams. Note that the cross-border league those sides mostly play (the Celtic Challenge) actually
fields *Clovers* and *Wolfhounds* for Ireland, not Ulster and Leinster; the Welsh entries below are
mapped to the two Celtic Challenge sides because no other real "North/South Wales" women's clubs exist.

| Game name | Real club | Actual kit last season | Game hexes | Verdict | Should be |
|---|---|---|---|---|---|
| Belfast RFC | Ulster Women | 25/26 Castore home is a retro **red-and-white** colourway (red/white cuffs and socks); first worn by Ulster Women v Leinster, 10 Aug 2025 | `#0a2240` / `#c8102e` | **WRONG** | `#ffffff` / `#c8102e` — Ulster's shirt is white; navy is a shorts/trim colour only |
| Dublin RFC | Leinster Women | Leinster blue home jersey (Castore), 12-counties linear print | `#0a5c36` / `#ffffff` | **WRONG** | `#005daa` / `#ffffff` — Leinster are blue, not green |
| Edinburgh RFC | Edinburgh Rugby (women) | Club dropped black-and-red in 2018. 25/26 Macron home = navy base with reflex blue, white and **burnt orange** brushstrokes; alternate white with navy and burnt orange | `#0e0e0e` / `#c9a227` | **WRONG** | `#1b2a4a` *(approx)* / `#d4622a` *(approx)* — exact brand hexes UNVERIFIED |
| South Wales RFC | Gwalia Lightning (Cardiff Arms Park / Cardiff Met) | **Blue and yellow** | `#c8102e` / `#0e0e0e` | **WRONG** | `#1b4b9b` *(approx)* / `#f5b301` *(approx)*. **Caveat:** if the intended club was actually Brython Thunder, then red/black is RIGHT — the two Welsh rows look swapped |
| North Wales RFC | Brython Thunder (Parc y Scarlets, also Eirias Stadium, Colwyn Bay) | **Red and black** | `#0e5a3a` / `#f5b301` | **WRONG** | `#c8102e` / `#0e0e0e` |
| Glasgow RFC | Glasgow Warriors (women) | 25/26 Macron home: mainly **black** with light-blue V-neck and sleeve edging, black/light-blue/white tartan print. Alternate is light blue | `#12295c` / `#c8102e` | **WRONG** | `#000000` / `#59adeb` — red is not a Warriors colour |

## 3. Pacific / Southern sides — 9 clubs

Assessed against the **Super Rugby Aupiki / Super Rugby Women's franchise** the game name points at,
per the brief. Where the New Zealand *provincial* (Farah Palmer Cup) team of the same name would give
a different answer, that is called out.

| Game name | Real club | Actual kit last season | Game hexes | Verdict | Should be |
|---|---|---|---|---|---|
| Auckland RFC | Blues (Blues Women) | Dark blue with white | `#00539f` / `#ffffff` | **CLOSE** | `#0b1864` / `#ffffff` — the Blues' blue is much darker than `#00539f` |
| Waikato RFC | Chiefs Manawa | Play the **same home jersey as the men's Chiefs**: Chiefs Country colours black, red and yellow, predominantly black | `#f5b301` / `#0e0e0e` | **WRONG** | `#0e0e0e` / `#c8102e` (yellow as a third). *If the intended team is Waikato province (FPC), red/yellow/black hoops make a yellow primary defensible* |
| Canterbury RFC | Matatū (Christchurch) | Matatū's stated official colour is **aquamarine** — the glacial blues/greens of the central South Island; not red-and-black | `#c8102e` / `#0e0e0e` | **WRONG for Matatū / RIGHT for Canterbury province** | If Matatū: an aquamarine + black pair. Exact aquamarine hex **UNVERIFIED**. If you mean Canterbury FPC, red/black is correct as-is |
| Wellington RFC | Hurricanes Poua | **Black and yellow** | `#f8d000` / `#0a0a3c` | **WRONG** | `#f8d000` / `#0e0e0e` — navy is not a Poua/Wellington colour. Same fix applies if you mean Wellington province |
| Fiji RFC | Fijian Drua Women (Fijiana Drua) | Bold blues; brand palette blue `#0A14BE` plus royal blue, teal, aqua teal, white | `#0a2f7a` / `#ffffff` | **CLOSE** | `#0a14be` / `#ffffff` — the Drua blue is far more saturated |
| Perth RFC | Western Force Women | Blue and gold since 2005; 2025 20th-anniversary home returned to the original **periwinkle blue** with gold numbers; away is gold | `#0a2240` / `#3aa9e0` | **WRONG** | `#054992` / `#ffc72c` *(gold approx)* — the second colour is gold, not cyan |
| New South Wales RFC | NSW Waratahs Women | Sky / "Cambridge" blue home shirt with navy heritage collar and navy cuff bands | `#c8102e` / `#ffffff` | **WRONG** | sky blue *(approx `#0085ca`, exact hex **UNVERIFIED**)* / `#0e1d3d`. Red appears only in the crest |
| Queensland RFC | Queensland Reds Women | Maroon | `#8b1a2b` / `#ffffff` | **CLOSE** | `#98022c` / `#ffffff` |
| Canberra RFC | ACT Brumbies Women | Club colours dark blue `#002B54`, gold `#FFC222`, grey `#A7A9AC`; the jersey is navy-dominant | `#f5b301` / `#0a2240` | **CLOSE (order reversed)** | `#002b54` / `#ffc222`. I could not find a 2025 *women's* kit launch page, so the navy-dominance is from the club palette, not a women's-kit source |

## 4. French Elite 1 / Elite 2 — 10 clubs (lower priority)

| Game name | Real club | Actual colours | Game hexes | Verdict | Should be |
|---|---|---|---|---|---|
| Toulouse | Stade Toulousain Women | *Rouge et noir* — red and black; 25/26 women's home is a heritage red/black design | `#8b1a2b` / `#0e0e0e` | **CLOSE** | `#c8102e` / `#0e0e0e` — Toulouse red is brighter than `#8b1a2b` |
| Bordeaux | Stade Bordelais Women (24-25 Elite 1 champions) | Club adopted **bordeaux (burgundy) and white** in the early 2010s (original colours were yellow/black); the women play in burgundy or white with burgundy shorts | `#0a2240` / `#c8102e` | **WRONG** | `#6b2231` *(approx)* / `#ffffff` |
| Blagnac | Blagnac Rugby (Blagnac SCR Women) | **Red and blue** | `#c8102e` / `#ffffff` | **WRONG** | `#c8102e` / `#1b4b9b` *(approx)* |
| Romagnat | ASM Romagnat, now ASM Rugby Féminin | **Yellow and blue** since the 2016 ASM Clermont tie-up (previously yellow and black) | `#0a5c36` / `#c8102e` | **WRONG** | `#f2e500` *(approx)* / `#17255a` *(approx)* |
| Montpellier | MHR Féminines | Navy blue and white ("bleu et blanc"); navy is the historic home colour, white the away | `#0a2240` / `#f5b301` | **WRONG** | `#0a2240` / `#ffffff` |
| Grenoble | FC Grenoble Amazones | FCG are commonly the *bleu et rouge*, but no source in my results stated it explicitly | `#0a2240` / `#c8102e` | **UNVERIFIED** (likely right) | leave as-is pending confirmation |
| Lyon | Lyon OU (LOU) Rugby Women | Red and black, adopted 1902 | `#c8102e` / `#0e0e0e` | **RIGHT** | — |
| Toulon | RC Toulon (women) | *Rouge et noir* — red and black, from the city's coat of arms | `#c8102e` / `#0e0e0e` | **RIGHT** | (whether RCT field an Elite 1/2 women's side is **UNVERIFIED**) |
| Bobigny | AC Bobigny 93 Rugby Women | **Red and black** | `#f5b301` / `#0e0e0e` | **WRONG** | `#c8102e` / `#0e0e0e` — yellow is not a Bobigny colour |
| La Rochelle | Stade Rochelais Women | *Les Jaune et Noir* — yellow and black | `#0e0e0e` / `#f5b301` | **RIGHT** | — |

## 5. English women's Championship tier — SHIPPED, 17 of 20 fixed

All twenty clubs used to carry the same `#1e5aa8` / `#ffffff`. That gave the tier no visual
identity at all: every fixture was a same-colour fixture, so clash detection in the division was
meaningless. Seventeen now carry the real club's traditional playing colours. Three do not, because
nothing reachable from here states them.

**How the colours were found.** Direct page fetches are blocked by this environment's egress proxy
(Wikipedia, National League Rugby, every club site, plain `curl`), and Wikipedia club infoboxes draw
kit as images anyway, so everything below rests on search-result text: county-RFU directories, club
history pages, and kit-supplier product listings whose titles name the colourway. Only **Bath** and
**London Irish** publish an actual brand hex. Every other value marked *(approx)* is a rendering of
a colour named in words, which is the honest ceiling at this level of the game.

| Game name | Real club | Colours in words | Shipped hexes | Confidence |
|---|---|---|---|---|
| Bath | Bath Rugby (women's section) | Blue, black and white | `#005baa` / `#000000` | **Official hex** (Bath brand blue, PMS 293C) |
| Richmond | Richmond FC (Richmond Women) | Old gold, red and black hoops | `#cfb53b` *(approx)* / `#c8102e` *(approx)* | Good on colour |
| London Hibernians | London Irish (London Irish Women) | Green, white trim | `#006238` / `#ffffff` | **Official hex** (club's traditional green) |
| North Bristol | North Bristol RFC | Royal blue with a single 6-inch red hoop | `#1051a5` *(approx)* / `#ce2029` *(approx)* | Medium — club History & Identity page, snippet only |
| Exeter University | Exeter University RFC | Green and white stripes (light green change) | `#00693c` *(approx)* / `#ffffff` | Good on colour |
| St Albans | Old Albanian RFC | Maroon, gold and navy | `#7a1f2b` *(approx)* / `#d4a017` *(approx)* | Good — two independent snippets |
| Beckenham | Beckenham RFC | Blue and gold (founded 1894 in red/white stripes) | `#1b4f9c` *(approx)* / `#e8b417` *(approx)* | Good on colour |
| Eastleigh | Trojans RFC, Eastleigh | Navy blue with red trim | `#0c1f45` *(approx)* / `#c8102e` *(approx)* | Medium — World Rugby Museum entry for an 1880s club cap |
| Ivybridge | Ivybridge RFC | Bottle green; second colour never established | `#14452f` *(approx)* / `#ffffff` **(chosen, not sourced)** | Partial — green evidenced, white is a free choice |
| Thurrock | Thurrock RFC, Grays | — | still `#1e5aa8` / `#ffffff` | **UNVERIFIED** |
| Lichfield | Lichfield RUFC (Lichfield Ladies) | Myrtle green shirts, red trim, navy shorts | `#2f6b57` *(approx)* / `#c8102e` *(approx)* | Good — Staffs RFU directory plus club colour history |
| Loughborough Town | Loughborough Students RUFC | Purple, grey change | `#4b2e83` *(approx)* / `#8e9295` *(approx)* | Medium — an earlier pass found a conflicting maroon source |
| Harrogate | Harrogate RUFC | Black, red and yellow hoops | `#0e0e0e` / `#c8102e` *(approx)* | Good — National League Rugby club-colours listing |
| Novocastrians | Novocastrians RFC ("Novos"), Benton | — | still `#1e5aa8` / `#ffffff` | **UNVERIFIED** |
| Kenilworth | Kenilworth RFC | — | still `#1e5aa8` / `#ffffff` | **UNVERIFIED** |
| Cheltenham | Cheltenham Tigers RFC, Newlands Park | Red and black | `#c8102e` *(approx)* / `#000000` | Good — O'Neills club-shop colourway codes |
| Blaydon | Blaydon RFC, Swalwell | Red shirts, white shorts | `#c41e24` *(approx)* / `#ffffff` | Good on colour |
| Bury St Edmunds | Bury St Edmunds RUFC, The Haberden | Green with gold stripe and trim | `#14663b` *(approx)* / `#e0a80d` *(approx)* | Good — league colours listing, snippet only |
| Barnsley | Barnsley RUFC, Shaw Lane | Navy; second colour never established | `#172447` *(approx)* / `#ffffff` **(chosen, not sourced)** | Partial — navy evidenced from the club's Samurai range |
| Buckingham | Buckingham RUFC ("the Swans") | Green and white | `#007a33` *(approx)* / `#ffffff` | Good — O'Neills shop colourway `grn-wht` |

### The three still on the placeholder

Thurrock, Novocastrians and Kenilworth keep `#1e5aa8` / `#ffffff` on purpose. Searched and found
nothing that states a colour: Wikipedia (kit rendered as images), each club's own site and RFU
club page, the county unions, PlaySport, and the clubs' kit shops — Victor Trophies and Fenton
Sports for Thurrock, Canterbury for Novocastrians, Akuma for Kenilworth. Product listings exist but
never name a colourway. **A wrong colour worn confidently is worse than an obvious placeholder**, so
these three wait for somebody who has seen a shirt.

### Two earlier findings corrected

An earlier pass of this document had **Harrogate** as green and white and **Lichfield** as red and
green. Both were re-checked: Harrogate is black, red and yellow hoops (the green-and-white line came
from a club-history anecdote about members resisting a switch, not the current kit), and Lichfield
is myrtle green with red trim, not red-primary. The shipped values follow the corrections.

### Remaining clash risk inside the division

- **Green** still covers four clubs: Exeter University `#00693c`, Buckingham `#007a33`,
  Bury St Edmunds `#14663b` and Ivybridge `#14452f`. The secondaries separate Bury St Edmunds
  (gold) and Ivybridge is much darker, but Exeter and Buckingham are close and both pair with white.
  They are genuinely similar in real life, so this is faithful rather than lazy.
- **Blue** covers Bath `#005baa`, Beckenham `#1b4f9c` and North Bristol `#1051a5`, plus the three
  placeholders. Secondaries differ (black, gold, red), which is what a clash check keys on.
- **Red primaries:** Cheltenham `#c8102e` and Blaydon `#c41e24`, separated by black against white.


---

## Tally

| Tier | Clubs | RIGHT | CLOSE | WRONG | Unverified |
|---|---|---|---|---|---|
| PWR (England) | 9 | 3 | 3 | 3 | 0 |
| Celtic / British | 6 | 0 | 0 | 6 | 0 |
| Pacific / Southern | 9 | 0 | 3 | 6 | 0 |
| French Elite | 10 | 3 | 1 | 5 | 1 |
| **Subtotal (the 34 named clubs)** | **34** | **6** | **7** | **20** | **1** |
| English Championship | 20 | 2 | 15 | 0 | 3 still on the placeholder |

## Highest-value fixes, in order

1. ~~**The 20 Championship clubs**~~ — DONE. 17 of 20 now carry real colours; Thurrock, Novocastrians and Kenilworth still need a human eye on a shirt.
2. **Harlequins** — navy/purple for a club whose whole identity is magenta-and-light-blue quarters.
3. **Leinster (Dublin RFC)** — green for a club that plays in blue.
4. **NSW Waratahs** — red for a club whose nickname is effectively "sky blue".
5. **The two Welsh sides** — they appear swapped, and neither pair matches.
6. **Glasgow Warriors and Edinburgh** — both use retired/never-used colour schemes (Edinburgh dropped black-and-red in 2018).
7. **Gloucester-Hartpury and Exeter Chiefs** — right primary, invented secondary (navy and gold respectively; both should be white).
