
import { GoogleGenAI, GenerateContentResponse, Type, Modality } from "@google/genai";
import { Team, AnalysisResult, SimulationResult, GameAnalysis, ConsistencyCheckResult, TeamStats, Injury, ModelWeights, CalibrationResult, GameForAnalysis, CompletedGame } from '../types';
import { calculateValueScore, getMarketLine, parseSpreadValue } from "../utils";
import { TEAMS } from '../constants';

export class ApiKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiKeyError';
  }
}

const getAiClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY as string });

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
async function withRetries<T>(apiCall: () => Promise<T>): Promise<T> {
    const maxRetries = 5; 
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            return await apiCall();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('API_KEY_INVALID') || errorMessage.includes('API key expired') || errorMessage.includes('API key not valid')) {
                console.error(`API Key Error: ${errorMessage}`);
                throw new ApiKeyError('The API key is invalid or has expired. Please select a new one.');
            }
            
            if (errorMessage.includes('500') || errorMessage.includes('503') || errorMessage.includes('INTERNAL') || errorMessage.includes('UNAVAILABLE') || errorMessage.includes('fetch failed') || errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
                attempt++;
                if (attempt >= maxRetries) {
                    console.error(`API call failed after ${maxRetries} attempts. Error: ${errorMessage}`);
                    throw error;
                }
                const delayTime = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
                console.warn(`API call failed on attempt ${attempt} with a transient error. Retrying in ${Math.round(delayTime)}ms...`);
                await delay(delayTime);
            } else {
                throw error;
            }
        }
    }
    throw new Error('Exhausted all retries for the API call.');
}

function sanitizeAndParseJson(text: string): any {
  if (!text) {
    throw new Error("Received an empty response from the AI model.");
  }
  let jsonString = text.trim();

  if (jsonString.startsWith('```json') && jsonString.endsWith('```')) {
    jsonString = jsonString.substring(7, jsonString.length - 3).trim();
  } else if (jsonString.startsWith('```') && jsonString.endsWith('```')) {
      jsonString = jsonString.substring(3, jsonString.length - 3).trim();
  }
  
  const firstBracket = jsonString.indexOf('{');
  const firstSquare = jsonString.indexOf('[');
  
  if (firstBracket === -1 && firstSquare === -1) {
       throw new Error("No JSON object or array found in the response.");
  }
  
  let startsWith, endsWith;

  if (firstBracket !== -1 && (firstSquare === -1 || firstBracket < firstSquare)) {
      startsWith = '{';
      endsWith = '}';
  } else {
      startsWith = '[';
      endsWith = ']';
  }

  const jsonStart = jsonString.indexOf(startsWith);
  const jsonEnd = jsonString.lastIndexOf(endsWith);

  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    jsonString = jsonString.substring(jsonStart, jsonEnd + 1);
  }

  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Failed to parse JSON:", jsonString, error instanceof Error ? error.message : 'An unknown error occurred');
    throw new Error(`Received an invalid JSON response from the AI model.`);
  }
}

const getSeasonString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); 
    if (month >= 9) { 
        return `${year}-${(year + 1).toString().slice(-2)}`;
    } else { 
        return `${year - 1}-${year.toString().slice(-2)}`;
    }
};

const getTeamAbbr = (teamName: string): string => {
    const team = TEAMS.find(t => t.name === teamName);
    if (team) return team.abbreviation;

    const partialMatch = TEAMS.find(t => teamName.includes(t.name) || t.name.includes(teamName));
    if (partialMatch) return partialMatch.abbreviation;

    return teamName.split(' ').map(n => n[0]).join('').substring(0, 3).toUpperCase();
};

