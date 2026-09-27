using System;
using System.Collections.Generic;

namespace Rugby.Engine
{
    public enum RuckOutcome { SafeRuck, Offload, Turnover, PenaltyConceded }

    /// <summary>Everything the breakdown decided, including the numbers behind the roll.</summary>
    public readonly struct RuckResolution
    {
        public readonly RuckOutcome Outcome;
        /// <summary>For PenaltyConceded: the side that gave it away.</summary>
        public readonly TeamSide? PenaltyAgainst;
        /// <summary>Metres the carry made before the tackle, positive towards the attacking team's goal.</summary>
        public readonly double MetresGained;
        /// <summary>Seconds from the tackle to the ball being playable (Fast Ball is about 2-3 s, slow ball 5+).</summary>
        public readonly double BallSpeedSeconds;
        /// <summary>0..1: 0.5 an even contest, above it the carrier won the collision.</summary>
        public readonly double CarrierDominance;
        /// <summary>The normalised probability of each outcome, indexed by (int)RuckOutcome.</summary>
        public readonly double[] Probabilities;
        /// <summary>The uniform roll in [0,1) that chose the outcome.</summary>
        public readonly double Roll;
        public readonly int JackalId;

        public RuckResolution(RuckOutcome outcome, TeamSide? penaltyAgainst, double metres, double speed,
            double dominance, double[] probabilities, double roll, int jackalId)
        {
            Outcome = outcome; PenaltyAgainst = penaltyAgainst; MetresGained = metres; BallSpeedSeconds = speed;
            CarrierDominance = dominance; Probabilities = probabilities; Roll = roll; JackalId = jackalId;
        }

        public Dictionary<string, double> ToData() => new Dictionary<string, double>
        {
            ["metres"] = Math.Round(MetresGained, 1),
            ["ballSpeed"] = Math.Round(BallSpeedSeconds, 2),
            ["dominance"] = Math.Round(CarrierDominance, 3),
            ["pSafe"] = Math.Round(Probabilities[(int)RuckOutcome.SafeRuck], 4),
            ["pOffload"] = Math.Round(Probabilities[(int)RuckOutcome.Offload], 4),
            ["pTurnover"] = Math.Round(Probabilities[(int)RuckOutcome.Turnover], 4),
            ["pPenalty"] = Math.Round(Probabilities[(int)RuckOutcome.PenaltyConceded], 4),
            ["roll"] = Math.Round(Roll, 4),
        };
    }

    /// <summary>
    /// The attribute resolution engine. Pure functions of (players, tactics, rng): no
    /// state of its own, so every formula can be unit-tested and tuned in isolation.
    /// </summary>
    public static class Resolver
    {
        // ---- base rates, per tackle, for two average players with no tactic ----
        // Tuned with `dotnet run -- --calibrate 1000` (two average Test XVs, no tactics):
        // 50 points and 6.4 tries a match, 134 tackles a side, 20 penalties, 19
        // breakdown turnovers, 14 offloads, 6 line breaks. Change a rate, re-run it.
        public const double BaseOffload = 0.085;
        public const double BaseTurnover = 0.080;
        public const double BaseDefPenalty = 0.060;
        public const double BaseAttPenalty = 0.030;
        public const double BaseSafe = 0.80;

