
import { Bet, Team, ValueScore, GameForAnalysis, MarketOdds, TeamStats, SavedAnalysis } from './types';

export const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getToday = () => formatDate(new Date());

export const getTomorrow = () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return formatDate(tomorrow);
};

export const getYesterday = () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return formatDate(yesterday);
};

export const determineOutcome = (bet: Bet, homeScore: number, awayScore: number): 'Win' | 'Loss' | 'Push' => {
    if (bet.betType === 'spread') {
        const homeMargin = homeScore - awayScore;
        const awayMargin = awayScore - homeScore;
        if (bet.teamOrOverUnder === 'home') {
            if (homeMargin + bet.line > 0) return 'Win';
            if (homeMargin + bet.line < 0) return 'Loss';
            return 'Push';
        } else { // away
            if (awayMargin + bet.line > 0) return 'Win';
            if (awayMargin + bet.line < 0) return 'Loss';
            return 'Push';
        }
    } else if (bet.betType === 'total') {
        const totalScore = homeScore + awayScore;
        if (bet.teamOrOverUnder === 'over') {
            if (totalScore > bet.line) return 'Win';
            if (totalScore < bet.line) return 'Loss';
            return 'Push';
        } else { // under
            if (totalScore < bet.line) return 'Win';
            if (totalScore > bet.line) return 'Loss';
            return 'Push';
        }
    } else { // moneyline
        if (bet.teamOrOverUnder === 'home') {
            return homeScore > awayScore ? 'Win' : 'Loss';
        } else { // away
            return awayScore > homeScore ? 'Win' : 'Loss';
        }
    }
};

export const calculateMargin = (bet: Bet): number | null => {
    if (!bet.finalScore || bet.outcome === 'Pending') return null;
    const { home, away } = bet.finalScore;
    if (bet.betType === 'spread') {
        const homeMargin = home - away;
        if (bet.teamOrOverUnder === 'home') return homeMargin + bet.line;
        return -homeMargin + bet.line;
    }
    if (bet.betType === 'total') {
        const actualTotal = home + away;
        const totalDifference = actualTotal - bet.line;
        return bet.teamOrOverUnder === 'over' ? totalDifference : -totalDifference;
    }
    return null;
};

export const calculateUnits = (bet: Bet): number => {
    switch (bet.outcome) {
        case 'Win':
            if (bet.odds > 0) {
                return bet.odds / 100;
            }
            return 100 / Math.abs(bet.odds);
        case 'Loss':
            return -1;
        case 'Push':
            return 0;
        case 'Pending':
        default:
            return 0;
    }
};

export const parseSpreadValue = (
  spreadStr: string,
  homeTeamAbbr: string,
  awayTeamAbbr: string
): number | null => {
  const parts = spreadStr.trim().split(' ');
  const numberPart = parseFloat(parts[parts.length - 1]);
  
  if (isNaN(numberPart)) return 0; 
  
  if (spreadStr.toUpperCase().includes(awayTeamAbbr.toUpperCase())) {
    return -numberPart;
  }
  
  return numberPart;
};

const getSpreadValueScore = (savantSpread: number, marketSpread: number): ValueScore => {
    const diff = Math.abs(savantSpread - marketSpread);

    // Value logic updated to reflect tighter, more realistic edges
    if (diff >= 4.0) {
        return {
            score: 9,
            text: "⭐⭐⭐ \"Savant's Pick\""
        };
    }
    if (diff >= 2.5) { 
        return {
            score: 6,
            text: '⭐⭐ "Solid Play"'
        };
    }
    if (diff >= 1.0) { 
        return {
            score: 4,
            text: '⭐ "Value Lean"'
        };
    }
    return {
        score: 2,
        text: '"No Play"'
    };
}

const getTotalValueScore = (savantTotal: number, marketTotal: number): ValueScore => {
    const diff = Math.abs(savantTotal - marketTotal);

    if (diff >= 5.0) {
        return {
            score: 9,
            text: "⭐⭐⭐ \"Savant's Pick\""
        };
    }
    if (diff >= 3.0) { 
        return {
            score: 6,
            text: '⭐⭐ "Solid Play"'
        };
    }
    if (diff >= 1.5) { 
        return {
            score: 4,
            text: '⭐ "Value Lean"'
        };
    }
    return {
        score: 2,
        text: '"No Play"'
    };
}