export const fetchScheduleAndOddsFromFanDuel = async (date: string): Promise<GameForAnalysis[]> => {
    const prompt = `
**PRIMARY DIRECTIVE:** Retrieve the **COMPLETE** list of NBA games scheduled for **${date}**. 
It is CRITICAL to include EVERY single game played on this date. Do not omit any matchups.

**STEP 1 - GET SCHEDULE:** Perform a Google Search for "NBA schedule ${date} ESPN" to ensure you have the definitive list of all games. Count them.
**STEP 2 - GET ODDS:** Perform a Google Search for "NBA odds ${date} FanDuel" to find betting lines.
**STEP 3 - MERGE:** Combine the data.

**CRITICAL RULE:** If a game is found in the schedule but NO odds are found, you **MUST** still include the game in the output with the "odds" field set to \`[]\`. **NEVER** filter out a game just because odds are missing.

**REQUIRED JSON OUTPUT:**
A raw JSON array. No markdown.
\`\`\`json
[
  {
    "date": "ISO 8601 Timestamp", 
    "time": "7:30 PM ET", 
    "awayTeamName": "Full Team Name",
    "homeTeamName": "Full Team Name",
    "odds": [
      {
        "bookmaker": "FanDuel",
        "spread": { "home": -5.5, "away": 5.5 }, 
        "total": 224.5, 
        "moneyline": { "home": -210, "away": 180 }
      }
    ]
  }
]
\`\`\`
If absolutely no games are scheduled for this date, return \`[]\`.
`;
    
    return withRetries(async () => {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro', 
            contents: prompt,
            config: {
                temperature: 0, 
                tools: [{ googleSearch: {} }],
            }
        });
        const results = sanitizeAndParseJson(response.text);
        if (!Array.isArray(results)) {
            return [];
        }
        
        return results.map((game: any): GameForAnalysis | null => {
            if (!game.awayTeamName || !game.homeTeamName || !game.date) return null;

            const awayAbbr = getTeamAbbr(game.awayTeamName);
            const homeAbbr = getTeamAbbr(game.homeTeamName);
            
            return {
                id: `${awayAbbr}_vs_${homeAbbr}_${date}`,
                date: game.date,
                time: game.time, 
                awayTeamName: game.awayTeamName,
                homeTeamName: game.homeTeamName,
                odds: game.odds
            };
        }).filter((g): g is GameForAnalysis => g !== null);
    });
};

export const fetchGameResultsFromWeb = async (date: string): Promise<CompletedGame[]> => {
    const prompt = `
**PRIMARY DIRECTIVE:** Find final scores for NBA games played on **${date}**.

**REQUIRED JSON OUTPUT:**
Raw JSON array.
\`\`\`json
[
  {
    "homeTeamName": "Team A",
    "awayTeamName": "Team B",
    "homeScore": 120,
    "awayScore": 115,
    "wentToOT": false
  }
]
\`\`\`
If no completed games, return \`[]\`.
`;

    return withRetries(async () => {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                temperature: 0, 
                tools: [{ googleSearch: {} }],
            }
        });
        const results = sanitizeAndParseJson(response.text);
        if (!Array.isArray(results)) {
            return [];
        }

        return results.map((game: any): CompletedGame | null => {
            if (!game.homeTeamName || !game.awayTeamName || game.homeScore === undefined || game.awayScore === undefined) return null;

             const awayAbbr = getTeamAbbr(game.awayTeamName);
             const homeAbbr = getTeamAbbr(game.homeTeamName);
             const gameDateForId = date.split('T')[0];
             return {
                 id: `${awayAbbr}_vs_${homeAbbr}_${gameDateForId}`,
                 homeTeamName: game.homeTeamName,
                 awayTeamName: game.awayTeamName,
                 homeScore: game.homeScore,
                 awayScore: game.awayScore,
                 wentToOT: game.wentToOT || false,
             };
        }).filter((g): g is CompletedGame => g !== null);
    });
};

