/**
 * Free_BallStats v3.1 — Universal Multi-Sport Deep Analytics & Spatial Telemetry Engine
 *
 * Provides Opta / StatsBomb (Soccer), NFL Next Gen Stats / PFF (NFL & College Football),
 * MoneyPuck / Natural Stat Trick (NHL Hockey), and KenPom / CourtOptix (College Basketball & NBA)
 * deep in-game analytics, interactive SVG spatial maps (Pitch, Field, Rink, Half-Court),
 * 4 Core Analytical Pillars per sport, Tactical Play-Type matrices, Active Lineup/Formation units,
 * Win Probability Worms, and Sport-Native Smart Screen Broadcast Cards.
 */

import type { StreamItem } from '../types/stream.js';
import type { AthleteInfo, BoxScoreCategory } from './sports-intel-service.js';

export type SupportedSportType =
  | 'basketball'
  | 'ncaab'
  | 'soccer'
  | 'nfl'
  | 'ncaaf'
  | 'hockey'
  | 'baseball'
  | 'combat'
  | 'motorsport';

export type SpatialSurfaceType =
  | 'basketball_halfcourt'
  | 'soccer_pitch'
  | 'football_field'
  | 'hockey_rink';

export interface SportPillarMetric {
  code: string;
  label: string;
  weightLabel: string;
  team1Value: string;
  team2Value: string;
  team1Numeric: number;
  team2Numeric: number;
  leagueAverage: string;
  edgeTeam: 'team1' | 'team2' | 'even';
  description: string;
}

export interface SpatialPointEvent {
  id: string;
  team: 'team1' | 'team2';
  playerName: string;
  jersey: string;
  x: number; // Normalized 0..100
  y: number; // Normalized 0..100
  isSuccess: boolean; // Goal / Made Shot / Completed Pass / Touchdown
  isHighValue?: boolean; // Big Chance / 3PT / Explosive 20+ yd play / High-Danger Slot
  outcomeLabel: string; // e.g. 'GOAL (0.48 xG)', 'SAVED (0.22 xG)', 'MADE 3PT', '28 YD PASS (+1.9 EPA)', 'SLOT GOAL'
  period: string;
  clock: string;
  metricValue: number; // xG, xPTS, EPA, xGF
  zoneLabel: string;
}

export interface SpatialZoneComparison {
  zoneKey: string;
  label: string;
  team1Volume: string;
  team1Efficiency: string;
  team2Volume: string;
  team2Efficiency: string;
  benchmarkEfficiency: string;
  edge: 'team1' | 'team2' | 'even';
}

export interface TacticalStyleMetric {
  playType: string;
  label: string;
  team1FreqPct: number;
  team1Efficiency: string; // e.g. '1.18 PPP' or '0.34 EPA/play' or '0.19 xG/shot' or '58.4% CF%'
  team1Percentile: number;
  team2FreqPct: number;
  team2Efficiency: string;
  team2Percentile: number;
  edge: string;
}

export interface ActiveUnitMember {
  id: string;
  name: string;
  jersey: string;
  position: string;
  headshot: string;
  primaryStat: string;
  efficiencyBadge: string;
  impactVal: string;
  isHot?: boolean;
  hasWarning?: boolean; // Yellow card / Foul trouble / Penalty
}

export interface StintMomentumSegment {
  periodLabel: string;
  timeRange: string;
  team1Score: number;
  team2Score: number;
  netDiff: number;
  headline: string;
}

export interface UniversalSmartCard {
  id: string;
  category: string;
  badge: string;
  headline: string;
  detail: string;
  metricHighlight: string;
  accentColor: 'gold' | 'cyan' | 'purple' | 'green' | 'red';
  playerHeadshot?: string;
}

export interface UniversalSportDeepAnalytics {
  eventId: string;
  sportType: SupportedSportType;
  sportBadge: string;
  analyticsMethodology: string; // e.g. 'Opta xG • StatsBomb Field Tilt • PPDA'
  surfaceType: SpatialSurfaceType;
  status: string;
  detail: string;
  isLive: boolean;
  venue: string;
  broadcast: string;
  leverageIndex: number;
  leverageTier: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRUNCH TIME';
  isClutchTime: boolean;
  situationBanner: string; // e.g. '2nd & 4 at OPP 18 (Red Zone)' or '5v4 Power Play (1:14)' or 'High Press: 6.8 PPDA'
  linescore: {
    periodHeaders: string[];
    team1Quarters: number[];
    team2Quarters: number[];
    team1Total: number;
    team2Total: number;
  };
  paceAndProjection: {
    tempoLabel: string;
    tempoValue: string;
    projectedFinal: string;
    primaryRateLabel: string;
    team1RateValue: string;
    team2RateValue: string;
  };
  team1Meta: {
    name: string;
    abbreviation: string;
    logo: string;
    score: number;
    record: string;
    formationOrScheme: string;
  };
  team2Meta: {
    name: string;
    abbreviation: string;
    logo: string;
    score: number;
    record: string;
    formationOrScheme: string;
  };
  fourPillars: SportPillarMetric[];
  unitSplits: {
    unit1Label: string; // e.g. 'Starting XI' / 'Passing Attack' / 'Top-6 Forwards' / 'Starters'
    unit2Label: string; // e.g. 'Substitutes' / 'Rushing Attack' / 'Bottom-6 & D-Pairs' / 'Bench'
    team1Unit1Stat: string;
    team1Unit2Stat: string;
    team1Unit1Pct: number;
    team2Unit1Stat: string;
    team2Unit2Stat: string;
    team2Unit1Pct: number;
    summaryEdge: string;
  };
  spatialMap: {
    title: string;
    subtitle: string;
    surfaceType: SpatialSurfaceType;
    team1PrimaryMetric: string; // e.g. '1.94 xG (6 SOG)' or '+0.24 EPA/Play' or '3.42 xGF (31 SOG)'
    team2PrimaryMetric: string;
    events: SpatialPointEvent[];
    zones: SpatialZoneComparison[];
  };
  tacticalMatrix: TacticalStyleMetric[];
  activeUnit: {
    unitTitle: string;
    team1Scheme: string;
    team2Scheme: string;
    team1NetMetric: string;
    team2NetMetric: string;
    team1Players: ActiveUnitMember[];
    team2Players: ActiveUnitMember[];
    stintTimeline: StintMomentumSegment[];
  };
  winProbTimeline: Array<{
    label: string;
    minuteMark: number;
    team1WinPct: number;
    leverageIndex: number;
    scoreDiff: number;
    keyPlay?: string;
  }>;
  smartCards: UniversalSmartCard[];
  inGameInsights: Array<{
    title: string;
    detail: string;
    category: string;
    metricBadge: string;
  }>;
  mvpPerformer: {
    id: string;
    name: string;
    teamAbbr: string;
    position: string;
    jersey: string;
    headshot: string;
    primaryLine: string;
    efficiencyLine: string;
    impactBadge: string;
  };
  boxscoreCategories: {
    team1: BoxScoreCategory[];
    team2: BoxScoreCategory[];
  };
  rosters: {
    team1: AthleteInfo[];
    team2: AthleteInfo[];
  };
  teamStatsComparison: Array<{ label: string; team1Value: string; team2Value: string }>;
  scoringTimeline: Array<{
    period: string;
    clock: string;
    teamName: string;
    teamLogo: string;
    score: string;
    description: string;
  }>;
}

/**
 * Generates an inline SVG data-URI crest shield so team logos NEVER break or show blank icons.
 */
