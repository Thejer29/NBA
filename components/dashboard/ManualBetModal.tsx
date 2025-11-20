import React, { useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Bet, GameForAnalysis } from '../../types';
import { TEAMS } from '../../constants';
import { getToday } from '../../utils';

interface ManualBetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddBet: (bet: Bet) => void;
}

const teamList = TEAMS.map(t => ({ name: t.name, abbreviation: t.abbreviation })).sort((a, b) => a.name.localeCompare(b.name));

const ManualBetModal: React.FC<ManualBetModalProps> = ({ isOpen, onClose, onAddBet }) => {
    const [gameDate, setGameDate] = useState(getToday());
    const [awayTeamName, setAwayTeamName] = useState('');
    const [homeTeamName, setHomeTeamName] = useState('');
    const [betType, setBetType] = useState<'spread' | 'total' | 'moneyline'>('spread');
    const [teamOrOverUnder, setTeamOrOverUnder] = useState<'home' | 'away' | 'over' | 'under'>('away');
    const [line, setLine] = useState('');
    const [odds, setOdds] = useState('-110');
    const [outcome, setOutcome] = useState<'Pending' | 'Win' | 'Loss' | 'Push'>('Pending');
    const [error, setError] = useState('');

    const homeTeamOptions = useMemo(() => teamList.filter(t => t.name !== awayTeamName), [awayTeamName]);
    const awayTeamOptions = useMemo(() => teamList.filter(t => t.name !== homeTeamName), [homeTeamName]);
    
    if (!isOpen) return null;

    const resetForm = () => {
        setGameDate(getToday());
        setAwayTeamName('');
        setHomeTeamName('');
        setBetType('spread');
        setTeamOrOverUnder('away');
        setLine('');
        setOdds('-110');
        setOutcome('Pending');
        setError('');
    };
    
    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!awayTeamName || !homeTeamName || !line || !odds) {
            setError('Please fill out all required fields.');
            return;
        }

        const lineNum = parseFloat(line);
        const oddsNum = parseInt(odds, 10);
        if (isNaN(lineNum) || isNaN(oddsNum)) {
            setError('Line and Odds must be valid numbers.');
            return;
        }

        const gameId = `${awayTeamName}-${homeTeamName}-${gameDate}`.replace(/\s+/g, '-');

        const game: GameForAnalysis = {
            id: gameId,
            date: new Date(`${gameDate}T12:00:00Z`).toISOString(),
            awayTeamName,
            homeTeamName,
        };

        const newBet: Bet = {
            id: uuidv4(),
            game,
            betType,
            line: betType === 'moneyline' ? oddsNum : lineNum, // For ML, line is the odds
            teamOrOverUnder,
            outcome,
            datePlaced: new Date().toISOString(),
            valueScore: 0, // Manual bets have no model value score
            odds: oddsNum,
            finalScore: undefined,
        };
        
        onAddBet(newBet);
        handleClose();
    };

    const renderBetSelection = () => {
        if (betType === 'spread' || betType === 'moneyline') {
            return (
                <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setTeamOrOverUnder('away')} className={`p-2 rounded-md text-sm font-semibold ${teamOrOverUnder === 'away' ? 'bg-savant-cyan text-savant-deep' : 'bg-savant-light text-savant-text'}`} disabled={!awayTeamName}>{awayTeamName || 'Away'}</button>
                    <button type="button" onClick={() => setTeamOrOverUnder('home')} className={`p-2 rounded-md text-sm font-semibold ${teamOrOverUnder === 'home' ? 'bg-savant-cyan text-savant-deep' : 'bg-savant-light text-savant-text'}`} disabled={!homeTeamName}>{homeTeamName || 'Home'}</button>
                </div>
            );
        } else { // total
            return (
                <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setTeamOrOverUnder('over')} className={`p-2 rounded-md text-sm font-semibold ${teamOrOverUnder === 'over' ? 'bg-savant-cyan text-savant-deep' : 'bg-savant-light text-savant-text'}`}>Over</button>
                    <button type="button" onClick={() => setTeamOrOverUnder('under')} className={`p-2 rounded-md text-sm font-semibold ${teamOrOverUnder === 'under' ? 'bg-savant-cyan text-savant-deep' : 'bg-savant-light text-savant-text'}`}>Under</button>
                </div>
            );
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in-down" onClick={handleClose}>
            <div className="bg-savant-main rounded-lg shadow-2xl w-full max-w-lg border border-savant-light flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <form onSubmit={handleSubmit}>
                    <div className="p-6 flex-shrink-0 border-b border-savant-light">
                        <h2 className="text-2xl font-bold text-savant-cyan">Add Manual Bet</h2>
                    </div>
                    
                    <div className="overflow-y-auto px-6 py-4 space-y-4 flex-grow">
                        <div>
                            <label className="block text-sm font-medium text-savant-accent mb-1">Game Date</label>
                            <input type="date" value={gameDate} onChange={e => setGameDate(e.target.value)} className="w-full bg-savant-light text-savant-text p-2 rounded-md border border-savant-accent focus:ring-2 focus:ring-savant-gold focus:outline-none" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-savant-accent mb-1">Away Team</label>
                                <select value={awayTeamName} onChange={e => setAwayTeamName(e.target.value)} className="w-full bg-savant-light text-savant-text p-2 rounded-md border border-savant-accent focus:ring-2 focus:ring-savant-gold focus:outline-none">
                                    <option value="">Select Team</option>
                                    {awayTeamOptions.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-savant-accent mb-1">Home Team</label>
                                <select value={homeTeamName} onChange={e => setHomeTeamName(e.target.value)} className="w-full bg-savant-light text-savant-text p-2 rounded-md border border-savant-accent focus:ring-2 focus:ring-savant-gold focus:outline-none">
                                    <option value="">Select Team</option>
                                    {homeTeamOptions.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-savant-accent mb-1">Bet Type</label>
                            <div className="grid grid-cols-3 gap-2">
                                <button type="button" onClick={() => { setBetType('spread'); setTeamOrOverUnder('away'); }} className={`p-2 rounded-md text-sm font-semibold ${betType === 'spread' ? 'bg-savant-cyan text-savant-deep' : 'bg-savant-light text-savant-text'}`}>Spread</button>
                                <button type="button" onClick={() => { setBetType('total'); setTeamOrOverUnder('over'); }} className={`p-2 rounded-md text-sm font-semibold ${betType === 'total' ? 'bg-savant-cyan text-savant-deep' : 'bg-savant-light text-savant-text'}`}>Total</button>
                                <button type="button" onClick={() => { setBetType('moneyline'); setTeamOrOverUnder('away'); }} className={`p-2 rounded-md text-sm font-semibold ${betType === 'moneyline' ? 'bg-savant-cyan text-savant-deep' : 'bg-savant-light text-savant-text'}`}>Moneyline</button>
                            </div>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-savant-accent mb-1">Selection</label>
                            {renderBetSelection()}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-savant-accent mb-1">{betType === 'moneyline' ? 'Odds' : 'Line'}</label>
                                <input 
                                    type="number" 
                                    step={betType === 'total' ? "0.5" : "1"} 
                                    value={line} 
                                    onChange={e => setLine(e.target.value)} 
                                    placeholder={betType === 'spread' ? '-7.5' : betType === 'total' ? '221.5' : '+150'}
                                    className="w-full bg-savant-light text-savant-text p-2 rounded-md border border-savant-accent focus:ring-2 focus:ring-savant-gold focus:outline-none" 
                                />
                            </div>
                             <div style={{ visibility: betType === 'moneyline' ? 'hidden' : 'visible' }}>
                                <label className="block text-sm font-medium text-savant-accent mb-1">Odds</label>
                                <input type="number" step="1" value={odds} onChange={e => setOdds(e.target.value)} placeholder="-110" className="w-full bg-savant-light text-savant-text p-2 rounded-md border border-savant-accent focus:ring-2 focus:ring-savant-gold focus:outline-none" />
                            </div>
                        </div>
                        
                         <div>
                            <label className="block text-sm font-medium text-savant-accent mb-1">Outcome</label>
                            <select value={outcome} onChange={e => setOutcome(e.target.value as any)} className="w-full bg-savant-light text-savant-text p-2 rounded-md border border-savant-accent focus:ring-2 focus:ring-savant-gold focus:outline-none">
                                <option value="Pending">Pending</option>
                                <option value="Win">Win</option>
                                <option value="Loss">Loss</option>
                                {betType !== 'moneyline' && <option value="Push">Push</option>}
                            </select>
                        </div>
                        
                        {error && <p className="text-sm text-red-400 text-center">{error}</p>}

                    </div>
                    
                    <div className="p-6 flex-shrink-0 border-t border-savant-light">
                        <div className="grid grid-cols-2 gap-4">
                            <button type="button" onClick={handleClose} className="bg-savant-light text-savant-text font-semibold py-2 px-4 rounded-lg hover:bg-savant-accent/50 transition">Cancel</button>
                            <button type="submit" className="bg-savant-gold text-savant-deep font-bold py-2 px-4 rounded-lg hover:bg-yellow-300 transition">Save Bet</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ManualBetModal;