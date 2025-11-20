

export interface Player {
  name: string;
  stats: {
    usageRate: number;
    careerFG: number;
    recentFG: number;
    career3P: number;
    recent3P: number;
  };
}

export interface PlayerStat {
    name: string;
    usageRate: number;
    offensiveRating: number;
}

export interface TeamStats {
  // Core Statistical Pillars
  sourceUrl?: string;
  offensiveRating: number;
  defensiveRating: number;
  netRating: number;
  effectiveFgPct: number;
  opponentEffectiveFgPct: number; // New: Defensive eFG%
  trueShootingPct: number;
  turnoverPct: number;
  forcedTurnoverPct: number; // New: Defensive TOV%
  offensiveReboundPct: number;
  defensiveReboundPct: number;
  freeThrowRate: number;
  opponentFreeThrowRate: number; // New: Defensive FTR
  pace: number;
  threePointAttemptRate: number; // Percentage of FGAs that are 3-pointers
  threePointPct: number; // 3-point shooting percentage
  
  // Record
  wins: number;
  losses: number;

  // Derived & Savant Stats
  pythagoreanWins?: number;
  luck?: number; // wins - pythagoreanWins
  recentForm: number; // Placeholder, will be calculated dynamically if needed
  elo?: number;
  netRatingVolatility?: number;

  // For recent form and rest differential
  lastGameDate?: string;
  recentStats?: {
    offensiveRating: number;
    defensiveRating: number;
    netRating: number;
    effectiveFgPct: number;
    opponentEffectiveFgPct: number;
    trueShootingPct: number;
    turnoverPct: number;
    forcedTurnoverPct: number;
    offensiveReboundPct: number;
    defensiveReboundPct: number;
    freeThrowRate: number;
    opponentFreeThrowRate: number;
    pace: number;
    threePointAttemptRate: number;
    threePointPct: number;
  };
  
  // New: Roster for Usage Redistribution
  roster?: PlayerStat[];
}

export interface Team {
  id: number;
  name:string;
  abbreviation: string;
  logo: string;
  stats: Partial<TeamStats> & { injuries?: Injury[] }; // Stats will be fetched dynamically
}

export interface Injury {
    player: string;
    status: 'Out' | 'Questionable' | 'Game-Time Decision' | 'Probable' | 'Day-To-Day' | 'Doubtful';
    details: string;
    teamName: string;
}

export interface ModelWeights {
  recentForm: number;
  eFgPctWeight: number;
  turnoverPctWeight: number;
  reboundPctWeight: number;
  freeThrowRateWeight: number;
  matchupImpactWeight: number; // New: How much to apply the four-factor adjustment
  volatilityImpactWeight: number; // New: How much team volatility affects simulation randomness
  simulationStdDev: number; // The standard deviation for each team's score in a single game simulation.
  scoreCorrelation: number; // The correlation (rho) between the two teams' scores in a simulation.
  threePointVarianceWeight: number;
  efficiencyDecay: number; // New: Penalty factor for usage increase
}

export interface SimulationResult {
  winProbability: { home: number; away: number };
  medianSpread: number; // e.g., -7.5 for home team favorite
  medianTotal: number;
  coverProbability: { home: number }; // cover probability for the HOME team
  outcomes: {
    spread: { value: number; count: number }[]; // For histogram
  };
}

export interface ValueScore {
    score: number;
    text: string;
}

export interface AnalysisResult {
  prc: string;
  savantLine: {
    spread: string;
    total: number;
    spreadReasoning: string;
    totalReasoning: string;
  };
  valueScore: {
    spread: ValueScore;
    total: ValueScore;
  };
  latestNews: string;
  injuryImpactAnalysis: string;
  matchupAnalysis: string;
  powerRankingContext: string;
  luckAnalysis: string;
  eloAnalysis: string;
  monteCarloAnalysis: string;
  synthesisNote: string;
  simulationResult?: SimulationResult;
  groundingChunks?: { web: { uri: string; title: string } }[];
  consistencyCheck?: ConsistencyCheckResult;
}

export interface MarketOdds {
    bookmaker: string;
    spread?: {
        home: number;
        away: number;
    };
    total?: number;
    moneyline?: {
        home: number;
        away: number;
    };
}

export interface GameForAnalysis {
    id: string;
    date: string; // ISO String
    time?: string;
    awayTeamName: string;
    homeTeamName: string;
    odds?: MarketOdds[];
}

export interface PlayerStatus {
    name: string;
    position: string;
}

export interface Lineups {
    home: PlayerStatus[];
    away: PlayerStatus[];
}

export interface GameDetails {
    injuries: Injury[];
    lineups: Lineups; // Lineups might be empty for future games
}

export interface GameAnalysis {
    game: GameForAnalysis;
    homeTeam: Team;
    awayTeam: Team;
    analysis: AnalysisResult;
}

export interface DailySlateAnalysis {
    date: string; // YYYY-MM-DD
    games: GameAnalysis[];
}

export interface Bet {
  id: string;
  game: GameForAnalysis;
  betType: 'spread' | 'total' | 'moneyline';
  line: number;
  teamOrOverUnder: 'home' | 'away' | 'over' | 'under';
  outcome: 'Win' | 'Loss' | 'Push' | 'Pending';
  datePlaced: string;
  finalScore?: {
    home: number;
    away: number;
    wentToOT?: boolean;
  };
  valueScore: number;
  odds: number;
}

export interface SavedAnalysis {
  id: string; // ISO string timestamp
  date: string; // YYYY-MM-DD
  results: GameAnalysis[];
  gameSlate: GameForAnalysis[];
  teamsWithStats: [string, Team][];
}

export interface ConsistencyCheckResult {
    isChangeSignificant: boolean;
    changeReason: string;
}

export interface CalibrationResult {
    calibratedWeights: ModelWeights;
    calibrationNotes: string;
}

export interface ExportData {
    bets: Bet[];
    savedAnalyses: SavedAnalysis[];
    modelWeights?: ModelWeights;
}

export interface CompletedGame {
    id: string;
    homeTeamName: string;
    awayTeamName: string;
    homeScore: number;
    awayScore: number;
    wentToOT: boolean;
}