export const calculateValueScore = (
    savantLine: { spread: string, total: number },
    marketLine: { spread: number, total: number },
    homeTeam: Team,
    awayTeam: Team
): { spread: ValueScore, total: ValueScore } => {
    
    const savantSpreadNum = parseSpreadValue(savantLine.spread, homeTeam.abbreviation, awayTeam.abbreviation);

    let spreadScore: ValueScore = { score: 0, text: "Could not calculate value" };
    if (savantSpreadNum !== null) {
        spreadScore = getSpreadValueScore(savantSpreadNum, marketLine.spread);
    }

    let totalScore: ValueScore = getTotalValueScore(savantLine.total, marketLine.total);

    return {
        spread: spreadScore,
        total: totalScore,
    };
};

export const getMarketLine = (game: GameForAnalysis): (MarketOdds & { sourceBook: string }) | null => {
    if (!game.odds || game.odds.length === 0) {
        return null;
    }
    const fanduelOdds = game.odds.find(o => o.bookmaker.toLowerCase().includes('fanduel'));
    if (fanduelOdds) {
        return { ...fanduelOdds, sourceBook: 'FanDuel' }; 
    }
    if (game.odds[0]) {
        return { ...game.odds[0], sourceBook: game.odds[0].bookmaker };
    }
    return null;
}

export const normalizeStats = (stats: Partial<TeamStats>, teamName: string): Partial<TeamStats> => {
    const normalized = { ...stats };

    // Defines which stats must be strictly between 0.0 and 1.0
    const percentageKeys: (keyof TeamStats)[] = [
        'effectiveFgPct', 'opponentEffectiveFgPct', 'trueShootingPct', 'turnoverPct',
        'forcedTurnoverPct', 'offensiveReboundPct', 'defensiveReboundPct', 'freeThrowRate',
        'opponentFreeThrowRate', 'threePointAttemptRate', 'threePointPct'
    ];

    const normalizeObject = (obj: any, keys: (keyof TeamStats | keyof NonNullable<TeamStats['recentStats']>)[]) => {
        if (!obj) return;
        for (const key of keys) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const originalValue = obj[key];
                if (originalValue === null || typeof originalValue === 'undefined') {
                    continue;
                }

                let numericValue = parseFloat(originalValue as any);

                if (!isNaN(numericValue)) {
                    // STRICT SANITIZATION
                    // If a percentage stat is > 1.0 (e.g. 54.3 or 13.5), it is likely an integer representation (54.3% or 13.5%).
                    // We divide by 100 to get the decimal (0.543 or 0.135).
                    // Exception: Pace, ORtg, DRtg are typically > 1.0, but those are not in 'percentageKeys'.
                    
                    if (numericValue > 1.0) {
                        // console.warn(`Sanitizing stat "${String(key)}" for ${teamName}. Original: ${originalValue}, Corrected: ${numericValue / 100}`);
                        numericValue = numericValue / 100;
                    }
                    
                    // Additional clamp just in case something went truly wrong (e.g. 500%)
                    if (numericValue > 1.0) numericValue = 0.99;
                    if (numericValue < 0.0) numericValue = 0.01;

                    obj[key] = numericValue;
                }
            }
        }
    };

    normalizeObject(normalized, percentageKeys);

    if (normalized.recentStats) {
        normalizeObject(normalized.recentStats, percentageKeys);
    }

    // Specific sanity checks for Ratings (ORtg/DRtg)
    // If AI returns 1.15 instead of 115.0, fix it.
    const ratingKeys: (keyof TeamStats)[] = ['offensiveRating', 'defensiveRating'];
    ratingKeys.forEach(key => {
        if (normalized[key]) {
            let val = parseFloat(normalized[key] as any);
            if (val < 10 && val > 0) {
                val = val * 100; // Fix decimal rating hallucination
                (normalized as any)[key] = val;
            }
        }
    });

    return normalized;
};

export function isGameForAnalysis(obj: any): obj is GameForAnalysis {
    if (
        !obj || typeof obj !== 'object' ||
        typeof obj.id !== 'string' ||
        typeof obj.date !== 'string' ||
        typeof obj.awayTeamName !== 'string' ||
        typeof obj.homeTeamName !== 'string'
    ) {
        return false;
    }
    return true;
}

export function isBet(obj: any): obj is Bet {
    if (
        !obj || typeof obj !== 'object' ||
        typeof obj.id !== 'string' ||
        !obj.game || typeof obj.game !== 'object'
    ) {
        return false;
    }
    return true;
}

export function isSavedAnalysis(obj: any): obj is SavedAnalysis {
    if (
        !obj || typeof obj !== 'object' ||
        typeof obj.id !== 'string' ||
        typeof obj.date !== 'string' ||
        !Array.isArray(obj.results)
    ) {
        return false;
    }
    return true;
}

export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
