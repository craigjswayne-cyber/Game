using System;
using System.Collections.Generic;

namespace Rugby.Engine
{
    /// <summary>
    /// THE HEADLESS MATCH ENGINE.
    ///
    /// ARCHITECTURE. The engine owns the match state and nothing else: no strings, no
    /// Unity types, no clock of its own. Each call to Step() is one TICK, and one tick
    /// resolves exactly one state of the finite state machine below (a phase-based tick,
    /// not a fixed 100 ms one: rugby is a sequence of discrete contests, and resolving one
    /// contest per tick keeps the engine cheap enough to simulate every match in a league
    /// in the background). Each handler advances the GAME clock by what that phase costs
    /// in real rugby (a recycled ruck about 7 s, a scrum about 45 s, a conversion 75 s).
    /// The presentation layer decides how fast those ticks are played to the viewer, so
    /// "Fast", "Normal" and "Instant result" all run the identical engine.
    ///
    /// DETERMINISM. Every random draw comes from one DeterministicRng seeded at kick-off,
    /// and draws happen in a fixed order, so (seed, teams, tactics, inputs) always replays
    /// the same match. Anything cosmetic the UI wants to randomise must use its own RNG.
    ///
    /// OUTPUT. Every resolved contest is emitted as a MatchEvent into Events. The UI drains
    /// the queue: text commentary, the 2D pitch and the stats panel are all consumers.
    ///
    /// THE PITCH. Ball and player positions are metres in a 100 x 70 box: X = 0 is the home
    /// try line and X = 100 the away try line, Y = 0 and 70 the touchlines. Home attacks
    /// towards +X and away towards -X (Team.AttackDirection), so "metres gained" is always
    /// ball.X += direction * metres. Phase play works like this: each carry moves the ball
    /// the metres the collision decided; the ruck forms where the tackle happened; the next
    /// carry starts there and is swung towards the open side (the wider half of the field)
    /// by up to a few metres a phase, further when the team plays wide. When a carry would
    /// take the ball past the opposition try line (X &gt;= 100 for home) it is a try; a
    /// team pinned inside its own 22 (MetresUpfield &lt; 22) is more likely to kick.
    /// </summary>
    public sealed class MatchEngine
    {
        public const double HalfLengthSeconds = 40 * 60;

        public Team Home { get; }
        public Team Away { get; }
        public MatchState State { get; private set; } = MatchState.KickOff;
        public TeamSide Possession { get; private set; }
        public Vec2 Ball { get; private set; } = new Vec2(50, 35);
        public double ClockSeconds { get; private set; }
        public int Tick { get; private set; }
        public int Half { get; private set; } = 1;
        public int PhaseCount { get; private set; }
        public MatchEventQueue Events { get; } = new MatchEventQueue();
        public bool IsFinished => State == MatchState.FullTime;

        private readonly DeterministicRng _rng;
        private readonly TeamSide _firstHalfKickers;
        private int _sequence;

        // the contest carried from AttackingPhase / LineBreak into Ruck
        private RugbyPlayer _pendingCarrier;
        private RugbyPlayer _pendingTackler;
        private double _pendingDominanceBoost;
        private double _lastBallSpeed = 4.0;
        private TeamSide _penaltyTo;
        private TeamSide _scoredBy;
        private double _tryY;

        public MatchEngine(Team home, Team away, ulong seed, TeamSide kicksOffFirst = TeamSide.Home)
        {
            if (home.Players.Count != 15 || away.Players.Count != 15) throw new ArgumentException("Both teams need fifteen players.");
            Home = home; Away = away;
            _rng = new DeterministicRng(seed);
            _firstHalfKickers = kicksOffFirst;
            Possession = kicksOffFirst;
        }

        public Team TeamOf(TeamSide side) => side == TeamSide.Home ? Home : Away;
        private Team Attacking => TeamOf(Possession);
        private Team Defending => TeamOf(Other(Possession));
        private static TeamSide Other(TeamSide s) => s == TeamSide.Home ? TeamSide.Away : TeamSide.Home;
        private TacticalModifiers Mods(Team t) => TacticalModifiers.From(t.Tactics);

