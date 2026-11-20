# 1.9.15 backlog

Kept back from 1.9.14 (owner, 19 Nov 2026: "Ok keep them back for 1.9.15").
Nothing here is started.

## From a feedback report (iPhone, men's game, 1.9.13, 15 Nov 2026)

One career, one club, 5 seasons, 178 competitive matches: 152-1-41 (78%),
finishes 1st, 2nd, 1st, 2nd, 2nd in the top flight, 2 trophies, board 90,
fans 95, in credit, senior squad 27, free (Store opened twice, 7 rewarded
adverts). 45 loans, 52 bids, 121 instant results against 74 watched.
Never opened Settings, Handbook, Report a bug, Save and load. Play time
(1h 5m, 4 sessions) is only counted from 1.9.13, so it covers the sessions
since that update, not the career.

1. **Long careers at the top are too easy.** Ideas: rival clubs bid harder
   for a champion's stars, the board raises demands after titles, a thin
   squad pays more in injuries and fatigue. The engine fingerprint must not
   change without the owner's say.
2. **Difficulty settings are not found.** The player never opened Settings.
   Point to them where a player who wins a lot will see it.
3. **The Pro challenges are not discovered by a free player.** A tip, or a
   board letter after a title, that names the three challenge careers (no
   hidden tendency named, no pressure wording).

## From the 1.9.14 release QA (minor, no wrong result for a player)

- Loan buy-out fee priced against the borrowing club's squad, not the parent's (loans.ts:580).
- A free agent's morale drained by repeated lowball offers in one week (ai.ts:687).
- A player dropped mid-window counted twice for morale (natDrop, then the announcement).
- Walk-out: only the home side's challenge shows when both sides have one; kit clashes not handled in the walk-out lines; anthem numbers too small to read at 390px and below.
- Era card shows the Test record before the week settles.
- Store's Pro Manager line does not name the Pro challenges.
- Men's Rugby Championship review card replaced by the autumn window's opening (the news item is filed; the card is not shown).
- Women's position data: generic "prop" and "back row" sources still lean loosehead and flanker for players whose old position was in another family (squads now meet the matchday minimum, so this is balance, not a missing shirt).
- save.ts:1322 builds a missing league without reading `rp.released` (latent; no save is known to hit it).
- French `testday.danger` would read masculine in a women's Test.
- Six-tab bottom bar cuts labels at 320px during a Test window.
