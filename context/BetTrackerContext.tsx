import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Bet } from '../types';

interface BetTrackerContextType {
    bets: Bet[];
    addBet: (bet: Bet) => void;
    deleteBet: (betId: string) => void;
    updateBet: (updatedBet: Bet) => void;
    setBets: (bets: Bet[]) => void;
    clearBets: () => void;
    cleanDuplicateBets: () => { duplicatesRemoved: number };
}

const BetTrackerContext = createContext<BetTrackerContextType | undefined>(undefined);

const usePersistentState = <T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
    const [state, setState] = useState<T>(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            console.error(`Error reading from localStorage: ${errorMessage}`);
            return initialValue;
        }
    });

    useEffect(() => {
        try {
            window.localStorage.setItem(key, JSON.stringify(state));
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            console.error(`Error writing to localStorage: ${errorMessage}`);
        }
    }, [key, state]);

    return [state, setState];
};

export const BetTrackerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [bets, setBetsState] = usePersistentState<Bet[]>('savant-tracked-bets', []);

    const addBet = useCallback((bet: Bet) => {
        setBetsState(prevBets => {
            // Check if a pending bet for the same game and type already exists
            const existingBetIndex = prevBets.findIndex(b =>
                b.outcome === 'Pending' &&
                b.game.id === bet.game.id &&
                b.betType === bet.betType
            );

            if (existingBetIndex !== -1) {
                // If it exists and is pending, replace it with the new one
                const newBets = [...prevBets];
                newBets[existingBetIndex] = bet;
                return newBets;
            } 
            
            // Prevent adding a bet if it's already graded or a different pending bet for the same game exists
             const alreadyExists = prevBets.some(b => b.id === bet.id);
             if(alreadyExists) return prevBets;

            // Otherwise, just add the new bet
            return [...prevBets, bet];
        });
    }, [setBetsState]);

    const deleteBet = useCallback((betId: string) => {
        setBetsState(prevBets => prevBets.filter(b => b.id !== betId));
    }, [setBetsState]);

    const updateBet = useCallback((updatedBet: Bet) => {
        setBetsState(prevBets => prevBets.map(b => b.id === updatedBet.id ? updatedBet : b));
    }, [setBetsState]);
    
    const setBets = useCallback((newBets: Bet[]) => {
        setBetsState(newBets);
    }, [setBetsState]);

    const clearBets = useCallback(() => {
        if (window.confirm("Are you sure you want to clear all tracked bets? This action cannot be undone.")) {
            setBetsState([]);
        }
    }, [setBetsState]);

    const cleanDuplicateBets = useCallback((): { duplicatesRemoved: number } => {
        const uniqueBetGroups = new Map<string, Bet[]>();
    
        // 1. Group bets by a composite key that IGNORES the date, as dates can be erroneous.
        // A unique bet is defined by the matchup, type, line, and side (team or over/under).
        bets.forEach(bet => {
            const key = `${bet.game.awayTeamName}|${bet.game.homeTeamName}|${bet.betType}|${bet.line}|${bet.teamOrOverUnder}`;
            
            if (!uniqueBetGroups.has(key)) {
                uniqueBetGroups.set(key, []);
            }
            uniqueBetGroups.get(key)!.push(bet);
        });
    
        const cleanedBets: Bet[] = [];
        let removedCount = 0;
    
        // 2. For each group, select the best one to keep
        uniqueBetGroups.forEach(group => {
            if (group.length <= 1) {
                if (group.length === 1) cleanedBets.push(group[0]);
                return;
            }
            
            // Priority: Graded > Pending. Then, newest date placed.
            group.sort((a, b) => {
                if (a.outcome !== 'Pending' && b.outcome === 'Pending') return -1;
                if (a.outcome === 'Pending' && b.outcome !== 'Pending') return 1;
                return new Date(b.datePlaced).getTime() - new Date(a.datePlaced).getTime();
            });
    
            // Keep the first one after sorting
            cleanedBets.push(group[0]);
            removedCount += group.length - 1;
        });
        
        // 3. If duplicates were found, update the state
        if (removedCount > 0) {
            setBetsState(cleanedBets.sort((a, b) => new Date(b.datePlaced).getTime() - new Date(a.datePlaced).getTime()));
        }
    
        // 4. Return the calculated count
        return { duplicatesRemoved: removedCount };
    }, [bets, setBetsState]);

    const value = useMemo(() => ({ bets, addBet, deleteBet, updateBet, setBets, clearBets, cleanDuplicateBets }), [bets, addBet, deleteBet, updateBet, setBets, clearBets, cleanDuplicateBets]);

    return (
        <BetTrackerContext.Provider value={value}>
            {children}
        </BetTrackerContext.Provider>
    );
};

export const useBetTracker = () => {
    const context = useContext(BetTrackerContext);
    if (context === undefined) {
        throw new Error('useBetTracker must be used within a BetTrackerProvider');
    }
    return context;
};