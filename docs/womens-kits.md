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
- The twenty clubs of the English women's Championship, which all still wear the
  same blue and white. That is the biggest single defect in the data: a division
  with no visual identity, where every fixture is a colour clash. Eight of the
  twenty have findable colours and ten do not, so the fix waits for a source
  rather than for an invention.

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

## 5. English women's Championship tier — 20 clubs, all `#1e5aa8` / `#ffffff`

**Is it worth fixing? Yes — this is the single most visible colour problem in the data.** Twenty
identical clubs means the tier has no visual identity at all: every fixture, kit clash check, league
table and badge renders the same. It also makes clash detection meaningless, because every match in
the division is a same-colour fixture. Even a partial fix (the eight rows below, plus distinct
invented-but-plausible palettes for the rest) would be a large improvement over what is there now.
Because every current pair is identical, **all 20 are WRONG by definition.**

| Game name | Real club | Actual colours | Suggested hexes | Confidence |
|---|---|---|---|---|
| Bath | Bath Rugby (women) | Blue, black and white | `#0f2b5b` *(approx)* / `#0e0e0e` | Medium — colours named, hexes approximate |
| Richmond | Richmond Women (Richmond FC) | Old gold, red and black | `#c9a227` / `#c8102e` | Good |
| London Hibernians | London Irish (London Irish Women, "The Emeralds") | Green, "head to toe" | `#00693c` *(approx)* / `#ffffff` | Good on colour, hex approximate |
| North Bristol | North Bristol RFC | Red and blue | `#c8102e` / `#12295c` | **Low** — only the club's own social-media colour emoji supports this |
| Exeter University | Exeter University RFC | Green and white stripes (change: light green) | `#0e5a3a` / `#ffffff` | Good |
| St Albans | Old Albanian RFC | — | — | **UNVERIFIED** |
| Beckenham | Beckenham RFC | Blue and gold (originally red/white stripes, 1894) | `#12295c` / `#c9a227` | Medium |
| Eastleigh | Trojans RFC, Eastleigh | — | — | **UNVERIFIED** |
| Ivybridge | Ivybridge RFC | — | — | **UNVERIFIED** |
| Thurrock | Thurrock RFC (T-Birds) | — | — | **UNVERIFIED** |
| Lichfield | Lichfield Ladies | Red and green (1st XV "Reds", 2nd XV "Greens") | `#c8102e` / `#0e5a3a` | Medium |
| Loughborough Town | Loughborough Students RUFC | Sources conflict: one lists purple (change grey), another a maroon shirt with black/white trim | `#4b2e83` *(approx)* / `#a7a9ac` | **Low** — conflicting sources |
| Harrogate | Harrogate RUFC | Black, red and yellow hoops (change: black with red/yellow trim) | `#0e0e0e` / `#c8102e` | Good |
| Novocastrians | Novocastrians RFC ("Novos"), Newcastle | — | — | **UNVERIFIED** |
| Kenilworth | Kenilworth RFC | — | — | **UNVERIFIED** |
| Cheltenham | Cheltenham Tigers RFC | — | — | **UNVERIFIED** |
| Blaydon | Blaydon RFC | — | — | **UNVERIFIED** |
| Bury St Edmunds | Bury St Edmunds RUFC | Green and gold stripe and trim (change: black with green trim) | `#0e5a3a` / `#c9a227` | Good |
| Barnsley | Barnsley RUFC | — | — | **UNVERIFIED** |
| Buckingham | Buckingham RUFC | — | — | **UNVERIFIED** |

---

## Tally

| Tier | Clubs | RIGHT | CLOSE | WRONG | Unverified |
|---|---|---|---|---|---|
| PWR (England) | 9 | 3 | 3 | 3 | 0 |
| Celtic / British | 6 | 0 | 0 | 6 | 0 |
| Pacific / Southern | 9 | 0 | 3 | 6 | 0 |
| French Elite | 10 | 3 | 1 | 5 | 1 |
| **Subtotal (the 34 named clubs)** | **34** | **6** | **7** | **20** | **1** |
| English Championship | 20 | 0 | 0 | 20 | 12 of the 20 have no findable colours |

## Highest-value fixes, in order

1. **The 20 Championship clubs** — identical colours, worst single defect. Eight are fixable from sources today.
2. **Harlequins** — navy/purple for a club whose whole identity is magenta-and-light-blue quarters.
3. **Leinster (Dublin RFC)** — green for a club that plays in blue.
4. **NSW Waratahs** — red for a club whose nickname is effectively "sky blue".
5. **The two Welsh sides** — they appear swapped, and neither pair matches.
6. **Glasgow Warriors and Edinburgh** — both use retired/never-used colour schemes (Edinburgh dropped black-and-red in 2018).
7. **Gloucester-Hartpury and Exeter Chiefs** — right primary, invented secondary (navy and gold respectively; both should be white).