export const fetchComprehensiveMatchupStats = async (homeTeamName: string, awayTeamName: string): Promise<{ home: Partial<TeamStats>, away: Partial<TeamStats> }> => {
    
    const seasonString = getSeasonString();
    
    const prompt = `
**TASK:** Extract **CURRENT ${seasonString} REGULAR SEASON** NBA stats for: ${awayTeamName} @ ${homeTeamName}. Mimic \`nba_api\` output logic.

**DATA SOURCE:** \`Basketball-Reference.com\` or \`NBA.com/stats\`.

**CRITICAL FORMATTING RULE:** 
All percentages (Turnover %, Rebound %, etc.) MUST be decimals (0.0 - 1.0). 
Example: 14.5% -> **0.145**. Do NOT return 14.5.

**REQUIRED METRICS:**
1.  **Team Factors:**
    *   Effective FG% (\`E_FG_PCT\`) -> Decimal (e.g., 0.543)
    *   Turnover % (\`TM_TOV_PCT\`) -> Decimal (e.g., 0.135)
    *   Offensive Rebound % (\`OREB_PCT\`) -> Decimal (e.g., 0.245)
    *   Free Throw Rate (\`FTA_RATE\`) -> Decimal (e.g., 0.215)
    *   Offensive Rating (\`ORtg\`) -> Number (e.g., 115.5)
    *   Defensive Rating (\`DRtg\`) -> Number (e.g., 112.1)
    *   Pace -> Number (e.g., 99.5)
    *   Wins/Losses

2.  **Active Roster (Top 8-9 by Minutes):**
    *   Exclude current injuries.
    *   For each player: Name, Usage Rate (0-100), Offensive Rating.

**OUTPUT FORMAT (JSON Only):**
\`\`\`json
{
  "home": {
    "offensiveRating": 115.5,
    "defensiveRating": 112.1,
    "netRating": 3.4,
    "pace": 99.5,
    "effectiveFgPct": 0.543,
    "opponentEffectiveFgPct": 0.531,
    "turnoverPct": 0.135,
    "forcedTurnoverPct": 0.141,
    "offensiveReboundPct": 0.225,
    "defensiveReboundPct": 0.765,
    "freeThrowRate": 0.215,
    "opponentFreeThrowRate": 0.221,
    "wins": 10,
    "losses": 5,
    "lastGameDate": "2025-11-10",
    "roster": [
       { "name": "Player A", "usageRate": 28.5, "offensiveRating": 118.0 }
    ]
  },
  "away": { ... }
}
\`\`\`
`;
    
    return withRetries(async () => {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            // Upgrade to 3-pro-preview for maximum accuracy in stat extraction (avoiding "13.5" vs "0.135" issues)
            model: 'gemini-3-pro-preview', 
            contents: prompt,
            config: {
                temperature: 0, 
                tools: [{ googleSearch: {} }],
                // A small thinking budget ensures it validates the decimal formatting rule before outputting
                thinkingConfig: { thinkingBudget: 1024 }
            }
        });
        const result = sanitizeAndParseJson(response.text);
        if (!result.home || !result.away) {
            throw new Error("AI response did not contain the required 'home' and 'away' stat objects.");
        }
        return result;
    });
};

export const fetchVolatilityStats = async (teamName: string): Promise<{ pointDifferentials: number[] | null }> => {
    const prompt = `
**TASK:** Extract the last 15 "Point Differentials" (Margin of Victory/Defeat) for the ${teamName} NBA team (Current Season).
**SOURCE:** Basketball-Reference Game Log.
**OUTPUT:** 
Strict JSON object containing a single array of numbers.
\`\`\`json
{ "pointDifferentials": [-5, 12, 3, ...] }
\`\`\`
`;
    return withRetries(async () => {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            // Keep Flash here for speed, volatility is a simpler list extraction task
            model: 'gemini-2.5-flash', 
            contents: prompt,
            config: { 
                temperature: 0, 
                tools: [{ googleSearch: {} }],
            }
        });
        const result = sanitizeAndParseJson(response.text);
        if (result && (!result.pointDifferentials || !Array.isArray(result.pointDifferentials))) {
             if (result.pointDifferentials !== null) { 
                return { pointDifferentials: null };
            }
        }
        return result;
    });
};


const getInjuryReportAgent = async (teamName: string): Promise<{ injuries: Injury[] }> => {
    const prompt = `
**TASK:** Create a current injury report for the ${teamName} NBA team.
**SOURCES:** NBA.com, ESPN, RotoWire.
**OUTPUT:** JSON object.
\`\`\`json
{
  "injuries": [
    { "player": "Name", "status": "Out/Questionable/etc", "details": "Reason", "teamName": "${teamName}" }
  ]
}
\`\`\`
`;
    return withRetries(async () => {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { 
                temperature: 0, 
                tools: [{ googleSearch: {} }],
            }
        });
        return sanitizeAndParseJson(response.text);
    });
}


export const fetchTeamInjuries = async (
    teamName: string,
): Promise<{ injuries: Injury[] }> => {
    try {
        const injuryReport = await getInjuryReportAgent(teamName);
        return { injuries: injuryReport.injuries || [] };
    } catch (error) {
        if (error instanceof ApiKeyError) throw error; 
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        console.warn(`Could not fetch injury report for ${teamName}. Proceeding without it. Reason: ${errorMessage}`);
        return { injuries: [] };
    }
};