        /// <summary>Resolves one state. Returns false once the match is over.</summary>
        public bool Step()
        {
            if (IsFinished) return false;
            Tick++;
            MatchState next;
            switch (State)
            {
                case MatchState.KickOff: next = DoKickOff(); break;
                case MatchState.AttackingPhase: next = DoAttackingPhase(); break;
                case MatchState.Ruck: next = DoRuck(); break;
                case MatchState.LineBreak: next = DoLineBreak(); break;
                case MatchState.KickingInPlay: next = DoKickInPlay(); break;
                case MatchState.Lineout: next = DoLineout(); break;
                case MatchState.Maul: next = DoMaul(); break;
                case MatchState.Scrum: next = DoScrum(); break;
                case MatchState.Turnover: next = DoTurnover(); break;
                case MatchState.Penalty: next = DoPenalty(); break;
                case MatchState.TryScored: next = DoTryScored(); break;
                case MatchState.Conversion: next = DoConversion(); break;
                case MatchState.HalfTime: next = DoHalfTime(); break;
                default: next = MatchState.FullTime; break;
            }
            State = ApplyClock(next);
            return !IsFinished;
        }

        /// <summary>Runs to full time, or until maxTicks, whichever is first.</summary>
        public void Run(int maxTicks = int.MaxValue)
        {
            for (int i = 0; i < maxTicks && Step(); i++) { }
        }

        // ------------------------------------------------------------------ clock

        /// <summary>
        /// The half ends at the first stoppage after 40:00, as in the Laws: the clock can
        /// run past 40 while play continues, and the whistle only goes when the ball is dead.
        /// </summary>
        private MatchState ApplyClock(MatchState next)
        {
            bool deadBall = next == MatchState.KickOff || next == MatchState.Scrum || next == MatchState.Lineout || next == MatchState.Penalty;
            if (!deadBall || ClockSeconds < Half * HalfLengthSeconds) return next;
            if (Half == 1)
            {
                Emit(MatchEventType.HalfTime, MatchState.HalfTime, null, null, null, null);
                return MatchState.HalfTime;
            }
            Emit(MatchEventType.FullTime, MatchState.FullTime, null, null, null, null);
            return MatchState.FullTime;
        }

        private void Spend(double seconds) => ClockSeconds += seconds;

        // ------------------------------------------------------------------ handlers

        private MatchState DoKickOff()
        {
            // the kicking team is Possession on entry; the ball goes to the receiving 10m-22m zone
            var kickers = Attacking;
            var kicker = kickers.ByShirt(Position.FlyHalf);
            double depth = 12 + 12 * _rng.NextDouble();
            Ball = new Vec2(50 + kickers.AttackDirection * depth, 10 + 50 * _rng.NextDouble()).ClampToField();
            Spend(20);
            // contestable restart: the kicking team regains it about 1 in 6
            double regather = 0.16 * (0.6 + 0.8 * kickers.Average(a => a.Handling, forwards: true) / 20.0);
            bool regained = _rng.NextDouble() < regather;
            if (!regained) Possession = Other(Possession);
            Emit(MatchEventType.KickOff, MatchState.AttackingPhase, kickers.Side, kicker.Id, null,
                new Dictionary<string, double> { ["regained"] = regained ? 1 : 0 });
            PhaseCount = 0;
            return MatchState.AttackingPhase;
        }

