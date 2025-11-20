
import React, { useState, useEffect, useCallback } from 'react';
import { 
    Team, 
    GameForAnalysis, 
    SavedAnalysis, 
    ModelWeights, 
    GameAnalysis, 
    TeamStats,
    CalibrationResult,
    GameDetails
} from '../../types';
import { 
    DEFAULT_MODEL_WEIGHTS, 
    TEAMS 
} from '../../constants';
import { 
    fetchNBASchedule, 
    fetchGameResultsForDate 
} from '../../services/nbaDataService';
import { 
    fetchComprehensiveMatchupStats, 
    fetchTeamInjuries, 
    generateAnalysis, 
    checkAnalysisConsistency, 
    getCalibratedWeights,
    ApiKeyError,
    fetchVolatilityStats
} from '../../services/geminiService';
import { 
    runMonteCarloSimulation, 
    patchStats 
} from '../../services/simulationService';
import { 
    getToday, 
    getMarketLine,
    determineOutcome,
    isSavedAnalysis
} from '../../utils';

import ControlPanel from './ControlPanel';
import GameSelector from './GameSelector';
import ResultsPanel from './ResultsPanel';
import SourcesPanel from './SourcesPanel';
import TuningModal from './TuningModal';
import CalibrationCompleteModal from './CalibrationCompleteModal';
import AnalysisViewerModal from './AnalysisViewerModal';
import { useBetTracker } from '../../context/BetTrackerContext';

const CONCURRENCY_LIMIT = 3;

