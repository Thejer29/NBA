
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { GameAnalysis, Injury, ValueScore, Team, MarketOdds, SimulationResult, Bet } from '../../types';
import Card from '../ui/Card';
import { TEAMS } from '../../constants';
import LoadingSpinner from '../LoadingSpinner';
import ActionReport from '../ActionReport';
import { getMarketLine, parseSpreadValue, decode, decodeAudioData } from '../../utils';
import StatComparisonTable from './StatComparisonTable';
import { generateSpokenRecapText, generateAudioRecap } from '../../services/geminiService';
import MonteCarloDetails from './MonteCarloDetails';


interface AnalysisResultCardProps {
    result: GameAnalysis;
    onTrackBet?: (bet: Bet) => void;
}

const teamMap = new Map(TEAMS.map(team => [team.name, team]));

const ConsistencyCheckAlert: React.FC<{ reason: string }> = ({ reason }) => (
    <div className="bg-yellow-900/50 border-2 border-yellow-500 text-yellow-200 p-4 rounded-lg mb-4 text-sm animate-fade-in-down">
        <div className="flex">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.636-1.21 2.242-1.21 2.878 0l5.394 10.273c.636 1.21-.242 2.628-1.439 2.628H4.302c-1.197 0-2.075-1.418-1.439-2.628L8.257 3.099zM9 12a1 1 0 112 0 1 1 0 01-2 0zm1-4a1 1 0 00-1 1v2a1 1 0 102 0V9a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
                <h4 className="font-bold">Line Change Alert</h4>
                <p className="mt-1">{reason}</p>
            </div>
        </div>
    </div>
);