export const generateAnalysis = async (
  homeTeam: Team,
  awayTeam: Team,
  marketLine: { spread: number; total: number; moneyline?: { home: number; away: number } },
  simulationResult: SimulationResult,
): Promise<AnalysisResult> => {
    
  const rawSavantSpread = simulationResult.medianSpread;
  const rawSavantTotal = simulationResult.medianTotal;
  
  const isHomeFav = rawSavantSpread < 0;
  const favTeam = isHomeFav ? homeTeam : awayTeam;
  const lineAbs = Math.abs(rawSavantSpread);
  const savantSpreadString = `${favTeam.abbreviation} -${lineAbs.toFixed(1)}`;

  const homeInjuriesString = JSON.stringify(homeTeam.stats.injuries?.filter(i => i.status !== 'Probable') || []);
  const awayInjuriesString = JSON.stringify(awayTeam.stats.injuries?.filter(i => i.status !== 'Probable') || []);

  const spreadDiff = Math.abs(rawSavantSpread - marketLine.spread);
  const totalDiff = Math.abs(rawSavantTotal - marketLine.total);
  const RED_FLAG_THRESHOLD = 5.0;
  let redFlagInstruction = '';

  if (spreadDiff >= RED_FLAG_THRESHOLD || totalDiff >= RED_FLAG_THRESHOLD) {
    redFlagInstruction = `
**!! RED FLAG: LARGE EDGE DETECTED !!**
*   **Diff:** Spread: ${spreadDiff.toFixed(1)}, Total: ${totalDiff.toFixed(1)}.
*   **Context:** The model disagrees with the market significantly.
*   **Action:** Be highly critical. Is there a major injury (e.g., Luka/Giannis out) that the stats haven't caught up to yet?
`;
  }

  const prompt = `
You are "The Savant Model", an expert NBA betting analyst.

**MATCHUP:** ${awayTeam.name} @ ${homeTeam.name}

**MATHEMATICAL PROJECTION (Clean Room Derived):**
*   **Final Savant Spread:** ${savantSpreadString}
*   **Final Savant Total:** ${rawSavantTotal.toFixed(1)}

${redFlagInstruction}

**INJURIES (Context):**
*   **${homeTeam.name}:** ${homeInjuriesString}
*   **${awayTeam.name}:** ${awayInjuriesString}
*   **Market Line:** ${homeTeam.abbreviation} ${marketLine.spread.toFixed(1)}

**TASK:**
1.  Accept the Mathematical Projection as the **Final Savant Line**.
2.  Provide concise qualitative analysis explaining *why* the math (and your roster adjustments) points to this line.
3.  Analyze the "Value" relative to the Market Line.

**OUTPUT SCHEMA (JSON):**
\`\`\`json
{
  "savantLine": {
    "spread": "${savantSpreadString}", 
    "total": ${rawSavantTotal.toFixed(1)}, 
    "spreadReasoning": "...",
    "totalReasoning": "..."
  },
  "prc": "...",
  "latestNews": "...",
  "injuryImpactAnalysis": "...",
  "matchupAnalysis": "...",
  "powerRankingContext": "...",
  "luckAnalysis": "...",
  "eloAnalysis": "...",
  "monteCarloAnalysis": "...",
  "synthesisNote": "..."
}
\`\`\`
`;
  try {
    const response = await withRetries<GenerateContentResponse>(async () => {
        const ai = getAiClient();
        return ai.models.generateContent({
            // Upgrade to gemini-3-pro-preview for advanced reasoning
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                temperature: 0.2,
                tools: [{ googleSearch: {} }],
                // Thinking Budget: Allow the AI to "think" through the matchup, injuries, and stats
                // before writing the analysis. This produces far more nuanced "Action Reports".
                thinkingConfig: { thinkingBudget: 2048 }
            }
        });
    });

    const qualitativeAnalysisData = sanitizeAndParseJson(response.text);
    
    const fullAnalysis: AnalysisResult = {
      ...qualitativeAnalysisData,
      savantLine: {
          ...qualitativeAnalysisData.savantLine,
          spread: savantSpreadString,
          total: rawSavantTotal,
      },
      valueScore: calculateValueScore(
        { spread: savantSpreadString, total: rawSavantTotal },
        marketLine,
        homeTeam,
        awayTeam
      ),
      simulationResult, 
      groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [],
    };

    return fullAnalysis;

  } catch (error) {
      console.error(`Error during Savant Analysis generation: ${error instanceof Error ? error.message : 'An unknown error occurred'}`);
      if (error instanceof Error) {
          throw new Error(`Savant Analysis failed. Reason: ${error.message}`);
      }
      throw new Error("An unknown error occurred during the Savant Analysis.");
  }
};

