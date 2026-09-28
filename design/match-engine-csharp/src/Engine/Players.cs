using System;
using System.Collections.Generic;

namespace Rugby.Engine
{
    public enum Position
    {
        LooseheadProp = 1, Hooker = 2, TightheadProp = 3, Lock4 = 4, Lock5 = 5,
        BlindsideFlanker = 6, OpensideFlanker = 7, Number8 = 8, ScrumHalf = 9, FlyHalf = 10,
        LeftWing = 11, InsideCentre = 12, OutsideCentre = 13, RightWing = 14, FullBack = 15,
    }

    public enum TeamSide { Home = 0, Away = 1 }

    /// <summary>
    /// A player's attributes on the classic 1..20 management-sim scale. A struct, so a
    /// snapshot can be copied into an event or a replay without aliasing the live player.
    /// </summary>
    public struct PlayerAttribute
    {
        public int Strength;
        public int Handling;
        public int Offloading;
        public int Tackling;
        public int Aggression;
        public int Rucking;     // clearing out and jackalling at the breakdown
        public int Discipline;  // staying on side, releasing, rolling away
        public int Pace;
        public int Stamina;
        public int Kicking;
        public int Decisions;

        public static PlayerAttribute Uniform(int v) => new PlayerAttribute
        {
            Strength = v, Handling = v, Offloading = v, Tackling = v, Aggression = v, Rucking = v,
            Discipline = v, Pace = v, Stamina = v, Kicking = v, Decisions = v,
        };

        /// <summary>Clamps every attribute into 1..20.</summary>
        public PlayerAttribute Clamped()
        {
            int c(int x) => x < 1 ? 1 : x > 20 ? 20 : x;
            return new PlayerAttribute
            {
                Strength = c(Strength), Handling = c(Handling), Offloading = c(Offloading), Tackling = c(Tackling),
                Aggression = c(Aggression), Rucking = c(Rucking), Discipline = c(Discipline), Pace = c(Pace),
                Stamina = c(Stamina), Kicking = c(Kicking), Decisions = c(Decisions),
            };
        }
    }

    public sealed class RugbyPlayer
    {
        public int Id { get; }
        public string Name { get; }
        public Position Position { get; }
        public TeamSide Side { get; }
        public PlayerAttribute Attributes { get; }

        /// <summary>0 = fresh, 1 = spent. Raised by work, lowered a little by stoppages.</summary>
        public double Fatigue { get; private set; }

        /// <summary>Where the player is standing, in pitch metres. Written by the engine each phase.</summary>
        public Vec2 Location { get; set; }

        /// <summary>Per-match counting stats, owned by the engine.</summary>
        public int TacklesMade { get; set; }
        public int TacklesMissed { get; set; }
        public int Carries { get; set; }
        public int MetresCarried { get; set; }
        public int Offloads { get; set; }
        public int TurnoversWon { get; set; }
        public int PenaltiesConceded { get; set; }

        public RugbyPlayer(int id, string name, Position position, TeamSide side, PlayerAttribute attributes)
        {
            Id = id; Name = name; Position = position; Side = side; Attributes = attributes.Clamped();
        }

        public bool IsForward => (int)Position <= 8;

        /// <summary>
        /// How much of the player's ability is available right now. Fatigue bites harder
        /// on a low-stamina player: at full fatigue a stamina-1 player keeps 65% of their
        /// ability, a stamina-20 player keeps 85%.
        /// </summary>
        public double Effectiveness =>
            1.0 - Fatigue * (0.35 - 0.20 * MathX.Norm20(Attributes.Stamina));

        /// <summary>Adds work. A high-stamina player tires up to 45% slower.</summary>
        public void AddWork(double effort)
        {
            double rate = 1.0 - 0.45 * MathX.Norm20(Attributes.Stamina);
            Fatigue = MathX.Clamp(Fatigue + effort * rate, 0, 1);
        }

        public void Recover(double amount) => Fatigue = MathX.Clamp(Fatigue - amount, 0, 1);

        public override string ToString() => $"{Name} ({(int)Position})";
    }

    public sealed class Team
    {
        public string Id { get; }
        public string Name { get; }
        public TeamSide Side { get; }
        public List<RugbyPlayer> Players { get; } = new List<RugbyPlayer>(15);
        public TeamTactics Tactics { get; set; } = new TeamTactics();
        public int Score { get; set; }
        public int Tries { get; set; }

        public Team(string id, string name, TeamSide side) { Id = id; Name = name; Side = side; }

        /// <summary>+1 if this team attacks towards X = 100, -1 towards X = 0.</summary>
        public int AttackDirection => Side == TeamSide.Home ? 1 : -1;

        /// <summary>How far this team is from its own try line (0) towards the opposition's (100).</summary>
        public double MetresUpfield(Vec2 ball) => Side == TeamSide.Home ? ball.X : Vec2.PitchLength - ball.X;

        public RugbyPlayer ByShirt(Position p)
        {
            foreach (var pl in Players) if (pl.Position == p) return pl;
            throw new InvalidOperationException($"{Name} has no {p}");
        }

        /// <summary>The average of one attribute across the XV, optionally forwards or backs only.</summary>
        public double Average(Func<PlayerAttribute, int> pick, bool? forwards = null)
        {
            double sum = 0; int n = 0;
            foreach (var p in Players)
            {
                if (forwards.HasValue && p.IsForward != forwards.Value) continue;
                sum += pick(p.Attributes) * p.Effectiveness; n++;
            }
            return n == 0 ? 0 : sum / n;
        }
    }
}
