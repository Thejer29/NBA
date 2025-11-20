
import React from 'react';
import { GameForAnalysis } from '../../types';
import Card from '../ui/Card';
import Skeleton from '../ui/Skeleton';
import { TEAMS } from '../../constants';

interface GameSelectorProps {
    gameSlate: GameForAnalysis[];
    isLoading: boolean;
    loadingStates: { [key: string]: boolean | string };
    onRunAnalysis: (gameIds: string[]) => void;
    selectedGameIds: Set<string>;
    onSelectionChange: React.Dispatch<React.SetStateAction<Set<string>>>;
    analysisProgress: { current: number; total: number } | null;
    analysisStatusMessage: string;
}

const teamMap = new Map(TEAMS.map(team => [team.name, team]));

const GameSelector: React.FC<GameSelectorProps> = ({ 
    gameSlate, 
    isLoading, 
    loadingStates, 
    onRunAnalysis,
    selectedGameIds,
    onSelectionChange,
    analysisProgress,
    analysisStatusMessage,
}) => {
    
    const handleSelectGame = (gameId: string) => {
        onSelectionChange(prev => {
            const newSet = new Set(prev);
            if (newSet.has(gameId)) {
                newSet.delete(gameId);
            } else {
                newSet.add(gameId);
            }
            return newSet;
        });
    };

    const handleSelectAll = () => {
        if (selectedGameIds.size === gameSlate.length) {
            onSelectionChange(new Set());
        } else {
            onSelectionChange(new Set(gameSlate.map(g => g.id)));
        }
    };

    const handleAnalyze = () => {
        if (selectedGameIds.size > 0) {
            onRunAnalysis(Array.from(selectedGameIds));
        } else {
            const allGameIds = gameSlate.map(g => g.id);
            onSelectionChange(new Set(allGameIds));
            onRunAnalysis(allGameIds);
        }
    };

    const isAnalyzing = !!loadingStates['analysis'];
    const hasSelection = selectedGameIds.size > 0;
    const buttonText = isAnalyzing 
        ? 'Analyzing...' 
        : hasSelection 
        ? `Analyze Selected (${selectedGameIds.size})` 
        : `Analyze Full Slate (${gameSlate.length})`;

    return (
        <Card>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-savant-cyan">Select Games to Analyze</h2>
                <button 
                    onClick={handleSelectAll}
                    disabled={gameSlate.length === 0 || isAnalyzing}
                    className="text-sm font-semibold text-savant-cyan hover:underline disabled:opacity-50 disabled:no-underline"
                >
                    {selectedGameIds.size === gameSlate.length ? 'Deselect All' : 'Select All'}
                </button>
            </div>
            
            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2">
                {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => <GameItemSkeleton key={i} />)
                ) : gameSlate.length > 0 ? (
                    gameSlate.map(game => (
                        <GameItem 
                            key={game.id} 
                            game={game}
                            isSelected={selectedGameIds.has(game.id)}
                            onSelect={handleSelectGame}
                            loadingState={loadingStates[game.id] || false}
                        />
                    ))
                ) : (
                    <p className="text-center text-savant-accent py-8">No games scheduled for this date.</p>
                )}
            </div>

            <div className="pt-4 mt-4 border-t border-savant-light">
                 {isAnalyzing && (
                     <div className="mb-4 animate-fade-in-down">
                        <div className="flex justify-between text-sm font-medium text-savant-accent mb-1">
                            <span>{analysisStatusMessage || 'Preparing analysis...'}</span>
                            {analysisProgress && <span>{analysisProgress.current} / {analysisProgress.total}</span>}
                        </div>
                        {analysisProgress && (
                            <div className="w-full bg-savant-light rounded-full h-2">
                                <div 
                                    className="bg-savant-cyan h-2 rounded-full transition-all duration-300 ease-in-out" 
                                    style={{ width: `${(analysisProgress.current / analysisProgress.total) * 100}%` }}
                                ></div>
                            </div>
                        )}
                    </div>
                )}
                <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || gameSlate.length === 0}
                    className="w-full bg-savant-cyan text-savant-deep font-bold py-3 px-4 rounded-lg hover:bg-cyan-300 transition disabled:opacity-50 flex items-center justify-center"
                >
                    {isAnalyzing && !analysisProgress && <div className="w-5 h-5 border-2 border-savant-deep border-t-transparent rounded-full animate-spin mr-2"></div>}
                    {buttonText}
                </button>
            </div>
        </Card>
    );
};

const GameItem: React.FC<{
    game: GameForAnalysis, 
    isSelected: boolean, 
    onSelect: (id: string) => void, 
    loadingState: boolean | string
}> = ({ game, isSelected, onSelect, loadingState }) => {
    const homeTeam = teamMap.get(game.homeTeamName);
    const awayTeam = teamMap.get(game.awayTeamName);
    
    const selectedClasses = isSelected ? 'bg-savant-light border-savant-cyan' : 'bg-savant-deep border-transparent hover:border-savant-light';
    
    // Prefer explicit text string if available (avoids timezone confusion), else fallback to calculated local time
    const displayTime = game.time ? game.time : new Date(game.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    return (
        <div 
            onClick={() => onSelect(game.id)}
            className={`flex items-center p-3 rounded-lg border-2 transition-all cursor-pointer ${selectedClasses}`}
            role="option"
            aria-selected={isSelected}
            tabIndex={0}
        >
             <div className="flex items-center flex-grow">
                 <div className={`w-6 h-6 rounded-md flex items-center justify-center mr-4 border-2 transition-all ${isSelected ? 'bg-savant-cyan border-savant-cyan' : 'border-savant-accent'}`}>
                    {isSelected && (
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-savant-deep" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    )}
                </div>
                <img src={awayTeam?.logo} alt={awayTeam?.name} className="w-6 h-6" />
                <span className="text-savant-text font-medium ml-2 w-28 truncate text-right">{awayTeam?.name}</span>
                <span className="mx-2 text-savant-accent">@</span>
                <span className="text-savant-text font-medium mr-2 w-28 truncate">{homeTeam?.name}</span>
                <img src={homeTeam?.logo} alt={homeTeam?.name} className="w-6 h-6" />
            </div>
            <div className="flex flex-col items-end w-32 text-right ml-auto pl-2">
                {typeof loadingState === 'string' ? (
                    <span className="text-xs text-savant-accent italic">{loadingState}</span>
                ) : loadingState ? (
                    <div className="w-4 h-4 border-2 border-savant-light border-t-savant-gold rounded-full animate-spin"></div>
                ) : (
                    <span className="text-sm font-mono text-savant-accent">{displayTime}</span>
                )}
            </div>
        </div>
    );
};

const GameItemSkeleton: React.FC = () => (
    <div className="flex items-center p-3 bg-savant-deep rounded-lg">
        <Skeleton className="w-6 h-6 rounded-md" />
        <Skeleton className="w-6 h-6 rounded-full ml-4" />
        <Skeleton className="h-5 w-24 ml-2" />
        <span className="mx-2 text-savant-accent">@</span>
        <Skeleton className="h-5 w-24 mr-2" />
        <Skeleton className="w-6 h-6 rounded-full" />
        <Skeleton className="h-4 w-16 ml-auto" />
    </div>
);

export default GameSelector;
