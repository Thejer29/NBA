import React, { useState, useMemo, useEffect } from 'react';
import { Bet } from '../../types';
import { determineOutcome } from '../../utils';

interface ManualGradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (finalScore: { home: number; away: number; wentToOT: boolean }) => void;
    bet: Bet;
}

const ManualGradeModal: React.FC<ManualGradeModalProps> = ({ isOpen, onClose, onSave, bet }) => {
    const [homeScore, setHomeScore] = useState('');
    const [awayScore, setAwayScore] = useState('');
    const [wentToOT, setWentToOT] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        // Reset state when modal opens for a new bet
        if (isOpen) {
            setHomeScore('');
            setAwayScore('');
            setWentToOT(false);
            setError('');
        }
    }, [isOpen, bet]);

    if (!isOpen) return null;

    const calculatedOutcome = useMemo(() => {
        const home = parseInt(homeScore, 10);
        const away = parseInt(awayScore, 10);
        if (!isNaN(home) && home >= 0 && !isNaN(away) && away >= 0) {
            return determineOutcome(bet, home, away);
        }
        return null;
    }, [homeScore, awayScore, bet]);
    
    const outcomeDisplay = {
        Win: { text: 'WIN', color: 'text-green-400' },
        Loss: { text: 'LOSS', color: 'text-red-400' },
        Push: { text: 'PUSH', color: 'text-gray-400' },
    };

    const handleSave = () => {
        setError('');
        const home = parseInt(homeScore, 10);
        const away = parseInt(awayScore, 10);
        if (isNaN(home) || isNaN(away) || home < 0 || away < 0) {
            setError('Please enter valid, non-negative scores for both teams.');
            return;
        }
        onSave({ home, away, wentToOT });
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in-down" onClick={onClose}>
            <div className="bg-savant-main rounded-lg shadow-2xl w-full max-w-md border border-savant-light flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-6 flex-shrink-0 border-b border-savant-light">
                    <h2 className="text-2xl font-bold text-savant-cyan">Manually Grade Bet</h2>
                    <p className="text-sm text-savant-accent mt-1 truncate">{bet.game.awayTeamName} @ {bet.game.homeTeamName}</p>
                </div>
                
                <div className="px-6 py-4 space-y-4 flex-grow">
                    <div className="grid grid-cols-2 gap-4 items-end">
                        <div>
                            <label htmlFor="away-score" className="block text-sm font-medium text-savant-accent mb-1">{bet.game.awayTeamName} (Away)</label>
                            <input
                                id="away-score"
                                type="number"
                                value={awayScore}
                                onChange={(e) => setAwayScore(e.target.value)}
                                className="w-full bg-savant-light text-savant-text p-2 rounded-md border border-savant-accent focus:ring-2 focus:ring-savant-gold focus:outline-none text-center text-lg"
                                placeholder="0"
                                min="0"
                            />
                        </div>
                        <div>
                            <label htmlFor="home-score" className="block text-sm font-medium text-savant-accent mb-1">{bet.game.homeTeamName} (Home)</label>
                             <input
                                id="home-score"
                                type="number"
                                value={homeScore}
                                onChange={(e) => setHomeScore(e.target.value)}
                                className="w-full bg-savant-light text-savant-text p-2 rounded-md border border-savant-accent focus:ring-2 focus:ring-savant-gold focus:outline-none text-center text-lg"
                                placeholder="0"
                                min="0"
                            />
                        </div>
                    </div>
                    <div className="flex items-center justify-center">
                        <input
                            id="ot-checkbox"
                            type="checkbox"
                            checked={wentToOT}
                            onChange={(e) => setWentToOT(e.target.checked)}
                            className="h-4 w-4 rounded bg-savant-light border-savant-accent text-savant-cyan focus:ring-savant-cyan"
                        />
                        <label htmlFor="ot-checkbox" className="ml-2 text-sm text-savant-accent">Game went to Overtime</label>
                    </div>

                    {calculatedOutcome && (
                        <div className="text-center p-3 rounded-lg bg-savant-deep animate-fade-in-down">
                            <p className="text-sm font-semibold text-savant-accent">Calculated Outcome</p>
                            <p className={`text-2xl font-bold ${outcomeDisplay[calculatedOutcome].color}`}>
                                {outcomeDisplay[calculatedOutcome].text}
                            </p>
                        </div>
                    )}

                    {error && <p className="text-sm text-red-400 text-center">{error}</p>}
                </div>
                
                <div className="p-6 flex-shrink-0 border-t border-savant-light">
                    <div className="grid grid-cols-2 gap-4">
                         <button type="button" onClick={onClose} className="bg-savant-light text-savant-text font-semibold py-2 px-4 rounded-lg hover:bg-savant-accent/50 transition">Cancel</button>
                        <button 
                            type="button" 
                            onClick={handleSave}
                            disabled={!calculatedOutcome}
                            className="bg-savant-cyan text-savant-deep font-bold py-2 px-4 rounded-lg hover:bg-cyan-300 transition disabled:opacity-50"
                        >
                            Save Grade
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManualGradeModal;