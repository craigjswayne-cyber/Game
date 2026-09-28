using System;
using Rugby.Engine;
using Rugby.Presentation;

namespace Rugby
{
    /// <summary>
    /// CONSOLE DRIVER. Builds two squads, runs the engine until ten breakdowns (phases of
    /// play) have been resolved, and prints every event as commentary with the numbers
    /// behind each breakdown. Then it finishes the match headless and prints the result,
    /// which is how the rest of a league's fixtures would be played.
    ///
    ///   dotnet run                 (seed 2026)
    ///   dotnet run -- 7            (another seed: same seed, same match, every time)
    /// </summary>
    public static class Program
    {
        private static readonly string[] Surnames =
        {
            "Genge", "George", "Stuart", "Itoje", "Martin", "Cunningham-South", "Earl", "Pollock",
            "Mitchell", "Smith", "Freeman", "Slade", "Lawrence", "Feyi-Waboso", "Steward",
            "Baille", "Mauvaka", "Atonio", "Meafou", "Flament", "Ollivon", "Cros", "Alldritt",
            "Dupont", "Ntamack", "Bielle-Biarrey", "Moefana", "Fickou", "Penaud", "Ramos",
        };

        public static int Main(string[] args)
        {
            if (args.Length > 0 && args[0] == "--calibrate") return Calibrate(args.Length > 1 ? int.Parse(args[1]) : 500);
            ulong seed = args.Length > 0 && ulong.TryParse(args[0], out var s) ? s : 2026UL;

            var home = BuildTeam("ENG", "England", TeamSide.Home, 0, seed);
            var away = BuildTeam("FRA", "France", TeamSide.Away, 15, seed + 1);

            // two opposite plans, so the tactic modifiers show up in the numbers
            home.Tactics = new TeamTactics
            {
                Defence = DefensiveSystem.RushDefence, Kicking = KickingStrategy.KickForTerritory,
                Attack = AttackShape.TightForwards, Breakdown = BreakdownIntent.SafePossession, RuckCommitment = 0.7,
            };
            away.Tactics = new TeamTactics
            {
                Defence = DefensiveSystem.Drift, Kicking = KickingStrategy.KeepInHand,
                Attack = AttackShape.PlayWide, Breakdown = BreakdownIntent.FastBall, RuckCommitment = 0.3,
            };

            var engine = new MatchEngine(home, away, seed);
            var commentary = new CommentaryRenderer(engine, seed ^ 0xC0FFEE);

            Console.WriteLine($"Seed {seed}. {home.Name} (rush defence, territory, tight, safe ball) v {away.Name} (drift, keep in hand, wide, fast ball)");
            Console.WriteLine(new string('-', 110));

            int breakdowns = 0;
            while (breakdowns < 10 && engine.Step())
            {
                while (engine.Events.TryDequeue(out var e))
                {
                    string line = commentary.Render(e);
                    if (line != null) Console.WriteLine(line);
                    string debug = CommentaryRenderer.Debug(e);
                    if (debug != null)
                    {
                        // one ResolveRuckPhase can emit two events (the tackle and the recycle): count it once
                        if (e.Type != MatchEventType.RuckSecured) { breakdowns++; Console.WriteLine(debug); }
                    }
                }
            }

            Console.WriteLine(new string('-', 110));
            Console.WriteLine($"{breakdowns} phases of play resolved in {engine.Tick} ticks ({engine.ClockSeconds / 60:0.0} match minutes).");

            // the rest of the match, headless: nobody is watching, so nobody drains commentary
            engine.Run();
            int drained = 0;
            while (engine.Events.TryDequeue(out _)) drained++;
            Console.WriteLine($"Full time: {home.Name} {home.Score} ({home.Tries} tries) - {away.Name} {away.Score} ({away.Tries} tries), " +
                              $"{engine.Tick} ticks, {drained} further events.");
            PrintTop(home); PrintTop(away);
            return 0;
        }

