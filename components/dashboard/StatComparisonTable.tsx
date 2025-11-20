

import React from 'react';
import { Team, TeamStats } from '../../types';
import { LEAGUE_AVG_VOLATILITY } from '../../constants';

interface StatComparisonTableProps {
    title: string;
    homeTeam: Team;
    awayTeam: Team;
    statType: 'season' | 'recent';
}

type StatDefinition = {
    label: string;
    key: keyof TeamStats | keyof NonNullable<TeamStats['recentStats']>;
    higherIsBetter: boolean;
    isPct?: boolean;
    decimals?: number;
};

const STAT_DEFINITIONS: StatDefinition[] = [
    { label: 'Offensive Rating', key: 'offensiveRating', higherIsBetter: true, decimals: 1 },
    { label: 'Defensive Rating', key: 'defensiveRating', higherIsBetter: false, decimals: 1 },
    { label: 'Net Rating', key: 'netRating', higherIsBetter: true, decimals: 1 },
    { label: 'Pace', key: 'pace', higherIsBetter: true, decimals: 1 },
    { label: 'Effective FG%', key: 'effectiveFgPct', higherIsBetter: true, isPct: true, decimals: 1 },
    { label: 'Turnover %', key: 'turnoverPct', higherIsBetter: false, isPct: true, decimals: 1 },
];

const getConsistencyGrade = (volatility: number) => {
    if (volatility < 10.5) return { label: 'Stable', color: 'text-green-400' };
    if (volatility < 14.0) return { label: 'Average', color: 'text-savant-text' };
    if (volatility < 17.5) return { label: 'Volatile', color: 'text-yellow-400' };
    return { label: 'Chaotic', color: 'text-red-400' };
};

const StatComparisonTable: React.FC<StatComparisonTableProps> = ({ title, homeTeam, awayTeam, statType }) => {

    const homeStats = statType === 'season' ? homeTeam.stats : homeTeam.stats.recentStats;
    const awayStats = statType === 'season' ? awayTeam.stats : awayTeam.stats.recentStats;

    if (!homeStats || !awayStats) {
        return (
            <div className="bg-savant-deep p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-savant-gold mb-3">{title}</h3>
                <p className="text-savant-accent text-center py-4">Recent stats data not available for one or both teams.</p>
            </div>
        );
    }

    const renderRow = (def: StatDefinition) => {
        const homeValue = homeStats[def.key as keyof typeof homeStats] as number | undefined;
        const awayValue = awayStats[def.key as keyof typeof awayStats] as number | undefined;

        const formatValue = (val: number | undefined) => {
            if (val === undefined || val === null) return 'N/A';
            const multiplier = def.isPct ? 100 : 1;
            return (val * multiplier).toFixed(def.decimals ?? 0) + (def.isPct ? '%' : '');
        };
        
        let homeClasses = 'text-savant-text';
        let awayClasses = 'text-savant-text';

        if (homeValue !== undefined && awayValue !== undefined) {
             if ( (def.higherIsBetter && homeValue > awayValue) || (!def.higherIsBetter && homeValue < awayValue) ) {
                homeClasses = 'text-green-400 font-bold';
                awayClasses = 'text-savant-accent';
            } else if ( (def.higherIsBetter && awayValue > homeValue) || (!def.higherIsBetter && awayValue < homeValue) ) {
                awayClasses = 'text-green-400 font-bold';
                homeClasses = 'text-savant-accent';
            }
        }

        return (
            <tr key={def.key} className="border-b border-savant-light/50">
                <td className="py-2 pr-2 text-sm text-savant-accent">{def.label}</td>
                <td className={`py-2 px-2 text-center text-sm font-mono ${awayClasses}`}>{formatValue(awayValue)}</td>
                <td className={`py-2 pl-2 text-center text-sm font-mono ${homeClasses}`}>{formatValue(homeValue)}</td>
            </tr>
        )
    }
    
    // Volatility Display & Comparison Logic
    const awayVolatility = awayTeam.stats.netRatingVolatility;
    const homeVolatility = homeTeam.stats.netRatingVolatility;
    
    const awayDisplay = awayVolatility != null ? awayVolatility.toFixed(1) : 'N/A';
    const homeDisplay = homeVolatility != null ? homeVolatility.toFixed(1) : 'N/A';
    
    const awayGrade = awayVolatility != null ? getConsistencyGrade(awayVolatility) : null;
    const homeGrade = homeVolatility != null ? getConsistencyGrade(homeVolatility) : null;


    return (
        <div className="bg-savant-deep p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-savant-gold mb-3">{title}</h3>
            <table className="w-full table-fixed">
                <thead>
                    <tr className="border-b-2 border-savant-light">
                        <th className="w-2/5 text-left text-sm font-semibold text-savant-text pb-2">Metric</th>
                        <th className="w-1/4 text-center text-sm font-semibold text-savant-text pb-2 truncate">{awayTeam.abbreviation}</th>
                        <th className="w-1/4 text-center text-sm font-semibold text-savant-text pb-2 truncate">{homeTeam.abbreviation}</th>
                    </tr>
                </thead>
                <tbody>
                    {STAT_DEFINITIONS.map(def => renderRow(def))}
                     {statType === 'season' && (
                        <>
                            <tr className="border-b border-savant-light/50">
                                <td className="py-2 pr-2 text-sm text-savant-accent">Record</td>
                                <td className="py-2 px-2 text-center text-sm font-mono text-savant-text">{awayTeam.stats.wins}-{awayTeam.stats.losses}</td>
                                <td className="py-2 pl-2 text-center text-sm font-mono text-savant-text">{homeTeam.stats.wins}-{homeTeam.stats.losses}</td>
                            </tr>
                            <tr className="border-b border-savant-light/50">
                                <td className="py-2 pr-2 text-sm text-savant-accent">Volatility</td>
                                <td className="py-2 px-2 text-center">
                                    <div className="flex flex-col items-center">
                                        <span className="text-sm font-mono text-savant-text">{awayDisplay}</span>
                                        {awayGrade && <span className={`text-[10px] font-bold uppercase ${awayGrade.color}`}>{awayGrade.label}</span>}
                                    </div>
                                </td>
                                <td className="py-2 pl-2 text-center">
                                     <div className="flex flex-col items-center">
                                        <span className="text-sm font-mono text-savant-text">{homeDisplay}</span>
                                        {homeGrade && <span className={`text-[10px] font-bold uppercase ${homeGrade.color}`}>{homeGrade.label}</span>}
                                    </div>
                                </td>
                            </tr>
                            <tr className="border-b-0">
                                <td className="py-2 pr-2 text-sm text-savant-accent">Luck Score</td>
                                <td className={`py-2 px-2 text-center text-sm font-mono ${ (awayTeam.stats.luck ?? 0) < (homeTeam.stats.luck ?? 0) ? 'text-green-400 font-bold' : 'text-savant-accent'}`}>{awayTeam.stats.luck?.toFixed(1) ?? 'N/A'}</td>
                                <td className={`py-2 pl-2 text-center text-sm font-mono ${ (homeTeam.stats.luck ?? 0) < (awayTeam.stats.luck ?? 0) ? 'text-green-400 font-bold' : 'text-savant-accent'}`}>{homeTeam.stats.luck?.toFixed(1) ?? 'N/A'}</td>
                            </tr>
                        </>
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default StatComparisonTable;