        private MatchState DoAttackingPhase()
        {
            var att = Attacking; var def = Defending;
            var am = Mods(att); var dm = Mods(def);
            PhaseCount++;
            double upfield = att.MetresUpfield(Ball);
            // everyone takes up the tactic's shape around the ball before anyone is picked
            MoveFormations(att, def, am, dm);

            // 1. kick? More likely deep in your own half, and by tactic.
            double pKick = 0.07 * am.KickChance * (upfield < 22 ? 3.0 : upfield < 50 ? 1.2 : 0.4);
            if (_rng.NextDouble() < pKick) return MatchState.KickingInPlay;

            // 2. handling error: a knock-on gives the other side the scrum
            var carrier = PickCarrier(att, am);
            double pKnock = 0.045 * (1.3 - carrier.Effectiveness * MathX.Norm20(carrier.Attributes.Handling));
            if (_rng.NextDouble() < pKnock)
            {
                Spend(6);
                Possession = Other(Possession);
                Emit(MatchEventType.Turnover, MatchState.Scrum, def.Side, carrier.Id, null,
                    new Dictionary<string, double> { ["knockOn"] = 1 });
                return MatchState.Scrum;
            }

            // 3. the carry meets a defender: does it break the line?
            var tackler = PickTackler(def, carrier);
            double pBreak = Resolver.LineBreakProbability(carrier, tackler, am, dm, _lastBallSpeed);
            Spend(1.5);
            if (_rng.NextDouble() < pBreak)
            {
                tackler.TacklesMissed++;
                _pendingCarrier = carrier;
                Emit(MatchEventType.LineBreak, MatchState.LineBreak, att.Side, carrier.Id, tackler.Id,
                    new Dictionary<string, double> { ["pBreak"] = Math.Round(pBreak, 4) });
                return MatchState.LineBreak;
            }

            _pendingCarrier = carrier;
            _pendingTackler = tackler;
            _pendingDominanceBoost = 0;
            Emit(MatchEventType.Carry, MatchState.Ruck, att.Side, carrier.Id, tackler.Id,
                new Dictionary<string, double> { ["phase"] = PhaseCount });
            return MatchState.Ruck;
        }

        private MatchState DoRuck()
        {
            var att = Attacking; var def = Defending;
            var am = Mods(att); var dm = Mods(def);
            var carrier = _pendingCarrier; var tackler = _pendingTackler;
            var jackal = PickJackal(def, tackler);
            var support = PickSupport(att, carrier, 2 + (int)Math.Round(3 * att.Tactics.RuckCommitment));

            var r = Resolver.ResolveRuckPhase(carrier, tackler, jackal, support, am, dm, _rng);
            double metres = r.MetresGained + _pendingDominanceBoost;
            // the goal-line stand: inside their 5 m every defender is on the line, so
            // gains shrink (a try from a carry has to be earned, not walked in)
            if (att.MetresUpfield(Ball) > 95 && metres > 0) metres *= 0.55;
            _lastBallSpeed = r.BallSpeedSeconds;

            // move the ball: forward by the metres made, and a few metres towards the open side
            double open = Ball.Y < Vec2.PitchWidth / 2 ? 1 : -1;
            double lateral = open * _rng.Range(1.0, 4.0) * am.AttackWidthSpread;
            Ball = new Vec2(Ball.X + att.AttackDirection * metres, Ball.Y + lateral);
            Spend(1.5 + r.BallSpeedSeconds);

            if (att.MetresUpfield(Ball) >= Vec2.PitchLength)
            {
                // over the line in the tackle: a try, grounded where he went over
                Ball = Ball.ClampToField();
                return ScoreTry(att, carrier);
            }
            Ball = Ball.ClampToField();

            var data = r.ToData();
            switch (r.Outcome)
            {
                case RuckOutcome.Offload:
                    var receiver = support[0];
                    Emit(MatchEventType.Offload, MatchState.AttackingPhase, att.Side, carrier.Id, receiver.Id, data);
                    // an offload keeps the ball alive: the next phase starts with fast ball
                    _lastBallSpeed = 1.5;
                    return MatchState.AttackingPhase;
                case RuckOutcome.Turnover:
                    Emit(MatchEventType.Turnover, MatchState.Turnover, def.Side, jackal.Id, carrier.Id, data);
                    return MatchState.Turnover;
                case RuckOutcome.PenaltyConceded:
                    var offender = r.PenaltyAgainst == def.Side ? jackal : carrier;
                    _penaltyTo = Other(r.PenaltyAgainst.Value);
                    Emit(MatchEventType.PenaltyConceded, MatchState.Penalty, r.PenaltyAgainst.Value, offender.Id, null, data);
                    return MatchState.Penalty;
                default:
                    Emit(MatchEventType.Tackle, MatchState.AttackingPhase, def.Side, tackler.Id, carrier.Id, data);
                    Emit(MatchEventType.RuckSecured, MatchState.AttackingPhase, att.Side, att.ByShirt(Position.ScrumHalf).Id, null, data);
                    return MatchState.AttackingPhase;
            }
        }

