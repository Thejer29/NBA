
import { Team, SimulationResult, ModelWeights, TeamStats, GameForAnalysis, PlayerStat } from '../types';
import { normalizeStats } from '../utils';
import { LEAGUE_AVG_VOLATILITY, LEAGUE_AVG_3P_ATTEMPT_RATE } from '../constants';

function mulberry32(a: number) {
    return function() {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

function xmur3(str: string): number {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = h << 13 | h >>> 19;
    }
    return h;
}

const randomBivariateNormalPair = (randomFn: () => number, correlation: number): [number, number] => {
    let u1 = 0, u2 = 0;
    while(u1 === 0) u1 = randomFn();
    while(u2 === 0) u2 = randomFn();

    const mag = Math.sqrt(-2.0 * Math.log(u1));
    const z1 = mag * Math.cos(2.0 * Math.PI * u2);
    const z2 = mag * Math.sin(2.0 * Math.PI * u2);
    
    const correlatedZ2 = correlation * z1 + Math.sqrt(1 - correlation * correlation) * z2;
    
    return [z1, correlatedZ2];
}

export const calculateProjectedTeamOutput = (
    activeRoster: PlayerStat[],
    estimatedPace: number = 100.0,
    efficiencyDecay: number = 0.05
): { projectedTeamOrtg: number; projectedPoints: number } => {
    
    const currentTotalUsg = activeRoster.reduce((sum, p) => sum + p.usageRate, 0);
    const usageScaler = currentTotalUsg > 0 ? 100.0 / currentTotalUsg : 1.0;
    let projectedTotalEfficiency = 0.0;

    activeRoster.forEach(player => {
        const baseUsg = player.usageRate;
        const baseOrtg = player.offensiveRating;
        
        const newProjectedUsg = baseUsg * usageScaler;
        const usageIncrease = newProjectedUsg - baseUsg;
        
        let projectedOrtg = baseOrtg;
        if (usageIncrease > 0) {
            const penalty = usageIncrease * efficiencyDecay;
            projectedOrtg = baseOrtg * (1 - (penalty / 100));
        }
        
        const playerContribution = (newProjectedUsg / 100) * projectedOrtg;
        projectedTotalEfficiency += playerContribution;
    });

    // Clamp the roster-derived rating to avoid hallucinations (e.g. 150 ORTG)
    projectedTotalEfficiency = Math.max(102, Math.min(125, projectedTotalEfficiency));

    const projectedPoints = (projectedTotalEfficiency / 100) * estimatedPace;
    
    return {
        projectedTeamOrtg: Math.round(projectedTotalEfficiency * 100) / 100,
        projectedPoints: Math.round(projectedPoints * 100) / 100
    };
};


const NUM_SIMULATIONS = 10000;
const HOME_COURT_ADVANTAGE = 2.5;
const LEAGUE_AVG_RATING = 115.0;
const LEAGUE_AVG_PACE = 99.5; 

// "CLEAN ROOM" FACTORS (Dean Oliver Inspired)
// These convert raw statistical edges into ORTG points.
// Inputs are decimals (0.01 = 1%).
// eFG% is the king. 1% eFG diff is roughly 1.6 - 2.0 points of ORTG.
// TOV% is roughly 1.0 - 1.2 points of ORTG.
// Reb/FTR are smaller contributors to margin, though important for possession control.
const EFG_POINTS_FACTOR = 1.6; 
const TOV_POINTS_FACTOR = 1.1;
const REB_POINTS_FACTOR = 0.6;
const FTR_POINTS_FACTOR = 0.4;
const MAX_FOUR_FACTOR_ADJUSTMENT = 12.0; // Cap the total adjustment to prevent runaway blowouts

const STAT_DEFAULTS = {
    offensiveRating: LEAGUE_AVG_RATING, defensiveRating: LEAGUE_AVG_RATING, pace: LEAGUE_AVG_PACE,
    effectiveFgPct: 0.54, opponentEffectiveFgPct: 0.54,
    turnoverPct: 0.13, forcedTurnoverPct: 0.13, offensiveReboundPct: 0.23,
    defensiveReboundPct: 0.77, freeThrowRate: 0.20, opponentFreeThrowRate: 0.20,
    netRatingVolatility: LEAGUE_AVG_VOLATILITY,
    threePointAttemptRate: LEAGUE_AVG_3P_ATTEMPT_RATE,
    threePointPct: 0.36,
};

export const patchStats = (stats: Partial<TeamStats>, teamName: string): TeamStats => {
    const patched = { ...stats };
    const requiredKeys = Object.keys(STAT_DEFAULTS) as (keyof typeof STAT_DEFAULTS)[];
    for (const key of requiredKeys) {
        const value = patched[key];
        const numericValue = value === null || typeof value === 'undefined' ? NaN : parseFloat(value as any);

        if (isNaN(numericValue)) {
            patched[key] = STAT_DEFAULTS[key] as any;
        } else {
            patched[key] = numericValue;
        }
    }
    return patched as TeamStats;
};

export const runMonteCarloSimulation = (homeTeam: Team, awayTeam: Team, marketLine: { spread: number, total: number }, weights: ModelWeights, game: GameForAnalysis): SimulationResult => {
    const seedNumber = xmur3(game.id);
    const random = mulberry32(seedNumber);
    
    // 1. Pre-process and Clean Stats
    const getWeightedStats = (team: Team): Partial<TeamStats> => {
        const baseStats = normalizeStats(team.stats, team.name);
        const recentStats = baseStats.recentStats;
        const weight = weights.recentForm;

        if (!recentStats || weight <= 0) {
            return baseStats;
        }

        const weightedStats: Partial<TeamStats> = {};
        const statsToWeight: (keyof TeamStats)[] = [
            'offensiveRating', 'defensiveRating', 'netRating', 'effectiveFgPct', 
            'opponentEffectiveFgPct', 'trueShootingPct', 'turnoverPct', 'forcedTurnoverPct',
            'offensiveReboundPct', 'defensiveReboundPct', 'freeThrowRate', 'opponentFreeThrowRate',
            'pace', 'threePointAttemptRate', 'threePointPct'
        ];

        statsToWeight.forEach(key => {
            const seasonValue = baseStats[key as keyof typeof baseStats];
            // @ts-ignore
            const recentValue = recentStats[key];
            
            const isSeasonNum = typeof seasonValue === 'number' && seasonValue !== null;
            const isRecentNum = typeof recentValue === 'number' && recentValue !== null;

            if (isSeasonNum && isRecentNum) {
                // @ts-ignore
                weightedStats[key] = (seasonValue * (1 - weight)) + (recentValue * weight);
            } else if (isSeasonNum) {
                // @ts-ignore
                weightedStats[key] = seasonValue;
            } else if (isRecentNum) {
                // @ts-ignore
                weightedStats[key] = recentValue;
            }
        });
        
        return { ...baseStats, ...weightedStats };
    };

    const homeStats = getWeightedStats(homeTeam);
    const awayStats = getWeightedStats(awayTeam);
    
    let finalHomeStats = patchStats(homeStats, homeTeam.name);
    let finalAwayStats = patchStats(awayStats, awayTeam.name);

    // 2. Clamp Ratings to Reality
    // We clamp inputs to prevent data entry errors from destroying the model.
    const clampRating = (val: number) => Math.max(103, Math.min(125, val));
    finalHomeStats.offensiveRating = clampRating(finalHomeStats.offensiveRating);
    finalHomeStats.defensiveRating = clampRating(finalHomeStats.defensiveRating);
    finalAwayStats.offensiveRating = clampRating(finalAwayStats.offensiveRating);
    finalAwayStats.defensiveRating = clampRating(finalAwayStats.defensiveRating);
    
    // 3. Roster Adjustments (if applicable)
    if (homeStats.roster && homeStats.roster.length >= 5) {
        const projection = calculateProjectedTeamOutput(homeStats.roster, finalHomeStats.pace, weights.efficiencyDecay);
        finalHomeStats.offensiveRating = projection.projectedTeamOrtg;
    }
    if (awayStats.roster && awayStats.roster.length >= 5) {
        const projection = calculateProjectedTeamOutput(awayStats.roster, finalAwayStats.pace, weights.efficiencyDecay);
        finalAwayStats.offensiveRating = projection.projectedTeamOrtg;
    }

    // 4. Rest Adjustment
    const getRestAdjustment = (teamStats: TeamStats, gameDate: string): number => {
        if (!teamStats.lastGameDate) return 0;
        const lastGame = new Date(teamStats.lastGameDate).getTime();
        const thisGame = new Date(gameDate).getTime();
        const diffDays = Math.round((thisGame - lastGame) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) return -1.5;
        if (diffDays === 2) return 0.0;
        if (diffDays === 3) return 0.5;
        return 1.0;
    };
    const netRestAdvantage = getRestAdjustment(finalHomeStats, game.date) - getRestAdjustment(finalAwayStats, game.date);

    // 5. Four Factors Logic (Clean Room Calculation)
    const calculateRatingAdjustment = (offense: TeamStats, defense: TeamStats): number => {
        // Calculate raw statistical edges.
        // Since inputs are decimals (0.01), multiplying by 100 gives us percentage points (1.0).
        // eFG Edge of 0.05 (5%) becomes 5.0.
        
        const efgAdvantage = (offense.effectiveFgPct - defense.opponentEffectiveFgPct) * 100 * EFG_POINTS_FACTOR;
        const tovAdvantage = (defense.forcedTurnoverPct - offense.turnoverPct) * 100 * TOV_POINTS_FACTOR;
        
        // Rebounding: OREB vs (1 - DREB)
        const rebAdvantage = (offense.offensiveReboundPct - (1 - defense.defensiveReboundPct)) * 100 * REB_POINTS_FACTOR;
        
        const ftrAdvantage = (offense.freeThrowRate - defense.opponentFreeThrowRate) * 100 * FTR_POINTS_FACTOR;
        
        const totalAdjustment = (efgAdvantage * weights.eFgPctWeight) +
                                (tovAdvantage * weights.turnoverPctWeight) +
                                (rebAdvantage * weights.reboundPctWeight) +
                                (ftrAdvantage * weights.freeThrowRateWeight);
        
        return Math.max(-MAX_FOUR_FACTOR_ADJUSTMENT, Math.min(MAX_FOUR_FACTOR_ADJUSTMENT, totalAdjustment));
    };
    
    const homeFourFactorAdj = calculateRatingAdjustment(finalHomeStats, finalAwayStats);
    const awayFourFactorAdj = calculateRatingAdjustment(finalAwayStats, finalHomeStats);
    
    // 6. Core Rating Model
    const expectedHomeOffensiveRating = finalHomeStats.offensiveRating + finalAwayStats.defensiveRating - LEAGUE_AVG_RATING;
    const expectedAwayOffensiveRating = finalAwayStats.offensiveRating + finalHomeStats.defensiveRating - LEAGUE_AVG_RATING;
    
    const projectedHomeOffensiveRating = expectedHomeOffensiveRating + (homeFourFactorAdj * weights.matchupImpactWeight);
    const projectedAwayOffensiveRating = expectedAwayOffensiveRating + (awayFourFactorAdj * weights.matchupImpactWeight);
    
    const p1 = Math.max(90, Math.min(110, finalHomeStats.pace));
    const p2 = Math.max(90, Math.min(110, finalAwayStats.pace));
    const avgPace = (p1 * p2) / LEAGUE_AVG_PACE;

    const homeRatingWithHCA = projectedHomeOffensiveRating + (HOME_COURT_ADVANTAGE / 2);
    const awayRatingWithHCA = projectedAwayOffensiveRating - (HOME_COURT_ADVANTAGE / 2);
    
    let rawHomeScore = (homeRatingWithHCA / 100) * avgPace;
    let rawAwayScore = (awayRatingWithHCA / 100) * avgPace;

    rawHomeScore += netRestAdvantage / 2;
    rawAwayScore -= netRestAdvantage / 2;

    // --- CLEAN ROOM: NO MARKET ANCHORING ---
    // The Savant Model trusts its own derivation entirely.
    const finalMeanHomeScore = rawHomeScore;
    const finalMeanAwayScore = rawAwayScore;

    // 7. Simulation Loop
    const spreads: number[] = [];
    const totals: number[] = [];
    let homeWins = 0;
    let homeCovers = 0;
    
    const { simulationStdDev, scoreCorrelation, volatilityImpactWeight } = weights;

    const homeVolatility = finalHomeStats.netRatingVolatility ?? LEAGUE_AVG_VOLATILITY;
    const awayVolatility = finalAwayStats.netRatingVolatility ?? LEAGUE_AVG_VOLATILITY;

    const home3PVariance = ((finalHomeStats.threePointAttemptRate ?? LEAGUE_AVG_3P_ATTEMPT_RATE) - LEAGUE_AVG_3P_ATTEMPT_RATE) * 5 * weights.threePointVarianceWeight;
    const away3PVariance = ((finalAwayStats.threePointAttemptRate ?? LEAGUE_AVG_3P_ATTEMPT_RATE) - LEAGUE_AVG_3P_ATTEMPT_RATE) * 5 * weights.threePointVarianceWeight;
    
    const homeStdDev = simulationStdDev + (homeVolatility - LEAGUE_AVG_VOLATILITY) * volatilityImpactWeight + home3PVariance;
    const awayStdDev = simulationStdDev + (awayVolatility - LEAGUE_AVG_VOLATILITY) * volatilityImpactWeight + away3PVariance;

    for (let i = 0; i < NUM_SIMULATIONS; i++) {
        const [homeZ, awayZ] = randomBivariateNormalPair(random, scoreCorrelation);
        const homeScore = Math.round(finalMeanHomeScore + homeZ * homeStdDev);
        const awayScore = Math.round(finalMeanAwayScore + awayZ * awayStdDev);
        
        const spread = awayScore - homeScore;
        spreads.push(spread);
        totals.push(homeScore + awayScore);
        
        if (homeScore > awayScore) {
            homeWins++;
        }
        
        if (spread < marketLine.spread) { 
            homeCovers++;
        }
    }

    spreads.sort((a, b) => a - b);
    totals.sort((a, b) => a - b);

    const medianSpread = spreads[Math.floor(NUM_SIMULATIONS / 2)];
    const medianTotal = totals[Math.floor(NUM_SIMULATIONS / 2)];

    const spreadOutcomes = new Map<number, number>();
    spreads.forEach(s => {
        const roundedSpread = Math.round(s);
        spreadOutcomes.set(roundedSpread, (spreadOutcomes.get(roundedSpread) || 0) + 1);
    });

    return {
        winProbability: {
            home: homeWins / NUM_SIMULATIONS,
            away: 1 - (homeWins / NUM_SIMULATIONS),
        },
        medianSpread: -medianSpread,
        medianTotal: medianTotal,
        coverProbability: {
            home: homeCovers / NUM_SIMULATIONS,
        },
        outcomes: {
            spread: Array.from(spreadOutcomes.entries()).map(([value, count]) => ({ value: -value, count })).sort((a, b) => a.value - b.value),
        },
    };
};