const AnalysisResultCard: React.FC<AnalysisResultCardProps> = ({ result, onTrackBet }) => {
    const { game, homeTeam, awayTeam, analysis } = result;
    const [isExpanded, setIsExpanded] = useState(false);
    const [isDeepDiveLoading, setIsDeepDiveLoading] = useState(false);
    const [deepDiveResult, setDeepDiveResult] = useState<string | null>(null);
    const [deepDiveError, setDeepDiveError] = useState<string | null>(null);

    const [isRecapLoading, setIsRecapLoading] = useState(false);
    const [isRecapPlaying, setIsRecapPlaying] = useState(false);
    const [recapError, setRecapError] = useState<string | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

    const marketLine = useMemo(() => getMarketLine(game), [game]);

    useEffect(() => {
        // Cleanup function to stop audio and close AudioContext when component unmounts
        return () => {
            if (audioSourceNodeRef.current) {
                audioSourceNodeRef.current.stop();
            }
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close();
            }
        };
    }, []);

    const handleSpokenRecap = async () => {
        if (isRecapPlaying && audioSourceNodeRef.current) {
            audioSourceNodeRef.current.stop();
            setIsRecapPlaying(false);
            return;
        }

        setIsRecapLoading(true);
        setRecapError(null);

        try {
            const recapText = await generateSpokenRecapText(result);
            const base64Audio = await generateAudioRecap(recapText);

            if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            }
            const audioContext = audioContextRef.current;
            
            const audioBuffer = await decodeAudioData(
                decode(base64Audio),
                audioContext,
                24000,
                1
            );

            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            source.start();

            setIsRecapPlaying(true);
            audioSourceNodeRef.current = source;

            source.onended = () => {
                setIsRecapPlaying(false);
                audioSourceNodeRef.current = null;
            };

        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : "An unknown error occurred while generating the recap.";
            setRecapError(errorMessage);
            console.error(e);
        } finally {
            setIsRecapLoading(false);
        }
    };


    const handleDeepDive = async () => {
        if (!marketLine) return;
        setIsDeepDiveLoading(true);
        setDeepDiveResult(null);
        setDeepDiveError(null);
        try {
            // This is a placeholder for a deep dive that would require the full game details
            // For now, we'll simulate a deep dive based on existing analysis
            // const res = await getDeepDive(homeTeam, awayTeam, marketLine, details, analysis);
            // setDeepDiveResult(res);
            setDeepDiveResult("# Deep Dive Action Report\n\nThis is a placeholder for a more detailed analysis. The full implementation would involve another complex AI call synthesizing all available data into a final betting recommendation report, similar to the initial analysis but with more depth.");

        } catch (e) {
            setDeepDiveError(e instanceof Error ? e.message : "An unknown deep dive error occurred.");
        } finally {
            setIsDeepDiveLoading(false);
        }
    };
    
    const createBet = (type: 'spread' | 'total', line: number, side: 'home' | 'away' | 'over' | 'under', valueScore: number) => {
        if (!onTrackBet) return;
        
        const bet: Bet = {
            id: uuidv4(),
            game: result.game,
            betType: type,
            line: line,
            teamOrOverUnder: side,
            outcome: 'Pending',
            datePlaced: new Date().toISOString(),
            valueScore: valueScore,
            odds: -110, // Default standard vig, editable later
        };
        onTrackBet(bet);
    }

    const homeInjuries = homeTeam.stats.injuries || [];
    const awayInjuries = awayTeam.stats.injuries || [];
    
    const formatSpread = (spread: number | undefined) => {
        if (spread === undefined) return 'N/A';
        return spread > 0 ? `+${spread.toFixed(1)}` : spread.toFixed(1);
    }
    const marketLineDisplay = marketLine?.spread
        ? `${awayTeam.abbreviation} ${formatSpread(marketLine.spread.away)} / ${homeTeam.abbreviation} ${formatSpread(marketLine.spread.home)}`
        : 'N/A';


    return (
        <Card className="animate-fade-in-down">
            {analysis.consistencyCheck?.isChangeSignificant && (
                <ConsistencyCheckAlert reason={analysis.consistencyCheck.changeReason} />
            )}
            <div className="flex justify-between items-start">
                <div>
                    <div className="flex items-center space-x-2">
                        <img src={awayTeam.logo} alt={awayTeam.name} className="w-6 h-6"/>
                        <h2 className="text-xl font-bold text-savant-text">{awayTeam.name} @ {homeTeam.name}</h2>
                        <img src={homeTeam.logo} alt={homeTeam.name} className="w-6 h-6"/>
                    </div>
                    <p className="text-sm text-savant-accent mt-1">
                        Market ({marketLine?.sourceBook}): <span className="font-mono">{marketLineDisplay}</span>, Total: <span className="font-mono">{marketLine?.total?.toFixed(1) ?? 'N/A'}</span>
                    </p>
                </div>
                <button onClick={() => setIsExpanded(!isExpanded)} className="text-sm text-savant-cyan hover:text-cyan-300 flex-shrink-0 ml-4">
                    {isExpanded ? 'Collapse' : 'Expand Details'}
                </button>
            </div>

            <div className={`mt-4 grid grid-cols-1 md:grid-cols-2 gap-4`}>
                <ValueCard 
                    betType="Spread" 
                    savantLine={analysis.savantLine}
                    marketLine={marketLine}
                    valueScore={analysis.valueScore.spread} 
                    homeTeamAbbr={homeTeam.abbreviation}
                    awayTeamAbbr={awayTeam.abbreviation}
                    simulationResult={analysis.simulationResult}
                    onTrack={(line, side) => createBet('spread', line, side, analysis.valueScore.spread.score)}
                />
                <ValueCard 
                    betType="Total" 
                    savantLine={analysis.savantLine}
                    marketLine={marketLine}
                    valueScore={analysis.valueScore.total} 
                    homeTeamAbbr={homeTeam.abbreviation}
                    awayTeamAbbr={awayTeam.abbreviation}
                    simulationResult={analysis.simulationResult}
                    onTrack={(line, side) => createBet('total', line, side, analysis.valueScore.total.score)}
                />
            </div>
             {recapError && <div className="mt-4 bg-red-800/80 text-white p-3 rounded-lg text-sm text-center animate-fade-in-down"><strong>Recap Error:</strong> {recapError}</div>}


            {isExpanded && (
                <div className="mt-6 space-y-6 border-t border-savant-light pt-6">
                    <div>
                        <h3 className="text-lg font-semibold text-savant-gold mb-3">Key Analysis Points</h3>
                        <div className="bg-savant-deep p-4 rounded-lg space-y-3 text-sm">
                           <AnalysisPoint title="Injury Impact" content={analysis.injuryImpactAnalysis} />
                           <AnalysisPoint title="Matchup Analysis" content={analysis.matchupAnalysis} />
                           <AnalysisPoint title="Synthesis & Recommendation" content={analysis.synthesisNote} />
                        </div>
                    </div>

                    {analysis.simulationResult && (
                        <MonteCarloDetails
                            simulationResult={analysis.simulationResult}
                            homeTeamAbbr={homeTeam.abbreviation}
                            awayTeamAbbr={awayTeam.abbreviation}
                        />
                    )}

                     <div>
                        <h3 className="text-lg font-semibold text-savant-gold mb-3">Statistical Matchup</h3>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            <StatComparisonTable title="Full Season Stats" homeTeam={homeTeam} awayTeam={awayTeam} statType="season" />
                            <StatComparisonTable title="Recent Form (Last 10)" homeTeam={homeTeam} awayTeam={awayTeam} statType="recent" />
                        </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-savant-gold mb-3">Injury Report</h3>
                        {(homeInjuries.length + awayInjuries.length) > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <TeamInjuryReport team={awayTeam} injuries={awayInjuries} />
                                <TeamInjuryReport team={homeTeam} injuries={homeInjuries} />
                            </div>
                        ) : (
                            <p className="text-savant-accent bg-savant-light p-3 rounded-md text-center">No significant injuries reported for this matchup.</p>
                        )}
                    </div>

                     <div className="flex justify-center items-center gap-4 mt-6">
                        <button
                            onClick={handleSpokenRecap}
                            disabled={isRecapLoading}
                            className="bg-savant-cyan text-savant-deep font-bold py-2 px-6 rounded-lg shadow-md hover:bg-cyan-300 transition disabled:opacity-50 flex items-center justify-center"
                        >
                             {isRecapLoading ? (
                                <div className="w-5 h-5 border-2 border-savant-deep border-t-transparent rounded-full animate-spin"></div>
                            ) : isRecapPlaying ? (
                                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1zm4 0a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                                </svg>

                            )}
                            <span className="ml-2">{isRecapLoading ? 'Generating...' : isRecapPlaying ? 'Stop Recap' : 'Spoken Recap'}</span>
                        </button>
                        <button
                            onClick={handleDeepDive}
                            disabled={isDeepDiveLoading}
                            className="bg-savant-gold text-savant-deep font-bold py-2 px-6 rounded-lg shadow-md hover:bg-yellow-400 transition disabled:opacity-50"
                        >
                            {isDeepDiveLoading ? 'Thinking...' : 'Generate Action Report'}
                        </button>
                    </div>

                    {isDeepDiveLoading && <LoadingSpinner message="Engaging Thinking Mode for a deep dive analysis..." />}
                    {deepDiveError && <div className="bg-red-800 text-white p-4 rounded-lg shadow-lg"><strong>Error:</strong> {deepDiveError}</div>}
                    {deepDiveResult && <div className="mt-4"><ActionReport report={deepDiveResult} /></div>}
                </div>
            )}
        </Card>
    );
};