        private MatchState DoLineBreak()
        {
            var att = Attacking; var def = Defending;
            var carrier = _pendingCarrier;
            // the break: 8-35 m depending on pace, and fatigue
            double pace = carrier.Effectiveness * MathX.Norm20(carrier.Attributes.Pace);
            double run = 8 + 27 * pace * _rng.NextDouble();
            Ball = new Vec2(Ball.X + att.AttackDirection * run, Ball.Y);
            carrier.AddWork(0.03);
            carrier.MetresCarried += (int)Math.Round(run);
            Spend(6);
            if (att.MetresUpfield(Ball) >= Vec2.PitchLength)
            {
                Ball = Ball.ClampToField();
                return ScoreTry(att, carrier);
            }
            Ball = Ball.ClampToField();
            // the cover tackle: the full-back or the nearest back gets back, beaten for pace
            _pendingTackler = CoverTackler(def);
            _pendingDominanceBoost = 2.0; // a scrambling tackle concedes a couple more metres
            return MatchState.Ruck;
        }

        private MatchState DoKickInPlay()
        {
            var att = Attacking; var def = Defending;
            var kicker = att.ByShirt(Position.FlyHalf);
            double k = kicker.Effectiveness * MathX.Norm20(kicker.Attributes.Kicking);
            double distance = 25 + 30 * k + _rng.Gaussian(0, 5);
            bool territory = att.Tactics.Kicking == KickingStrategy.KickForTerritory || att.MetresUpfield(Ball) < 22;
            Ball = new Vec2(Ball.X + att.AttackDirection * distance, Ball.Y).ClampToField();
            Spend(10);
            if (territory && _rng.NextDouble() < 0.55 + 0.3 * k)
            {
                // found touch: their throw
                Ball = new Vec2(Ball.X, Ball.Y < 35 ? 0 : 70);
                Emit(MatchEventType.KickToTouch, MatchState.Lineout, att.Side, kicker.Id, null,
                    new Dictionary<string, double> { ["distance"] = Math.Round(distance, 1) });
                Possession = Other(Possession);
                return MatchState.Lineout;
            }
            // contestable or long: the chasers win it back sometimes
            double regain = 0.12 + (att.Tactics.Kicking == KickingStrategy.KickForTerritory ? 0.04 : 0);
            bool regained = _rng.NextDouble() < regain;
            if (!regained) Possession = Other(Possession);
            var catcher = TeamOf(Possession).ByShirt(Position.FullBack);
            Emit(MatchEventType.KickInPlay, MatchState.AttackingPhase, att.Side, kicker.Id, catcher.Id,
                new Dictionary<string, double> { ["distance"] = Math.Round(distance, 1), ["regained"] = regained ? 1 : 0 });
            PhaseCount = 0;
            _lastBallSpeed = 4.0;
            return MatchState.AttackingPhase;
        }

