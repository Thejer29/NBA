import { GameForAnalysis, CompletedGame } from '../types';
import { fetchScheduleAndOddsFromFanDuel, fetchGameResultsFromWeb } from './geminiService';

export const fetchNBASchedule = async (date: string): Promise<GameForAnalysis[]> => {
    // Defensive check: If no date is provided, or it's not in the expected YYYY-MM-DD format,
    // prevent making an expensive AI call.
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        console.warn(`fetchNBASchedule was called with an invalid date: "${date}". Returning an empty array.`);
        return [];
    }

    try {
        const games = await fetchScheduleAndOddsFromFanDuel(date);
        return games;
    } catch (error) {
        console.error(`Error fetching NBA schedule from FanDuel via AI: ${error instanceof Error ? error.message : 'An unknown error occurred'}`);
        if (error instanceof Error) throw error;
        throw new Error("Could not retrieve game schedule due to an unknown error.");
    }
};

export const fetchGameResultsForDate = async (date: string): Promise<CompletedGame[]> => {
    try {
        const results = await fetchGameResultsFromWeb(date);
        return results;
    } catch (error) {
        console.error(`Error fetching NBA results for ${date} via AI: ${error instanceof Error ? error.message : 'An unknown error occurred'}`);
        if (error instanceof Error) throw error;
        throw new Error(`An unknown error occurred while fetching game results for ${date}.`);
    }
};