export const checkAnalysisConsistency = async (
  oldGameAnalysis: GameAnalysis,
  newGameAnalysis: GameAnalysis
): Promise<ConsistencyCheckResult> => {
  const { analysis: oldAnalysis, homeTeam: oldHomeTeam, awayTeam: oldAwayTeam } = oldGameAnalysis;
  const { analysis: newAnalysis, homeTeam: newHomeTeam, awayTeam: newAwayTeam } = newGameAnalysis;
  
  const prompt = `
**TASK:** Explain why the spread moved from "${oldAnalysis.savantLine.spread}" to "${newAnalysis.savantLine.spread}" for ${newAwayTeam.name} @ ${newHomeTeam.name}.
**DATA:** Compare injuries and stats provided in context.
**OUTPUT JSON:** \`{ "isChangeSignificant": boolean, "changeReason": "string" }\`
`;

    return withRetries(async () => {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: {
                temperature: 0,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        isChangeSignificant: { type: Type.BOOLEAN },
                        changeReason: { type: Type.STRING },
                    },
                    required: ['isChangeSignificant', 'changeReason']
                },
            }
        });
        return sanitizeAndParseJson(response.text);
    });
};


export const generateSpokenRecapText = async (gameAnalysis: GameAnalysis): Promise<string> => {
    const { analysis, homeTeam, awayTeam } = gameAnalysis;
    const prompt = `
**TASK:** Write a short, professional sports radio recap (approx 4-5 sentences) for the analysis of ${awayTeam.name} at ${homeTeam.name}.
**KEY DATA:** Savant Line: ${analysis.savantLine.spread} / ${analysis.savantLine.total}. Key Insight: ${analysis.matchupAnalysis}. Recommendation: ${analysis.synthesisNote}.
**OUTPUT:** Raw text only.
`;
    return withRetries(async () => {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: {
                temperature: 0.4,
            }
        });
        return response.text;
    });
};

export const generateAudioRecap = async (recapText: string): Promise<string> => {
    return withRetries(async () => {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: `Say cheerfully with a professional, confident, and clear analyst's voice: ${recapText}` }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' },
                    },
                },
            },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
            throw new Error("Failed to generate audio from the TTS model. Response did not contain audio data.");
        }
        return base64Audio;
    });
};

export const getCalibratedWeights = async (
    currentWeights: ModelWeights,
    performanceSummary: string
): Promise<CalibrationResult> => {
    const prompt = `
**TASK:** Optimize "Savant Model" NBA weights based on recent performance.
**CURRENT WEIGHTS:** ${JSON.stringify(currentWeights)}
**PERFORMANCE:** ${performanceSummary}
**OUTPUT JSON:** \`{ "calibratedWeights": { ... }, "calibrationNotes": "..." }\`
`;
    return withRetries(async () => {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: {
                temperature: 0.3,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        calibratedWeights: {
                            type: Type.OBJECT,
                            properties: {
                                recentForm: { type: Type.NUMBER },
                                eFgPctWeight: { type: Type.NUMBER },
                                turnoverPctWeight: { type: Type.NUMBER },
                                reboundPctWeight: { type: Type.NUMBER },
                                freeThrowRateWeight: { type: Type.NUMBER },
                                matchupImpactWeight: { type: Type.NUMBER },
                                volatilityImpactWeight: { type: Type.NUMBER },
                                simulationStdDev: { type: Type.NUMBER },
                                scoreCorrelation: { type: Type.NUMBER },
                                threePointVarianceWeight: { type: Type.NUMBER },
                                efficiencyDecay: { type: Type.NUMBER },
                            },
                             required: [
                                'recentForm', 'eFgPctWeight', 'turnoverPctWeight',
                                'reboundPctWeight', 'freeThrowRateWeight', 'matchupImpactWeight',
                                'volatilityImpactWeight', 'simulationStdDev', 'scoreCorrelation',
                                'threePointVarianceWeight', 'efficiencyDecay'
                            ]
                        },
                        calibrationNotes: { type: Type.STRING },
                    },
                    required: ['calibratedWeights', 'calibrationNotes']
                },
            }
        });
        return sanitizeAndParseJson(response.text);
    });
};