        /// <summary>
        /// THE TACKLE AND THE RUCK THAT FOLLOWS IT.
        ///
        /// 1. Collision. Each player's contest score is a weighted blend of the relevant
        ///    attributes (each mapped 1..20 to 0..1), scaled by how fresh they are:
        ///        carrier C = eff_c * (0.45 Str + 0.30 Hand + 0.25 Off)
        ///        tackler T = eff_t * (0.50 Tack + 0.30 Str + 0.20 Agg) + 0.10 * rushBonus
        ///    Carrier dominance d = logistic(6 * (C - T)): 0.5 for an even contest, about
        ///    0.82 when the carrier is 0.25 better (a 5-point attribute edge across the board).
        ///
        /// 2. Metres. gain = carryGain * (0.6 + 4.0 d) + N(0, 1.2), floored at -3 m, so a
        ///    dominant tackle drives the carrier back behind the gain line.
        ///
        /// 3. The contest for the ball. Four weights, each a base rate times the factors
        ///    that drive it, then normalised to probabilities and chosen by one roll:
        ///        w_offload  = B_off  * offloadRate * (0.4 + 1.2 offSkill) * (0.5 + d) * (1 - 0.5 tackleSkill)
        ///        w_turnover = B_turn * exposure * jackal * (1.5 - d) * (1.2 - 0.5 cleanout) * (3.5 / supporters)
        ///        w_penDef   = B_pD   * penaltyRisk * (0.4 + agg_j) * (1.25 - 0.75 disc_j) * (0.7 + 0.6 d)
        ///        w_penAtt   = B_pA   * (1.25 - 0.75 disc_c) * (1.6 - d) * jackal
        ///        w_safe     = B_safe * (0.6 + 0.8 cleanout) * (0.6 + 0.8 d)
        ///    A dominant carry (high d) makes offloads and defensive penalties (a beaten
        ///    defender goes off his feet) more likely and turnovers less likely; a dominant
        ///    tackle does the opposite. Fast Ball raises exposure and offloads; Safe
        ///    Possession lowers both. Rush Defence raises dominance, jackal threat and penalty risk.
        ///
        /// 4. Ball speed. seconds = (2.2 + 3.0 (1 - cleanout) + 2.0 jackal (1 - d)) / ruckSpeed,
        ///    clamped 1.2..8: the next phase's attack is sharper when this is small.
        ///
        /// 5. Fatigue. The carrier, tackler, jackal and every committed supporter pay for it.
        /// </summary>
        public static RuckResolution ResolveRuckPhase(
            RugbyPlayer carrier, RugbyPlayer tackler, RugbyPlayer jackal, IReadOnlyList<RugbyPlayer> support,
            in TacticalModifiers attack, in TacticalModifiers defence, DeterministicRng rng)
        {
            if (carrier == null) throw new ArgumentNullException(nameof(carrier));
            if (tackler == null) throw new ArgumentNullException(nameof(tackler));
            if (jackal == null) jackal = tackler;
            if (support == null || support.Count == 0) throw new ArgumentException("A ruck needs at least one supporting player.", nameof(support));

            var ca = carrier.Attributes; var ta = tackler.Attributes; var ja = jackal.Attributes;
            double effC = carrier.Effectiveness, effT = tackler.Effectiveness, effJ = jackal.Effectiveness;

            // ---- 1. the collision ----
            double carrierScore = effC * (0.45 * MathX.Norm20(ca.Strength) + 0.30 * MathX.Norm20(ca.Handling) + 0.25 * MathX.Norm20(ca.Offloading));
            double tacklerScore = effT * (0.50 * MathX.Norm20(ta.Tackling) + 0.30 * MathX.Norm20(ta.Strength) + 0.20 * MathX.Norm20(ta.Aggression))
                                  + 0.10 * defence.TackleDominance;
            double d = MathX.Logistic(carrierScore - tacklerScore, 6.0);

            // ---- 2. metres ----
            double metres = attack.CarryGain * (0.6 + 4.0 * d) + rng.Gaussian(0, 1.2);
            metres = Math.Max(-3.0, metres);

            // ---- 3. the contest for the ball ----
            double offSkill = effC * MathX.Norm20(ca.Offloading);
            double tackleSkill = effT * MathX.Norm20(ta.Tackling);
            double jackalThreat = effJ * MathX.Norm20(ja.Rucking) * defence.JackalThreat;

            double cleanout = 0;
            foreach (var s in support) cleanout += s.Effectiveness * (0.6 * MathX.Norm20(s.Attributes.Rucking) + 0.4 * MathX.Norm20(s.Attributes.Strength));
            cleanout /= support.Count;

            double wOffload = BaseOffload * attack.OffloadRate * (0.4 + 1.2 * offSkill) * (0.5 + d) * (1.0 - 0.5 * tackleSkill);
            double wTurnover = BaseTurnover * attack.TurnoverExposure * (0.5 + jackalThreat) * (1.5 - d) * (1.2 - 0.5 * cleanout) * (3.5 / support.Count);
            double wPenDef = BaseDefPenalty * defence.PenaltyRisk * (0.4 + effJ * MathX.Norm20(ja.Aggression))
                             * (1.25 - 0.75 * MathX.Norm20(ja.Discipline)) * (0.7 + 0.6 * d);
            double wPenAtt = BaseAttPenalty * (1.25 - 0.75 * MathX.Norm20(ca.Discipline)) * (1.6 - d) * (0.5 + jackalThreat);
            double wSafe = BaseSafe * (0.6 + 0.8 * cleanout) * (0.6 + 0.8 * d);

            // five raw weights, reported as the four outcomes (the two penalties share one)
            double total = wOffload + wTurnover + wPenDef + wPenAtt + wSafe;
            var probabilities = new double[4];
            probabilities[(int)RuckOutcome.SafeRuck] = wSafe / total;
            probabilities[(int)RuckOutcome.Offload] = wOffload / total;
            probabilities[(int)RuckOutcome.Turnover] = wTurnover / total;
            probabilities[(int)RuckOutcome.PenaltyConceded] = (wPenDef + wPenAtt) / total;

            // one roll, walked through the cumulative bands in a fixed order
            double roll = rng.NextDouble();
            double acc = 0;
            RuckOutcome outcome;
            TeamSide? against = null;
            if (roll < (acc += wOffload / total)) outcome = RuckOutcome.Offload;
            else if (roll < (acc += wTurnover / total)) outcome = RuckOutcome.Turnover;
            else if (roll < (acc += wPenDef / total)) { outcome = RuckOutcome.PenaltyConceded; against = tackler.Side; }
            else if (roll < (acc += wPenAtt / total)) { outcome = RuckOutcome.PenaltyConceded; against = carrier.Side; }
            else outcome = RuckOutcome.SafeRuck;

            // ---- 4. ball speed ----
            double speed = (2.2 + 3.0 * (1.0 - cleanout) + 2.0 * jackalThreat * (1.0 - d)) / attack.RuckSpeed;
            speed = MathX.Clamp(speed, 1.2, 8.0);

            // ---- 5. fatigue and counting stats ----
            carrier.AddWork(0.012 + 0.010 * (1.0 - d));
            tackler.AddWork(0.012 + 0.010 * d);
            if (!ReferenceEquals(jackal, tackler)) jackal.AddWork(0.008);
            foreach (var s in support) s.AddWork(0.006);
            carrier.Carries++;
            carrier.MetresCarried += (int)Math.Round(metres);
            tackler.TacklesMade++;
            if (outcome == RuckOutcome.Offload) carrier.Offloads++;
            if (outcome == RuckOutcome.Turnover) jackal.TurnoversWon++;
            if (outcome == RuckOutcome.PenaltyConceded)
            {
                if (against == tackler.Side) jackal.PenaltiesConceded++; else carrier.PenaltiesConceded++;
            }

            return new RuckResolution(outcome, against, metres, speed, d, probabilities, roll, jackal.Id);
        }