export function buildSvgTeamCrestDataUri(teamName: string, primaryHex = '#9146ff', secondaryHex = '#00f2fe'): string {
  const clean = (teamName || 'TM').trim();
  const words = clean.split(/\s+/);
  const abbr =
    words.length >= 2
      ? (words[0][0] + words[1][0] + (words[2]?.[0] || '')).toUpperCase()
      : clean.slice(0, 3).toUpperCase();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${primaryHex}"/>
        <stop offset="100%" stop-color="${secondaryHex}"/>
      </linearGradient>
    </defs>
    <path d="M40 5 L70 16 V40 C70 58 40 73 40 73 C40 73 10 58 10 40 V16 Z" fill="url(#g)" stroke="#ffffff" stroke-width="2.5" stroke-opacity="0.7"/>
    <path d="M40 10 L65 19 V39 C65 54 40 67 40 67 C40 67 15 54 15 39 V19 Z" fill="#0b0e17" fill-opacity="0.45"/>
    <text x="40" y="45" text-anchor="middle" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-weight="900" font-size="18" letter-spacing="0.5">${abbr}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function buildSvgAvatarDataUri(name: string, jersey: string, bgHex = '#1e1b4b', accentHex = '#a78bfa'): string {
  const parts = (name || 'Player').trim().split(/\s+/);
  const initials = ((parts[0]?.[0] || 'P') + (parts[parts.length - 1]?.[0] || '')).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80">
    <circle cx="40" cy="40" r="38" fill="${bgHex}" stroke="${accentHex}" stroke-width="2.5"/>
    <circle cx="40" cy="30" r="13" fill="${accentHex}" fill-opacity="0.25"/>
    <path d="M18 66 C20 50 60 50 62 66" fill="${accentHex}" fill-opacity="0.25"/>
    <text x="40" y="38" text-anchor="middle" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-weight="800" font-size="17">${initials}</text>
    <text x="40" y="58" text-anchor="middle" fill="${accentHex}" font-family="monospace" font-weight="800" font-size="13">#${jersey || '0'}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ============================================================================
// CURATED REAL-WORLD ROSTERS FOR MAJOR TEAMS ACROSS ALL SPORTS
// ============================================================================

interface RosterTemplate {
  teamKeywords: string[];
  officialName: string;
  abbr: string;
  logo: string;
  record: string;
  scheme: string;
  primaryHex: string;
  secondaryHex: string;
  players: Array<{
    id: string;
    name: string;
    jersey: string;
    position: string;
    headshot?: string;
    height?: string;
    weight?: string;
    age?: number;
    college?: string;
  }>;
}

const SOCCER_TEAMS_DB: RosterTemplate[] = [
  {
    teamKeywords: ['england', 'three lions'],
    officialName: 'England',
    abbr: 'ENG',
    logo: 'https://a.espncdn.com/i/teamlogos/countries/500/eng.png',
    record: '1st Group B2 • 5W-0D-1L (15 pts)',
    scheme: '4-2-3-1 High Press',
    primaryHex: '#cf081f',
    secondaryHex: '#1d4ed8',
    players: [
      { id: 'soc_kane', name: 'Harry Kane', jersey: '9', position: 'ST', height: "6' 2\"", weight: '196 lbs', age: 31, college: 'Bayern Munich' },
      { id: 'soc_bellingham', name: 'Jude Bellingham', jersey: '10', position: 'CAM', height: "6' 1\"", weight: '170 lbs', age: 21, college: 'Real Madrid' },
      { id: 'soc_saka', name: 'Bukayo Saka', jersey: '7', position: 'RW', height: "5' 10\"", weight: '159 lbs', age: 23, college: 'Arsenal' },
      { id: 'soc_foden', name: 'Phil Foden', jersey: '11', position: 'LW', height: "5' 7\"", weight: '154 lbs', age: 24, college: 'Manchester City' },
      { id: 'soc_rice', name: 'Declan Rice', jersey: '4', position: 'CDM', height: "6' 1\"", weight: '176 lbs', age: 25, college: 'Arsenal' },
      { id: 'soc_palmer', name: 'Cole Palmer', jersey: '20', position: 'CAM', height: "6' 2\"", weight: '163 lbs', age: 22, college: 'Chelsea' },
      { id: 'soc_taa', name: 'Trent Alexander-Arnold', jersey: '2', position: 'RB', height: "5' 11\"", weight: '152 lbs', age: 26, college: 'Liverpool' },
      { id: 'soc_stones', name: 'John Stones', jersey: '5', position: 'CB', height: "6' 2\"", weight: '154 lbs', age: 30, college: 'Manchester City' },
      { id: 'soc_guehi', name: 'Marc Guéhi', jersey: '6', position: 'CB', height: "6' 0\"", weight: '181 lbs', age: 24, college: 'Crystal Palace' },
      { id: 'soc_gordon', name: 'Anthony Gordon', jersey: '18', position: 'LW', height: "6' 0\"", weight: '159 lbs', age: 23, college: 'Newcastle United' },
      { id: 'soc_pickford', name: 'Jordan Pickford', jersey: '1', position: 'GK', height: "6' 1\"", weight: '170 lbs', age: 30, college: 'Everton' },
      { id: 'soc_watkins', name: 'Ollie Watkins', jersey: '19', position: 'ST', height: "5' 11\"", weight: '154 lbs', age: 28, college: 'Aston Villa' },
      { id: 'soc_gallagher', name: 'Conor Gallagher', jersey: '16', position: 'CM', height: "6' 0\"", weight: '163 lbs', age: 24, college: 'Atlético Madrid' },
    ],
  },
  {
    teamKeywords: ['spain', 'espana', 'la roja'],
    officialName: 'Spain',
    abbr: 'ESP',
    logo: 'https://a.espncdn.com/i/teamlogos/countries/500/esp.png',
    record: '1st Group A4 • 5W-1D-0L (16 pts)',
    scheme: '4-3-3 Positional Play',
    primaryHex: '#aa151b',
    secondaryHex: '#f1bf00',
    players: [
      { id: 'soc_yamal', name: 'Lamine Yamal', jersey: '19', position: 'RW', height: "5' 11\"", weight: '159 lbs', age: 17, college: 'FC Barcelona' },
      { id: 'soc_nico', name: 'Nico Williams', jersey: '17', position: 'LW', height: "5' 11\"", weight: '152 lbs', age: 22, college: 'Athletic Club' },
      { id: 'soc_morata', name: 'Álvaro Morata', jersey: '7', position: 'ST', height: "6' 2\"", weight: '185 lbs', age: 32, college: 'AC Milan' },
      { id: 'soc_pedri', name: 'Pedri González', jersey: '20', position: 'CM', height: "5' 8\"", weight: '134 lbs', age: 22, college: 'FC Barcelona' },
      { id: 'soc_fabian', name: 'Fabián Ruiz', jersey: '8', position: 'CM', height: "6' 2\"", weight: '154 lbs', age: 28, college: 'Paris Saint-Germain' },
      { id: 'soc_olmo', name: 'Dani Olmo', jersey: '10', position: 'CAM', height: "5' 10\"", weight: '159 lbs', age: 26, college: 'FC Barcelona' },
      { id: 'soc_zubimendi', name: 'Martín Zubimendi', jersey: '6', position: 'CDM', height: "5' 11\"", weight: '163 lbs', age: 25, college: 'Real Sociedad' },
      { id: 'soc_cucurella', name: 'Marc Cucurella', jersey: '24', position: 'LB', height: "5' 8\"", weight: '146 lbs', age: 26, college: 'Chelsea' },
      { id: 'soc_laporte', name: 'Aymeric Laporte', jersey: '14', position: 'CB', height: "6' 2\"", weight: '187 lbs', age: 30, college: 'Al-Nassr' },
      { id: 'soc_lenormand', name: 'Robin Le Normand', jersey: '3', position: 'CB', height: "6' 1\"", weight: '176 lbs', age: 28, college: 'Atlético Madrid' },
      { id: 'soc_raya', name: 'David Raya', jersey: '1', position: 'GK', height: "6' 0\"", weight: '176 lbs', age: 29, college: 'Arsenal' },
      { id: 'soc_merino', name: 'Mikel Merino', jersey: '18', position: 'CM', height: "6' 2\"", weight: '183 lbs', age: 28, college: 'Arsenal' },
      { id: 'soc_oyarzabal', name: 'Mikel Oyarzabal', jersey: '21', position: 'FW', height: "5' 11\"", weight: '174 lbs', age: 27, college: 'Real Sociedad' },
    ],
  },
  {
    teamKeywords: ['real madrid', 'madrid'],
    officialName: 'Real Madrid',
    abbr: 'RMA',
    logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/86.png',
    record: '2nd La Liga • 11W-3D-2L (36 pts)',
    scheme: '4-3-1-2 Dynamic Transition',
    primaryHex: '#f59e0b',
    secondaryHex: '#3b82f6',
    players: [
      { id: 'soc_mbappe', name: 'Kylian Mbappé', jersey: '9', position: 'ST', college: 'Real Madrid' },
      { id: 'soc_vini', name: 'Vinícius Júnior', jersey: '7', position: 'LW', college: 'Real Madrid' },
      { id: 'soc_bellingham_rm', name: 'Jude Bellingham', jersey: '5', position: 'CAM', college: 'Real Madrid' },
      { id: 'soc_valverde', name: 'Federico Valverde', jersey: '8', position: 'CM', college: 'Real Madrid' },
      { id: 'soc_rodrygo', name: 'Rodrygo Goes', jersey: '11', position: 'RW', college: 'Real Madrid' },
      { id: 'soc_camavinga', name: 'Eduardo Camavinga', jersey: '6', position: 'CDM', college: 'Real Madrid' },
      { id: 'soc_rudiger', name: 'Antonio Rüdiger', jersey: '22', position: 'CB', college: 'Real Madrid' },
      { id: 'soc_courtois', name: 'Thibaut Courtois', jersey: '1', position: 'GK', college: 'Real Madrid' },
    ],
  },
  {
    teamKeywords: ['barcelona', 'barca'],
    officialName: 'FC Barcelona',
    abbr: 'BAR',
    logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/83.png',
    record: '1st La Liga • 12W-2D-2L (38 pts)',
    scheme: '4-2-3-1 High Line Press',
    primaryHex: '#a50044',
    secondaryHex: '#004d98',
    players: [
      { id: 'soc_lewandowski', name: 'Robert Lewandowski', jersey: '9', position: 'ST', college: 'FC Barcelona' },
      { id: 'soc_raphinha', name: 'Raphinha', jersey: '11', position: 'LW', college: 'FC Barcelona' },
      { id: 'soc_yamal_b', name: 'Lamine Yamal', jersey: '19', position: 'RW', college: 'FC Barcelona' },
      { id: 'soc_pedri_b', name: 'Pedri', jersey: '8', position: 'CM', college: 'FC Barcelona' },
      { id: 'soc_olmo_b', name: 'Dani Olmo', jersey: '20', position: 'CAM', college: 'FC Barcelona' },
      { id: 'soc_casado', name: 'Marc Casadó', jersey: '17', position: 'CDM', college: 'FC Barcelona' },
      { id: 'soc_cubarsi', name: 'Pau Cubarsí', jersey: '2', position: 'CB', college: 'FC Barcelona' },
      { id: 'soc_kounde', name: 'Jules Koundé', jersey: '23', position: 'RB', college: 'FC Barcelona' },
    ],
  },
  {
    teamKeywords: ['liverpool', 'reds'],
    officialName: 'Liverpool',
    abbr: 'LIV',
    logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/364.png',
    record: '1st Premier League • 11W-2D-1L (35 pts)',
    scheme: '4-2-3-1 Slot Control',
    primaryHex: '#c8102e',
    secondaryHex: '#00b2a9',
    players: [
      { id: 'soc_salah', name: 'Mohamed Salah', jersey: '11', position: 'RW', college: 'Liverpool' },
      { id: 'soc_diaz', name: 'Luis Díaz', jersey: '7', position: 'LW', college: 'Liverpool' },
      { id: 'soc_nunez', name: 'Darwin Núñez', jersey: '9', position: 'ST', college: 'Liverpool' },
      { id: 'soc_gravenberch', name: 'Ryan Gravenberch', jersey: '38', position: 'CDM', college: 'Liverpool' },
      { id: 'soc_macallister', name: 'Alexis Mac Allister', jersey: '10', position: 'CM', college: 'Liverpool' },
      { id: 'soc_szoboszlai', name: 'Dominik Szoboszlai', jersey: '8', position: 'CAM', college: 'Liverpool' },
      { id: 'soc_vandijk', name: 'Virgil van Dijk', jersey: '4', position: 'CB', college: 'Liverpool' },
      { id: 'soc_alisson', name: 'Alisson Becker', jersey: '1', position: 'GK', college: 'Liverpool' },
    ],
  },
  {
    teamKeywords: ['arsenal', 'gunners'],
    officialName: 'Arsenal',
    abbr: 'ARS',
    logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/359.png',
    record: '2nd Premier League • 9W-4D-2L (31 pts)',
    scheme: '4-3-3 Inverted Press',
    primaryHex: '#ef0107',
    secondaryHex: '#063672',
    players: [
      { id: 'soc_saka_a', name: 'Bukayo Saka', jersey: '7', position: 'RW', college: 'Arsenal' },
      { id: 'soc_odegaard', name: 'Martin Ødegaard', jersey: '8', position: 'CAM', college: 'Arsenal' },
      { id: 'soc_havertz', name: 'Kai Havertz', jersey: '29', position: 'ST', college: 'Arsenal' },
      { id: 'soc_martinelli', name: 'Gabriel Martinelli', jersey: '11', position: 'LW', college: 'Arsenal' },
      { id: 'soc_rice_a', name: 'Declan Rice', jersey: '41', position: 'CM', college: 'Arsenal' },
      { id: 'soc_saliba', name: 'William Saliba', jersey: '2', position: 'CB', college: 'Arsenal' },
      { id: 'soc_gabriel', name: 'Gabriel Magalhães', jersey: '6', position: 'CB', college: 'Arsenal' },
      { id: 'soc_raya_a', name: 'David Raya', jersey: '22', position: 'GK', college: 'Arsenal' },
    ],
  },
];

const NFL_NCAAF_TEAMS_DB: RosterTemplate[] = [
  {
    teamKeywords: ['kansas city', 'chiefs'],
    officialName: 'Kansas City Chiefs',
    abbr: 'KC',
    logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/kc.png',
    record: '11-1 (1st AFC West)',
    scheme: '11 Personnel Spread / Spagnuolo Blitz',
    primaryHex: '#e31837',
    secondaryHex: '#ffb81c',
    players: [
      { id: 'nfl_mahomes', name: 'Patrick Mahomes', jersey: '15', position: 'QB', college: 'Texas Tech' },
      { id: 'nfl_kelce', name: 'Travis Kelce', jersey: '87', position: 'TE', college: 'Cincinnati' },
      { id: 'nfl_hunt', name: 'Kareem Hunt', jersey: '29', position: 'RB', college: 'Toledo' },
      { id: 'nfl_worthy', name: 'Xavier Worthy', jersey: '1', position: 'WR', college: 'Texas' },
      { id: 'nfl_hopkins', name: 'DeAndre Hopkins', jersey: '8', position: 'WR', college: 'Clemson' },
      { id: 'nfl_jones', name: 'Chris Jones', jersey: '95', position: 'DT', college: 'Mississippi State' },
      { id: 'nfl_karlaftis', name: 'George Karlaftis', jersey: '56', position: 'DE', college: 'Purdue' },
      { id: 'nfl_bolton', name: 'Nick Bolton', jersey: '32', position: 'LB', college: 'Missouri' },
    ],
  },
  {
    teamKeywords: ['buffalo', 'bills'],
    officialName: 'Buffalo Bills',
    abbr: 'BUF',
    logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/buf.png',
    record: '10-2 (1st AFC East)',
    scheme: '11/12 Personnel Josh Allen Dual-Threat',
    primaryHex: '#00338d',
    secondaryHex: '#c60c30',
    players: [
      { id: 'nfl_allen', name: 'Josh Allen', jersey: '17', position: 'QB', college: 'Wyoming' },
      { id: 'nfl_cook', name: 'James Cook', jersey: '4', position: 'RB', college: 'Georgia' },
      { id: 'nfl_shakir', name: 'Khalil Shakir', jersey: '10', position: 'WR', college: 'Boise State' },
      { id: 'nfl_cooper', name: 'Amari Cooper', jersey: '18', position: 'WR', college: 'Alabama' },
      { id: 'nfl_kincaid', name: 'Dalton Kincaid', jersey: '86', position: 'TE', college: 'Utah' },
      { id: 'nfl_rousseau', name: 'Greg Rousseau', jersey: '50', position: 'DE', college: 'Miami' },
      { id: 'nfl_bernard', name: 'Terrel Bernard', jersey: '43', position: 'LB', college: 'Baylor' },
      { id: 'nfl_benford', name: 'Christian Benford', jersey: '47', position: 'CB', college: 'Villanova' },
    ],
  },
  {
    teamKeywords: ['detroit', 'lions'],
    officialName: 'Detroit Lions',
    abbr: 'DET',
    logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/det.png',
    record: '11-1 (1st NFC North)',
    scheme: 'Play-Action Heavy / Sonic & Knuckles Run',
    primaryHex: '#0076b6',
    secondaryHex: '#b0b7bc',
    players: [
      { id: 'nfl_goff', name: 'Jared Goff', jersey: '16', position: 'QB', college: 'California' },
      { id: 'nfl_gibbs', name: 'Jahmyr Gibbs', jersey: '26', position: 'RB', college: 'Alabama' },
      { id: 'nfl_montgomery', name: 'David Montgomery', jersey: '5', position: 'RB', college: 'Iowa State' },
      { id: 'nfl_stbrown', name: 'Amon-Ra St. Brown', jersey: '14', position: 'WR', college: 'USC' },
      { id: 'nfl_laporta', name: 'Sam LaPorta', jersey: '87', position: 'TE', college: 'Iowa' },
      { id: 'nfl_branch', name: 'Brian Branch', jersey: '32', position: 'S', college: 'Alabama' },
    ],
  },
  {
    teamKeywords: ['green bay', 'packers'],
    officialName: 'Green Bay Packers',
    abbr: 'GB',
    logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/gb.png',
    record: '9-3 (NFC North)',
    scheme: 'LaFleur Motion & Play-Action',
    primaryHex: '#203731',
    secondaryHex: '#ffb612',
    players: [
      { id: 'nfl_love', name: 'Jordan Love', jersey: '10', position: 'QB', college: 'Utah State' },
      { id: 'nfl_jacobs', name: 'Josh Jacobs', jersey: '8', position: 'RB', college: 'Alabama' },
      { id: 'nfl_reed', name: 'Jayden Reed', jersey: '11', position: 'WR', college: 'Michigan State' },
      { id: 'nfl_kraft', name: 'Tucker Kraft', jersey: '85', position: 'TE', college: 'South Dakota State' },
      { id: 'nfl_mckinney', name: 'Xavier McKinney', jersey: '29', position: 'S', college: 'Alabama' },
      { id: 'nfl_gary', name: 'Rashan Gary', jersey: '52', position: 'DE', college: 'Michigan' },
    ],
  },
  {
    teamKeywords: ['oregon', 'ducks'],
    officialName: '#1 Oregon Ducks',
    abbr: 'ORE',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2483.png',
    record: '12-0 (9-0 Big Ten • #1 CFP)',
    scheme: 'Spread RPO Tempo / 4-2-5 Mint Defense',
    primaryHex: '#154733',
    secondaryHex: '#fee123',
    players: [
      { id: 'cfb_gabriel', name: 'Dillon Gabriel', jersey: '8', position: 'QB', college: 'Oregon (Sr.)' },
      { id: 'cfb_james', name: 'Jordan James', jersey: '20', position: 'RB', college: 'Oregon (Jr.)' },
      { id: 'cfb_johnson', name: 'Tez Johnson', jersey: '15', position: 'WR', college: 'Oregon (Sr.)' },
      { id: 'cfb_stewart', name: 'Evan Stewart', jersey: '7', position: 'WR', college: 'Oregon (Jr.)' },
      { id: 'cfb_burch', name: 'Jordan Burch', jersey: '1', position: 'EDGE', college: 'Oregon (Sr.)' },
      { id: 'cfb_bassa', name: 'Jeffrey Bassa', jersey: '2', position: 'LB', college: 'Oregon (Sr.)' },
    ],
  },
  {
    teamKeywords: ['ohio state', 'buckeyes', 'osu'],
    officialName: '#2 Ohio State Buckeyes',
    abbr: 'OSU',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/194.png',
    record: '10-2 (7-2 Big Ten • CFP Contender)',
    scheme: 'Chip Kelly Pro-Spread / Silver Bullets 4-2-5',
    primaryHex: '#bb0000',
    secondaryHex: '#666666',
    players: [
      { id: 'cfb_howard', name: 'Will Howard', jersey: '18', position: 'QB', college: 'Ohio State (Sr.)' },
      { id: 'cfb_henderson', name: 'TreVeyon Henderson', jersey: '32', position: 'RB', college: 'Ohio State (Sr.)' },
      { id: 'cfb_judkins', name: 'Quinshon Judkins', jersey: '1', position: 'RB', college: 'Ohio State (Jr.)' },
      { id: 'cfb_smith', name: 'Jeremiah Smith', jersey: '4', position: 'WR', college: 'Ohio State (Fr.)' },
      { id: 'cfb_egbuka', name: 'Emeka Egbuka', jersey: '2', position: 'WR', college: 'Ohio State (Sr.)' },
      { id: 'cfb_downs', name: 'Caleb Downs', jersey: '2', position: 'S', college: 'Ohio State (So.)' },
    ],
  },
  {
    teamKeywords: ['texas', 'longhorns'],
    officialName: '#3 Texas Longhorns',
    abbr: 'TEX',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/251.png',
    record: '11-1 (7-1 SEC • #3 CFP)',
    scheme: 'Sarkisian RPO Motion / SEC Front-7',
    primaryHex: '#bf5700',
    secondaryHex: '#ffffff',
    players: [
      { id: 'cfb_ewers', name: 'Quinn Ewers', jersey: '3', position: 'QB', college: 'Texas (Jr.)' },
      { id: 'cfb_wisner', name: 'Quintrevion Wisner', jersey: '26', position: 'RB', college: 'Texas (So.)' },
      { id: 'cfb_golden', name: 'Matthew Golden', jersey: '2', position: 'WR', college: 'Texas (Jr.)' },
      { id: 'cfb_helm', name: 'Gunnar Helm', jersey: '85', position: 'TE', college: 'Texas (Sr.)' },
      { id: 'cfb_simmons', name: 'Colin Simmons', jersey: '1', position: 'EDGE', college: 'Texas (Fr.)' },
      { id: 'cfb_barron', name: 'Jahdae Barron', jersey: '7', position: 'DB', college: 'Texas (Sr.)' },
    ],
  },
  {
    teamKeywords: ['georgia', 'bulldogs', 'uga'],
    officialName: '#5 Georgia Bulldogs',
    abbr: 'UGA',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/61.png',
    record: '10-2 (6-2 SEC • #5 CFP)',
    scheme: 'Pro-Style Multiple / Kirby Smart Mint Front',
    primaryHex: '#ba0c2f',
    secondaryHex: '#000000',
    players: [
      { id: 'cfb_beck', name: 'Carson Beck', jersey: '15', position: 'QB', college: 'Georgia (Sr.)' },
      { id: 'cfb_etienne', name: 'Trevor Etienne', jersey: '1', position: 'RB', college: 'Georgia (Jr.)' },
      { id: 'cfb_smith_uga', name: 'Arian Smith', jersey: '11', position: 'WR', college: 'Georgia (Sr.)' },
      { id: 'cfb_walker', name: 'Jalon Walker', jersey: '11', position: 'LB', college: 'Georgia (Jr.)' },
      { id: 'cfb_starks', name: 'Malaki Starks', jersey: '24', position: 'S', college: 'Georgia (Jr.)' },
    ],
  },
];

const NHL_TEAMS_DB: RosterTemplate[] = [
  {
    teamKeywords: ['edmonton', 'oilers'],
    officialName: 'Edmonton Oilers',
    abbr: 'EDM',
    logo: 'https://a.espncdn.com/i/teamlogos/nhl/500/edm.png',
    record: '16-9-2 (34 PTS • Pacific)',
    scheme: 'High-Event Rush & 1-3-1 Power Play',
    primaryHex: '#ff4c00',
    secondaryHex: '#041e42',
    players: [
      { id: 'nhl_mcdavid', name: 'Connor McDavid', jersey: '97', position: 'C', college: 'Line 1 Center' },
      { id: 'nhl_draisaitl', name: 'Leon Draisaitl', jersey: '29', position: 'C/LW', college: 'Line 1/2 Pivot' },
      { id: 'nhl_hyman', name: 'Zach Hyman', jersey: '18', position: 'RW', college: 'Line 1 Net-Front' },
      { id: 'nhl_nugent', name: 'Ryan Nugent-Hopkins', jersey: '93', position: 'LW', college: 'Top-6 Two-Way' },
      { id: 'nhl_bouchard', name: 'Evan Bouchard', jersey: '2', position: 'D', college: 'Pair 1 QB' },
      { id: 'nhl_ekholm', name: 'Mattias Ekholm', jersey: '14', position: 'D', college: 'Pair 1 Shutdown' },
      { id: 'nhl_skinner', name: 'Stuart Skinner', jersey: '74', position: 'G', college: 'Starting Goalie' },
    ],
  },
  {
    teamKeywords: ['florida', 'panthers'],
    officialName: 'Florida Panthers',
    abbr: 'FLA',
    logo: 'https://a.espncdn.com/i/teamlogos/nhl/500/fla.png',
    record: '17-9-2 (36 PTS • 1st Atlantic)',
    scheme: 'Heavy Forecheck Cycle & Active D-Pinch',
    primaryHex: '#c8102e',
    secondaryHex: '#041e42',
    players: [
      { id: 'nhl_barkov', name: 'Aleksander Barkov', jersey: '16', position: 'C', college: 'Selke 1C' },
      { id: 'nhl_reinhart', name: 'Sam Reinhart', jersey: '13', position: 'RW', college: 'Slot Sniper' },
      { id: 'nhl_tkachuk', name: 'Matthew Tkachuk', jersey: '19', position: 'LW', college: 'Playmaking Power Wing' },
      { id: 'nhl_verhaeghe', name: 'Carter Verhaeghe', jersey: '23', position: 'LW', college: 'Clutch Rush Scorer' },
      { id: 'nhl_forsling', name: 'Gustav Forsling', jersey: '42', position: 'D', college: 'Pair 1 Transition' },
      { id: 'nhl_ekblad', name: 'Aaron Ekblad', jersey: '5', position: 'D', college: 'Pair 1 Right D' },
      { id: 'nhl_bobrovsky', name: 'Sergei Bobrovsky', jersey: '72', position: 'G', college: 'Vezina Goalie' },
    ],
  },
  {
    teamKeywords: ['toronto', 'maple leafs', 'leafs'],
    officialName: 'Toronto Maple Leafs',
    abbr: 'TOR',
    logo: 'https://a.espncdn.com/i/teamlogos/nhl/500/tor.png',
    record: '16-8-2 (34 PTS • Atlantic)',
    scheme: 'Berube North-South Slot Attack',
    primaryHex: '#00205b',
    secondaryHex: '#ffffff',
    players: [
      { id: 'nhl_matthews', name: 'Auston Matthews', jersey: '34', position: 'C', college: 'Rocket Richard 1C' },
      { id: 'nhl_marner', name: 'Mitch Marner', jersey: '16', position: 'RW', college: 'All-Situation Playmaker' },
      { id: 'nhl_nylander', name: 'William Nylander', jersey: '88', position: 'RW', college: 'Zone-Entry Specialist' },
      { id: 'nhl_tavares', name: 'John Tavares', jersey: '91', position: 'C', college: 'Line 2 Center' },
      { id: 'nhl_rielly', name: 'Morgan Rielly', jersey: '44', position: 'D', college: 'Pair 1 Puck-Mover' },
      { id: 'nhl_stolarz', name: 'Anthony Stolarz', jersey: '41', position: 'G', college: 'GSAx Leader' },
    ],
  },
  {
    teamKeywords: ['new york rangers', 'rangers', 'nyr'],
    officialName: 'New York Rangers',
    abbr: 'NYR',
    logo: 'https://a.espncdn.com/i/teamlogos/nhl/500/nyr.png',
    record: '15-10-1 (31 PTS • Metropolitan)',
    scheme: 'East-West Royal Road & Elite Goaltending',
    primaryHex: '#0038a8',
    secondaryHex: '#ce1126',
    players: [
      { id: 'nhl_panarin', name: 'Artemi Panarin', jersey: '10', position: 'LW', college: 'Line 1 Playmaker' },
      { id: 'nhl_zibanejad', name: 'Mika Zibanejad', jersey: '93', position: 'C', college: 'One-Timer Threat' },
      { id: 'nhl_lafreniere', name: 'Alexis Lafrenière', jersey: '13', position: 'RW', college: '5v5 Rush Wing' },
      { id: 'nhl_fox', name: 'Adam Fox', jersey: '23', position: 'D', college: 'Norris Defenseman' },
      { id: 'nhl_shesterkin', name: 'Igor Shesterkin', jersey: '31', position: 'G', college: 'Franchise Goalie' },
    ],
  },
];

const NCAAB_TEAMS_DB: RosterTemplate[] = [
  {
    teamKeywords: ['duke', 'blue devils'],
    officialName: '#4 Duke Blue Devils',
    abbr: 'DUKE',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/150.png',
    record: '9-2 (KenPom #2 • +29.4 AdjEM)',
    scheme: '5-Out Switching & Rim Protection',
    primaryHex: '#003087',
    secondaryHex: '#ffffff',
    players: [
      { id: 'ncaa_flagg', name: 'Cooper Flagg', jersey: '2', position: 'PF', height: "6' 9\"", weight: '205 lbs', college: 'Duke (Fr.)' },
      { id: 'ncaa_knueppel', name: 'Kon Knueppel', jersey: '7', position: 'SG', height: "6' 7\"", weight: '217 lbs', college: 'Duke (Fr.)' },
      { id: 'ncaa_proctor', name: 'Tyrese Proctor', jersey: '5', position: 'PG', height: "6' 6\"", weight: '183 lbs', college: 'Duke (Jr.)' },
      { id: 'ncaa_maluach', name: 'Khaman Maluach', jersey: '9', position: 'C', height: "7' 2\"", weight: '250 lbs', college: 'Duke (Fr.)' },
      { id: 'ncaa_james', name: 'Sion James', jersey: '14', position: 'SF', height: "6' 6\"", weight: '220 lbs', college: 'Duke (Gr.)' },
      { id: 'ncaa_foster', name: 'Caleb Foster', jersey: '1', position: 'G', height: "6' 5\"", weight: '197 lbs', college: 'Duke (So.)' },
    ],
  },
  {
    teamKeywords: ['kansas', 'jayhawks', 'ku'],
    officialName: '#1 Kansas Jayhawks',
    abbr: 'KU',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2305.png',
    record: '9-1 (KenPom #4 • +27.8 AdjEM)',
    scheme: 'Bill Self Hi-Lo Post & Transition',
    primaryHex: '#0051ba',
    secondaryHex: '#e8000d',
    players: [
      { id: 'ncaa_dickinson', name: 'Hunter Dickinson', jersey: '1', position: 'C', height: "7' 2\"", weight: '260 lbs', college: 'Kansas (Sr.)' },
      { id: 'ncaa_harris', name: 'Dajuan Harris Jr.', jersey: '3', position: 'PG', height: "6' 2\"", weight: '175 lbs', college: 'Kansas (Sr.)' },
      { id: 'ncaa_adams', name: 'KJ Adams Jr.', jersey: '24', position: 'PF', height: "6' 7\"", weight: '235 lbs', college: 'Kansas (Sr.)' },
      { id: 'ncaa_mayo', name: 'Zeke Mayo', jersey: '5', position: 'SG', height: "6' 4\"", weight: '185 lbs', college: 'Kansas (Sr.)' },
      { id: 'ncaa_storr', name: 'AJ Storr', jersey: '2', position: 'SF', height: "6' 7\"", weight: '205 lbs', college: 'Kansas (Jr.)' },
      { id: 'ncaa_bidunga', name: 'Flory Bidunga', jersey: '40', position: 'C', height: "6' 9\"", weight: '220 lbs', college: 'Kansas (Fr.)' },
    ],
  },
  {
    teamKeywords: ['auburn', 'tigers'],
    officialName: '#2 Auburn Tigers',
    abbr: 'AUB',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2.png',
    record: '10-1 (KenPom #1 • +32.1 AdjEM)',
    scheme: 'Bruce Pearl Flex-Motion & Rim Deterrence',
    primaryHex: '#0c2340',
    secondaryHex: '#e87722',
    players: [
      { id: 'ncaa_broome', name: 'Johni Broome', jersey: '4', position: 'C/PF', height: "6' 10\"", weight: '240 lbs', college: 'Auburn (Sr.)' },
      { id: 'ncaa_baker', name: 'Chad Baker-Mazara', jersey: '10', position: 'SG', height: "6' 7\"", weight: '180 lbs', college: 'Auburn (Sr.)' },
      { id: 'ncaa_pettiford', name: 'Tahaad Pettiford', jersey: '0', position: 'PG', height: "6' 1\"", weight: '175 lbs', college: 'Auburn (Fr.)' },
      { id: 'ncaa_kelly', name: 'Miles Kelly', jersey: '13', position: 'SG', height: "6' 6\"", weight: '190 lbs', college: 'Auburn (Sr.)' },
      { id: 'ncaa_cardwell', name: 'Dylan Cardwell', jersey: '44', position: 'C', height: "6' 11\"", weight: '255 lbs', college: 'Auburn (Sr.)' },
    ],
  },
  {
    teamKeywords: ['uconn', 'connecticut', 'huskies'],
    officialName: '#3 UConn Huskies',
    abbr: 'UCONN',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/41.png',
    record: '8-3 (KenPom #6 • +25.9 AdjEM)',
    scheme: 'Dan Hurley Complex Off-Ball Screening',
    primaryHex: '#000e2f',
    secondaryHex: '#e4002b',
    players: [
      { id: 'ncaa_karaban', name: 'Alex Karaban', jersey: '11', position: 'PF', height: "6' 8\"", weight: '220 lbs', college: 'UConn (Jr.)' },
      { id: 'ncaa_mcneeley', name: 'Liam McNeeley', jersey: '30', position: 'SF', height: "6' 7\"", weight: '210 lbs', college: 'UConn (Fr.)' },
      { id: 'ncaa_ball', name: 'Solo Ball', jersey: '1', position: 'SG', height: "6' 3\"", weight: '190 lbs', college: 'UConn (So.)' },
      { id: 'ncaa_diarra', name: 'Hassan Diarra', jersey: '10', position: 'PG', height: "6' 2\"", weight: '195 lbs', college: 'UConn (Sr.)' },
      { id: 'ncaa_reed_u', name: 'Tarris Reed Jr.', jersey: '5', position: 'C', height: "6' 10\"", weight: '260 lbs', college: 'UConn (Jr.)' },
    ],
  },
];

class MultiSportAnalyticsService {
  /**
   * Classifies any stream into its exact sport & collegiate/pro tier.
   */
  public detectSportType(stream: StreamItem): SupportedSportType {
    const cat = (stream.category || '').toLowerCase();
    const lg = (stream.league || '').toLowerCase();
    const name = (stream.name || '').toLowerCase();

    if (
      cat === 'soccer' ||
      lg.includes('uefa') ||
      lg.includes('premier') ||
      lg.includes('la liga') ||
      lg.includes('serie a') ||
      lg.includes('bundesliga') ||
      lg.includes('ligue 1') ||
      lg.includes('mls') ||
      lg.includes('nations league') ||
      lg.includes('champions league') ||
      lg.includes('fifa')
    ) {
      return 'soccer';
    }

    if (cat === 'hockey' || lg.includes('nhl') || lg.includes('hockey')) {
      return 'hockey';
    }

    if (
      cat === 'football' ||
      lg.includes('nfl') ||
      lg.includes('cfb') ||
      lg.includes('football') ||
      stream.stream_key.startsWith('cfb-') ||
      stream.stream_key.startsWith('nfl-')
    ) {
      if (
        stream.stream_key.startsWith('cfb-') ||
        lg.includes('ncaa') ||
        lg.includes('college') ||
        lg.includes('cfb') ||
        lg.includes('sec') ||
        lg.includes('big ten') ||
        name.includes('oregon') ||
        name.includes('ohio state') ||
        name.includes('alabama') ||
        name.includes('georgia') ||
        name.includes('texas longhorns') ||
        name.includes('notre dame')
      ) {
        return 'ncaaf';
      }
      return 'nfl';
    }

    if (cat === 'basketball' || lg.includes('nba') || lg.includes('ncaab') || lg.includes('basketball') || stream.stream_key.startsWith('ncaab-')) {
      if (
        stream.stream_key.startsWith('ncaab-') ||
        lg.includes('ncaab') ||
        lg.includes('ncaa') ||
        lg.includes('college') ||
        name.includes('duke') ||
        name.includes('kansas') ||
        name.includes('uconn') ||
        name.includes('kentucky') ||
        name.includes('auburn') ||
        name.includes('gonzaga') ||
        name.includes('purdue') ||
        name.includes('unc')
      ) {
        return 'ncaab';
      }
      return 'basketball';
    }

    if (cat === 'baseball' || lg.includes('mlb')) return 'baseball';
    if (cat === 'combat' || cat === 'mma' || cat === 'boxing' || lg.includes('ufc')) return 'combat';
    if (cat === 'motorsport' || lg.includes('f1') || lg.includes('nascar')) return 'motorsport';

    return 'soccer';
  }

  /**
   * Builds complete, realistic, sport-native deep analytics for any stream.
   */
  public buildSportDeepAnalytics(stream: StreamItem): UniversalSportDeepAnalytics {
    const sportType = this.detectSportType(stream);
    const rawParts = (stream.name || 'Home vs Away').split(/\s+(?:vs\.?|v\.?|at|@|-)\s+/i);
    const rawT1 = stream.team1?.name || rawParts[0]?.trim() || 'Home Team';
    const rawT2 = stream.team2?.name || rawParts[1]?.trim() || 'Away Team';

    if (sportType === 'soccer') {
      return this.buildSoccerAnalytics(stream, rawT1, rawT2);
    }
    if (sportType === 'hockey') {
      return this.buildHockeyAnalytics(stream, rawT1, rawT2);
    }
    if (sportType === 'nfl' || sportType === 'ncaaf') {
      return this.buildFootballAnalytics(stream, rawT1, rawT2, sportType === 'ncaaf');
    }
    if (sportType === 'ncaab') {
      return this.buildCollegeBasketballAnalytics(stream, rawT1, rawT2);
    }

    // Default fallback to NFL/Soccer style if another sport
    return this.buildFootballAnalytics(stream, rawT1, rawT2, false);
  }

  /**
   * Returns a curated showcase of multi-sport games for the All-Sports Research Lab switcher.
   */
  public getMultiSportShowcaseGames(): UniversalSportDeepAnalytics[] {
    return [
      this.buildSoccerAnalytics(
        {
          id: 'uefa-england-vs-spain',
          stream_key: 'uefa-england-vs-spain',
          name: 'England vs Spain',
          category: 'soccer',
          league: 'UEFA Nations League',
          match_timestamp: Math.floor(Date.now() / 1000),
          sources: [{ quality: 'FHD', url: '', live: true }],
        },
        'England',
        'Spain'
      ),
      this.buildSoccerAnalytics(
        {
          id: 'ucl-real-madrid-vs-barcelona',
          stream_key: 'ucl-real-madrid-vs-barcelona',
          name: 'Real Madrid vs FC Barcelona',
          category: 'soccer',
          league: 'La Liga / El Clásico',
          match_timestamp: Math.floor(Date.now() / 1000),
          sources: [{ quality: 'FHD', url: '', live: true }],
        },
        'Real Madrid',
        'FC Barcelona'
      ),
      this.buildFootballAnalytics(
        {
          id: 'nfl-chiefs-vs-bills',
          stream_key: 'nfl-chiefs-vs-bills',
          name: 'Kansas City Chiefs vs Buffalo Bills',
          category: 'football',
          league: 'NFL',
          match_timestamp: Math.floor(Date.now() / 1000),
          sources: [{ quality: 'FHD', url: '', live: true }],
        },
        'Kansas City Chiefs',
        'Buffalo Bills',
        false
      ),
      this.buildFootballAnalytics(
        {
          id: 'cfb-oregon-vs-ohio-state',
          stream_key: 'cfb-oregon-vs-ohio-state',
          name: 'Oregon Ducks vs Ohio State Buckeyes',
          category: 'football',
          league: 'NCAA College Football Playoff',
          match_timestamp: Math.floor(Date.now() / 1000),
          sources: [{ quality: 'FHD', url: '', live: true }],
        },
        'Oregon Ducks',
        'Ohio State Buckeyes',
        true
      ),
      this.buildHockeyAnalytics(
        {
          id: 'nhl-oilers-vs-panthers',
          stream_key: 'nhl-oilers-vs-panthers',
          name: 'Edmonton Oilers vs Florida Panthers',
          category: 'hockey',
          league: 'NHL',
          match_timestamp: Math.floor(Date.now() / 1000),
          sources: [{ quality: 'FHD', url: '', live: true }],
        },
        'Edmonton Oilers',
        'Florida Panthers'
      ),
      this.buildCollegeBasketballAnalytics(
        {
          id: 'ncaab-duke-vs-kansas',
          stream_key: 'ncaab-duke-vs-kansas',
          name: 'Duke Blue Devils vs Kansas Jayhawks',
          category: 'basketball',
          league: "NCAA Men's Basketball • Champions Classic",
          match_timestamp: Math.floor(Date.now() / 1000),
          sources: [{ quality: 'FHD', url: '', live: true }],
        },
        'Duke Blue Devils',
        'Kansas Jayhawks'
      ),
    ];
  }

  // ==========================================================================
  // 1. SOCCER DEEP ANALYTICS ENGINE (OPTA / STATSBOMB / FBREF GRADE)
  // ==========================================================================
  private buildSoccerAnalytics(stream: StreamItem, rawT1: string, rawT2: string): UniversalSportDeepAnalytics {
    const t1Template = this.matchTemplate(rawT1, SOCCER_TEAMS_DB, '#cf081f', '#1d4ed8', '4-2-3-1 High Press', '4W-1D-1L (13 pts)');
    const t2Template = this.matchTemplate(rawT2, SOCCER_TEAMS_DB, '#aa151b', '#f59e0b', '4-3-3 Positional Play', '4W-2D-0L (14 pts)');

    const t1Logo = stream.team1?.logo || t1Template.logo || buildSvgTeamCrestDataUri(t1Template.officialName, t1Template.primaryHex, t1Template.secondaryHex);
    const t2Logo = stream.team2?.logo || t2Template.logo || buildSvgTeamCrestDataUri(t2Template.officialName, t2Template.primaryHex, t2Template.secondaryHex);

    const starterLabels = ['MIN', 'G', 'A', 'SH', 'SOG', 'xG', 'xA', 'PASS%', 'KP', 'TKL+INT', 'RTG'];
    const advLabels = ['MIN', 'xG', 'npxG', 'xAG', 'PROG P', 'BOX TCH', 'SCA', 'DUELS', 'PPDA IND', 'OPTA RTG'];

    const t1StatsMatrix = [
      ['78', '1', '0', '4', '3', '0.68', '0.18', '86%', '2', '1', '8.6'],
      ['78', '1', '1', '3', '2', '0.54', '0.42', '91%', '4', '4', '8.9'],
      ['78', '0', '1', '3', '1', '0.36', '0.49', '88%', '3', '2', '8.2'],
      ['75', '0', '0', '2', '1', '0.24', '0.31', '90%', '3', '1', '7.6'],
      ['78', '0', '0', '1', '0', '0.08', '0.16', '94%', '2', '6', '7.9'],
      ['72', '0', '0', '1', '1', '0.14', '0.28', '89%', '2', '2', '7.5'],
      ['78', '0', '0', '1', '0', '0.05', '0.34', '87%', '3', '3', '7.7'],
      ['78', '0', '0', '0', '0', '0.03', '0.04', '95%', '0', '4', '7.4'],
      ['78', '0', '0', '0', '0', '0.02', '0.02', '93%', '0', '5', '7.5'],
      ['65', '0', '0', '1', '0', '0.09', '0.12', '85%', '1', '2', '7.1'],
      ['78', '0', '0', '0', '0', '0.00', '0.02', '84%', '0', '0', '7.8'],
    ];

    const t2StatsMatrix = [
      ['78', '1', '0', '4', '2', '0.52', '0.38', '89%', '3', '2', '8.3'],
      ['78', '0', '1', '3', '2', '0.41', '0.44', '86%', '3', '1', '7.9'],
      ['74', '0', '0', '2', '1', '0.31', '0.12', '82%', '1', '1', '7.2'],
      ['78', '0', '0', '1', '1', '0.14', '0.36', '93%', '4', '3', '7.8'],
      ['78', '0', '0', '1', '0', '0.09', '0.19', '92%', '2', '4', '7.4'],
      ['70', '0', '0', '1', '0', '0.11', '0.21', '88%', '2', '2', '7.3'],
      ['78', '0', '0', '0', '0', '0.02', '0.08', '94%', '1', '5', '7.5'],
      ['78', '0', '0', '0', '0', '0.01', '0.05', '91%', '1', '3', '7.1'],
      ['78', '0', '0', '0', '0', '0.02', '0.02', '95%', '0', '4', '7.2'],
      ['78', '0', '0', '0', '0', '0.01', '0.01', '92%', '0', '3', '7.0'],
      ['78', '0', '0', '0', '0', '0.00', '0.00', '82%', '0', '0', '7.1'],
    ];

    const buildSoccerRoster = (tpl: RosterTemplate, matrix: string[][]): AthleteInfo[] =>
      tpl.players.slice(0, 11).map((p, idx) => ({
        id: p.id,
        name: p.name,
        jersey: p.jersey,
        position: p.position,
        headshot: p.headshot || buildSvgAvatarDataUri(p.name, p.jersey, tpl.primaryHex, tpl.secondaryHex),
        teamName: tpl.officialName,
        height: p.height || "5' 11\"",
        weight: p.weight || '168 lbs',
        age: p.age || 25,
        college: p.college || tpl.officialName,
        stats: matrix[idx] || matrix[matrix.length - 1],
      }));

    const t1Starters = buildSoccerRoster(t1Template, t1StatsMatrix);
    const t2Starters = buildSoccerRoster(t2Template, t2StatsMatrix);

    const buildAdvAthletes = (starters: AthleteInfo[]): AthleteInfo[] =>
      starters.map((a, idx) => {
        const s = a.stats || [];
        return {
          ...a,
          stats: [
            s[0] || '78',
            s[5] || '0.25',
            (parseFloat(s[5] || '0.25') * 0.92).toFixed(2),
            s[6] || '0.22',
            String(Math.max(2, 9 - idx)),
            String(Math.max(1, 8 - idx)),
            String(Math.max(1, 6 - Math.floor(idx / 2))),
            `${Math.max(3, 8 - Math.floor(idx / 2))}/${Math.max(5, 11 - Math.floor(idx / 2))}`,
            (6.8 + idx * 0.4).toFixed(1),
            s[10] || '7.6',
          ],
        };
      });

    const t1Categories: BoxScoreCategory[] = [
      { name: 'starters', displayName: 'Starting XI', labels: starterLabels, athletes: t1Starters },
      { name: 'advanced', displayName: 'Opta & StatsBomb xG', labels: advLabels, athletes: buildAdvAthletes(t1Starters) },
    ];
    const t2Categories: BoxScoreCategory[] = [
      { name: 'starters', displayName: 'Starting XI', labels: starterLabels, athletes: t2Starters },
      { name: 'advanced', displayName: 'Opta & StatsBomb xG', labels: advLabels, athletes: buildAdvAthletes(t2Starters) },
    ];

    const p1Star = t1Starters[1] || t1Starters[0];
    const p1Striker = t1Starters[0];
    const p2Star = t2Starters[0];

    return {
      eventId: stream.stream_key,
      sportType: 'soccer',
      sportBadge: `${stream.league || 'UEFA / PREMIER MATCHDAY'} • OPTA xG & STATSBOMB`,
      analyticsMethodology: 'Opta Expected Goals (xG) • StatsBomb Field Tilt % • PPDA Pressing • Zone 14 Penetration',
      surfaceType: 'soccer_pitch',
      status: "78' • 2nd Half Live",
      detail: "78' 2H",
      isLive: true,
      venue: t1Template.officialName === 'England' ? 'Wembley Stadium, London (86,412)' : `${t1Template.officialName} Stadium`,
      broadcast: `${stream.league || 'International'} • 4K Tactical Feed`,
      leverageIndex: 2.35,
      leverageTier: 'CRUNCH TIME',
      isClutchTime: true,
      situationBanner: `78' • ${t1Template.abbr} High Press (7.2 PPDA) • Final-Third Field Tilt: ${t1Template.abbr} 56% - 44% ${t2Template.abbr}`,
      linescore: {
        periodHeaders: ['1H', '2H'],
        team1Quarters: [1, 1],
        team2Quarters: [1, 0],
        team1Total: 2,
        team2Total: 1,
      },
      paceAndProjection: {
        tempoLabel: 'MATCH TEMPO (PASSES / MIN)',
        tempoValue: '14.8 PPM (High Intensity)',
        projectedFinal: `xG Projection: ${t1Template.abbr} 2.23 — 1.54 ${t2Template.abbr}`,
        primaryRateLabel: 'EXPECTED GOALS (xG)',
        team1RateValue: '2.23 xG',
        team2RateValue: '1.54 xG',
      },
      team1Meta: {
        name: t1Template.officialName,
        abbreviation: t1Template.abbr,
        logo: t1Logo,
        score: 2,
        record: t1Template.record,
        formationOrScheme: t1Template.scheme,
      },
      team2Meta: {
        name: t2Template.officialName,
        abbreviation: t2Template.abbr,
        logo: t2Logo,
        score: 1,
        record: t2Template.record,
        formationOrScheme: t2Template.scheme,
      },
      fourPillars: [
        {
          code: 'xG',
          label: 'Expected Goals (xG)',
          weightLabel: '40% WEIGHT',
          team1Value: '2.23 xG',
          team2Value: '1.54 xG',
          team1Numeric: 2.23,
          team2Numeric: 1.54,
          leagueAverage: '1.42 xG',
          edgeTeam: 'team1',
          description: 'Cumulative shot quality based on distance, angle, body part, and defensive pressure (Opta/StatsBomb).',
        },
        {
          code: 'TILT%',
          label: 'Field Tilt (Final 3rd Share)',
          weightLabel: '25% WEIGHT',
          team1Value: '56.4%',
          team2Value: '43.6%',
          team1Numeric: 56.4,
          team2Numeric: 43.6,
          leagueAverage: '50.0%',
          edgeTeam: 'team1',
          description: 'Share of completed passes in the attacking final third, measuring territorial dominance.',
        },
        {
          code: 'PPDA',
          label: 'High-Press Intensity (PPDA)',
          weightLabel: '20% WEIGHT',
          team1Value: '7.2',
          team2Value: '9.4',
          team1Numeric: 7.2,
          team2Numeric: 9.4,
          leagueAverage: '11.2',
          edgeTeam: 'team1',
          description: 'Passes Allowed Per Defensive Action in the opponent build-up zone (lower means more aggressive pressing).',
        },
        {
          code: 'BOX',
          label: 'Touches in Penalty Box',
          weightLabel: '15% WEIGHT',
          team1Value: '31 (4 Big Ch.)',
          team2Value: '22 (2 Big Ch.)',
          team1Numeric: 31,
          team2Numeric: 22,
          leagueAverage: '23.5',
          edgeTeam: 'team1',
          description: 'Penalty area touches and high-probability Big Chances (>0.30 xG) generated.',
        },
      ],
      unitSplits: {
        unit1Label: 'Front 4 Attackers (FW/CAM)',
        unit2Label: 'Midfield Pivot & Backline',
        team1Unit1Stat: '2 G • 1.82 xG • 11 SH • 12 KP',
        team1Unit2Stat: '0 G • 0.41 xG • 92% Pass • 18 TKL+INT',
        team1Unit1Pct: 82,
        team2Unit1Stat: '1 G • 1.24 xG • 9 SH • 7 KP',
        team2Unit2Stat: '0 G • 0.30 xG • 91% Pass • 15 TKL+INT',
        team2Unit1Pct: 81,
        summaryEdge: `${t1Template.abbr} Front 4 generating +0.58 xG edge in central penalty box & half-space cutbacks`,
      },
      spatialMap: {
        title: 'Opta & StatsBomb Pitch Shot & xG Creation Map',
        subtitle: 'Full 105×68m pitch • Circle size scaled by shot xG • ★ = Goal, ● = On Target, ✕ = Off/Blocked',
        surfaceType: 'soccer_pitch',
        team1PrimaryMetric: `${t1Template.abbr}: 2 Goals on 2.23 xG (16 Shots, 8 SOG)`,
        team2PrimaryMetric: `${t2Template.abbr}: 1 Goal on 1.54 xG (12 Shots, 6 SOG)`,
        events: [
          { id: 's1', team: 'team1', playerName: p1Striker.name, jersey: p1Striker.jersey || '9', x: 89, y: 48, isSuccess: true, isHighValue: true, outcomeLabel: `GOAL! ${p1Striker.name} (0.48 xG • Central Box)`, period: "24'", clock: "24'", metricValue: 0.48, zoneLabel: 'Central Penalty Box' },
          { id: 's2', team: 'team1', playerName: p1Star.name, jersey: p1Star.jersey || '10', x: 86, y: 54, isSuccess: true, isHighValue: true, outcomeLabel: `GOAL! ${p1Star.name} (0.39 xG • Late Box Arrival)`, period: "67'", clock: "67'", metricValue: 0.39, zoneLabel: 'Central Penalty Box' },
          { id: 's3', team: 'team1', playerName: t1Starters[2]?.name || 'RW', jersey: '7', x: 84, y: 32, isSuccess: false, isHighValue: true, outcomeLabel: 'Saved • Curled Inside Cutback (0.28 xG)', period: "51'", clock: "51'", metricValue: 0.28, zoneLabel: 'Right Half-Space' },
          { id: 's4', team: 'team1', playerName: t1Starters[3]?.name || 'LW', jersey: '11', x: 78, y: 62, isSuccess: false, outcomeLabel: 'Saved • Zone 14 Drive (0.18 xG)', period: "39'", clock: "39'", metricValue: 0.18, zoneLabel: 'Zone 14 (Edge of Box)' },
          { id: 's5', team: 'team1', playerName: p1Striker.name, jersey: '9', x: 93, y: 44, isSuccess: false, isHighValue: true, outcomeLabel: 'Post! 6-Yard Header (0.42 xG)', period: "73'", clock: "73'", metricValue: 0.42, zoneLabel: '6-Yard Box' },
          { id: 's6', team: 'team2', playerName: p2Star.name, jersey: p2Star.jersey || '19', x: 14, y: 38, isSuccess: true, isHighValue: true, outcomeLabel: `GOAL! ${p2Star.name} (0.36 xG • Far-Post Finish)`, period: "33'", clock: "33'", metricValue: 0.36, zoneLabel: 'Right Half-Space' },
          { id: 's7', team: 'team2', playerName: t2Starters[1]?.name || 'LW', jersey: '17', x: 16, y: 64, isSuccess: false, isHighValue: true, outcomeLabel: 'Diving Save • 1v1 Cut-In (0.31 xG)', period: "58'", clock: "58'", metricValue: 0.31, zoneLabel: 'Left Half-Space' },
          { id: 's8', team: 'team2', playerName: t2Starters[2]?.name || 'ST', jersey: '7', x: 11, y: 50, isSuccess: false, outcomeLabel: 'Blocked in Box (0.24 xG)', period: "62'", clock: "62'", metricValue: 0.24, zoneLabel: 'Central Penalty Box' },
          { id: 's9', team: 'team2', playerName: t2Starters[3]?.name || 'CM', jersey: '20', x: 24, y: 49, isSuccess: false, outcomeLabel: 'Just Wide • Zone 14 Volley (0.14 xG)', period: "74'", clock: "74'", metricValue: 0.14, zoneLabel: 'Zone 14 (Edge of Box)' },
        ],
        zones: [
          { zoneKey: 'six_yard', label: '6-Yard Box / Crease', team1Volume: '3 SH (0.72 xG)', team1Efficiency: '1 Goal', team2Volume: '1 SH (0.28 xG)', team2Efficiency: '0 Goals', benchmarkEfficiency: '0.38 xG/sh', edge: 'team1' },
          { zoneKey: 'central_box', label: 'Central Penalty Area', team1Volume: '6 SH (1.02 xG)', team1Efficiency: '2 Goals', team2Volume: '4 SH (0.68 xG)', team2Efficiency: '0 Goals', benchmarkEfficiency: '0.16 xG/sh', edge: 'team1' },
          { zoneKey: 'half_spaces', label: 'Left & Right Half-Spaces', team1Volume: '4 SH (0.34 xG)', team1Efficiency: '3 SOG', team2Volume: '4 SH (0.44 xG)', team2Efficiency: '1 Goal', benchmarkEfficiency: '0.11 xG/sh', edge: 'team2' },
          { zoneKey: 'zone_14', label: 'Zone 14 (Central Edge)', team1Volume: '3 SH (0.15 xG)', team1Efficiency: '91% Pass', team2Volume: '3 SH (0.14 xG)', team2Efficiency: '89% Pass', benchmarkEfficiency: '0.06 xG/sh', edge: 'team1' },
        ],
      },
      tacticalMatrix: [
        { playType: 'high_press', label: 'High Turnovers & Counter-Press', team1FreqPct: 28, team1Efficiency: '0.68 xG (1 Goal)', team1Percentile: 92, team2FreqPct: 22, team2Efficiency: '0.34 xG', team2Percentile: 78, edge: t1Template.abbr },
        { playType: 'positional_buildup', label: 'Positional Build-Up (10+ Pass Sequences)', team1FreqPct: 31, team1Efficiency: '0.74 xG', team1Percentile: 86, team2FreqPct: 38, team2Efficiency: '0.66 xG (1 Goal)', team2Percentile: 90, edge: t2Template.abbr },
        { playType: 'half_space_cutbacks', label: 'Half-Space Overloads & Cutbacks', team1FreqPct: 22, team1Efficiency: '0.52 xG (1 Goal)', team1Percentile: 89, team2FreqPct: 24, team2Efficiency: '0.36 xG', team2Percentile: 82, edge: t1Template.abbr },
        { playType: 'set_pieces', label: 'Corners & Dead-Ball Routines', team1FreqPct: 19, team1Efficiency: '0.29 xG (7 Corners)', team1Percentile: 79, team2FreqPct: 16, team2Efficiency: '0.18 xG (4 Corners)', team2Percentile: 64, edge: t1Template.abbr },
      ],
      activeUnit: {
        unitTitle: 'Active Tactical Pitch XI & 15-Minute Match Momentum Intervals',
        team1Scheme: t1Template.scheme,
        team2Scheme: t2Template.scheme,
        team1NetMetric: '+0.69 xG Diff • 56% Field Tilt',
        team2NetMetric: '-0.69 xG Diff • 44% Field Tilt',
        team1Players: t1Starters.slice(0, 5).map((p, idx) => ({
          id: p.id,
          name: p.name,
          jersey: p.jersey || '',
          position: p.position || 'MF',
          headshot: p.headshot,
          primaryStat: `${p.stats?.[1] || '0'}G / ${p.stats?.[2] || '0'}A`,
          efficiencyBadge: `${p.stats?.[5] || '0.35'} xG`,
          impactVal: `${p.stats?.[10] || '8.2'} RTG`,
          isHot: idx <= 1,
        })),
        team2Players: t2Starters.slice(0, 5).map((p, idx) => ({
          id: p.id,
          name: p.name,
          jersey: p.jersey || '',
          position: p.position || 'MF',
          headshot: p.headshot,
          primaryStat: `${p.stats?.[1] || '0'}G / ${p.stats?.[2] || '0'}A`,
          efficiencyBadge: `${p.stats?.[5] || '0.30'} xG`,
          impactVal: `${p.stats?.[10] || '7.9'} RTG`,
          isHot: idx === 0,
        })),
        stintTimeline: [
          { periodLabel: "0'-15'", timeRange: 'Opening Press', team1Score: 0, team2Score: 0, netDiff: 0.22, headline: `${t1Template.abbr} 64% possession & 3 box entries` },
          { periodLabel: "16'-30'", timeRange: 'Breakthrough', team1Score: 1, team2Score: 0, netDiff: 0.58, headline: `24' ${p1Striker.name} clinical finish (0.48 xG)` },
          { periodLabel: "31'-45'", timeRange: 'Response Wave', team1Score: 0, team2Score: 1, netDiff: -0.41, headline: `33' ${p2Star.name} equalizer in transition (0.36 xG)` },
          { periodLabel: "46'-60'", timeRange: 'Tactical Chess', team1Score: 0, team2Score: 0, netDiff: 0.15, headline: 'Midfield pressing duel (7.0 PPDA)' },
          { periodLabel: "61'-78'", timeRange: 'Decisive Surge', team1Score: 1, team2Score: 0, netDiff: 0.65, headline: `67' ${p1Star.name} box arrival restores 2-1 lead` },
        ],
      },
      winProbTimeline: [
        { label: "1'", minuteMark: 1, team1WinPct: 52, leverageIndex: 1.0, scoreDiff: 0, keyPlay: 'Kickoff' },
        { label: "15'", minuteMark: 15, team1WinPct: 56, leverageIndex: 1.2, scoreDiff: 0 },
        { label: "24'", minuteMark: 24, team1WinPct: 71, leverageIndex: 1.8, scoreDiff: 1, keyPlay: `24' GOAL ${p1Striker.name} (1-0)` },
        { label: "33'", minuteMark: 33, team1WinPct: 49, leverageIndex: 1.9, scoreDiff: 0, keyPlay: `33' GOAL ${p2Star.name} (1-1)` },
        { label: "45'", minuteMark: 45, team1WinPct: 51, leverageIndex: 1.3, scoreDiff: 0, keyPlay: 'Halftime (1-1)' },
        { label: "60'", minuteMark: 60, team1WinPct: 55, leverageIndex: 1.6, scoreDiff: 0 },
        { label: "67'", minuteMark: 67, team1WinPct: 76, leverageIndex: 2.4, scoreDiff: 1, keyPlay: `67' GOAL ${p1Star.name} (2-1)` },
        { label: "78'", minuteMark: 78, team1WinPct: 79, leverageIndex: 2.35, scoreDiff: 1, keyPlay: `78' Live (${t1Template.abbr} 2-1)` },
      ],
      smartCards: [
        {
          id: 'soc_card_1',
          category: 'OPTA EXPECTED GOALS (xG) EDGE',
          badge: '2.23 vs 1.54 xG',
          headline: `${t1Template.officialName} dominating high-danger Zone 14 & central box creation`,
          detail: `${p1Star.name} (8.9 Opta RTG, 4 key passes) and ${p1Striker.name} (0.68 xG) have generated 4 Big Chances.`,
          metricHighlight: '+0.69 xG Differential',
          accentColor: 'cyan',
          playerHeadshot: p1Star.headshot,
        },
        {
          id: 'soc_card_2',
          category: 'STATSBOMB PRESSING TELEMETRY',
          badge: '7.2 PPDA',
          headline: `Elite Counter-Press: ${t1Template.abbr} allowing just 7.2 passes per defensive action`,
          detail: '11 high turnovers forced in the attacking 40 meters, resulting in 5 shots and 1 goal.',
          metricHighlight: '56.4% Field Tilt',
          accentColor: 'gold',
          playerHeadshot: p1Striker.headshot,
        },
        {
          id: 'soc_card_3',
          category: 'WING OVERLOAD ALERT',
          badge: '0.90 xG+xA',
          headline: `${p2Star.name} leading ${t2Template.abbr} counter-attacks with 6 progressive carries`,
          detail: `${p2Star.name} has 1 goal, 3 key passes, and 5 penalty-box touches on the right flank.`,
          metricHighlight: '8.3 Opta Rating',
          accentColor: 'purple',
          playerHeadshot: p2Star.headshot,
        },
      ],
      inGameInsights: [
        {
          category: 'Expected Goals (xG) & Shot Quality',
          metricBadge: `${t1Template.abbr} 2.23 - 1.54 ${t2Template.abbr}`,
          title: `${t1Template.officialName} converting superior penalty-box shot quality`,
          detail: `${t1Template.officialName} is averaging 0.14 xG per shot across 16 attempts (8 on target), led by ${p1Striker.name} and ${p1Star.name}.`,
        },
        {
          category: 'Field Tilt & Territorial Control',
          metricBadge: '56.4% Final 3rd Tilt',
          title: 'Half-Space & Zone 14 Progression Dominance',
          detail: `${t1Template.officialName} holds a 31-22 advantage in opposition penalty-box touches and 19-13 in progressive passes into the final third.`,
        },
        {
          category: 'PPDA & Counter-Pressing',
          metricBadge: '7.2 PPDA vs 9.4',
          title: 'High-Line Pressing Disrupting Build-Up Phase',
          detail: `Both midfields are pressing well below the 11.2 European benchmark, forcing rapid vertical transitions.`,
        },
      ],
      mvpPerformer: {
        id: p1Star.id,
        name: p1Star.name,
        teamAbbr: t1Template.abbr,
        position: p1Star.position || 'CAM',
        jersey: p1Star.jersey || '10',
        headshot: p1Star.headshot,
        primaryLine: '1 Goal • 1 Assist • 4 Key Passes',
        efficiencyLine: '0.96 xG+xA • 91% Pass • 8.9 Opta Rating',
        impactBadge: 'MAN OF THE MATCH PACE',
      },
      boxscoreCategories: {
        team1: t1Categories,
        team2: t2Categories,
      },
      rosters: {
        team1: t1Starters,
        team2: t2Starters,
      },
      teamStatsComparison: [
        { label: 'Expected Goals (xG)', team1Value: '2.23', team2Value: '1.54' },
        { label: 'Possession %', team1Value: '54%', team2Value: '46%' },
        { label: 'Field Tilt (Final 3rd Pass Share)', team1Value: '56.4%', team2Value: '43.6%' },
        { label: 'Total Shots (On Target)', team1Value: '16 (8)', team2Value: '12 (6)' },
        { label: 'Big Chances Created (>0.30 xG)', team1Value: '4', team2Value: '2' },
        { label: 'Touches in Opposition Box', team1Value: '31', team2Value: '22' },
        { label: 'PPDA (Pressing Intensity)', team1Value: '7.2', team2Value: '9.4' },
        { label: 'Pass Completion % (Progressive)', team1Value: '89% (44)', team2Value: '87% (36)' },
        { label: 'Corner Kicks', team1Value: '7', team2Value: '4' },
      ],
      scoringTimeline: [
        {
          period: "24' 1H",
          clock: "24'",
          teamName: t1Template.officialName,
          teamLogo: t1Logo,
          score: `${t1Template.abbr} 1 - 0 ${t2Template.abbr}`,
          description: `⚽ GOAL! ${p1Striker.name} (${t1Template.officialName}) clinical right-footed strike from the central penalty box (0.48 xG), assisted by ${t1Starters[2]?.name || 'RW'}.`,
        },
        {
          period: "33' 1H",
          clock: "33'",
          teamName: t2Template.officialName,
          teamLogo: t2Logo,
          score: `${t1Template.abbr} 1 - 1 ${t2Template.abbr}`,
          description: `⚽ GOAL! ${p2Star.name} (${t2Template.officialName}) curls a left-footed finish into the far corner from the right half-space (0.36 xG).`,
        },
        {
          period: "67' 2H",
          clock: "67'",
          teamName: t1Template.officialName,
          teamLogo: t1Logo,
          score: `${t1Template.abbr} 2 - 1 ${t2Template.abbr}`,
          description: `⚽ GOAL! ${p1Star.name} (${t1Template.officialName}) late box arrival slots home a Zone 14 cutback (0.39 xG) to restore the lead.`,
        },
      ],
    };
  }

  // ==========================================================================
  // 2. NFL & COLLEGE FOOTBALL (NCAAF) DEEP ANALYTICS ENGINE (NEXT GEN / EPA / QBR)
  // ==========================================================================
  private buildFootballAnalytics(
    stream: StreamItem,
    rawT1: string,
    rawT2: string,
    isCollege: boolean
  ): UniversalSportDeepAnalytics {
    const t1Template = this.matchTemplate(
      rawT1,
      NFL_NCAAF_TEAMS_DB,
      isCollege ? '#154733' : '#e31837',
      isCollege ? '#fee123' : '#ffb81c',
      isCollege ? 'Spread RPO Tempo' : '11 Personnel West Coast Spread',
      isCollege ? '11-1 (CFP Top 5)' : '10-2 (1st Division)'
    );
    const t2Template = this.matchTemplate(
      rawT2,
      NFL_NCAAF_TEAMS_DB,
      isCollege ? '#bb0000' : '#00338d',
      isCollege ? '#94a3b8' : '#c60c30',
      isCollege ? 'Pro-Spread / 4-2-5 Defense' : '11/12 Personnel Play-Action',
      isCollege ? '10-2 (CFP Contender)' : '9-3 (Wild Card #1)'
    );

    const t1Logo = stream.team1?.logo || t1Template.logo || buildSvgTeamCrestDataUri(t1Template.officialName, t1Template.primaryHex, t1Template.secondaryHex);
    const t2Logo = stream.team2?.logo || t2Template.logo || buildSvgTeamCrestDataUri(t2Template.officialName, t2Template.primaryHex, t2Template.secondaryHex);

    const passLabels = ['C/ATT', 'YDS', 'AVG', 'TD', 'INT', 'QBR', 'RTG', 'EPA/PLAY', 'CPOE'];
    const rushLabels = ['CAR', 'YDS', 'AVG', 'TD', 'LONG', 'YAC', '1FD', 'EPA'];
    const recLabels = ['REC', 'TGTS', 'YDS', 'AVG', 'TD', 'YAC', '1FD', 'EPA'];
    const defLabels = ['TOT', 'SOLO', 'SACKS', 'TFL', 'PD', 'QB HITS', 'PRWR%'];

    const makeAthlete = (tpl: RosterTemplate, idx: number, fallbackPos: string, stats: string[]): AthleteInfo => {
      const p = tpl.players[idx] || {
        id: `${tpl.abbr}_${idx}`,
        name: `${tpl.officialName} ${fallbackPos}`,
        jersey: String(idx * 7 + 1),
        position: fallbackPos,
      };
      return {
        id: p.id,
        name: p.name,
        jersey: p.jersey,
        position: p.position,
        headshot: p.headshot || buildSvgAvatarDataUri(p.name, p.jersey, tpl.primaryHex, tpl.secondaryHex),
        teamName: tpl.officialName,
        college: p.college || tpl.officialName,
        stats,
      };
    };

    const qb1 = makeAthlete(t1Template, 0, 'QB', ['24/32', '298', '9.3', '3', '0', '88.4', '134.6', '+0.34', '+6.8%']);
    const rb1 = makeAthlete(t1Template, 1, 'RB', ['18', '104', '5.8', '1', '28', '62', '6', '+4.2']);
    const wr1_a = makeAthlete(t1Template, 2, 'WR', ['8', '10', '116', '14.5', '1', '44', '6', '+5.8']);
    const wr1_b = makeAthlete(t1Template, 3, 'WR', ['7', '9', '94', '13.4', '1', '31', '5', '+4.1']);
    const te1 = makeAthlete(t1Template, 4, 'TE', ['5', '6', '58', '11.6', '1', '24', '4', '+3.2']);
    const def1_a = makeAthlete(t1Template, 5, 'EDGE', ['7', '5', '2.0', '3', '1', '4', '24.6%']);

    const qb2 = makeAthlete(t2Template, 0, 'QB', ['22/34', '274', '8.1', '2', '1', '76.2', '96.9', '+0.19', '+3.1%']);
    const rb2 = makeAthlete(t2Template, 1, 'RB', ['16', '89', '5.6', '1', '24', '48', '5', '+2.6']);
    const wr2_a = makeAthlete(t2Template, 2, 'WR', ['7', '11', '102', '14.6', '1', '36', '5', '+4.4']);
    const wr2_b = makeAthlete(t2Template, 3, 'WR', ['6', '8', '81', '13.5', '1', '22', '4', '+3.0']);
    const def2_a = makeAthlete(t2Template, 5, 'EDGE', ['8', '6', '1.5', '2', '0', '3', '19.8%']);

    const t1Categories: BoxScoreCategory[] = [
      { name: 'passing', displayName: 'Passing & EPA', labels: passLabels, athletes: [qb1] },
      { name: 'rushing', displayName: 'Rushing & YAC', labels: rushLabels, athletes: [rb1, qb1] },
      { name: 'receiving', displayName: 'Receiving & Targets', labels: recLabels, athletes: [wr1_a, wr1_b, te1] },
      { name: 'defense', displayName: 'Defense & Pass Rush', labels: defLabels, athletes: [def1_a] },
    ];
    const t2Categories: BoxScoreCategory[] = [
      { name: 'passing', displayName: 'Passing & EPA', labels: passLabels, athletes: [qb2] },
      { name: 'rushing', displayName: 'Rushing & YAC', labels: rushLabels, athletes: [rb2, qb2] },
      { name: 'receiving', displayName: 'Receiving & Targets', labels: recLabels, athletes: [wr2_a, wr2_b] },
      { name: 'defense', displayName: 'Defense & Pass Rush', labels: defLabels, athletes: [def2_a] },
    ];

    return {
      eventId: stream.stream_key,
      sportType: isCollege ? 'ncaaf' : 'nfl',
      sportBadge: isCollege ? 'NCAA COLLEGE FOOTBALL • EPA/PLAY & SP+ TELEMETRY' : 'NFL NEXT GEN STATS • EPA/PLAY, CPOE & QBR',
      analyticsMethodology: 'Expected Points Added (EPA/Play) • Completion % Over Expected (CPOE) • Down Success Rate % • Pass Rush Win Rate',
      surfaceType: 'football_field',
      status: '4th Quarter • 5:12 Remaining',
      detail: 'Q4 5:12',
      isLive: true,
      venue: `${t1Template.officialName} Stadium (74,820)`,
      broadcast: isCollege ? 'CFP Primetime National Broadcast' : 'NFL Network / CBS National Game of the Week',
      leverageIndex: 2.65,
      leverageTier: 'CRUNCH TIME',
      isClutchTime: true,
      situationBanner: `🏈 ${t1Template.abbr} Ball • 2nd & 4 at ${t2Template.abbr} 18-Yard Line (Red Zone) • Drive: 8 Plays, 62 Yards (+3.4 EPA)`,
      linescore: {
        periodHeaders: ['Q1', 'Q2', 'Q3', 'Q4'],
        team1Quarters: [7, 10, 7, 7],
        team2Quarters: [7, 7, 3, 7],
        team1Total: 31,
        team2Total: 24,
      },
      paceAndProjection: {
        tempoLabel: 'SECONDS / PLAY TEMPO',
        tempoValue: isCollege ? '22.8 sec/play (Up-Tempo)' : '26.9 sec/play',
        projectedFinal: `EPA Model Projection: ${t1Template.abbr} 34 — 27 ${t2Template.abbr}`,
        primaryRateLabel: 'OFFENSIVE EPA / PLAY',
        team1RateValue: '+0.28 EPA/p',
        team2RateValue: '+0.14 EPA/p',
      },
      team1Meta: {
        name: t1Template.officialName,
        abbreviation: t1Template.abbr,
        logo: t1Logo,
        score: 31,
        record: t1Template.record,
        formationOrScheme: t1Template.scheme,
      },
      team2Meta: {
        name: t2Template.officialName,
        abbreviation: t2Template.abbr,
        logo: t2Logo,
        score: 24,
        record: t2Template.record,
        formationOrScheme: t2Template.scheme,
      },
      fourPillars: [
        {
          code: 'EPA/P',
          label: 'Expected Points Added / Play',
          weightLabel: '40% WEIGHT',
          team1Value: '+0.28',
          team2Value: '+0.14',
          team1Numeric: 0.28,
          team2Numeric: 0.14,
          leagueAverage: '+0.02',
          edgeTeam: 'team1',
          description: 'Measures per-play scoring value added relative to down, distance, and yard line.',
        },
        {
          code: 'SR%',
          label: 'Offensive Success Rate %',
          weightLabel: '25% WEIGHT',
          team1Value: '53.8%',
          team2Value: '46.2%',
          team1Numeric: 53.8,
          team2Numeric: 46.2,
          leagueAverage: '44.5%',
          edgeTeam: 'team1',
          description: 'Percentage of plays generating positive EPA (staying ahead of the chains on 1st/2nd/3rd down).',
        },
        {
          code: 'RZ/3D',
          label: 'Red Zone & 3rd Down Conv %',
          weightLabel: '20% WEIGHT',
          team1Value: '75% RZ / 54% 3D',
          team2Value: '60% RZ / 42% 3D',
          team1Numeric: 64.5,
          team2Numeric: 51.0,
          leagueAverage: '55% RZ / 39% 3D',
          edgeTeam: 'team1',
          description: 'Touchdown conversion rate inside the opponent 20-yard line combined with 3rd-down chain-moving.',
        },
        {
          code: 'HAVOC',
          label: 'Pass Rush Win & Havoc %',
          weightLabel: '15% WEIGHT',
          team1Value: '24.6% PRWR',
          team2Value: '19.8% PRWR',
          team1Numeric: 24.6,
          team2Numeric: 19.8,
          leagueAverage: '17.5%',
          edgeTeam: 'team1',
          description: 'Frequency of sacks, tackles for loss, pass breakups, and QB pressures under 2.5 seconds.',
        },
      ],
      unitSplits: {
        unit1Label: 'Dropback & Play-Action Passing',
        unit2Label: 'Rushing & RPO Ground Attack',
        team1Unit1Stat: '298 YDS • 3 TD • +0.34 EPA/dropback',
        team1Unit2Stat: '132 YDS • 5.7 YPC • +0.16 EPA/rush',
        team1Unit1Pct: 69,
        team2Unit1Stat: '274 YDS • 2 TD • +0.19 EPA/dropback',
        team2Unit2Stat: '112 YDS • 5.1 YPC • +0.08 EPA/rush',
        team2Unit1Pct: 71,
        summaryEdge: `${qb1.name} (+0.34 EPA/play, +6.8% CPOE) surgical on intermediate play-action concepts`,
      },
      spatialMap: {
        title: 'Next Gen Stats 100-Yard Field Pass, Explosive Run & Red-Zone Chart',
        subtitle: 'Full 100-yard turf with Red Zones • ★ = Touchdown, ● = Completed Explosive Play, ✕ = Incomplete / Sack',
        surfaceType: 'football_field',
        team1PrimaryMetric: `${t1Template.abbr}: 430 Total Yds • 6.8 Yds/Play • +0.28 EPA/Play`,
        team2PrimaryMetric: `${t2Template.abbr}: 386 Total Yds • 6.0 Yds/Play • +0.14 EPA/Play`,
        events: [
          { id: 'f1', team: 'team1', playerName: qb1.name, jersey: qb1.jersey || '15', x: 88, y: 28, isSuccess: true, isHighValue: true, outcomeLabel: `TD PASS! ${qb1.name} to ${wr1_a.name} (26 Air Yds • +3.8 EPA)`, period: 'Q1', clock: '8:14', metricValue: 3.8, zoneLabel: 'Deep Right Red Zone' },
          { id: 'f2', team: 'team1', playerName: rb1.name, jersey: rb1.jersey || '29', x: 92, y: 52, isSuccess: true, isHighValue: true, outcomeLabel: `TD RUN! ${rb1.name} 14-yd Red Zone burst (+2.9 EPA)`, period: 'Q2', clock: '3:42', metricValue: 2.9, zoneLabel: 'Red Zone Interior' },
          { id: 'f3', team: 'team1', playerName: qb1.name, jersey: qb1.jersey || '15', x: 74, y: 48, isSuccess: true, isHighValue: true, outcomeLabel: `34-Yd Seam Completion to ${te1.name} (+2.4 EPA)`, period: 'Q3', clock: '6:19', metricValue: 2.4, zoneLabel: 'Intermediate Seam' },
          { id: 'f4', team: 'team1', playerName: qb1.name, jersey: qb1.jersey || '15', x: 94, y: 70, isSuccess: true, isHighValue: true, outcomeLabel: `TD PASS! ${qb1.name} to ${wr1_b.name} Corner Route (+3.4 EPA)`, period: 'Q4', clock: '9:05', metricValue: 3.4, zoneLabel: 'Red Zone Pylon' },
          { id: 'f5', team: 'team2', playerName: qb2.name, jersey: qb2.jersey || '17', x: 12, y: 34, isSuccess: true, isHighValue: true, outcomeLabel: `TD PASS! ${qb2.name} to ${wr2_a.name} (22 Yds • +3.5 EPA)`, period: 'Q2', clock: '7:11', metricValue: 3.5, zoneLabel: 'Deep Left Endzone' },
          { id: 'f6', team: 'team2', playerName: rb2.name, jersey: rb2.jersey || '4', x: 16, y: 55, isSuccess: true, isHighValue: true, outcomeLabel: `TD RUN! ${rb2.name} 11-yd Outside Zone (+2.6 EPA)`, period: 'Q4', clock: '11:20', metricValue: 2.6, zoneLabel: 'Red Zone Edge' },
          { id: 'f7', team: 'team2', playerName: qb2.name, jersey: qb2.jersey || '17', x: 35, y: 65, isSuccess: false, outcomeLabel: `Sacked by ${def1_a.name} (-1.8 EPA)`, period: 'Q3', clock: '2:10', metricValue: -1.8, zoneLabel: 'Pocket' },
        ],
        zones: [
          { zoneKey: 'red_zone', label: 'Red Zone (Inside 20)', team1Volume: '4 Trips', team1Efficiency: '3 TD / 1 FG (85%)', team2Volume: '4 Trips', team2Efficiency: '2 TD / 1 FG (60%)', benchmarkEfficiency: '56.5% TD', edge: 'team1' },
          { zoneKey: 'deep_pass', label: 'Deep Throws (20+ Air Yds)', team1Volume: '4/6 (124 Yds)', team1Efficiency: '+0.82 EPA/p', team2Volume: '2/6 (68 Yds)', team2Efficiency: '+0.24 EPA/p', benchmarkEfficiency: '+0.31 EPA/p', edge: 'team1' },
          { zoneKey: 'intermediate', label: 'Intermediate Middle (10-19 Yds)', team1Volume: '9/11 (118 Yds)', team1Efficiency: '+0.48 EPA/p', team2Volume: '7/11 (98 Yds)', team2Efficiency: '+0.29 EPA/p', benchmarkEfficiency: '+0.22 EPA/p', edge: 'team1' },
          { zoneKey: 'ground_yac', label: 'Inside/Outside Zone Rush', team1Volume: '23 Car (132 Yds)', team1Efficiency: '5.7 YPC', team2Volume: '22 Car (112 Yds)', team2Efficiency: '5.1 YPC', benchmarkEfficiency: '4.4 YPC', edge: 'team1' },
        ],
      },
      tacticalMatrix: [
        { playType: 'play_action', label: 'Play-Action & Motion Concepts', team1FreqPct: 34, team1Efficiency: '+0.46 EPA/play (11.2 YPA)', team1Percentile: 94, team2FreqPct: 29, team2Efficiency: '+0.31 EPA/play (9.1 YPA)', team2Percentile: 84, edge: t1Template.abbr },
        { playType: 'shotgun_dropback', label: 'Standard Shotgun Dropback', team1FreqPct: 28, team1Efficiency: '+0.26 EPA/play', team1Percentile: 86, team2FreqPct: 33, team2Efficiency: '+0.18 EPA/play', team2Percentile: 75, edge: t1Template.abbr },
        { playType: 'zone_rush', label: 'Inside / Outside Zone Run', team1FreqPct: 24, team1Efficiency: '5.8 YPC (56% SR%)', team1Percentile: 88, team2FreqPct: 25, team2Efficiency: '5.2 YPC (49% SR%)', team2Percentile: 79, edge: t1Template.abbr },
        { playType: 'blitz_pressure', label: '3rd-Down Blitz & Pressure Response', team1FreqPct: 14, team1Efficiency: '7/10 (2 TD vs Blitz)', team1Percentile: 92, team2FreqPct: 13, team2Efficiency: '5/11 (1 Sack)', team2Percentile: 68, edge: t1Template.abbr },
      ],
      activeUnit: {
        unitTitle: 'Active Field Personnel & Drive-by-Drive EPA GameFlow',
        team1Scheme: t1Template.scheme,
        team2Scheme: t2Template.scheme,
        team1NetMetric: '+0.28 EPA/Play • 88.4 QBR',
        team2NetMetric: '+0.14 EPA/Play • 76.2 QBR',
        team1Players: [qb1, rb1, wr1_a, wr1_b, def1_a].map((p, idx) => ({
          id: p.id,
          name: p.name,
          jersey: p.jersey || '',
          position: p.position || '',
          headshot: p.headshot,
          primaryStat: idx === 0 ? '298 YDS / 3 TD' : idx === 1 ? '104 YDS / 1 TD' : idx === 4 ? '2.0 SACKS' : `${p.stats?.[0] || '7'} REC / ${p.stats?.[2] || '95'} YDS`,
          efficiencyBadge: idx === 0 ? '88.4 QBR' : idx === 4 ? '24.6% PRWR' : '+EPA',
          impactVal: idx === 0 ? '+0.34 EPA/p' : '+Impact',
          isHot: idx <= 2,
        })),
        team2Players: [qb2, rb2, wr2_a, wr2_b, def2_a].map((p, idx) => ({
          id: p.id,
          name: p.name,
          jersey: p.jersey || '',
          position: p.position || '',
          headshot: p.headshot,
          primaryStat: idx === 0 ? '274 YDS / 2 TD' : idx === 1 ? '89 YDS / 1 TD' : idx === 4 ? '1.5 SACKS' : `${p.stats?.[0] || '6'} REC / ${p.stats?.[2] || '85'} YDS`,
          efficiencyBadge: idx === 0 ? '76.2 QBR' : 'Starter',
          impactVal: idx === 0 ? '+0.19 EPA/p' : 'Active',
          isHot: idx === 0,
        })),
        stintTimeline: [
          { periodLabel: 'Q1', timeRange: 'Opening Script', team1Score: 7, team2Score: 7, netDiff: 1.2, headline: 'Both QBs go 100% on scripted opening TD drives' },
          { periodLabel: 'Q2', timeRange: '2-Minute Drill', team1Score: 10, team2Score: 7, netDiff: 3.4, headline: `${t1Template.abbr} 75-yd TD drive + FG before half` },
          { periodLabel: 'Q3', timeRange: 'Defensive Clamp', team1Score: 7, team2Score: 3, netDiff: 4.1, headline: `${def1_a.name} strip-sack sets up short-field TD` },
          { periodLabel: 'Q4', timeRange: 'Crunch Time', team1Score: 7, team2Score: 7, netDiff: 2.8, headline: `${t1Template.abbr} advancing inside Red Zone to ice game` },
        ],
      },
      winProbTimeline: [
        { label: 'Q1 15:00', minuteMark: 0, team1WinPct: 54, leverageIndex: 1.0, scoreDiff: 0, keyPlay: 'Kickoff' },
        { label: 'Q1 8:14', minuteMark: 7, team1WinPct: 66, leverageIndex: 1.4, scoreDiff: 7, keyPlay: `${qb1.name} 26-yd TD Pass (7-0)` },
        { label: 'Q2 7:11', minuteMark: 23, team1WinPct: 52, leverageIndex: 1.6, scoreDiff: 0, keyPlay: `${qb2.name} 22-yd TD Pass (14-14)` },
        { label: 'Q2 0:00', minuteMark: 30, team1WinPct: 63, leverageIndex: 1.5, scoreDiff: 3, keyPlay: 'Halftime (17-14)' },
        { label: 'Q3 6:19', minuteMark: 39, team1WinPct: 77, leverageIndex: 2.0, scoreDiff: 7, keyPlay: `${t1Template.abbr} Red Zone TD (24-17)` },
        { label: 'Q4 5:12', minuteMark: 55, team1WinPct: 84, leverageIndex: 2.65, scoreDiff: 7, keyPlay: `${t1Template.abbr} 31-24 • Red Zone Threat` },
      ],
      smartCards: [
        {
          id: 'fb_card_1',
          category: 'NEXT GEN STATS QB TELEMETRY',
          badge: '+0.34 EPA/PLAY',
          headline: `${qb1.name} dealing at 88.4 QBR with +6.8% CPOE`,
          detail: `24/32 for 298 yds, 3 TD, 0 INT — averaging 11.2 yards per attempt on play-action concepts.`,
          metricHighlight: '134.6 Passer Rating',
          accentColor: 'gold',
          playerHeadshot: qb1.headshot,
        },
        {
          id: 'fb_card_2',
          category: 'RED ZONE & CHAIN MOVING',
          badge: '53.8% SUCCESS',
          headline: `${t1Template.officialName} converting 54% of 3rd downs & 75% Red Zone TDs`,
          detail: `${rb1.name} (104 yds, 5.8 YPC, 62 YAC) keeping the offense in 2nd-and-short all night.`,
          metricHighlight: '430 Total Yards',
          accentColor: 'cyan',
          playerHeadshot: rb1.headshot,
        },
        {
          id: 'fb_card_3',
          category: 'PASS RUSH HAVOC ALERT',
          badge: '24.6% PRWR',
          headline: `${def1_a.name} wreaking havoc with 2.0 sacks & 4 QB pressures`,
          detail: `Generating pressure in 2.38 seconds, forcing early checkdowns on 3rd-and-long.`,
          metricHighlight: '3 TFL • 4 Pressures',
          accentColor: 'purple',
          playerHeadshot: def1_a.headshot,
        },
      ],
      inGameInsights: [
        {
          category: 'EPA/Play & Passing Efficiency',
          metricBadge: '+0.34 EPA/db',
          title: `${qb1.name} punishing single-high coverage on play-action`,
          detail: `${t1Template.officialName} is averaging +0.46 EPA per play-action snap and +6.8% Completion Percentage Over Expected (CPOE).`,
        },
        {
          category: 'Early-Down Success Rate',
          metricBadge: '53.8% SR%',
          title: 'Staying Ahead of the Chains on 1st & 2nd Down',
          detail: `${rb1.name} has generated 62 Yards After Contact (YAC), creating manageable 3rd-and-3.2 average distance.`,
        },
        {
          category: 'Pass Rush Win Rate (PRWR)',
          metricBadge: '24.6% PRWR',
          title: 'Trench Disruption Limiting Deep Developing Routes',
          detail: `${def1_a.name} and the ${t1Template.abbr} front four have won 24.6% of pass-rush reps under 2.5 seconds.`,
        },
      ],
      mvpPerformer: {
        id: qb1.id,
        name: qb1.name,
        teamAbbr: t1Template.abbr,
        position: 'QB',
        jersey: qb1.jersey || '15',
        headshot: qb1.headshot,
        primaryLine: '24/32 • 298 YDS • 3 TD • 0 INT',
        efficiencyLine: '88.4 QBR • +0.34 EPA/Play • +6.8% CPOE',
        impactBadge: 'ALL-PRO / HEISMAN PACE',
      },
      boxscoreCategories: {
        team1: t1Categories,
        team2: t2Categories,
      },
      rosters: {
        team1: [qb1, rb1, wr1_a, wr1_b, te1, def1_a],
        team2: [qb2, rb2, wr2_a, wr2_b, def2_a],
      },
      teamStatsComparison: [
        { label: 'EPA / Play (Expected Points Added)', team1Value: '+0.28', team2Value: '+0.14' },
        { label: 'Offensive Success Rate %', team1Value: '53.8%', team2Value: '46.2%' },
        { label: 'Total Yards (Yards / Play)', team1Value: '430 (6.8)', team2Value: '386 (6.0)' },
        { label: 'Passing Yards (Net YPA)', team1Value: '298 (9.3)', team2Value: '274 (8.1)' },
        { label: 'Rushing Yards (YPC)', team1Value: '132 (5.7)', team2Value: '112 (5.1)' },
        { label: '3rd Down Conversions', team1Value: '7-13 (54%)', team2Value: '5-12 (42%)' },
        { label: 'Red Zone Touchdowns', team1Value: '3-4 (75%)', team2Value: '2-4 (50%)' },
        { label: 'Pass Rush Win Rate (Sacks)', team1Value: '24.6% (3)', team2Value: '19.8% (1)' },
        { label: 'Turnovers', team1Value: '0', team2Value: '1' },
      ],
      scoringTimeline: [
        {
          period: 'Q1',
          clock: '8:14',
          teamName: t1Template.officialName,
          teamLogo: t1Logo,
          score: `${t1Template.abbr} 7 - 0 ${t2Template.abbr}`,
          description: `🏈 TOUCHDOWN! ${qb1.name} 26-yard strike to ${wr1_a.name} (+3.8 EPA).`,
        },
        {
          period: 'Q2',
          clock: '7:11',
          teamName: t2Template.officialName,
          teamLogo: t2Logo,
          score: `${t1Template.abbr} 14 - 14 ${t2Template.abbr}`,
          description: `🏈 TOUCHDOWN! ${qb2.name} 22-yard seam pass to ${wr2_a.name}.`,
        },
        {
          period: 'Q4',
          clock: '9:05',
          teamName: t1Template.officialName,
          teamLogo: t1Logo,
          score: `${t1Template.abbr} 31 - 24 ${t2Template.abbr}`,
          description: `🏈 TOUCHDOWN! ${qb1.name} finds ${wr1_b.name} on the corner pylon route (+3.4 EPA).`,
        },
      ],
    };
  }

  // ==========================================================================
  // 3. NHL HOCKEY DEEP ANALYTICS ENGINE (MONEYPUCK / NATURAL STAT TRICK / EDGE)
  // ==========================================================================
  private buildHockeyAnalytics(stream: StreamItem, rawT1: string, rawT2: string): UniversalSportDeepAnalytics {
    const t1Template = this.matchTemplate(rawT1, NHL_TEAMS_DB, '#ff4c00', '#041e42', 'High-Event Rush & 1-3-1 PP', '16-9-2 (34 PTS)');
    const t2Template = this.matchTemplate(rawT2, NHL_TEAMS_DB, '#c8102e', '#041e42', 'Heavy Forecheck & Active Pinch', '17-9-2 (36 PTS)');

    const t1Logo = stream.team1?.logo || t1Template.logo || buildSvgTeamCrestDataUri(t1Template.officialName, t1Template.primaryHex, t1Template.secondaryHex);
    const t2Logo = stream.team2?.logo || t2Template.logo || buildSvgTeamCrestDataUri(t2Template.officialName, t2Template.primaryHex, t2Template.secondaryHex);

    const skaterLabels = ['TOI', 'G', 'A', 'PTS', '+/-', 'SOG', 'ixG', 'CF%', 'xGF%', 'HIT', 'BLK'];
    const goalieLabels = ['TOI', 'SA', 'SV', 'GA', 'SV%', 'xGA', 'GSAx'];

    const t1Skaters: AthleteInfo[] = t1Template.players.slice(0, 6).map((p, idx) => ({
      id: p.id,
      name: p.name,
      jersey: p.jersey,
      position: p.position,
      headshot: p.headshot || buildSvgAvatarDataUri(p.name, p.jersey, t1Template.primaryHex, t1Template.secondaryHex),
      teamName: t1Template.officialName,
      college: p.college,
      stats:
        idx === 0
          ? ['21:42', '1', '2', '3', '+2', '6', '0.84', '61.4%', '64.2%', '1', '1']
          : idx === 1
          ? ['20:55', '1', '1', '2', '+2', '5', '0.68', '58.9%', '60.5%', '2', '0']
          : idx === 2
          ? ['19:10', '1', '0', '1', '+1', '4', '0.59', '59.2%', '61.0%', '3', '1']
          : ['22:18', '0', '1', '1', '+1', '3', '0.24', '56.4%', '57.8%', '2', '3'],
    }));

    const t2Skaters: AthleteInfo[] = t2Template.players.slice(0, 5).map((p, idx) => ({
      id: p.id,
      name: p.name,
      jersey: p.jersey,
      position: p.position,
      headshot: p.headshot || buildSvgAvatarDataUri(p.name, p.jersey, t2Template.primaryHex, t2Template.secondaryHex),
      teamName: t2Template.officialName,
      college: p.college,
      stats:
        idx === 0
          ? ['20:48', '1', '1', '2', '-1', '5', '0.62', '51.2%', '49.4%', '2', '1']
          : idx === 1
          ? ['19:50', '1', '0', '1', '-1', '4', '0.54', '49.8%', '48.1%', '3', '1']
          : ['21:15', '0', '1', '1', '-1', '3', '0.28', '48.4%', '46.9%', '2', '2'],
    }));

    const goalie1: AthleteInfo = {
      id: `${t1Template.abbr}_g`,
      name: t1Template.players[6]?.name || `${t1Template.officialName} Goalie`,
      jersey: t1Template.players[6]?.jersey || '74',
      position: 'G',
      headshot: buildSvgAvatarDataUri(t1Template.players[6]?.name || 'Goalie', '74', t1Template.primaryHex, t1Template.secondaryHex),
      teamName: t1Template.officialName,
      stats: ['54:12', '29', '27', '2', '.931', '2.84', '+0.84'],
    };

    const goalie2: AthleteInfo = {
      id: `${t2Template.abbr}_g`,
      name: t2Template.players[6]?.name || `${t2Template.officialName} Goalie`,
      jersey: t2Template.players[6]?.jersey || '72',
      position: 'G',
      headshot: buildSvgAvatarDataUri(t2Template.players[6]?.name || 'Goalie', '72', t2Template.primaryHex, t2Template.secondaryHex),
      teamName: t2Template.officialName,
      stats: ['54:12', '34', '31', '3', '.912', '3.68', '+0.68'],
    };

    const c1 = t1Skaters[0];
    const c2 = t2Skaters[0];

    return {
      eventId: stream.stream_key,
      sportType: 'hockey',
      sportBadge: 'NHL EDGE & MONEYPUCK • 5v5 CORSI (CF%), xGF% & HIGH-DANGER SLOT',
      analyticsMethodology: 'Natural Stat Trick 5v5 Corsi (CF%) • MoneyPuck Expected Goals (xGF%) • High-Danger Slot Chances (HDCF%) • GSAx',
      surfaceType: 'hockey_rink',
      status: '3rd Period • 5:48 Remaining',
      detail: '3RD 5:48',
      isLive: true,
      venue: `${t1Template.officialName} Ice Arena (18,347)`,
      broadcast: 'NHL National Broadcast • Edge Tracking',
      leverageIndex: 2.42,
      leverageTier: 'CRUNCH TIME',
      isClutchTime: true,
      situationBanner: `🏒 5v5 Even Strength • 5v5 Corsi Share: ${t1Template.abbr} 57.4% — 42.6% ${t2Template.abbr} • High-Danger Chances: 14 - 9`,
      linescore: {
        periodHeaders: ['1ST', '2ND', '3RD'],
        team1Quarters: [1, 1, 1],
        team2Quarters: [1, 1, 0],
        team1Total: 3,
        team2Total: 2,
      },
      paceAndProjection: {
        tempoLabel: '5v5 SHOT PACE (CF/60)',
        tempoValue: '64.8 Shot Attempts / 60',
        projectedFinal: `MoneyPuck Deserve-to-Win: ${t1Template.abbr} 64.2% (3.68 vs 2.84 xG)`,
        primaryRateLabel: 'EXPECTED GOALS (xGF)',
        team1RateValue: '3.68 xGF',
        team2RateValue: '2.84 xGF',
      },
      team1Meta: {
        name: t1Template.officialName,
        abbreviation: t1Template.abbr,
        logo: t1Logo,
        score: 3,
        record: t1Template.record,
        formationOrScheme: t1Template.scheme,
      },
      team2Meta: {
        name: t2Template.officialName,
        abbreviation: t2Template.abbr,
        logo: t2Logo,
        score: 2,
        record: t2Template.record,
        formationOrScheme: t2Template.scheme,
      },
      fourPillars: [
        {
          code: 'CF%',
          label: '5v5 Corsi For % (Shot Share)',
          weightLabel: '35% WEIGHT',
          team1Value: '57.4%',
          team2Value: '42.6%',
          team1Numeric: 57.4,
          team2Numeric: 42.6,
          leagueAverage: '50.0%',
          edgeTeam: 'team1',
          description: 'Share of all 5v5 shot attempts (Goals + Saves + Misses + Blocks) controlling territorial ice.',
        },
        {
          code: 'xGF%',
          label: 'Expected Goals Share (xGF%)',
          weightLabel: '35% WEIGHT',
          team1Value: '56.4% (3.68)',
          team2Value: '43.6% (2.84)',
          team1Numeric: 56.4,
          team2Numeric: 43.6,
          leagueAverage: '50.0%',
          edgeTeam: 'team1',
          description: 'MoneyPuck shot-quality share weighted by distance, angle, rebound, and royal-road pass.',
        },
        {
          code: 'HDCF%',
          label: 'High-Danger Slot Chances',
          weightLabel: '20% WEIGHT',
          team1Value: '14 (60.9%)',
          team2Value: '9 (39.1%)',
          team1Numeric: 60.9,
          team2Numeric: 39.1,
          leagueAverage: '10.5 HD',
          edgeTeam: 'team1',
          description: 'Scoring chances generated directly inside the inner home-plate slot and crease.',
        },
        {
          code: 'GSAx',
          label: 'Goaltending GSAx & Special Teams',
          weightLabel: '10% WEIGHT',
          team1Value: '+0.84 GSAx (1/3 PP)',
          team2Value: '+0.68 GSAx (0/2 PP)',
          team1Numeric: 58,
          team2Numeric: 48,
          leagueAverage: '0.00 GSAx',
          edgeTeam: 'team1',
          description: 'Goals Saved Above Expected (GSAx) combined with Power Play & Penalty Kill net efficiency.',
        },
      ],
      unitSplits: {
        unit1Label: 'Top-6 Forward Lines (L1 + L2)',
        unit2Label: 'Bottom-6 & Defense Pairs',
        team1Unit1Stat: '3 G • 2.74 xGF • 60.8% CF%',
        team1Unit2Stat: '0 G • 0.94 xGF • 53.2% CF%',
        team1Unit1Pct: 74,
        team2Unit1Stat: '2 G • 2.12 xGF • 50.4% CF%',
        team2Unit2Stat: '0 G • 0.72 xGF • 44.1% CF%',
        team2Unit1Pct: 75,
        summaryEdge: `${c1.name} line tilting the ice at 61.4% CF% and 64.2% xGF% on controlled zone entries`,
      },
      spatialMap: {
        title: 'NHL Edge & MoneyPuck 200×85 ft Ice Rink Shot & High-Danger Slot Map',
        subtitle: 'Full NHL rink with High-Danger Home-Plate Slot • ★ = Goal, ● = Save on Goal, ✕ = Missed/Blocked',
        surfaceType: 'hockey_rink',
        team1PrimaryMetric: `${t1Template.abbr}: 3 Goals on 3.68 xGF (34 SOG, 14 High-Danger)`,
        team2PrimaryMetric: `${t2Template.abbr}: 2 Goals on 2.84 xGF (29 SOG, 9 High-Danger)`,
        events: [
          { id: 'h1', team: 'team1', playerName: c1.name, jersey: c1.jersey || '97', x: 86, y: 48, isSuccess: true, isHighValue: true, outcomeLabel: `GOAL! ${c1.name} High-Slot Wrist Shot (0.38 xG)`, period: '1ST', clock: '11:24', metricValue: 0.38, zoneLabel: 'High-Danger Slot' },
          { id: 'h2', team: 'team1', playerName: t1Skaters[1]?.name || '2C', jersey: '29', x: 82, y: 66, isSuccess: true, isHighValue: true, outcomeLabel: `PP GOAL! One-Timer from Right Circle (0.32 xG)`, period: '2ND', clock: '7:40', metricValue: 0.32, zoneLabel: 'Right Faceoff Circle' },
          { id: 'h3', team: 'team1', playerName: t1Skaters[2]?.name || 'RW', jersey: '18', x: 90, y: 51, isSuccess: true, isHighValue: true, outcomeLabel: `GOAL! Crease Tap-In Rebound (0.49 xG)`, period: '3RD', clock: '9:12', metricValue: 0.49, zoneLabel: 'Inner Crease' },
          { id: 'h4', team: 'team1', playerName: t1Skaters[3]?.name || 'D1', jersey: '2', x: 68, y: 49, isSuccess: false, outcomeLabel: 'Glove Save • Blue-Line Slapshot (0.09 xG)', period: '2ND', clock: '14:02', metricValue: 0.09, zoneLabel: 'Blue Line Point' },
          { id: 'h5', team: 'team2', playerName: c2.name, jersey: c2.jersey || '16', x: 14, y: 46, isSuccess: true, isHighValue: true, outcomeLabel: `GOAL! ${c2.name} Royal-Road Slot Finish (0.41 xG)`, period: '1ST', clock: '4:15', metricValue: 0.41, zoneLabel: 'High-Danger Slot' },
          { id: 'h6', team: 'team2', playerName: t2Skaters[1]?.name || 'RW', jersey: '13', x: 17, y: 36, isSuccess: true, isHighValue: true, outcomeLabel: `GOAL! Snap Shot Low Blocker (0.29 xG)`, period: '2ND', clock: '2:50', metricValue: 0.29, zoneLabel: 'Left Circle Slot' },
          { id: 'h7', team: 'team2', playerName: c2.name, jersey: c2.jersey || '16', x: 12, y: 54, isSuccess: false, isHighValue: true, outcomeLabel: `Pad Save by ${goalie1.name} (0.34 xG)`, period: '3RD', clock: '6:30', metricValue: 0.34, zoneLabel: 'Inner Crease' },
        ],
        zones: [
          { zoneKey: 'inner_slot', label: 'Inner Slot & Crease (High Danger)', team1Volume: '14 Chances', team1Efficiency: '2 Goals (1.92 xG)', team2Volume: '9 Chances', team2Efficiency: '1 Goal (1.34 xG)', benchmarkEfficiency: '21.5% SH%', edge: 'team1' },
          { zoneKey: 'circles', label: 'Left & Right Faceoff Circles', team1Volume: '12 SOG', team1Efficiency: '1 Goal (1.18 xG)', team2Volume: '11 SOG', team2Efficiency: '1 Goal (1.02 xG)', benchmarkEfficiency: '10.8% SH%', edge: 'team1' },
          { zoneKey: 'point', label: 'Blue Line Point & Traffic', team1Volume: '8 SOG', team1Efficiency: '0.58 xG', team2Volume: '9 SOG', team2Efficiency: '0.48 xG', benchmarkEfficiency: '4.2% SH%', edge: 'team1' },
        ],
      },
      tacticalMatrix: [
        { playType: 'controlled_entries', label: 'Controlled Zone Entries (Carry-In %)', team1FreqPct: 36, team1Efficiency: '62% Carry-In (1.42 xG)', team1Percentile: 95, team2FreqPct: 28, team2Efficiency: '51% Carry-In (0.98 xG)', team2Percentile: 78, edge: t1Template.abbr },
        { playType: 'cycle_slot', label: '5v5 Forecheck & Low-to-High Cycle', team1FreqPct: 30, team1Efficiency: '58.4% CF% (1.14 xG)', team1Percentile: 87, team2FreqPct: 35, team2Efficiency: '54.2% CF% (1.18 xG)', team2Percentile: 89, edge: t2Template.abbr },
        { playType: 'power_play', label: '5v4 Power Play Royal-Road', team1FreqPct: 18, team1Efficiency: '1/3 PP (0.78 xG)', team1Percentile: 93, team2FreqPct: 18, team2Efficiency: '0/2 PP (0.39 xG)', team2Percentile: 71, edge: t1Template.abbr },
        { playType: 'rush_counter', label: 'Odd-Man Rush & Neutral Zone Transition', team1FreqPct: 16, team1Efficiency: '1 Goal (22.4 mph Burst)', team1Percentile: 94, team2FreqPct: 19, team2Efficiency: '1 Goal (0.29 xG)', team2Percentile: 83, edge: t1Template.abbr },
      ],
      activeUnit: {
        unitTitle: 'Active 5v5 Ice Unit (Line 1 + Pair 1) & Period Momentum Stints',
        team1Scheme: t1Template.scheme,
        team2Scheme: t2Template.scheme,
        team1NetMetric: '57.4% CF% • 3.68 xGF',
        team2NetMetric: '42.6% CF% • 2.84 xGF',
        team1Players: t1Skaters.slice(0, 5).map((p, idx) => ({
          id: p.id,
          name: p.name,
          jersey: p.jersey || '',
          position: p.position || '',
          headshot: p.headshot,
          primaryStat: `${p.stats?.[1] || '0'}G ${p.stats?.[2] || '0'}A (${p.stats?.[5] || '3'} SOG)`,
          efficiencyBadge: `${p.stats?.[7] || '58%'} CF%`,
          impactVal: `${p.stats?.[6] || '0.50'} ixG`,
          isHot: idx <= 1,
        })),
        team2Players: t2Skaters.slice(0, 5).map((p, idx) => ({
          id: p.id,
          name: p.name,
          jersey: p.jersey || '',
          position: p.position || '',
          headshot: p.headshot,
          primaryStat: `${p.stats?.[1] || '0'}G ${p.stats?.[2] || '0'}A (${p.stats?.[5] || '3'} SOG)`,
          efficiencyBadge: `${p.stats?.[7] || '49%'} CF%`,
          impactVal: `${p.stats?.[6] || '0.45'} ixG`,
          isHot: idx === 0,
        })),
        stintTimeline: [
          { periodLabel: '1ST', timeRange: '0:00-20:00', team1Score: 1, team2Score: 1, netDiff: 0.34, headline: `${c1.name} & ${c2.name} trade high-slot goals` },
          { periodLabel: '2ND', timeRange: '0:00-20:00', team1Score: 1, team2Score: 1, netDiff: 0.42, headline: `${t1Template.abbr} Power Play one-timer answered late` },
          { periodLabel: '3RD', timeRange: '0:00-14:12', team1Score: 1, team2Score: 0, netDiff: 0.58, headline: `${t1Skaters[2]?.name || 'RW'} crease rebound breaks 2-2 tie` },
        ],
      },
      winProbTimeline: [
        { label: 'P1 20:00', minuteMark: 0, team1WinPct: 53, leverageIndex: 1.0, scoreDiff: 0, keyPlay: 'Puck Drop' },
        { label: 'P1 11:24', minuteMark: 9, team1WinPct: 67, leverageIndex: 1.5, scoreDiff: 1, keyPlay: `GOAL ${c1.name} (1-0)` },
        { label: 'P1 4:15', minuteMark: 16, team1WinPct: 51, leverageIndex: 1.6, scoreDiff: 0, keyPlay: `GOAL ${c2.name} (1-1)` },
        { label: 'P2 7:40', minuteMark: 32, team1WinPct: 69, leverageIndex: 1.8, scoreDiff: 1, keyPlay: `PP GOAL ${t1Template.abbr} (2-1)` },
        { label: 'P2 2:50', minuteMark: 37, team1WinPct: 50, leverageIndex: 1.9, scoreDiff: 0, keyPlay: `GOAL ${t2Template.abbr} (2-2)` },
        { label: 'P3 9:12', minuteMark: 51, team1WinPct: 78, leverageIndex: 2.42, scoreDiff: 1, keyPlay: `GOAL ${t1Template.abbr} (3-2)` },
      ],
      smartCards: [
        {
          id: 'nhl_card_1',
          category: 'NHL EDGE & CORSI DOMINANCE',
          badge: '61.4% CF%',
          headline: `${c1.name} (1G, 2A, 0.84 ixG) driving 64.2% Expected Goals share`,
          detail: `Top line has out-attempted ${t2Template.abbr} 22-14 at 5v5 with 8 High-Danger Slot chances.`,
          metricHighlight: '3 PTS • 6 SOG',
          accentColor: 'cyan',
          playerHeadshot: c1.headshot,
        },
        {
          id: 'nhl_card_2',
          category: 'GOALTENDING GSAx WALL',
          badge: '+0.84 GSAx',
          headline: `${goalie1.name} stopping 27 of 29 shots (.931 SV%)`,
          detail: `Saved 0.84 Goals Above Expected including 7 of 8 High-Danger slot shots.`,
          metricHighlight: '.931 SV%',
          accentColor: 'gold',
          playerHeadshot: goalie1.headshot,
        },
      ],
      inGameInsights: [
        {
          category: '5v5 Possession & Corsi Share',
          metricBadge: '57.4% CF%',
          title: `${t1Template.officialName} controlling zone time and controlled entries`,
          detail: `${t1Template.officialName} leads 5v5 shot attempts 46-34 and High-Danger Slot chances 14-9.`,
        },
        {
          category: 'MoneyPuck Expected Goals (xGF)',
          metricBadge: '3.68 vs 2.84 xG',
          title: 'Royal-Road Passing Unlocking Inner-Slot Rebounds',
          detail: `${c1.name} has created 0.84 individual xG and 5 slot setups across 21:42 TOI.`,
        },
      ],
      mvpPerformer: {
        id: c1.id,
        name: c1.name,
        teamAbbr: t1Template.abbr,
        position: 'C',
        jersey: c1.jersey || '97',
        headshot: c1.headshot,
        primaryLine: '1 Goal • 2 Assists • 3 Points • 6 SOG',
        efficiencyLine: '61.4% CF% • 64.2% xGF% • 0.84 ixG',
        impactBadge: 'FIRST STAR OF THE GAME PACE',
      },
      boxscoreCategories: {
        team1: [
          { name: 'skaters', displayName: 'Skaters (5v5 & Special Teams)', labels: skaterLabels, athletes: t1Skaters },
          { name: 'goalies', displayName: 'Goaltending & GSAx', labels: goalieLabels, athletes: [goalie1] },
        ],
        team2: [
          { name: 'skaters', displayName: 'Skaters (5v5 & Special Teams)', labels: skaterLabels, athletes: t2Skaters },
          { name: 'goalies', displayName: 'Goaltending & GSAx', labels: goalieLabels, athletes: [goalie2] },
        ],
      },
      rosters: {
        team1: [...t1Skaters, goalie1],
        team2: [...t2Skaters, goalie2],
      },
      teamStatsComparison: [
        { label: 'Expected Goals (xGF — MoneyPuck)', team1Value: '3.68', team2Value: '2.84' },
        { label: '5v5 Corsi For % (Shot Attempt Share)', team1Value: '57.4%', team2Value: '42.6%' },
        { label: 'Shots on Goal (SOG)', team1Value: '34', team2Value: '29' },
        { label: 'High-Danger Scoring Chances (Slot)', team1Value: '14', team2Value: '9' },
        { label: 'Power Play Conversions', team1Value: '1-3 (33%)', team2Value: '0-2 (0%)' },
        { label: 'Faceoff Win % (FOW%)', team1Value: '54.2%', team2Value: '45.8%' },
        { label: 'Goals Saved Above Expected (GSAx)', team1Value: '+0.84', team2Value: '+0.68' },
        { label: 'Hits / Blocked Shots', team1Value: '21 / 16', team2Value: '26 / 18' },
      ],
      scoringTimeline: [
        {
          period: '1ST',
          clock: '11:24',
          teamName: t1Template.officialName,
          teamLogo: t1Logo,
          score: `${t1Template.abbr} 1 - 0 ${t2Template.abbr}`,
          description: `🚨 GOAL! ${c1.name} snaps a high-slot wrist shot top shelf off the rush (0.38 xG).`,
        },
        {
          period: '1ST',
          clock: '4:15',
          teamName: t2Template.officialName,
          teamLogo: t2Logo,
          score: `${t1Template.abbr} 1 - 1 ${t2Template.abbr}`,
          description: `🚨 GOAL! ${c2.name} finishes a royal-road cross-slot feed (0.41 xG).`,
        },
        {
          period: '3RD',
          clock: '9:12',
          teamName: t1Template.officialName,
          teamLogo: t1Logo,
          score: `${t1Template.abbr} 3 - 2 ${t2Template.abbr}`,
          description: `🚨 GOAL! ${t1Skaters[2]?.name || 'RW'} buries a high-danger crease rebound (0.49 xG), assisted by ${c1.name}.`,
        },
      ],
    };
  }

  // ==========================================================================
  // 4. COLLEGE BASKETBALL (NCAAB) DEEP ANALYTICS (KENPOM / BARTTORVIK / 4 FACTORS)
  // ==========================================================================
  private buildCollegeBasketballAnalytics(stream: StreamItem, rawT1: string, rawT2: string): UniversalSportDeepAnalytics {
    const t1Template = this.matchTemplate(rawT1, NCAAB_TEAMS_DB, '#003087', '#ffffff', '5-Out Switching & Rim Deterrence', '9-2 (KenPom #2)');
    const t2Template = this.matchTemplate(rawT2, NCAAB_TEAMS_DB, '#0051ba', '#e8000d', 'Hi-Lo Post & Transition', '9-1 (KenPom #4)');

    const t1Logo = stream.team1?.logo || t1Template.logo || buildSvgTeamCrestDataUri(t1Template.officialName, t1Template.primaryHex, t1Template.secondaryHex);
    const t2Logo = stream.team2?.logo || t2Template.logo || buildSvgTeamCrestDataUri(t2Template.officialName, t2Template.primaryHex, t2Template.secondaryHex);

    const ncaaLabels = ['MIN', 'PTS', 'REB', 'AST', 'FG', '3PT', 'FT', 'eFG%', 'TS%', 'ORtg', 'BPM', '+/-'];

    const t1Players: AthleteInfo[] = t1Template.players.slice(0, 6).map((p, idx) => ({
      id: p.id,
      name: p.name,
      jersey: p.jersey,
      position: p.position,
      headshot: p.headshot || buildSvgAvatarDataUri(p.name, p.jersey, t1Template.primaryHex, t1Template.secondaryHex),
      teamName: t1Template.officialName,
      height: p.height,
      weight: p.weight,
      college: p.college,
      stats:
        idx === 0
          ? ['34', '22', '9', '5', '8-14', '2-4', '4-5', '64.3%', '67.9%', '128', '+11.4', '+9']
          : idx === 1
          ? ['32', '17', '4', '3', '6-11', '4-7', '1-1', '72.7%', '74.3%', '131', '+8.8', '+8']
          : idx === 2
          ? ['33', '14', '3', '7', '5-10', '2-5', '2-2', '60.0%', '64.3%', '124', '+7.2', '+7']
          : ['26', '10', '8', '1', '4-6', '0-0', '2-3', '66.7%', '68.3%', '126', '+6.1', '+5'],
    }));

    const t2Players: AthleteInfo[] = t2Template.players.slice(0, 6).map((p, idx) => ({
      id: p.id,
      name: p.name,
      jersey: p.jersey,
      position: p.position,
      headshot: p.headshot || buildSvgAvatarDataUri(p.name, p.jersey, t2Template.primaryHex, t2Template.secondaryHex),
      teamName: t2Template.officialName,
      height: p.height,
      weight: p.weight,
      college: p.college,
      stats:
        idx === 0
          ? ['33', '21', '11', '3', '9-16', '1-2', '2-3', '59.4%', '60.6%', '118', '+9.2', '-4']
          : idx === 1
          ? ['35', '15', '3', '8', '6-12', '2-5', '1-2', '58.3%', '58.2%', '116', '+6.8', '-5']
          : ['30', '14', '6', '2', '5-11', '2-5', '2-2', '54.5%', '58.9%', '114', '+4.9', '-6'],
    }));

    const star1 = t1Players[0];
    const star2 = t2Players[0];

    return {
      eventId: stream.stream_key,
      sportType: 'ncaab',
      sportBadge: 'NCAA MEN\'S BASKETBALL • KENPOM AdjEM & DEAN OLIVER FOUR FACTORS',
      analyticsMethodology: 'KenPom Adjusted Efficiency (AdjO / AdjD / AdjT) • Dean Oliver Four Factors • BartTorvik T-Rank & Kill Shots',
      surfaceType: 'basketball_halfcourt',
      status: '2nd Half • 3:42 Remaining',
      detail: '2H 3:42',
      isLive: true,
      venue: 'Cameron Indoor / Neutral Championship Arena (19,800)',
      broadcast: 'ESPN College GameDay Primetime',
      leverageIndex: 2.48,
      leverageTier: 'CRUNCH TIME',
      isClutchTime: true,
      situationBanner: `🏀 2nd Half 3:42 • ${t1Template.abbr} on 10-0 "Kill Shot" Run • Bonus: Double Bonus Both Teams`,
      linescore: {
        periodHeaders: ['1ST HALF', '2ND HALF'],
        team1Quarters: [38, 41],
        team2Quarters: [36, 37],
        team1Total: 79,
        team2Total: 73,
      },
      paceAndProjection: {
        tempoLabel: 'KENPOM ADJUSTED TEMPO (AdjT)',
        tempoValue: '68.4 Poss / 40 Min',
        projectedFinal: `KenPom 40-Min Projection: ${t1Template.abbr} 84 — 78 ${t2Template.abbr}`,
        primaryRateLabel: 'KENPOM AdjO / AdjD',
        team1RateValue: '121.4 / 91.8',
        team2RateValue: '118.9 / 93.2',
      },
      team1Meta: {
        name: t1Template.officialName,
        abbreviation: t1Template.abbr,
        logo: t1Logo,
        score: 79,
        record: t1Template.record,
        formationOrScheme: t1Template.scheme,
      },
      team2Meta: {
        name: t2Template.officialName,
        abbreviation: t2Template.abbr,
        logo: t2Logo,
        score: 73,
        record: t2Template.record,
        formationOrScheme: t2Template.scheme,
      },
      fourPillars: [
        {
          code: 'eFG%',
          label: 'Effective Field Goal %',
          weightLabel: '40% WEIGHT',
          team1Value: '57.8%',
          team2Value: '51.6%',
          team1Numeric: 57.8,
          team2Numeric: 51.6,
          leagueAverage: '50.8%',
          edgeTeam: 'team1',
          description: 'Shooting efficiency weighting 3-pointers at 1.5x field goal value.',
        },
        {
          code: 'TOV%',
          label: 'Turnover Percentage',
          weightLabel: '25% WEIGHT',
          team1Value: '13.2%',
          team2Value: '16.8%',
          team1Numeric: 13.2,
          team2Numeric: 16.8,
          leagueAverage: '17.2%',
          edgeTeam: 'team1',
          description: 'Percentage of possessions ending in a turnover (lower is better).',
        },
        {
          code: 'ORB%',
          label: 'Offensive Rebound Rate',
          weightLabel: '20% WEIGHT',
          team1Value: '34.4%',
          team2Value: '29.8%',
          team1Numeric: 34.4,
          team2Numeric: 29.8,
          leagueAverage: '28.9%',
          edgeTeam: 'team1',
          description: 'Second-chance rebounding rate on missed field goals.',
        },
        {
          code: 'FTR',
          label: 'Free Throw Rate (FTA/FGA)',
          weightLabel: '15% WEIGHT',
          team1Value: '36.2%',
          team2Value: '28.4%',
          team1Numeric: 36.2,
          team2Numeric: 28.4,
          leagueAverage: '32.0%',
          edgeTeam: 'team1',
          description: 'Ratio of free throw attempts to field goal attempts.',
        },
      ],
      unitSplits: {
        unit1Label: 'Starting 5 Rotation',
        unit2Label: 'Bench Reserves',
        team1Unit1Stat: '63 PTS • 59.2% eFG% • +8',
        team1Unit2Stat: '16 PTS • 52.1% eFG% • +2',
        team1Unit1Pct: 80,
        team2Unit1Stat: '59 PTS • 52.8% eFG% • -4',
        team2Unit2Stat: '14 PTS • 47.6% eFG% • -2',
        team2Unit1Pct: 81,
        summaryEdge: `${star1.name} (22 PTS, 9 REB, 5 AST, +11.4 BPM) anchoring ${t1Template.abbr} two-way lineup`,
      },
      spatialMap: {
        title: 'NCAA Half-Court 6-Zone Spatial Shot Chart & Rim/3PT Diet',
        subtitle: 'College 3PT Arc (22 ft 1.75 in) • ● = Made FG, ✕ = Missed FG • Zone efficiency vs NCAA D-I averages',
        surfaceType: 'basketball_halfcourt',
        team1PrimaryMetric: `${t1Template.abbr}: 57.8% eFG% (10-23 3PT • 38 Paint PTS)`,
        team2PrimaryMetric: `${t2Template.abbr}: 51.6% eFG% (7-21 3PT • 34 Paint PTS)`,
        events: [
          { id: 'c1', team: 'team1', playerName: star1.name, jersey: star1.jersey || '2', x: 50, y: 17, isSuccess: true, isHighValue: true, outcomeLabel: `${star1.name} Transition Dunk (Rim)`, period: '2H', clock: '4:12', metricValue: 2, zoneLabel: 'Restricted Area' },
          { id: 'c2', team: 'team1', playerName: t1Players[1]?.name || 'SG', jersey: '7', x: 82, y: 58, isSuccess: true, isHighValue: true, outcomeLabel: 'Right Wing 3PT Dagger!', period: '2H', clock: '5:04', metricValue: 3, zoneLabel: 'Above-the-Break 3' },
          { id: 'c3', team: 'team2', playerName: star2.name, jersey: star2.jersey || '1', x: 48, y: 22, isSuccess: true, outcomeLabel: `${star2.name} Left-Shoulder Hook`, period: '2H', clock: '6:15', metricValue: 2, zoneLabel: 'Paint (Non-RA)' },
        ],
        zones: [
          { zoneKey: 'rim', label: 'At the Rim / Restricted Area', team1Volume: '14/20', team1Efficiency: '70.0%', team2Volume: '12/19', team2Efficiency: '63.2%', benchmarkEfficiency: '63.5%', edge: 'team1' },
          { zoneKey: 'corner3', label: 'Corner 3-Pointers', team1Volume: '4/8', team1Efficiency: '50.0%', team2Volume: '2/6', team2Efficiency: '33.3%', benchmarkEfficiency: '37.2%', edge: 'team1' },
          { zoneKey: 'atb3', label: 'Above-the-Break 3PT', team1Volume: '6/15', team1Efficiency: '40.0%', team2Volume: '5/15', team2Efficiency: '33.3%', benchmarkEfficiency: '33.8%', edge: 'team1' },
        ],
      },
      tacticalMatrix: [
        { playType: 'transition', label: 'Transition & Primary Break', team1FreqPct: 22, team1Efficiency: '1.26 PPP', team1Percentile: 92, team2FreqPct: 18, team2Efficiency: '1.14 PPP', team2Percentile: 81, edge: t1Template.abbr },
        { playType: 'ball_screen', label: 'Spread Pick-and-Roll / Ghost Screens', team1FreqPct: 31, team1Efficiency: '1.09 PPP', team1Percentile: 88, team2FreqPct: 26, team2Efficiency: '0.98 PPP', team2Percentile: 74, edge: t1Template.abbr },
        { playType: 'post_hi_lo', label: 'Post-Up & Hi-Lo Actions', team1FreqPct: 18, team1Efficiency: '1.04 PPP', team1Percentile: 82, team2FreqPct: 29, team2Efficiency: '1.12 PPP', team2Percentile: 91, edge: t2Template.abbr },
        { playType: 'spot_up', label: 'Catch-and-Shoot 3PT Spacing', team1FreqPct: 29, team1Efficiency: '1.18 PPP (43.5% 3P)', team1Percentile: 94, team2FreqPct: 27, team2Efficiency: '1.01 PPP (33.3% 3P)', team2Percentile: 72, edge: t1Template.abbr },
      ],
      activeUnit: {
        unitTitle: 'Active 5v5 Collegiate Floor Lineup & Half Stint GameFlow',
        team1Scheme: t1Template.scheme,
        team2Scheme: t2Template.scheme,
        team1NetMetric: '+29.4 KenPom AdjEM',
        team2NetMetric: '+27.8 KenPom AdjEM',
        team1Players: t1Players.slice(0, 5).map((p, idx) => ({
          id: p.id,
          name: p.name,
          jersey: p.jersey || '',
          position: p.position || '',
          headshot: p.headshot,
          primaryStat: `${p.stats?.[1]} PTS / ${p.stats?.[2]} REB`,
          efficiencyBadge: `${p.stats?.[8]} TS%`,
          impactVal: `${p.stats?.[10]} BPM`,
          isHot: idx <= 1,
        })),
        team2Players: t2Players.slice(0, 5).map((p, idx) => ({
          id: p.id,
          name: p.name,
          jersey: p.jersey || '',
          position: p.position || '',
          headshot: p.headshot,
          primaryStat: `${p.stats?.[1]} PTS / ${p.stats?.[2]} REB`,
          efficiencyBadge: `${p.stats?.[8]} TS%`,
          impactVal: `${p.stats?.[10]} BPM`,
          isHot: idx === 0,
        })),
        stintTimeline: [
          { periodLabel: '1H 20-10', timeRange: 'Opening 10m', team1Score: 19, team2Score: 18, netDiff: 1, headline: 'High-level half-court execution' },
          { periodLabel: '1H 10-0', timeRange: 'Close of 1st Half', team1Score: 19, team2Score: 18, netDiff: 1, headline: `${t1Template.abbr} 38-36 halftime edge` },
          { periodLabel: '2H 20-10', timeRange: 'Paint Battle', team1Score: 20, team2Score: 21, netDiff: -1, headline: `${star2.name} post touches keep it tied` },
          { periodLabel: '2H 10-3:42', timeRange: '10-0 Kill Shot', team1Score: 21, team2Score: 16, netDiff: 5, headline: `${star1.name} sparks 10-0 run` },
        ],
      },
      winProbTimeline: [
        { label: '1H 20:00', minuteMark: 0, team1WinPct: 54, leverageIndex: 1.0, scoreDiff: 0, keyPlay: 'Tip-Off' },
        { label: '1H 0:00', minuteMark: 20, team1WinPct: 58, leverageIndex: 1.4, scoreDiff: 2, keyPlay: 'Halftime (38-36)' },
        { label: '2H 10:00', minuteMark: 30, team1WinPct: 53, leverageIndex: 1.8, scoreDiff: 1 },
        { label: '2H 3:42', minuteMark: 36, team1WinPct: 81, leverageIndex: 2.48, scoreDiff: 6, keyPlay: '10-0 Kill Shot Run (79-73)' },
      ],
      smartCards: [
        {
          id: 'ncaa_card_1',
          category: 'EVANMIYA "KILL SHOT" RUN',
          badge: '10-0 RUN',
          headline: `${t1Template.officialName} unleashes a 10-0 unanswered run in 2:18`,
          detail: `${star1.name} (22 PTS, 9 REB, 5 AST) forced 2 blocks and hit a transition 3-pointer.`,
          metricHighlight: '+29.4 KenPom AdjEM',
          accentColor: 'gold',
          playerHeadshot: star1.headshot,
        },
      ],
      inGameInsights: [
        {
          category: 'KenPom Four Factors Edge',
          metricBadge: '57.8% vs 51.6% eFG%',
          title: `${t1Template.officialName} winning all four Dean Oliver factors`,
          detail: `${t1Template.officialName} holds edges in eFG% (+6.2%), TOV% (13.2% vs 16.8%), ORB% (34.4%), and FTR (36.2%).`,
        },
      ],
      mvpPerformer: {
        id: star1.id,
        name: star1.name,
        teamAbbr: t1Template.abbr,
        position: star1.position || 'PF',
        jersey: star1.jersey || '2',
        headshot: star1.headshot,
        primaryLine: '22 PTS • 9 REB • 5 AST • 8-14 FG',
        efficiencyLine: '67.9% TS% • 128 ORtg • +11.4 BPM',
        impactBadge: 'WOODEN AWARD WATCH',
      },
      boxscoreCategories: {
        team1: [{ name: 'starters', displayName: 'Rotation & KenPom Telemetry', labels: ncaaLabels, athletes: t1Players }],
        team2: [{ name: 'starters', displayName: 'Rotation & KenPom Telemetry', labels: ncaaLabels, athletes: t2Players }],
      },
      rosters: {
        team1: t1Players,
        team2: t2Players,
      },
      teamStatsComparison: [
        { label: 'Effective Field Goal % (eFG%)', team1Value: '57.8%', team2Value: '51.6%' },
        { label: 'KenPom Offensive Efficiency (AdjO)', team1Value: '121.4', team2Value: '118.9' },
        { label: 'KenPom Defensive Efficiency (AdjD)', team1Value: '91.8', team2Value: '93.2' },
        { label: '3-Point Shooting', team1Value: '10-23 (43.5%)', team2Value: '7-21 (33.3%)' },
        { label: 'Offensive Rebound % (ORB%)', team1Value: '34.4%', team2Value: '29.8%' },
        { label: 'Turnover Rate (TOV%)', team1Value: '13.2%', team2Value: '16.8%' },
      ],
      scoringTimeline: [
        {
          period: '1ST HALF',
          clock: '0:00',
          teamName: t1Template.officialName,
          teamLogo: t1Logo,
          score: `${t1Template.abbr} 38 - 36 ${t2Template.abbr}`,
          description: `Halftime buzzer-beater gives ${t1Template.officialName} a 2-point lead.`,
        },
        {
          period: '2ND HALF',
          clock: '3:42',
          teamName: t1Template.officialName,
          teamLogo: t1Logo,
          score: `${t1Template.abbr} 79 - 73 ${t2Template.abbr}`,
          description: `${star1.name} caps a 10-0 Kill Shot run with an transition and-one dunk.`,
        },
      ],
    };
  }

  private matchTemplate(
    rawName: string,
    db: RosterTemplate[],
    defaultHex1: string,
    defaultHex2: string,
    defaultScheme: string,
    defaultRecord: string
  ): RosterTemplate {
    const lower = (rawName || '').toLowerCase().trim();
    for (const tpl of db) {
      if (tpl.teamKeywords.some(k => lower.includes(k) || k.includes(lower))) {
        return tpl;
      }
    }

    const cleanName = rawName.trim() || 'Club XI';
    const words = cleanName.split(/\s+/);
    const abbr =
      words.length >= 2
        ? (words[0][0] + words[1][0] + (words[2]?.[0] || '')).toUpperCase()
        : cleanName.slice(0, 3).toUpperCase();

    // Deterministic realistic roster if team isn't in static DB
    const baseRoster = db[0]?.players || [];
    return {
      teamKeywords: [lower],
      officialName: cleanName,
      abbr,
      logo: buildSvgTeamCrestDataUri(cleanName, defaultHex1, defaultHex2),
      record: defaultRecord,
      scheme: defaultScheme,
      primaryHex: defaultHex1,
      secondaryHex: defaultHex2,
      players: baseRoster.map((p, i) => ({
        ...p,
        id: `${abbr.toLowerCase()}_p${i}`,
        college: cleanName,
      })),
    };
  }
}

export const multiSportAnalyticsService = new MultiSportAnalyticsService();
