


import React from 'react';
import { SimulationResult } from '../../types';

interface MonteCarloDetailsProps {
    simulationResult: SimulationResult;
    homeTeamAbbr: string;
    awayTeamAbbr: string;
}

const MonteCarloDetails: React.FC<MonteCarloDetailsProps> = ({ simulationResult, homeTeamAbbr, awayTeamAbbr }) => {
    const { winProbability, coverProbability, outcomes } = simulationResult;

    const spreadOutcomesData = outcomes?.spread;

    if (!spreadOutcomesData || spreadOutcomesData.length === 0) {
        return (
            <div>
                <h3 className="text-lg font-semibold text-savant-gold mb-3">Monte Carlo Simulation (10,000 Games)</h3>
                <div className="bg-savant-deep p-4 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center mb-4">
                        <div>
                            <p className="text-xs text-savant-accent font-semibold tracking-wider">{homeTeamAbbr} WIN PROB.</p>
                            <p className="text-2xl font-mono text-savant-cyan">{(winProbability.home * 100).toFixed(1)}%</p>
                        </div>
                        <div>
                            <p className="text-xs text-savant-accent font-semibold tracking-wider">{awayTeamAbbr} WIN PROB.</p>
                            <p className="text-2xl font-mono text-savant-text">{(winProbability.away * 100).toFixed(1)}%</p>
                        </div>
                        <div>
                            <p className="text-xs text-savant-accent font-semibold tracking-wider">{homeTeamAbbr} COVER PROB.</p>
                            <p className="text-2xl font-mono text-savant-cyan">{(coverProbability.home * 100).toFixed(1)}%</p>
                        </div>
                    </div>
                    <div className="mt-6 text-center text-savant-accent">
                        No outcome distribution data available for visualization.
                    </div>
                </div>
            </div>
        );
    }

    const maxCount = Math.max(...spreadOutcomesData.map(o => o.count), 0);
    const medianSpread = Number(simulationResult.medianSpread);

    const spreadMap = new Map(spreadOutcomesData.map(o => [o.value, o.count]));
    const minSpread = Math.min(...spreadOutcomesData.map(o => o.value));
    const maxSpread = Math.max(...spreadOutcomesData.map(o => o.value));

    const spreadRange: number[] = [];
    if (isFinite(minSpread) && isFinite(maxSpread)) {
        for (let i = minSpread; i <= maxSpread; i++) {
            spreadRange.push(i);
        }
    }
    
    // Position of the median line. (value - min) / (max - min)
    const spreadWidth = maxSpread - minSpread;
    const medianPositionPercent = spreadWidth > 0 ? ((medianSpread - minSpread) / spreadWidth) * 100 : 50;


    return (
        <div>
            <h3 className="text-lg font-semibold text-savant-gold mb-3">Monte Carlo Simulation (10,000 Games)</h3>
            <div className="bg-savant-deep p-4 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center mb-4">
                    <div>
                        <p className="text-xs text-savant-accent font-semibold tracking-wider">{homeTeamAbbr} WIN PROB.</p>
                        <p className="text-2xl font-mono text-savant-cyan">{(winProbability.home * 100).toFixed(1)}%</p>
                    </div>
                    <div>
                        <p className="text-xs text-savant-accent font-semibold tracking-wider">{awayTeamAbbr} WIN PROB.</p>
                        <p className="text-2xl font-mono text-savant-text">{(winProbability.away * 100).toFixed(1)}%</p>
                    </div>
                    <div>
                        <p className="text-xs text-savant-accent font-semibold tracking-wider">{homeTeamAbbr} COVER PROB.</p>
                        <p className="text-2xl font-mono text-savant-cyan">{(coverProbability.home * 100).toFixed(1)}%</p>
                    </div>
                </div>

                <div className="mt-6">
                    <p className="text-center text-sm font-semibold text-savant-accent mb-2">Spread Outcome Distribution</p>
                    <div className="relative h-40 w-full bg-savant-main/50 rounded-lg p-2 flex items-end justify-start gap-[1px]">
                        {spreadRange.map((value: number) => {
                            const count = Number(spreadMap.get(value) || 0);
                            const isMedian = value === Math.round(medianSpread);
                            return (
                                <div key={value} className="flex-1 flex flex-col items-center justify-end group" style={{ minWidth: '3px' }}>
                                    <div className="relative w-full" style={{ height: `${(count / maxCount) * 100}%` }}>
                                        <div className={`w-full h-full rounded-t-sm transition-colors ${isMedian ? 'bg-savant-gold' : count > 0 ? 'bg-savant-cyan group-hover:bg-cyan-300' : 'bg-transparent'}`}></div>
                                        {count > 0 && (
                                            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 w-max p-1 px-2 text-xs bg-savant-deep text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                                {homeTeamAbbr} {value > 0 ? '+' : ''}{value} ({((count / 10000) * 100).toFixed(1)}%)
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                         {/* Median Line */}
                        <div 
                            className="absolute top-0 bottom-0 border-l-2 border-dashed border-savant-gold/80 pointer-events-none"
                            style={{ left: `${medianPositionPercent}%` }}
                        >
                           <div className="absolute top-0 -translate-y-full -translate-x-1/2 bg-savant-gold/80 text-savant-deep text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                               Median: {medianSpread > 0 ? '+' : ''}{medianSpread.toFixed(1)}
                           </div>
                        </div>
                    </div>
                     <div className="text-xs text-center text-savant-accent mt-2">
                        Each bar represents the frequency of a final score margin from the 10,000 simulated games.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MonteCarloDetails;