        private MatchState DoLineout()
        {
            var throwing = Attacking; var opp = Defending;
            var hooker = throwing.ByShirt(Position.Hooker);
            double us = throwing.Average(a => a.Handling, true) + throwing.Average(a => a.Strength, true);
            double them = opp.Average(a => a.Handling, true) + opp.Average(a => a.Strength, true);
            double pWin = MathX.Clamp(0.86 + 0.02 * (us - them), 0.65, 0.97);
            Spend(40);
            Ball = new Vec2(Ball.X, Ball.Y < 35 ? 5 : 65);
            if (_rng.NextDouble() >= pWin)
            {
                Possession = Other(Possession);
                Emit(MatchEventType.LineoutStolen, MatchState.AttackingPhase, opp.Side, opp.ByShirt(Position.Lock5).Id, hooker.Id, null);
                PhaseCount = 0;
                return MatchState.AttackingPhase;
            }
            Emit(MatchEventType.LineoutWon, MatchState.AttackingPhase, throwing.Side, hooker.Id, null,
                new Dictionary<string, double> { ["pWin"] = Math.Round(pWin, 3) });
            PhaseCount = 0;
            // close to their line a forward-minded side drives
            bool drive = throwing.MetresUpfield(Ball) > 80 && throwing.Tactics.Attack != AttackShape.PlayWide;
            return drive ? MatchState.Maul : MatchState.AttackingPhase;
        }

        private MatchState DoMaul()
        {
            var att = Attacking; var def = Defending;
            double push = att.Average(a => a.Strength, true) - def.Average(a => a.Strength, true);
            double metres = Math.Max(0, 4 + 0.8 * push + _rng.Gaussian(0, 2.5));
            Ball = new Vec2(Ball.X + att.AttackDirection * metres, Ball.Y);
            Spend(12);
            foreach (var p in att.Players) if (p.IsForward) p.AddWork(0.01);
            foreach (var p in def.Players) if (p.IsForward) p.AddWork(0.01);
            if (att.MetresUpfield(Ball) >= Vec2.PitchLength)
            {
                Ball = Ball.ClampToField();
                return ScoreTry(att, att.ByShirt(Position.Hooker));
            }
            Ball = Ball.ClampToField();
            // pulled down illegally: a penalty to the drivers
            double pCollapse = 0.10 * Mods(def).PenaltyRisk;
            if (_rng.NextDouble() < pCollapse)
            {
                _penaltyTo = att.Side;
                Emit(MatchEventType.MaulCollapsed, MatchState.Penalty, def.Side, def.ByShirt(Position.Lock4).Id, null, null);
                return MatchState.Penalty;
            }
            Emit(MatchEventType.MaulDrive, MatchState.AttackingPhase, att.Side, att.ByShirt(Position.Hooker).Id, null,
                new Dictionary<string, double> { ["metres"] = Math.Round(metres, 1) });
            return MatchState.AttackingPhase;
        }

        private MatchState DoScrum()
        {
            var feed = Attacking; var opp = Defending;
            double pack = feed.Average(a => a.Strength, true) - opp.Average(a => a.Strength, true);
            Spend(45);
            double pPen = MathX.Clamp(0.08 + 0.02 * Math.Abs(pack), 0.05, 0.30);
            if (_rng.NextDouble() < pPen)
            {
                // the weaker pack goes down
                var offenderSide = pack >= 0 ? opp.Side : feed.Side;
                _penaltyTo = Other(offenderSide);
                var offender = TeamOf(offenderSide).ByShirt(Position.TightheadProp);
                Emit(MatchEventType.ScrumPenalty, MatchState.Penalty, offenderSide, offender.Id, null, null);
                return MatchState.Penalty;
            }
            Emit(MatchEventType.ScrumWon, MatchState.AttackingPhase, feed.Side, feed.ByShirt(Position.Number8).Id, null, null);
            PhaseCount = 0;
            _lastBallSpeed = 3.0;
            return MatchState.AttackingPhase;
        }

        private MatchState DoTurnover()
        {
            Possession = Other(Possession);
            PhaseCount = 0;
            // turnover ball is broken-field ball: the defence is not set
            _lastBallSpeed = 2.0;
            Spend(3);
            return MatchState.AttackingPhase;
        }

