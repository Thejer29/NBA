

import { Team, ModelWeights } from './types';

export const TEAMS: Omit<Team, 'stats'>[] = [
  { id: 17, name: 'Milwaukee Bucks', abbreviation: 'MIL', logo: 'https://cdn.nba.com/logos/nba/1610612749/primary/L/logo.svg' },
  { id: 2, name: 'Boston Celtics', abbreviation: 'BOS', logo: 'https://cdn.nba.com/logos/nba/1610612738/primary/L/logo.svg' },
  { id: 7, name: 'Denver Nuggets', abbreviation: 'DEN', logo: 'https://cdn.nba.com/logos/nba/1610612743/primary/L/logo.svg' },
  { id: 13, name: 'Los Angeles Lakers', abbreviation: 'LAL', logo: 'https://cdn.nba.com/logos/nba/1610612747/primary/L/logo.svg' },
  { id: 9, name: 'Golden State Warriors', abbreviation: 'GSW', logo: 'https://cdn.nba.com/logos/nba/1610612744/primary/L/logo.svg' },
  { id: 22, name: 'Phoenix Suns', abbreviation: 'PHX', logo: 'https://cdn.nba.com/logos/nba/1610612756/primary/L/logo.svg' },
  { id: 20, name: 'Philadelphia 76ers', abbreviation: 'PHI', logo: 'https://cdn.nba.com/logos/nba/1610612755/primary/L/logo.svg' },
  { id: 14, name: 'Miami Heat', abbreviation: 'MIA', logo: 'https://cdn.nba.com/logos/nba/1610612748/primary/L/logo.svg' },
  { id: 1, name: 'Atlanta Hawks', abbreviation: 'ATL', logo: 'https://cdn.nba.com/logos/nba/1610612737/primary/L/logo.svg' },
  { id: 18, name: 'Brooklyn Nets', abbreviation: 'BKN', logo: 'https://cdn.nba.com/logos/nba/1610612751/primary/L/logo.svg' },
  { id: 30, name: 'Charlotte Hornets', abbreviation: 'CHA', logo: 'https://cdn.nba.com/logos/nba/1610612766/primary/L/logo.svg' },
  { id: 4, name: 'Chicago Bulls', abbreviation: 'CHI', logo: 'https://cdn.nba.com/logos/nba/1610612741/primary/L/logo.svg' },
  { id: 5, name: 'Cleveland Cavaliers', abbreviation: 'CLE', logo: 'https://cdn.nba.com/logos/nba/1610612739/primary/L/logo.svg' },
  { id: 6, name: 'Dallas Mavericks', abbreviation: 'DAL', logo: 'https://cdn.nba.com/logos/nba/1610612742/primary/L/logo.svg' },
  { id: 8, name: 'Detroit Pistons', abbreviation: 'DET', logo: 'https://cdn.nba.com/logos/nba/1610612765/primary/L/logo.svg' },
  { id: 10, name: 'Houston Rockets', abbreviation: 'HOU', logo: 'https://cdn.nba.com/logos/nba/1610612745/primary/L/logo.svg' },
  { id: 11, name: 'Indiana Pacers', abbreviation: 'IND', logo: 'https://cdn.nba.com/logos/nba/1610612754/primary/L/logo.svg' },
  { id: 12, name: 'Los Angeles Clippers', abbreviation: 'LAC', logo: 'https://cdn.nba.com/logos/nba/1610612746/primary/L/logo.svg' },
  { id: 29, name: 'Memphis Grizzlies', abbreviation: 'MEM', logo: 'https://cdn.nba.com/logos/nba/1610612763/primary/L/logo.svg' },
  { id: 16, name: 'Minnesota Timberwolves', abbreviation: 'MIN', logo: 'https://cdn.nba.com/logos/nba/1610612750/primary/L/logo.svg' },
  { id: 3, name: 'New Orleans Pelicans', abbreviation: 'NOP', logo: 'https://cdn.nba.com/logos/nba/1610612740/primary/L/logo.svg' },
  { id: 19, name: 'New York Knicks', abbreviation: 'NYK', logo: 'https://cdn.nba.com/logos/nba/1610612752/primary/L/logo.svg' },
  { id: 25, name: 'Oklahoma City Thunder', abbreviation: 'OKC', logo: 'https://cdn.nba.com/logos/nba/1610612760/primary/L/logo.svg' },
  { id: 21, name: 'Orlando Magic', abbreviation: 'ORL', logo: 'https://cdn.nba.com/logos/nba/1610612753/primary/L/logo.svg' },
  { id: 23, name: 'Portland Trail Blazers', abbreviation: 'POR', logo: 'https://cdn.nba.com/logos/nba/1610612757/primary/L/logo.svg' },
  { id: 24, name: 'Sacramento Kings', abbreviation: 'SAC', logo: 'https://cdn.nba.com/logos/nba/1610612758/primary/L/logo.svg' },
  { id: 26, name: 'San Antonio Spurs', abbreviation: 'SAS', logo: 'https://cdn.nba.com/logos/nba/1610612759/primary/L/logo.svg' },
  { id: 28, name: 'Toronto Raptors', abbreviation: 'TOR', logo: 'https://cdn.nba.com/logos/nba/1610612761/primary/L/logo.svg' },
  { id: 27, name: 'Utah Jazz', abbreviation: 'UTA', logo: 'https://cdn.nba.com/logos/nba/1610612762/primary/L/logo.svg' },
  { id: 15, name: 'Washington Wizards', abbreviation: 'WAS', logo: 'https://cdn.nba.com/logos/nba/1610612764/primary/L/logo.svg' },
];

export const DEFAULT_MODEL_WEIGHTS: ModelWeights = {
    recentForm: 0.2, // Reduced from 0.3. Rely more on stable, season-long data.
    // Four Factor Weights (should sum roughly to 1.0)
    eFgPctWeight: 0.4,
    turnoverPctWeight: 0.25,
    reboundPctWeight: 0.20,
    freeThrowRateWeight: 0.15,
    matchupImpactWeight: 0.15, // Reduced from 0.25. Lowers variance from specific matchups.
    volatilityImpactWeight: 1.0, // How much team volatility affects simulation randomness
    // Simulation Parameters
    simulationStdDev: 12.5, // Increased from 12.0 to add slightly more variance, making extreme confidence less likely.
    scoreCorrelation: 0.3,   // A slight positive correlation is realistic for NBA game scores.
    threePointVarianceWeight: 0.5, // How much 3P-heavy play styles increase score variance.
    efficiencyDecay: 0.05, // New: Penalty factor. For every 1% usage increase, efficiency drops by this %.
};

export const LEAGUE_AVG_VOLATILITY = 13.5; // Updated: Standard Deviation of Point Differentials is typically higher than Net Rating.
export const LEAGUE_AVG_3P_ATTEMPT_RATE = 0.39; // Modern NBA average 3PAr
export const EXPORT_FILE_PREFIX = 'NBA';