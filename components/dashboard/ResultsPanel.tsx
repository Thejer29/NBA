
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useBetTracker } from '../../context/BetTrackerContext';
import { Bet, SavedAnalysis, ModelWeights, ExportData } from '../../types';
import Card from '../ui/Card';
import { isBet, isSavedAnalysis, calculateMargin, determineOutcome, calculateUnits } from '../../utils';
import ManualBetModal from './ManualBetModal';
import { TEAMS, EXPORT_FILE_PREFIX } from '../../constants';
import ManualGradeModal from './ManualGradeModal';
import ConfirmationModal from '../ui/ConfirmationModal';
import AnalysisResultCard from './AnalysisResultCard';

interface ResultsPanelProps {
    unitSize: number;
    savedAnalyses: SavedAnalysis[];
    setSavedAnalyses: React.Dispatch<React.SetStateAction<SavedAnalysis[]>>;
    onGradePendingBets: () => Promise<void>;
    isGrading: boolean;
    onLoadAnalysis: (analysis: SavedAnalysis) => void;
    modelWeights: ModelWeights;
    setModelWeights: React.Dispatch<React.SetStateAction<ModelWeights>>;
    onViewAnalysis: (gameId: string) => void;
}

const convertBetsToCSV = (betsToExport: Bet[]): string => {
    const headers = [
        'Date Placed', 'Game Date', 'Matchup', 'Bet Type', 'Selection', 'Line', 'Odds', 'Outcome', 'Value Score', 'Final Score'
    ];

    const escapeCSV = (val: any): string => {
        if (val === undefined || val === null) {
            return '';
        }
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const rows = betsToExport.map(bet => {
        const datePlaced = new Date(bet.datePlaced).toISOString().split('T')[0];
        const gameDate = new Date(bet.game.date).toISOString().split('T')[0];
        const matchup = `${bet.game.awayTeamName} @ ${bet.game.homeTeamName}`;
        const betType = bet.betType.charAt(0).toUpperCase() + bet.betType.slice(1);
        
        let selection = '';
        if (bet.betType === 'spread' || bet.betType === 'moneyline') {
            selection = bet.teamOrOverUnder === 'home' ? bet.game.homeTeamName : bet.game.awayTeamName;
        } else {
            selection = bet.teamOrOverUnder.charAt(0).toUpperCase() + bet.teamOrOverUnder.slice(1);
        }

        const line = bet.betType === 'moneyline' ? '' : bet.line;
        const odds = bet.odds;
        const outcome = bet.outcome;
        const valueScore = bet.valueScore.toFixed(1);
        const finalScore = bet.finalScore ? `${bet.finalScore.away} - ${bet.finalScore.home}` : '';
        
        const rowData = [
            datePlaced,
            gameDate,
            matchup,
            betType,
            selection,
            line,
            odds,
            outcome,
            valueScore,
            finalScore
        ];
        
        return rowData.map(escapeCSV).join(',');
    });

    return [headers.join(','), ...rows].join('\n');
};

const ResultsPanel: React.FC<ResultsPanelProps> = ({ unitSize, savedAnalyses, setSavedAnalyses, onGradePendingBets, isGrading, onLoadAnalysis, modelWeights, setModelWeights, onViewAnalysis }) => {
    const { bets, setBets, clearBets, deleteBet, updateBet, addBet, cleanDuplicateBets } = useBetTracker();
    const [activeTab, setActiveTab] = useState<'recommended' | 'graded' | 'history'>('recommended');
    const [importData, setImportData] = useState<ExportData | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [betToGrade, setBetToGrade] = useState<Bet | null>(null);
    const [isManualEntryModalOpen, setIsManualEntryModalOpen] = useState(false);
    const initialTabSet = useRef(false);
    const [filterMode, setFilterMode] = useState<'all' | 'value'>('all');
    const [valueFilter, setValueFilter] = useState<number>(0);
    const [confirmationModal, setConfirmationModal] = useState<{ isOpen: boolean; title: string; message: React.ReactNode, onConfirm?: () => void }>({ isOpen: false, title: '', message: '' });
    
    // State for viewing specific analysis results (drilling down)
    const [expandedAnalysisId, setExpandedAnalysisId] = useState<string | null>(null);
    
    const prevSavedAnalysesLength = useRef(savedAnalyses.length);

    useEffect(() => {
        // Automatically switch to history tab and expand the new analysis when one is added
        if (savedAnalyses.length > prevSavedAnalysesLength.current) {
            setActiveTab('history');
            setExpandedAnalysisId(savedAnalyses[0].id); // Assuming new ones are prepended
            prevSavedAnalysesLength.current = savedAnalyses.length;
        }
    }, [savedAnalyses]);


    const { wins, losses, pushes, netProfit, netUnits, roi, totalPlays, breakdown } = useMemo(() => {
        const relevantBets = bets.filter(b => {
            if (filterMode === 'value') {
                return b.betType !== 'moneyline' && b.valueScore >= valueFilter;
            }
            return true;
        });

        const graded = relevantBets.filter(b => b.outcome !== 'Pending');
        const wins = graded.filter(b => b.outcome === 'Win').length;
        const losses = graded.filter(b => b.outcome === 'Loss').length;
        const pushes = graded.filter(b => b.outcome === 'Push').length;
        
        let calculatedNetProfit = 0;
        let calculatedNetUnits = 0;

        graded.forEach(bet => {
            if (bet.outcome === 'Win') {
                const unitWin = bet.odds > 0 ? (bet.odds / 100) : (100 / Math.abs(bet.odds));
                calculatedNetUnits += unitWin;
                calculatedNetProfit += unitSize * unitWin;
            } else if (bet.outcome === 'Loss') {
                calculatedNetUnits -= 1;
                calculatedNetProfit -= unitSize;
            }
        });

        const totalWagered = (wins + losses) * unitSize;
        const roiCalc = totalWagered > 0 ? (calculatedNetProfit / totalWagered) * 100 : 0;

        const calcBreakdownStats = (arr: Bet[]) => {
            const w = arr.filter(b => b.outcome === 'Win').length;
            const l = arr.filter(b => b.outcome === 'Loss').length;
            const p = arr.filter(b => b.outcome === 'Push').length;
            const winPct = (w + l) > 0 ? (w / (w + l)) * 100 : 0;
            const units = arr.reduce((acc, bet) => acc + calculateUnits(bet), 0);
            return {
                record: `${w}-${l}-${p}`,
                winPct: winPct.toFixed(1) + '%',
                units,
            };
        };

        const spreads = graded.filter(b => b.betType === 'spread');
        const totals = graded.filter(b => b.betType === 'total');
        const overs = totals.filter(b => b.teamOrOverUnder === 'over');
        const unders = totals.filter(b => b.teamOrOverUnder === 'under');
        
        return { 
            wins, 
            losses, 
            pushes, 
            netProfit: calculatedNetProfit, 
            netUnits: calculatedNetUnits, 
            roi: roiCalc, 
            totalPlays: graded.length,
            breakdown: {
                spreads: calcBreakdownStats(spreads),
                overs: calcBreakdownStats(overs),
                unders: calcBreakdownStats(unders),
            }
        };
    }, [bets, unitSize, valueFilter, filterMode]);

    const recommendedPlays = useMemo(() => bets.filter(b => b.outcome === 'Pending'), [bets]);
    
    const savantPicks = useMemo(() => 
        recommendedPlays
            .filter(b => b.betType !== 'moneyline' && b.valueScore >= 8)
            .sort((a,b) => b.valueScore - a.valueScore), 
        [recommendedPlays]
    );

    const solidPlays = useMemo(() => 
        recommendedPlays
            .filter(b => b.betType !== 'moneyline' && b.valueScore >= 5 && b.valueScore < 8)
            .sort((a,b) => b.valueScore - a.valueScore), 
        [recommendedPlays]
    );

    const valueLeans = useMemo(() => 
        recommendedPlays
            .filter(b => b.betType !== 'moneyline' && b.valueScore >= 3 && b.valueScore < 5)
            .sort((a,b) => b.valueScore - a.valueScore), 
        [recommendedPlays]
    );


    const gradedBets = useMemo(() => bets.filter(b => {
        if (b.outcome === 'Pending') return false;

        if (filterMode === 'value') {
            return b.betType !== 'moneyline' && b.valueScore >= valueFilter;
        }
        // 'all' mode
        return true;
    }).sort((a,b) => new Date(b.datePlaced).getTime() - new Date(a.datePlaced).getTime()), [bets, valueFilter, filterMode]);
    
    useEffect(() => {
        // On initial load, if there are no pending bets but there are graded bets,
        // switch to the graded tab to show the user their history.
        if (bets.length > 0 && !initialTabSet.current) {
            const hasPending = bets.some(b => b.outcome === 'Pending');
            const hasGraded = bets.some(b => b.outcome !== 'Pending');
            if (!hasPending && hasGraded) {
                setActiveTab('graded');
            }
            initialTabSet.current = true;
        }
    }, [bets]);

    const handleDeleteAnalysis = (id: string) => {
        setSavedAnalyses(prev => {
            const updated = prev.filter(a => a.id !== id);
            localStorage.setItem('savant-saved-analyses', JSON.stringify(updated));
            return updated;
        });
        if (expandedAnalysisId === id) {
            setExpandedAnalysisId(null);
        }
    };

    const handleExport = () => {
        try {
            const dataToExport: ExportData = {
                bets,
                savedAnalyses,
                modelWeights,
            };
            const data = JSON.stringify(dataToExport, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${EXPORT_FILE_PREFIX}-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Export failed:", error);
            alert("An error occurred while trying to export the data.");
        }
    };

    const handleExportCSV = () => {
        if (bets.length === 0) {
            alert("No bets to export.");
            return;
        }
        try {
            const csvData = convertBetsToCSV(bets);
            const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${EXPORT_FILE_PREFIX}-Bets-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("CSV Export failed:", error);
            alert("An error occurred while trying to export the data as CSV.");
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result;
                if (typeof text === 'string') {
                    const parsedData = JSON.parse(text);
                    if (
                        parsedData && typeof parsedData === 'object' &&
                        'bets' in parsedData && Array.isArray(parsedData.bets) &&
                        'savedAnalyses' in parsedData && Array.isArray(parsedData.savedAnalyses) &&
                        parsedData.bets.every(isBet) &&
                        parsedData.savedAnalyses.every(isSavedAnalysis)
                        // modelWeights is optional, no need for strict validation here
                    ) {
                        setImportData({ 
                            bets: parsedData.bets, 
                            savedAnalyses: parsedData.savedAnalyses,
                            modelWeights: parsedData.modelWeights 
                        });
                    } else {
                        alert('Invalid file format. The file might be corrupted or not conform to the expected data structure. Please export a fresh file and try again.');
                    }
                }
            } catch (error) {
                const msg = error instanceof Error ? error.message : 'An unknown error occurred';
                console.error('Error parsing imported file:', msg);
                alert(`Error parsing file: ${msg}`);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    const handleConfirmImport = (mode: 'merge' | 'overwrite') => {
        if (!importData) return;
        const { bets: importedBets, savedAnalyses: importedAnalyses, modelWeights: importedWeights } = importData;
    
        let title = '';
        const messageLines: string[] = [];
    
        if (mode === 'merge') {
            const betsMap = new Map(bets.map(b => [b.id, b]));
            let newBetsCount = 0;
            importedBets.forEach(b => {
                if (!betsMap.has(b.id)) newBetsCount++;
                betsMap.set(b.id, b)
            });
            setBets(Array.from(betsMap.values()));
    
            const analysesMap = new Map(savedAnalyses.map(a => [a.id, a]));
            let newAnalysesCount = 0;
            importedAnalyses.forEach(a => {
                if(!analysesMap.has(a.id)) newAnalysesCount++;
                analysesMap.set(a.id, a)
            });
            setSavedAnalyses(Array.from(analysesMap.values()));
            
            title = 'Merge Successful';
            messageLines.push(`- ${newBetsCount} new bets were added or updated.`);
            messageLines.push(`- ${newAnalysesCount} new analysis sessions were added or updated.`);
            if (importedWeights) {
                setModelWeights(importedWeights);
                messageLines.push('- Model weights have been updated from the file.');
            }
        } else { // overwrite
            setBets(importedBets);
            setSavedAnalyses(importedAnalyses);
            
            title = 'Overwrite Successful';
            messageLines.push(`- All previous data has been replaced.`);
            messageLines.push(`- Loaded ${importedBets.length} bets.`);
            messageLines.push(`- Loaded ${importedAnalyses.length} analysis sessions.`);
            if (importedWeights) {
                setModelWeights(importedWeights);
                messageLines.push('- Model weights have been restored from the file.');
            }
        }
    
        setConfirmationModal({
            isOpen: true,
            title,
            message: (
                <ul className="list-disc list-inside space-y-1">
                    {messageLines.map((line, i) => <li key={i}>{line}</li>)}
                </ul>
            )
        });
    
        setImportData(null);
    };
    
    const handleFilterClick = (mode: 'all' | 'value', threshold: number = 0) => {
        setFilterMode(mode);
        setValueFilter(threshold);
    };

    const handleOpenManualGrade = (bet: Bet, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent triggering the analysis view
        setBetToGrade(bet);
    };
    
    const handleDelete = (betId: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent triggering the analysis view
        deleteBet(betId);
    };

    const handleSaveManualGrade = (finalScore: { home: number; away: number; wentToOT: boolean }) => {
        if (!betToGrade) return;
        const outcome = determineOutcome(betToGrade, finalScore.home, finalScore.away);
        updateBet({ ...betToGrade, outcome, finalScore });
        setBetToGrade(null); // Close modal
    };

    const handleCleanDuplicates = () => {
        setConfirmationModal({
            isOpen: true,
            title: 'Confirm Bet Cleanup',
            message: 'This will scan all your bets and remove any duplicates, keeping the most recently placed or graded version. This action cannot be undone.',
            onConfirm: () => {
                const { duplicatesRemoved } = cleanDuplicateBets();
                // Now, show the results modal
                setConfirmationModal({
                    isOpen: true,
                    title: 'Cleanup Complete',
                    message: duplicatesRemoved > 0 
                        ? `Removed ${duplicatesRemoved} duplicate bet(s). Your bet history is now clean.`
                        : 'No duplicate bets were found.',
                    onConfirm: undefined
                });
            }
        });
    };
    
    const filterTitle = useMemo(() => {
        if (filterMode === 'value') {
            if (valueFilter >= 8.0) return `Performance: Savant's Picks (≥ 8.0)`;
            if (valueFilter >= 5.0) return `Performance: Solid Plays (≥ 5.0)`;
            if (valueFilter >= 3.0) return `Performance: Value Leans (≥ 3.0)`;
        }
        return 'Performance: All Plays';
    }, [filterMode, valueFilter]);

    const valueFilterButtons = [
        { label: '⭐ (≥3)', threshold: 3.0 },
        { label: '⭐⭐ (≥5)', threshold: 5.0 },
        { label: '⭐⭐⭐ (≥8)', threshold: 8.0 },
    ];

    // Retrieve the currently expanded analysis object
    const expandedAnalysis = useMemo(() => {
        return savedAnalyses.find(a => a.id === expandedAnalysisId);
    }, [savedAnalyses, expandedAnalysisId]);

    return (
        <>
            <Card className="sticky top-8">
                <h2 className="text-xl font-bold text-savant-cyan mb-2">Results</h2>
                
                <div className="text-center mb-2">
                    <p className="text-sm font-semibold text-savant-accent transition-all duration-300">{filterTitle}</p>
                </div>
                
                <div className="grid grid-cols-3 md:grid-cols-5 gap-2 text-center mb-4 bg-savant-deep p-2 rounded-lg">
                    <StatCard label="Graded Plays" value={totalPlays} />
                    <StatCard label="Record" value={`${wins}-${losses}-${pushes}`} />
                     <StatCard 
                        label="Net (U)" 
                        value={netUnits > 0 ? `+${netUnits.toFixed(2)}u` : `${netUnits.toFixed(2)}u`}
                        color={netUnits > 0 ? 'text-green-400' : netUnits < 0 ? 'text-red-400' : 'text-savant-text'} 
                    />
                    <StatCard label="Net ($)" value={netProfit >= 0 ? `+$${netProfit.toFixed(2)}` : `-$${Math.abs(netProfit).toFixed(2)}`} color={netProfit > 0 ? 'text-green-400' : netProfit < 0 ? 'text-red-400' : 'text-savant-text'} />
                    <StatCard label="ROI" value={`${roi.toFixed(1)}%`} color={roi > 0 ? 'text-green-400' : roi < 0 ? 'text-red-400' : 'text-savant-text'} />
                </div>
                
                 <div className="flex flex-wrap justify-center items-center gap-2 mb-4">
                    <span className="text-xs font-semibold text-savant-accent mr-2">Filter Performance:</span>
                    <button
                        onClick={() => handleFilterClick('all')}
                        className={`text-xs font-semibold px-3 py-1 rounded-full transition ${filterMode === 'all' ? 'bg-savant-cyan text-savant-deep ring-2 ring-cyan-300' : 'bg-savant-light text-savant-accent hover:bg-savant-accent/80'}`}
                    >
                        All Plays
                    </button>
                    {valueFilterButtons.map(f => (
                        <button
                            key={f.threshold}
                            onClick={() => handleFilterClick('value', f.threshold)}
                             className={`text-xs font-semibold px-3 py-1 rounded-full transition ${filterMode === 'value' && valueFilter === f.threshold ? 'bg-savant-cyan text-savant-deep ring-2 ring-cyan-300' : 'bg-savant-light text-savant-accent hover:bg-savant-accent/80'}`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {totalPlays > 0 && (
                    <RecordBreakdown breakdown={breakdown} />
                )}

                <div className="flex border-b border-savant-light mb-3">
                    <TabButton title={`Recommended (${recommendedPlays.length})`} isActive={activeTab === 'recommended'} onClick={() => { setActiveTab('recommended'); setExpandedAnalysisId(null); }} />
                    <TabButton title={`Graded (${gradedBets.length})`} isActive={activeTab === 'graded'} onClick={() => { setActiveTab('graded'); setExpandedAnalysisId(null); }} />
                    <TabButton title={`History (${savedAnalyses.length})`} isActive={activeTab === 'history'} onClick={() => setActiveTab('history')} />
                </div>

                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    {activeTab === 'recommended' && (
                        <>
                            <p className="text-xs text-savant-accent italic text-center mb-3 -mt-2">
                                Click any play to view the full analysis.
                            </p>
                             {savantPicks.length > 0 && (
                                <BetCategory title="⭐⭐⭐ Savant's Picks" bets={savantPicks} onDelete={handleDelete} onGrade={handleOpenManualGrade} onViewAnalysis={onViewAnalysis} />
                            )}
                            {solidPlays.length > 0 && (
                                <BetCategory title="⭐⭐ Solid Plays" bets={solidPlays} onDelete={handleDelete} onGrade={handleOpenManualGrade} onViewAnalysis={onViewAnalysis} />
                            )}
                             {valueLeans.length > 0 && (
                                <BetCategory title="⭐ Value Leans" bets={valueLeans} onDelete={handleDelete} onGrade={handleOpenManualGrade} onViewAnalysis={onViewAnalysis} />
                            )}
                            {recommendedPlays.length > 0 && savantPicks.length === 0 && solidPlays.length === 0 && valueLeans.length === 0 && 
                                <EmptyState message="No plays meet the value criteria. This can include manually added bets, moneyline bets, or plays with low model confidence." />
                            }
                            {recommendedPlays.length === 0 && 
                                <EmptyState message="No recommended plays found. Run an analysis to generate new plays." />
                            }
                        </>
                    )}

                    {activeTab === 'graded' && (
                        gradedBets.length > 0 
                            ? <BetCategory title="Graded Bets" bets={gradedBets} onDelete={handleDelete} onGrade={handleOpenManualGrade} onViewAnalysis={onViewAnalysis} />
                            : <EmptyState message="No graded bets found. Pending bets will appear here after their games are complete." />
                    )}
                    
                    {activeTab === 'history' && (
                        expandedAnalysis ? (
                            <div className="animate-fade-in-down">
                                <div className="flex justify-between items-center mb-4 bg-savant-deep p-3 rounded-lg">
                                    <div>
                                        <h3 className="font-bold text-savant-text">Analysis Results</h3>
                                        <p className="text-xs text-savant-accent">{new Date(expandedAnalysis.date).toDateString()}</p>
                                    </div>
                                    <button 
                                        onClick={() => setExpandedAnalysisId(null)}
                                        className="text-sm bg-savant-light text-savant-text px-3 py-1 rounded hover:bg-savant-accent transition"
                                    >
                                        Back to List
                                    </button>
                                </div>
                                <div className="space-y-6">
                                    {expandedAnalysis.results.map((result) => (
                                        <AnalysisResultCard 
                                            key={result.game.id} 
                                            result={result} 
                                            onTrackBet={(bet) => {
                                                addBet(bet);
                                                alert("Bet added to Tracker!");
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        ) : (
                            savedAnalyses.length > 0 ? (
                                <div>
                                    <p className="text-xs text-savant-accent italic text-center mb-3">
                                        Select a saved session to view results or reload the slate.
                                    </p>
                                    <ul className="space-y-3">
                                        {savedAnalyses.map(analysis => {
                                            const topMatchup = analysis.results[0];
                                            const topMatchupDisplay = topMatchup
                                                ? `${topMatchup.awayTeam.name} @ ${topMatchup.homeTeam.name}`
                                                : 'No games analyzed';
                                            const additionalGames = analysis.results.length > 1 ? ` (+${analysis.results.length - 1} more)` : '';

                                            return (
                                                <li 
                                                    key={analysis.id} 
                                                    className="bg-savant-deep p-3 rounded-lg flex justify-between items-center group transition-all hover:bg-savant-deep/80 cursor-pointer"
                                                    onClick={() => setExpandedAnalysisId(analysis.id)}
                                                >
                                                    <div>
                                                        <p className="font-semibold text-savant-text">Analysis: {new Date(analysis.id).toLocaleDateString()}</p>
                                                        <p className="text-xs text-savant-accent">{topMatchupDisplay}{additionalGames}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); onLoadAnalysis(analysis); }} 
                                                            className="text-xs font-semibold bg-savant-light text-savant-text px-3 py-2 rounded-md hover:bg-savant-accent transition"
                                                            title="Load these games back into the selector"
                                                        >
                                                            Load to Selector
                                                        </button>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteAnalysis(analysis.id); }} 
                                                            className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-2" 
                                                            aria-label="Delete analysis"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            ) : <EmptyState message="No saved analysis history." />
                        )
                    )}
                </div>
                <div className="mt-4 pt-4 border-t border-savant-light space-y-2">
                    <button onClick={onGradePendingBets} disabled={isGrading} className="w-full text-center bg-savant-cyan text-savant-deep font-bold py-2 px-4 rounded-lg hover:bg-cyan-300 transition disabled:opacity-50">
                        {isGrading ? 'Grading...' : `Grade ${bets.filter(b => b.outcome === 'Pending').length} Pending Bets`}
                    </button>
                     <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setIsManualEntryModalOpen(true)} className="w-full text-center bg-savant-light text-savant-text font-semibold py-2 px-4 rounded-lg hover:bg-savant-accent/50 transition">
                            Add Bet
                        </button>
                         <button onClick={clearBets} className="w-full text-center bg-red-800/50 text-red-300 font-semibold py-2 px-4 rounded-lg hover:bg-red-800/80 transition">
                            Clear Bets
                        </button>
                    </div>
                    <div className="pt-2">
                        <p className="text-xs font-semibold text-center text-savant-accent mb-2 tracking-wider">DATA MANAGEMENT</p>
                        <div className="grid grid-cols-3 gap-2">
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
                            <button onClick={handleImportClick} className="w-full text-center bg-savant-deep text-savant-text font-semibold py-2 px-4 rounded-lg hover:bg-savant-light/50 border border-savant-light transition">Import</button>
                            <button onClick={handleExport} className="w-full text-center bg-savant-deep text-savant-text font-semibold py-2 px-4 rounded-lg hover:bg-savant-light/50 border border-savant-light transition">Export</button>
                            <button onClick={handleCleanDuplicates} title="Scan and remove duplicate bets" className="w-full text-center bg-savant-deep text-savant-text font-semibold py-2 px-4 rounded-lg hover:bg-savant-light/50 border border-savant-light transition">Clean</button>
                        </div>
                        <div className="grid grid-cols-1 gap-2 mt-2">
                            <button onClick={handleExportCSV} className="w-full text-center bg-savant-deep text-savant-text font-semibold py-2 px-4 rounded-lg hover:bg-savant-light/50 border border-savant-light transition">Export Bets to CSV</button>
                        </div>
                        <p className="text-xs text-center text-savant-accent mt-2">JSON files contain all bets, analyses, and model weights.</p>
                    </div>
                </div>

                {importData && (
                     <div className="absolute inset-0 bg-savant-deep/90 flex items-center justify-center animate-fade-in-down p-4">
                        <Card className="w-full max-w-sm text-center">
                            <h3 className="font-bold text-lg text-savant-cyan">Confirm Import</h3>
                            <p className="text-sm text-savant-accent mt-2 mb-4">You are about to import {importData.bets.length} bets, {importData.savedAnalyses.length} analysis sessions{importData.modelWeights ? ', and saved model weights' : ''}.</p>
                            <div className="space-y-2">
                                <button onClick={() => handleConfirmImport('merge')} className="w-full bg-savant-cyan text-savant-deep font-bold py-2 px-4 rounded-lg hover:bg-cyan-300">Merge</button>
                                <button onClick={() => handleConfirmImport('overwrite')} className="w-full bg-red-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-600">Overwrite</button>
                                <button onClick={() => setImportData(null)} className="w-full bg-savant-light text-savant-text font-semibold py-2 px-4 rounded-lg hover:bg-savant-accent/50">Cancel</button>
                            </div>
                        </Card>
                    </div>
                )}

            </Card>
             {betToGrade && (
                <ManualGradeModal 
                    isOpen={!!betToGrade}
                    onClose={() => setBetToGrade(null)}
                    onSave={handleSaveManualGrade}
                    bet={betToGrade} 
                />
            )}
            {isManualEntryModalOpen && <ManualBetModal isOpen={isManualEntryModalOpen} onClose={() => setIsManualEntryModalOpen(false)} onAddBet={addBet} />}
            <ConfirmationModal 
                isOpen={confirmationModal.isOpen}
                onClose={() => setConfirmationModal({ isOpen: false, title: '', message: '' })}
                title={confirmationModal.title}
                message={confirmationModal.message}
                onConfirm={confirmationModal.onConfirm}
            />
        </>
    );
};

const StatCard: React.FC<{ label: string, value: string | number, color?: string }> = ({ label, value, color = 'text-savant-text' }) => (
    <div className="flex flex-col p-2 rounded-md bg-savant-deep/50">
        <span className="text-xs text-savant-accent font-semibold tracking-wider uppercase">{label}</span>
        <span className={`text-xl font-mono font-bold ${color}`}>{value}</span>
    </div>
);

const RecordBreakdown: React.FC<{ 
    breakdown: { 
        spreads: { record: string, winPct: string, units: number }, 
        overs: { record: string, winPct: string, units: number }, 
        unders: { record: string, winPct: string, units: number } 
    } 
}> = ({ breakdown }) => (
    <div className="mb-4 bg-savant-deep p-3 rounded-lg">
        <div className="grid grid-cols-4 gap-2 text-center text-xs font-semibold text-savant-accent border-b border-savant-light pb-2 mb-2">
            <span>Bet Type</span>
            <span>Record</span>
            <span>Win %</span>
            <span>Units</span>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center text-sm">
            <BreakdownRow label="Spreads" record={breakdown.spreads.record} winPct={breakdown.spreads.winPct} units={breakdown.spreads.units} />
            <BreakdownRow label="Overs" record={breakdown.overs.record} winPct={breakdown.overs.winPct} units={breakdown.overs.units} />
            <BreakdownRow label="Unders" record={breakdown.unders.record} winPct={breakdown.unders.winPct} units={breakdown.unders.units} />
        </div>
    </div>
);

const BreakdownRow: React.FC<{ label: string, record: string, winPct: string, units: number }> = ({ label, record, winPct, units }) => {
    const unitsColor = units > 0 ? 'text-green-400' : units < 0 ? 'text-red-400' : 'text-savant-accent';
    const unitsDisplay = `${units > 0 ? '+' : ''}${units.toFixed(2)}u`;
    
    return (
        <>
            <span className="font-semibold text-savant-text text-left">{label}</span>
            <span className="font-mono text-savant-accent">{record}</span>
            <span className="font-mono text-savant-accent">{winPct}</span>
            <span className={`font-mono font-bold ${unitsColor}`}>{unitsDisplay}</span>
        </>
    );
};

const TabButton: React.FC<{ title: string; isActive: boolean; onClick: () => void }> = ({ title, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`flex-1 text-center font-semibold text-sm py-2 transition-colors duration-200 ${
      isActive
        ? 'text-savant-cyan border-b-2 border-savant-cyan'
        : 'text-savant-accent hover:text-savant-text border-b-2 border-transparent'
    }`}
  >
    {title}
  </button>
);

const BetCategory: React.FC<{ title: string; bets: Bet[]; onDelete: (id: string, e: React.MouseEvent) => void; onGrade: (bet: Bet, e: React.MouseEvent) => void; onViewAnalysis: (gameId: string) => void; }> = ({ title, bets, onDelete, onGrade, onViewAnalysis }) => (
    <div>
        <h4 className="text-md font-bold text-savant-gold mb-2">{title}</h4>
        <ul className="space-y-2">
            {bets.map(bet => <BetItem key={bet.id} bet={bet} onDelete={onDelete} onGrade={onGrade} onViewAnalysis={onViewAnalysis} />)}
        </ul>
    </div>
);

const BetItem: React.FC<{ bet: Bet; onDelete: (id: string, e: React.MouseEvent) => void; onGrade: (bet: Bet, e: React.MouseEvent) => void; onViewAnalysis: (gameId: string) => void; }> = ({ bet, onDelete, onGrade, onViewAnalysis }) => {
    const { game, betType, line, teamOrOverUnder, outcome, valueScore, odds, finalScore } = bet;
    const teamAbbrMap = useMemo(() => new Map(TEAMS.map(t => [t.name, t.abbreviation])), []);
    
    const margin = calculateMargin(bet);
    const isBadBeat = outcome === 'Loss' && margin !== null && Math.abs(margin) <= 1.5;
    const units = calculateUnits(bet);

    const outcomeColor = {
        Win: 'border-green-500',
        Loss: 'border-red-500',
        Push: 'border-gray-500',
        Pending: 'border-savant-light'
    };

    let selectionText = '';
    if (betType === 'spread') {
        const teamName = teamOrOverUnder === 'home' ? game.homeTeamName : game.awayTeamName;
        const abbr = teamAbbrMap.get(teamName) || teamName.substring(0,3).toUpperCase();
        selectionText = `${abbr} ${line > 0 ? '+' : ''}${line}`;
    } else if (betType === 'total') {
        selectionText = `${teamOrOverUnder.charAt(0).toUpperCase()} ${line}`;
    } else { // moneyline
        const teamName = teamOrOverUnder === 'home' ? game.homeTeamName : game.awayTeamName;
        const abbr = teamAbbrMap.get(teamName) || teamName.substring(0,3).toUpperCase();
        selectionText = `${abbr} ML`;
    }

    return (
        <li 
            className={`bg-savant-deep p-3 rounded-lg border-l-4 ${outcomeColor[outcome]} flex items-center group transition-all hover:bg-savant-deep/80 cursor-pointer`}
            onClick={() => onViewAnalysis(game.id)}
        >
            <div className="flex-grow pr-2">
                <div className="flex justify-between items-center">
                    <p className="text-xs text-savant-accent truncate pr-2">{game.awayTeamName} @ {game.homeTeamName}</p>
                    <p className="text-xs text-savant-accent font-mono flex-shrink-0">{new Date(game.date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })}</p>
                </div>
                <div className="flex items-baseline space-x-3">
                    <p className="font-bold text-savant-text">{selectionText}</p>
                    <p className="text-sm text-savant-accent">{odds > 0 ? `+${odds}` : odds}</p>
                    {betType !== 'moneyline' && <p className="text-xs text-savant-gold">Score: {valueScore.toFixed(1)}</p>}
                    {betType === 'moneyline' && <p className="text-xs text-savant-gold">EV Score: {valueScore.toFixed(1)}</p>}
                     {outcome !== 'Pending' && (
                        <p className={`text-xs font-mono font-bold ${units > 0 ? 'text-green-400' : units < 0 ? 'text-red-400' : 'text-savant-accent'}`}>
                            {units >= 0 ? '+' : ''}{units.toFixed(2)}u
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                     {outcome !== 'Pending' && finalScore && (
                        <p className="text-xs text-savant-accent font-mono">
                            Final: {finalScore.away} - {finalScore.home}
                        </p>
                    )}
                    {finalScore?.wentToOT && (
                        <span className="text-[10px] font-bold bg-savant-light text-savant-accent px-1.5 py-0.5 rounded-full">OT</span>
                    )}
                     {isBadBeat && (
                        <span 
                            className="text-[10px] font-bold bg-orange-800/80 text-orange-300 px-1.5 py-0.5 rounded-full cursor-help"
                            title="Bad Beat: Lost by 1.5 points or less."
                        >
                            BAD BEAT
                        </span>
                    )}
                </div>
            </div>
             <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {outcome === 'Pending' && (
                    <button onClick={(e) => onGrade(bet, e)} className="p-1.5 bg-savant-light rounded-md hover:bg-savant-accent" aria-label="Manually grade bet">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-savant-text" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                    </button>
                )}
                <button onClick={(e) => onDelete(bet.id, e)} className="p-1.5 bg-savant-light rounded-md hover:bg-red-500/50" aria-label="Delete bet">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>
        </li>
    );
};

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
    <div className="text-center py-8">
        <p className="text-savant-accent">{message}</p>
    </div>
);

export default ResultsPanel;