        private MatchState DoPenalty()
        {
            Possession = _penaltyTo;
            var att = Attacking;
            var kicker = att.ByShirt(Position.FlyHalf);
            double pGoal = Resolver.GoalKickProbability(kicker, Ball, att.Side);
            double upfield = att.MetresUpfield(Ball);
            Spend(15);
            if (upfield >= 55 && pGoal >= 0.55)
            {
                Spend(50);
                bool good = _rng.NextDouble() < pGoal;
                if (good) { att.Score += 3; }
                Emit(good ? MatchEventType.PenaltyKickAtGoal : MatchEventType.PenaltyGoalMissed,
                    good ? MatchState.KickOff : MatchState.AttackingPhase, att.Side, kicker.Id, null,
                    new Dictionary<string, double> { ["pGoal"] = Math.Round(pGoal, 3) });
                if (good) { Possession = Other(att.Side); return MatchState.KickOff; } // the side that conceded restarts
                Possession = Other(att.Side);  // a miss: 22 drop-out, simplified to their ball
                Ball = new Vec2(att.Side == TeamSide.Home ? 78 : 22, 35);
                PhaseCount = 0;
                return MatchState.AttackingPhase;
            }
            // kick to the corner: about 20-30 m of ground and the throw
            double gain = 20 + 10 * kicker.Effectiveness * MathX.Norm20(kicker.Attributes.Kicking);
            Ball = new Vec2(Ball.X + att.AttackDirection * gain, Ball.Y < 35 ? 0 : 70).ClampToField();
            if (att.MetresUpfield(Ball) > 95) Ball = new Vec2(att.Side == TeamSide.Home ? 95 : 5, Ball.Y);
            Emit(MatchEventType.PenaltyToCorner, MatchState.Lineout, att.Side, kicker.Id, null, null);
            return MatchState.Lineout;
        }

        private MatchState ScoreTry(Team att, RugbyPlayer scorer)
        {
            att.Score += 5; att.Tries++;
            _scoredBy = att.Side;
            _tryY = Ball.Y;
            Emit(MatchEventType.TryScored, MatchState.TryScored, att.Side, scorer.Id, null, null);
            return MatchState.TryScored;
        }

        private MatchState DoTryScored()
        {
            Spend(30);
            return MatchState.Conversion;
        }

        private MatchState DoConversion()
        {
            var att = TeamOf(_scoredBy);
            var kicker = att.ByShirt(Position.FlyHalf);
            // taken in line with where the try was scored, 15 m out
            var spot = new Vec2(att.Side == TeamSide.Home ? 85 : 15, _tryY);
            double p = Resolver.GoalKickProbability(kicker, spot, att.Side);
            bool good = _rng.NextDouble() < p;
            if (good) att.Score += 2;
            Spend(75);
            Emit(good ? MatchEventType.ConversionScored : MatchEventType.ConversionMissed, MatchState.KickOff, att.Side, kicker.Id, null,
                new Dictionary<string, double> { ["pGoal"] = Math.Round(p, 3) });
            // the side that conceded restarts
            Possession = Other(att.Side);
            Ball = new Vec2(50, 35);
            return MatchState.KickOff;
        }

        private MatchState DoHalfTime()
        {
            Half = 2;
            ClockSeconds = HalfLengthSeconds;
            foreach (var p in Home.Players) p.Recover(0.15);
            foreach (var p in Away.Players) p.Recover(0.15);
            Possession = Other(_firstHalfKickers);
            Ball = new Vec2(50, 35);
            return MatchState.KickOff;
        }

        // ------------------------------------------------------------------ selection

        /// <summary>Who takes the ball up: forwards near the ruck, backs further out, by tactic.</summary>
        private RugbyPlayer PickCarrier(Team att, in TacticalModifiers am)
        {
            double wideness = att.Tactics.Attack == AttackShape.PlayWide ? 1.6 : att.Tactics.Attack == AttackShape.TightForwards ? 0.5 : 1.0;
            var weights = new double[15];
            for (int i = 0; i < 15; i++)
            {
                var p = att.Players[i];
                if (p.Position == Position.ScrumHalf) { weights[i] = 0.2; continue; }
                double role = p.IsForward ? 1.0 : wideness;
                weights[i] = role * (0.5 + p.Effectiveness * MathX.Norm20(p.Attributes.Strength));
            }
            return att.Players[_rng.PickWeighted(weights)];
        }