        /// <summary>
        /// Plays n full matches between two average sides with no tactics and prints the
        /// averages a designer tunes against (Test rugby: about 45 points and 5-6 tries a
        /// match between both sides, 140-160 tackles made per side).
        /// </summary>
        private static int Calibrate(int n)
        {
            double points = 0, tries = 0, tackles = 0, breaks = 0, turnovers = 0, penalties = 0, offloads = 0, homeWins = 0;
            for (int i = 0; i < n; i++)
            {
                var home = BuildTeam("H", "Home", TeamSide.Home, 0, (ulong)(1000 + i));
                var away = BuildTeam("A", "Away", TeamSide.Away, 15, (ulong)(5000 + i));
                var engine = new MatchEngine(home, away, (ulong)(90000 + i));
                engine.Run();
                while (engine.Events.TryDequeue(out var e))
                {
                    if (e.Type == MatchEventType.LineBreak) breaks++;
                    if (e.Type == MatchEventType.Turnover && !e.Data.ContainsKey("knockOn")) turnovers++;
                    if (e.Type == MatchEventType.PenaltyConceded || e.Type == MatchEventType.ScrumPenalty || e.Type == MatchEventType.MaulCollapsed) penalties++;
                    if (e.Type == MatchEventType.Offload) offloads++;
                }
                points += home.Score + away.Score; tries += home.Tries + away.Tries;
                foreach (var p in home.Players) tackles += p.TacklesMade;
                foreach (var p in away.Players) tackles += p.TacklesMade;
                if (home.Score > away.Score) homeWins++;
            }
            Console.WriteLine($"{n} matches: {points / n:0.0} points, {tries / n:0.00} tries, {tackles / n / 2:0} tackles a side, " +
                              $"{breaks / n:0.0} line breaks, {turnovers / n:0.0} breakdown turnovers, {penalties / n:0.0} penalties, " +
                              $"{offloads / n:0.0} offloads, home wins {homeWins / n:P0}");
            return 0;
        }

        private static void PrintTop(Team t)
        {
            RugbyPlayer tackler = null, carrier = null;
            foreach (var p in t.Players)
            {
                if (tackler == null || p.TacklesMade > tackler.TacklesMade) tackler = p;
                if (carrier == null || p.MetresCarried > carrier.MetresCarried) carrier = p;
            }
            Console.WriteLine($"  {t.Name}: most tackles {tackler.Name} ({tackler.TacklesMade}), most metres {carrier.Name} ({carrier.MetresCarried} m)");
        }

        /// <summary>A plausible Test XV: forwards strong and good at the breakdown, backs quick and skilful.</summary>
        private static Team BuildTeam(string id, string name, TeamSide side, int nameOffset, ulong seed)
        {
            var rng = new DeterministicRng(seed * 7919UL);
            var team = new Team(id, name, side);
            for (int shirt = 1; shirt <= 15; shirt++)
            {
                var pos = (Position)shirt;
                bool fwd = shirt <= 8;
                int r(int baseV) => baseV + rng.Range(-2, 3);
                var a = new PlayerAttribute
                {
                    Strength = r(fwd ? 16 : 11), Handling = r(fwd ? 11 : 15), Offloading = r(fwd ? 11 : 13),
                    Tackling = r(fwd ? 15 : 12), Aggression = r(fwd ? 14 : 10), Rucking = r(fwd ? 15 : 8),
                    Discipline = r(13), Pace = r(fwd ? 9 : 16), Stamina = r(14),
                    Kicking = r(shirt == 10 ? 17 : shirt == 15 || shirt == 9 ? 13 : 6), Decisions = r(13),
                };
                if (pos == Position.OpensideFlanker) a.Rucking += 3;
                team.Players.Add(new RugbyPlayer(nameOffset + shirt, Surnames[(nameOffset + shirt - 1) % Surnames.Length], pos, side, a));
            }
            return team;
        }
    }
}