        /// <summary>
        /// Does the carry beat the first tackler outright? Compares the carrier's pace and
        /// handling with the tackler's tackling, then applies the attack's and defence's
        /// line-break modifiers. Fast ball from the previous ruck (low ballSpeed) helps.
        ///     p = 0.032 * lineBreak_att * lineBreakConceded_def * (1 + 2.5 (pace_c - tack_t)) * (3.0 / ballSpeed)^0.5
        /// clamped to 0.5%..25%.
        /// </summary>
        public static double LineBreakProbability(RugbyPlayer carrier, RugbyPlayer tackler,
            in TacticalModifiers attack, in TacticalModifiers defence, double lastBallSpeed)
        {
            double pace = carrier.Effectiveness * (0.7 * MathX.Norm20(carrier.Attributes.Pace) + 0.3 * MathX.Norm20(carrier.Attributes.Handling));
            double tack = tackler.Effectiveness * MathX.Norm20(tackler.Attributes.Tackling);
            double p = 0.032 * attack.LineBreakChance * defence.LineBreakConceded
                       * (1.0 + 2.5 * (pace - tack)) * Math.Sqrt(3.0 / Math.Max(1.2, lastBallSpeed));
            return MathX.Clamp(p, 0.005, 0.25);
        }

        /// <summary>
        /// Goal-kick success from the kick's position: distance to the posts and the angle
        /// from the middle of the posts both reduce it, a better kicker less so.
        ///     p = logistic(3.2 - dist/9.5 - 1.6 * angleFactor + 2.4 * (kick - 0.5)) * eff
        /// </summary>
        public static double GoalKickProbability(RugbyPlayer kicker, Vec2 spot, TeamSide kickingSide)
        {
            double goalX = kickingSide == TeamSide.Home ? Vec2.PitchLength : 0.0;
            double dx = Math.Abs(goalX - spot.X);
            double dy = Math.Abs(spot.Y - Vec2.PitchWidth / 2);
            double dist = Math.Sqrt(dx * dx + dy * dy);
            double angleFactor = Math.Atan2(dy, Math.Max(1.0, dx)) / (Math.PI / 2); // 0 straight, 1 on the touchline
            double k = MathX.Norm20(kicker.Attributes.Kicking);
            double p = MathX.Logistic(3.2 - dist / 9.5 - 1.6 * angleFactor + 2.4 * (k - 0.5)) * kicker.Effectiveness;
            return MathX.Clamp(p, 0.02, 0.97);
        }
    }
}