        /// <summary>The nearest defender to the carrier, with some noise, weighted by tackling.</summary>
        private RugbyPlayer PickTackler(Team def, RugbyPlayer carrier)
        {
            var weights = new double[15];
            for (int i = 0; i < 15; i++)
            {
                var p = def.Players[i];
                double dist = (p.Location - carrier.Location).Length;
                weights[i] = (1.0 / (1.0 + dist / 5.0)) * (0.5 + MathX.Norm20(p.Attributes.Tackling));
            }
            return def.Players[_rng.PickWeighted(weights)];
        }

        /// <summary>Who gets back to make the cover tackle: the back three, by pace and tackling.</summary>
        private RugbyPlayer CoverTackler(Team def)
        {
            var three = new[] { def.ByShirt(Position.FullBack), def.ByShirt(Position.LeftWing), def.ByShirt(Position.RightWing) };
            var w = new double[3];
            for (int i = 0; i < 3; i++)
                w[i] = (i == 0 ? 1.6 : 1.0) * three[i].Effectiveness * (0.4 + MathX.Norm20(three[i].Attributes.Pace) + 0.5 * MathX.Norm20(three[i].Attributes.Tackling));
            return three[_rng.PickWeighted(w)];
        }

        /// <summary>The first defender over the ball: usually a flanker, weighted by rucking.</summary>
        private RugbyPlayer PickJackal(Team def, RugbyPlayer tackler)
        {
            var weights = new double[15];
            for (int i = 0; i < 15; i++)
            {
                var p = def.Players[i];
                double bias = p.Position == Position.OpensideFlanker ? 3.0 : p.IsForward ? 1.0 : 0.3;
                weights[i] = ReferenceEquals(p, tackler) ? 0.8 : bias * MathX.Norm20(p.Attributes.Rucking);
            }
            int k = _rng.PickWeighted(weights);
            return k < 0 ? tackler : def.Players[k];
        }

        /// <summary>The n attackers who hit the ruck (the nearest forwards first).</summary>
        private List<RugbyPlayer> PickSupport(Team att, RugbyPlayer carrier, int n)
        {
            var pool = new List<RugbyPlayer>();
            foreach (var p in att.Players) if (!ReferenceEquals(p, carrier) && p.Position != Position.ScrumHalf) pool.Add(p);
            pool.Sort((a, b) =>
            {
                double da = (a.Location - carrier.Location).Length - (a.IsForward ? 4 : 0);
                double db = (b.Location - carrier.Location).Length - (b.IsForward ? 4 : 0);
                int c = da.CompareTo(db);
                return c != 0 ? c : a.Id.CompareTo(b.Id); // a stable tie-break keeps the sort deterministic
            });
            return pool.GetRange(0, Math.Min(n, pool.Count));
        }

        /// <summary>Writes each player's Location from the tactic's formation around the ball.</summary>
        private void MoveFormations(Team att, Team def, in TacticalModifiers am, in TacticalModifiers dm)
        {
            var a = Formation.Attacking(att, Ball, am);
            var d = Formation.Defending(def, Ball, dm);
            for (int i = 0; i < 15; i++) { att.Players[i].Location = a[i]; def.Players[i].Location = d[i]; }
        }

        // ------------------------------------------------------------------ events

        private void Emit(MatchEventType type, MatchState after, TeamSide? team, int? primary, int? secondary,
            Dictionary<string, double> data)
        {
            Events.Enqueue(new MatchEvent(++_sequence, Tick, ClockSeconds, type, State, after, team, primary, secondary,
                Ball, Home.Score, Away.Score, data));
        }
    }
}
