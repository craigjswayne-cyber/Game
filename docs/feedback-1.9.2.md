# 1.9.2: owner feedback (collecting, 18 Oct 2026)

Collected from the owner's first play of the 1.9.1 build. Work starts once the
list is complete.

1. **Title load-in.** The first paint before the script runs is a plain dark
   screen with PHASE / RUGBY MANAGER. Style it or replace it.
2. **Squads out of date.** Star players and captains who have left their clubs
   (Tomos Williams is now at Saracens; Gloucester's captain is Dewi Lake and
   their star player Jack Morgan; Len Ikitau has moved). Check every club's
   star player, captain and squad against current squads, for all teams.
3. **Manager's name** is capitalised (first letter) when entered at start-up.
4. **Replacements sheet:** colour-code tiredness. It colours at 60 minutes
   today; check whether that is driven by % or by the break.
5. **The referee never wears white** (he reads as the ball).
6. **Female referees** in the game too.
7. **Save slots:** 1 for free players, 4 for Pro Manager. Free players who
   already have more keep them playable but cannot start another until they
   are down to 1 or go Pro.
8. **Tablet:** the Store box and the next-match box sit too close; check the
   spacing.
9. **Injuries:** the manager always decides who comes on. The case seen was a
   head injury assessment (HIA), which swaps a temporary replacement on
   automatically. Make HIA ask the manager too, or at least make it plain.
10. **One advert per reward, never more.** Tapping a rewarded button (a
    favour for an ad) must play exactly one advert. The game asks Google for
    one rewarded spot per tap (`ads-bridge.js` showRewarded, one
    `showRewardVideoAd` call, the button locked while it runs); find where
    the extra adverts come from and stop them.
11. **Half-time recovery: +10%.** Everyone on the pitch gets 10 points of
    energy back at the half-time whistle (today energy only drains,
    `match/energy.ts`; `blowHalfTime` does not touch it). Keep the balance
    where it is: retune the drain so scoring, late-game tiredness and the
    value of the bench stay at today's figures (balance probes, soak), and
    record the fingerprint change with its reason.
12. **Demand more on offers.** About 60% of the time the bidder raises by
    10% to 20%. Today (`ai.ts` counterIncomingOffer) it is a 55% roll, a
    raise of 6% to 22% anchored to how far under value they opened, capped
    at 140% of value and the bidder's budget; otherwise they walk, or say
    best and final when already at the cap.
13. **Referee "allows 7 before reaching for a card": 7 what?** It counts
    infringements (`referee.ts` patience). Say so: "allows 7 infringements
    before reaching for a card", in all six languages.
14. **Pitches.** Saracens (StoneX), Newcastle (Kingston Park) and Gloucester
    (Kingsholm) are the three artificial pitches in the PREM; the game
    already has those three as artificial. Every other ground's surface is a
    guess from a hash of the club (`conditions.ts` clubSurface), which made
    Bristol hybrid; Bristol is not. Replace the guess with a researched
    surface for every PREM ground at least, grass where unconfirmed.
15. **Team talks must matter.** The right talk against the right opponent
    should be a real bonus; a bad talk against a good side should hurt the
    team heavily. Today (`teamtalk.ts`) the effect is a per-player multiplier
    capped at plus or minus 8% (`TALK_CAP` 0.08, slope `TALK_K_UP` 0.13 up,
    `TALK_K_DOWN` 0.1 down), so a wrong call barely shows. Raise the ceiling
    and make it depend on the setting (`talkSetting`: strength gap, home or
    away, big match): a bigger upside for the right tone, and a steeper
    penalty for the wrong tone against a stronger side. Retune so an average
    talk leaves results where they are today (balance probes, soak), and
    record the fingerprint change.