interface ValueCardProps {
    betType: 'Spread' | 'Total';
    savantLine: { spread: string; total: number };
    marketLine: (MarketOdds & { sourceBook: string }) | null;
    valueScore: ValueScore;
    homeTeamAbbr: string;
    awayTeamAbbr: string;
    simulationResult?: SimulationResult;
    onTrack: (line: number, side: 'home' | 'away' | 'over' | 'under') => void;
}

const ValueCard: React.FC<ValueCardProps> = ({ betType, savantLine, marketLine, valueScore, homeTeamAbbr, awayTeamAbbr, simulationResult, onTrack }) => {
    const { score, text } = valueScore;
    const colorClasses = score >= 8 ? 'text-savant-gold'
                     : score >= 5 ? 'text-green-400'
                     : score >= 3 ? 'text-savant-cyan'
                     : 'text-red-400';
    
    let savantDisplay: string;
    let marketDisplay: string;
    let difference: number | null = null;
    
    // Logic to determine what to track
    let trackLine: number | null = null;
    let trackSide: 'home' | 'away' | 'over' | 'under' | null = null;

    
    if (betType === 'Spread') {
        let savantSpreadNum: number | null = null;
        if (simulationResult) {
            savantSpreadNum = simulationResult.medianSpread; 
        } else {
            savantSpreadNum = parseSpreadValue(savantLine.spread, homeTeamAbbr, awayTeamAbbr);
        }

        const marketSpreadNum = marketLine?.spread?.home; // Market spread is usually home perspective e.g. -7.5
        
        if (savantSpreadNum !== null) {
            const isHomeFav = savantSpreadNum < 0;
            const favTeamAbbr = savantSpreadNum < 0 ? homeTeamAbbr : awayTeamAbbr;
            const absSpread = Math.abs(savantSpreadNum);
            savantDisplay = `${favTeamAbbr} -${absSpread.toFixed(1)}`;
        } else {
             savantDisplay = 'N/A';
        }

        marketDisplay = marketSpreadNum !== undefined ? `${marketSpreadNum >= 0 ? '+' : ''}${marketSpreadNum.toFixed(1)}` : 'N/A';
        
        if (savantSpreadNum !== null && marketSpreadNum !== undefined) {
            difference = Math.abs(savantSpreadNum - marketSpreadNum);
            
            // Determine which side the model likes based on the difference logic
            // E.g. Model has Home -9. Market has Home -7. Model says Home covers easily.
            // Logic: savantSpreadNum (Home perspective) vs marketSpreadNum (Home perspective)
            // If savantSpreadNum < marketSpreadNum (e.g. -9 < -7), model likes Home.
            // If savantSpreadNum > marketSpreadNum (e.g. -3 > -5, or +2 > -4), model likes Home/Away differently.
            
            if (savantSpreadNum < marketSpreadNum) {
                // Model is more negative (more points for home team or less for away) -> Likes Home
                trackSide = 'home';
            } else {
                // Model is more positive -> Likes Away
                trackSide = 'away';
            }
            trackLine = marketSpreadNum;
        }
    } else { // Total
        const savantTotalNum = simulationResult ? simulationResult.medianTotal : savantLine.total;
        savantDisplay = `${savantTotalNum.toFixed(1)}`;
        marketDisplay = marketLine?.total ? `${marketLine.total.toFixed(1)}` : 'N/A';
        if (marketLine?.total) {
            difference = Math.abs(savantTotalNum - marketLine.total);
            
            if (savantTotalNum > marketLine.total) {
                trackSide = 'over';
            } else {
                trackSide = 'under';
            }
            trackLine = marketLine.total;
        }
    }

    return (
        <div className="bg-savant-light p-4 rounded-lg flex flex-col justify-between relative group/card">
            <div>
                 <div className="flex justify-between items-start mb-3">
                    <h4 className="text-lg font-bold text-savant-text">{betType}</h4>
                    <div className="text-right">
                        <p className={`text-lg font-bold ${colorClasses}`}>{text}</p>
                        <p className="text-xs text-savant-accent -mt-1">Score: {score}/10</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-center border-t border-savant-light/50 pt-3">
                    <div>
                        <p className="text-xs text-savant-accent font-semibold tracking-wider">SAVANT LINE</p>
                        <p className="text-2xl font-mono text-savant-cyan">{savantDisplay}</p>
                    </div>
                    <div>
                        <p className="text-xs text-savant-accent font-semibold tracking-wider">MARKET LINE</p>
                        <p className="text-2xl font-mono text-savant-text">{betType === 'Spread' ? homeTeamAbbr : 'O/U'} {marketDisplay}</p>
                    </div>
                </div>
            </div>
            <div className="mt-4 text-center flex items-center justify-center">
                {difference !== null && (
                    <p className="text-sm font-semibold text-savant-gold bg-savant-deep/50 inline-block px-3 py-1 rounded-md">
                        Edge: {difference.toFixed(1)} pts
                    </p>
                )}
                {/* Track Button - appears if we have a valid side to track */}
                {trackSide && trackLine !== null && (
                     <button 
                        onClick={() => onTrack(trackLine!, trackSide!)}
                        className="ml-3 bg-savant-cyan text-savant-deep text-xs font-bold px-2 py-1 rounded hover:bg-cyan-300 transition flex items-center"
                        title={`Track ${trackSide} ${trackLine}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                        </svg>
                        Track
                    </button>
                )}
            </div>
        </div>
    );
};

const AnalysisPoint: React.FC<{title: string, content: string}> = ({title, content}) => (
    <div>
        <h4 className="font-semibold text-savant-gold">{title}</h4>
        <p className="text-savant-accent">{content}</p>
    </div>
);


const TeamInjuryReport: React.FC<{ team: Team, injuries: Injury[] }> = ({ team, injuries }) => {
     const statusColors: { [key: string]: string } = {
        'Out': 'text-red-400',
        'Doubtful': 'text-red-400',
        'Questionable': 'text-yellow-400',
        'Game-Time Decision': 'text-yellow-400',
        'Day-To-Day': 'text-yellow-400',
        'Probable': 'text-green-400',
    };
    
    if (injuries.length === 0) return null;

    return (
        <div className="bg-savant-light p-3 rounded-lg">
            <div className="flex items-center mb-2">
                 <img src={team?.logo} alt={team?.name} className="w-6 h-6 mr-2" />
                 <h4 className="font-bold text-savant-text">{team?.name}</h4>
            </div>
             <ul className="space-y-2 text-sm">
                {injuries.map(injury => (
                    <li key={injury.player}>
                        <div className="flex justify-between items-center">
                            <span className="text-savant-accent font-semibold">{injury.player}</span>
                            <span className={`font-bold text-xs ${statusColors[injury.status] || 'text-gray-400'}`}>{injury.status}</span>
                        </div>
                        <p className="text-xs text-savant-accent/80 italic pl-2"> - {injury.details}</p>
                    </li>
                ))}
            </ul>
        </div>
    );
};


export default AnalysisResultCard;