const Dashboard: React.FC = () => {
    const { bets, updateBet, setBets } = useBetTracker();
    
    // -- State --
    const [selectedDate, setSelectedDate] = useState<string>(getToday());
    const [gameSlate, setGameSlate] = useState<GameForAnalysis[]>([]);
    const [loadingStates, setLoadingStates] = useState<{ [key: string]: boolean | string }>({});
    const [unitSize, setUnitSize] = useState<number>(100);
    const [modelWeights, setModelWeights] = useState<ModelWeights>(DEFAULT_MODEL_WEIGHTS);
    
    const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>(() => {
        try {
            const saved = localStorage.getItem('savant-saved-analyses');
            const parsed = saved ? JSON.parse(saved) : [];
            return Array.isArray(parsed) && parsed.every(isSavedAnalysis) ? parsed : [];
        } catch (e) {
            console.error("Failed to parse saved analyses:", e);
            return [];
        }
    });

    const [selectedGameIds, setSelectedGameIds] = useState<Set<string>>(new Set());
    
    // Modals & Status
    const [isTuningModalOpen, setIsTuningModalOpen] = useState(false);
    const [isCalibrating, setIsCalibrating] = useState(false);
    const [calibrationResult, setCalibrationResult] = useState<{ result: { notes: string; newWeights: ModelWeights } | null; error: string | null } | null>(null);
    const [isGrading, setIsGrading] = useState(false);
    const [analysisProgress, setAnalysisProgress] = useState<{ current: number; total: number } | null>(null);
    const [analysisStatusMessage, setAnalysisStatusMessage] = useState<string>('');
    const [viewingAnalysis, setViewingAnalysis] = useState<GameAnalysis | null>(null);

    // -- Effects --

    useEffect(() => {
        localStorage.setItem('savant-saved-analyses', JSON.stringify(savedAnalyses));
    }, [savedAnalyses]);

    useEffect(() => {
        const loadSchedule = async () => {
            setLoadingStates(prev => ({ ...prev, 'schedule': true }));
            try {
                const games = await fetchNBASchedule(selectedDate);
                setGameSlate(games);
                setSelectedGameIds(new Set()); // Reset selection on date change
            } catch (error) {
                console.error(error);
                alert("Failed to load schedule. Please check your API key or try again.");
            } finally {
                setLoadingStates(prev => ({ ...prev, 'schedule': false }));
            }
        };
        loadSchedule();
    }, [selectedDate]);


    // -- Handlers --

    const handleTuneModel = () => setIsTuningModalOpen(true);

    const handleCalibrate = async () => {
        if (bets.length < 10) {
            alert("Need at least 10 graded bets to calibrate.");
            return;
        }
        setIsCalibrating(true);
        try {
            const performanceSummary = bets.filter(b => b.outcome !== 'Pending')
                .map(b => `Bet: ${b.betType} on ${b.teamOrOverUnder} (Line: ${b.line}). Outcome: ${b.outcome}. ValueScore: ${b.valueScore}`)
                .join('\n');

            const result = await getCalibratedWeights(modelWeights, performanceSummary);
            setModelWeights(result.calibratedWeights);
            setCalibrationResult({ result: { notes: result.calibrationNotes, newWeights: result.calibratedWeights }, error: null });
        } catch (error) {
            setCalibrationResult({ result: null, error: error instanceof Error ? error.message : "Unknown error" });
        } finally {
            setIsCalibrating(false);
        }
    };

    const handleGradePendingBets = async () => {
        const pendingBets = bets.filter(b => b.outcome === 'Pending');
        if (pendingBets.length === 0) {
            alert("No pending bets to grade.");
            return;
        }

        setIsGrading(true);
        // Group by date to minimize API calls
        const betsByDate = new Map<string, typeof pendingBets>();
        pendingBets.forEach(b => {
            const date = b.game.date.split('T')[0];
            if (!betsByDate.has(date)) betsByDate.set(date, []);
            betsByDate.get(date)!.push(b);
        });

        let updatedCount = 0;

        try {
            for (const [date, dateBets] of betsByDate.entries()) {
                const results = await fetchGameResultsForDate(date);
                
                for (const bet of dateBets) {
                    const gameResult = results.find(r => {
                         // Loose matching on names
                         const homeMatch = r.homeTeamName.includes(bet.game.homeTeamName) || bet.game.homeTeamName.includes(r.homeTeamName);
                         const awayMatch = r.awayTeamName.includes(bet.game.awayTeamName) || bet.game.awayTeamName.includes(r.awayTeamName);
                         return homeMatch && awayMatch;
                    });

                    if (gameResult) {
                        const outcome = determineOutcome(bet, gameResult.homeScore, gameResult.awayScore);
                        updateBet({
                            ...bet,
                            outcome,
                            finalScore: { home: gameResult.homeScore, away: gameResult.awayScore, wentToOT: gameResult.wentToOT }
                        });
                        updatedCount++;
                    }
                }
            }
            if (updatedCount > 0) {
                alert(`Successfully graded ${updatedCount} bets.`);
            } else {
                alert("No matching final scores found for pending bets yet.");
            }
        } catch (error) {
            console.error(error);
            alert("Error grading bets.");
        } finally {
            setIsGrading(false);
        }
    };

    const processSingleGame = async (gameId: string): Promise<GameAnalysis | null> => {
        const game = gameSlate.find(g => g.id === gameId);
        if (!game) return null;

        setLoadingStates(prev => ({ ...prev, [gameId]: 'Fetching Stats...' }));

        // 1. Fetch comprehensive stats
        const [statsData, homeInjuryData, awayInjuryData, homeVolatilityData, awayVolatilityData] = await Promise.all([
            fetchComprehensiveMatchupStats(game.homeTeamName, game.awayTeamName),
            fetchTeamInjuries(game.homeTeamName),
            fetchTeamInjuries(game.awayTeamName),
            fetchVolatilityStats(game.homeTeamName),
            fetchVolatilityStats(game.awayTeamName)
        ]);

        // Explicitly cast statsData to avoid TS 'unknown' errors if inference fails
        const safeStatsData = statsData as { home: Partial<TeamStats>; away: Partial<TeamStats> };

        // 2. Construct Team objects
        const homeTeam: Team = {
            id: 1, // IDs are placeholders in this context
            name: game.homeTeamName,
            abbreviation: TEAMS.find(t => t.name === game.homeTeamName)?.abbreviation || 'HOM',
            logo: TEAMS.find(t => t.name === game.homeTeamName)?.logo || '',
            stats: {
                ...patchStats(safeStatsData.home, game.homeTeamName),
                injuries: homeInjuryData.injuries,
                netRatingVolatility: homeVolatilityData?.pointDifferentials 
                    ? calculateStdDev(homeVolatilityData.pointDifferentials) 
                    : undefined
            }
        };

        const awayTeam: Team = {
            id: 2,
            name: game.awayTeamName,
            abbreviation: TEAMS.find(t => t.name === game.awayTeamName)?.abbreviation || 'AWY',
            logo: TEAMS.find(t => t.name === game.awayTeamName)?.logo || '',
            stats: {
                ...patchStats(safeStatsData.away, game.awayTeamName),
                injuries: awayInjuryData.injuries,
                netRatingVolatility: awayVolatilityData?.pointDifferentials 
                    ? calculateStdDev(awayVolatilityData.pointDifferentials) 
                    : undefined
            }
        };

        setLoadingStates(prev => ({ ...prev, [gameId]: 'Running Simulation...' }));

        // 3. Run Simulation
        const marketOdds = getMarketLine(game);
        const marketSpread = marketOdds?.spread?.home ?? 0;
        const marketTotal = marketOdds?.total ?? 220;

        const simulationResult = runMonteCarloSimulation(homeTeam, awayTeam, { spread: marketSpread, total: marketTotal }, modelWeights, game);

        setLoadingStates(prev => ({ ...prev, [gameId]: 'Generating Analysis...' }));

        // 4. Generate AI Analysis
        const analysis = await generateAnalysis(homeTeam, awayTeam, { spread: marketSpread, total: marketTotal }, simulationResult);

        // 5. Check Consistency against previous analysis if exists
        const previousAnalysis = savedAnalyses.flatMap(s => s.results).find(r => r.game.id === game.id);
        if (previousAnalysis) {
            const consistency = await checkAnalysisConsistency(previousAnalysis, { game, homeTeam, awayTeam, analysis });
            analysis.consistencyCheck = consistency;
        }

        setLoadingStates(prev => ({ ...prev, [gameId]: false }));
        
        return {
            game,
            homeTeam,
            awayTeam,
            analysis
        };
    };

    const handleRunAnalysis = async (gameIdsToAnalyze: string[]) => {
        if (gameIdsToAnalyze.length === 0) return;

        setLoadingStates(prev => ({ ...prev, 'analysis': true }));
        setAnalysisProgress({ current: 0, total: gameIdsToAnalyze.length });
        setAnalysisStatusMessage(`Starting analysis of ${gameIdsToAnalyze.length} games (Batch size: ${CONCURRENCY_LIMIT})...`);
        
        const newResults: GameAnalysis[] = [];
        const teamsWithStats: [string, Team][] = [];
        let completedCount = 0;

        // Helper to run the queue
        const runConcurrencyQueue = async () => {
            const queue = [...gameIdsToAnalyze];
            const activePromises: Promise<void>[] = [];

            const processNext = async (): Promise<void> => {
                if (queue.length === 0) return;
                const gameId = queue.shift()!;
                
                try {
                    const result = await processSingleGame(gameId);
                    if (result) {
                        newResults.push(result);
                        if (!teamsWithStats.some(t => t[0] === result.homeTeam.name)) teamsWithStats.push([result.homeTeam.name, result.homeTeam]);
                        if (!teamsWithStats.some(t => t[0] === result.awayTeam.name)) teamsWithStats.push([result.awayTeam.name, result.awayTeam]);
                    }
                } catch (e) {
                    if (e instanceof ApiKeyError) throw e; // Halt entirely on API key error
                    console.error(`Analysis failed for game ${gameId}:`, e);
                } finally {
                    completedCount++;
                    setAnalysisProgress({ current: completedCount, total: gameIdsToAnalyze.length });
                }
                
                // Recursively process next if queue isn't empty
                if (queue.length > 0) {
                    return processNext();
                }
            };

            // Initial fill of the pool
            const initialPoolSize = Math.min(CONCURRENCY_LIMIT, queue.length);
            for (let i = 0; i < initialPoolSize; i++) {
                activePromises.push(processNext());
            }

            await Promise.all(activePromises);
        };

        try {
            await runConcurrencyQueue();

            if (newResults.length > 0) {
                const newSavedAnalysis: SavedAnalysis = {
                    id: new Date().toISOString(),
                    date: selectedDate,
                    results: newResults,
                    gameSlate: gameSlate,
                    teamsWithStats: teamsWithStats
                };

                setSavedAnalyses(prev => [newSavedAnalysis, ...prev]);
            }
        } catch (error: unknown) {
             if (error instanceof ApiKeyError) {
                alert(error.message);
                setLoadingStates({});
                setAnalysisProgress(null);
                return; 
            }
        } finally {
            setLoadingStates(prev => ({ ...prev, 'analysis': false }));
            setAnalysisProgress(null);
            setAnalysisStatusMessage('');
        }
    };

    const handleLoadAnalysis = (analysis: SavedAnalysis) => {
        setSelectedDate(analysis.date);
        setGameSlate(analysis.gameSlate);
        // We don't necessarily need to restore teamsWithStats to state unless we want to cache them
        // But restoring the slate allows the user to re-run specific games easily
    };
    
    const handleViewAnalysis = (gameId: string) => {
        // Find the analysis in saved history
        // We look in the most recent saved analysis first
        for (const saved of savedAnalyses) {
            const found = saved.results.find(r => r.game.id === gameId);
            if (found) {
                setViewingAnalysis(found);
                return;
            }
        }
        alert("Detailed analysis not found for this game.");
    };

    const calculateStdDev = (numbers: number[]): number => {
        if (numbers.length === 0) return 0;
        const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
        const variance = numbers.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / numbers.length;
        return Math.sqrt(variance);
    };

    return (
        <main className="container mx-auto p-4 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Controls & Game Selection */}
                <div className="space-y-6">
                    <ControlPanel 
                        selectedDate={selectedDate} 
                        onDateChange={setSelectedDate} 
                        unitSize={unitSize} 
                        onUnitSizeChange={setUnitSize}
                        onTuneModel={handleTuneModel}
                        onCalibrate={handleCalibrate}
                        isCalibrating={isCalibrating}
                    />
                    <GameSelector 
                        gameSlate={gameSlate} 
                        isLoading={!!loadingStates['schedule']} 
                        loadingStates={loadingStates} 
                        onRunAnalysis={handleRunAnalysis}
                        selectedGameIds={selectedGameIds}
                        onSelectionChange={setSelectedGameIds}
                        analysisProgress={analysisProgress}
                        analysisStatusMessage={analysisStatusMessage}
                    />
                     <SourcesPanel />
                </div>

                {/* Right Column: Results & Analysis */}
                <div className="lg:col-span-2 space-y-6">
                    <ResultsPanel 
                        unitSize={unitSize}
                        savedAnalyses={savedAnalyses}
                        setSavedAnalyses={setSavedAnalyses}
                        onGradePendingBets={handleGradePendingBets}
                        isGrading={isGrading}
                        onLoadAnalysis={handleLoadAnalysis}
                        modelWeights={modelWeights}
                        setModelWeights={setModelWeights}
                        onViewAnalysis={handleViewAnalysis}
                    />
                </div>
            </div>

            {/* Modals */}
            <TuningModal 
                isOpen={isTuningModalOpen} 
                onClose={() => setIsTuningModalOpen(false)} 
                currentWeights={modelWeights} 
                onSave={(newWeights) => { setModelWeights(newWeights); setIsTuningModalOpen(false); }} 
            />
            
            <CalibrationCompleteModal 
                isOpen={!!calibrationResult} 
                onClose={() => setCalibrationResult(null)} 
                result={calibrationResult?.result || null} 
                error={calibrationResult?.error || null} 
            />

            {viewingAnalysis && (
                <AnalysisViewerModal 
                    analysis={viewingAnalysis} 
                    onClose={() => setViewingAnalysis(null)} 
                />
            )}
        </main>
    );
};

export default Dashboard;
