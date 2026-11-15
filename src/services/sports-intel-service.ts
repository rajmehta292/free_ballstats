import { LRUCache } from 'lru-cache';
import type { StreamItem } from '../types/stream.js';
import { basketballResearchService, type BasketballGameDeepAnalytics, type PlayerAdvancedBoxRow } from './basketball-research-service.js';
import {
  multiSportAnalyticsService,
  buildSvgTeamCrestDataUri,
  buildSvgAvatarDataUri,
  type UniversalSportDeepAnalytics,
} from './multi-sport-analytics-service.js';

export interface AthleteInfo {
  id: string;
  name: string;
  jersey?: string;
  position?: string;
  headshot: string;
  stats?: string[];
  teamName?: string;
  height?: string;
  weight?: string;
  age?: number;
  college?: string;
  experience?: string;
}

export interface BoxScoreCategory {
  name: string;
  displayName: string;
  labels: string[];
  athletes: AthleteInfo[];
}

export interface TeamBoxScore {
  teamName: string;
  teamLogo: string;
  categories: BoxScoreCategory[];
}

export interface SportsGamecastIntel {
  stream_key: string;
  source: 'espn' | 'reference_engine';
  sportPath?: string;
  scoreboard: {
    team1: { name: string; logo: string; score: string; record?: string; isHome: boolean };
    team2: { name: string; logo: string; score: string; record?: string; isHome: boolean };
    status: string;
    detail: string;
    clock?: string;
    period?: number;
    downDistance?: string;
    possession?: string;
  };
  winProbability?: {
    team1Percentage: number;
    team2Percentage: number;
  };
  stats: Array<{ label: string; team1Value: string; team2Value: string }>;
  leaders: Array<{
    category: string;
    athlete: AthleteInfo;
    statline: string;
    teamName?: string;
  }>;
  boxscore?: {
    team1: TeamBoxScore;
    team2: TeamBoxScore;
  };
  rosters?: {
    team1: AthleteInfo[];
    team2: AthleteInfo[];
  };
  scoringPlays: Array<{
    period: string;
    clock: string;
    teamLogo?: string;
    teamName: string;
    score: string;
    description: string;
  }>;
  gameInfo: {
    venue?: string;
    city?: string;
    attendance?: string;
    weather?: string;
    broadcast?: string;
    odds?: string;
    overUnder?: string;
  };
  news: Array<{
    title: string;
    description: string;
    link: string;
    image?: string;
    published?: string;
  }>;
  linescore?: {
    periodHeaders: string[];
    team1Quarters: number[];
    team2Quarters: number[];
    team1Total: number;
    team2Total: number;
  };
  basketballAnalytics?: BasketballGameDeepAnalytics;
  sportAnalytics?: UniversalSportDeepAnalytics;
}

export interface AthleteProfileDetails {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  jersey?: string;
  position?: string;
  height?: string;
  weight?: string;
  age?: number;
  college?: string;
  experience?: string;
  headshot: string;
  teamName?: string;
  teamLogo?: string;
  statsSummary?: any;
  overviewStats?: Array<{ label: string; value: string }>;
  biography?: string;
}

class SportsIntelService {
  private cache: LRUCache<string, SportsGamecastIntel>;
  private athleteCache: LRUCache<string, AthleteProfileDetails>;

  constructor() {
    this.cache = new LRUCache<string, SportsGamecastIntel>({
      max: 200,
      ttl: 20000, // 20 seconds cache for live sports
    });

    this.athleteCache = new LRUCache<string, AthleteProfileDetails>({
      max: 500,
      ttl: 3600000, // 1 hour for athlete profiles
    });
  }

  async getGamecastIntel(stream: StreamItem): Promise<SportsGamecastIntel> {
    const cached = this.cache.get(stream.stream_key);
    if (cached) return cached;

    try {
      const espnData = await this.fetchFromESPN(stream);
      if (espnData) {
        this.cache.set(stream.stream_key, espnData);
        return espnData;
      }
    } catch (err) {
      console.error(`[SportsIntelService] Error fetching ESPN intelligence for ${stream.stream_key}:`, err);
    }

    const fallback = this.generateComprehensiveFallback(stream);
    this.cache.set(stream.stream_key, fallback);
    return fallback;
  }

  async getAthleteProfile(sport: string, league: string, athleteId: string): Promise<AthleteProfileDetails> {
    const cacheKey = `${sport}:${league}:${athleteId}`;
    const cached = this.athleteCache.get(cacheKey);
    if (cached) return cached;

    // Check curated NBA advanced profile database first for instant rich metrics
    const curatedNba = basketballResearchService.getPlayers().find(p => p.id === athleteId);

    try {
      const url = `https://site.api.espn.com/apis/common/v3/sports/${sport}/${league}/athletes/${athleteId}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });

      if (res.ok) {
        const data: any = await res.json();
        const a = data.athlete || {};

        const overviewStats: Array<{ label: string; value: string }> = [];
        if (data.statsSummary?.statistics) {
          for (const stat of data.statsSummary.statistics.slice(0, 6)) {
            overviewStats.push({
              label: stat.label || stat.name,
              value: stat.displayValue || String(stat.value),
            });
          }
        }

        if (curatedNba) {
          overviewStats.push(
            { label: 'True Shooting (TS%)', value: `${curatedNba.tsPct}%` },
            { label: 'Effective FG (eFG%)', value: `${curatedNba.efgPct}%` },
            { label: 'PER / BPM / VORP', value: `${curatedNba.per} / +${curatedNba.bpm} / ${curatedNba.vorp}` },
            { label: 'Usage Rate (USG%)', value: `${curatedNba.usgPct}%` },
          );
        }

        const profile: AthleteProfileDetails = {
          id: athleteId,
          name: a.displayName || `${a.firstName || ''} ${a.lastName || ''}`.trim() || curatedNba?.name || 'Player Profile',
          firstName: a.firstName,
          lastName: a.lastName,
          jersey: a.jersey || curatedNba?.jersey,
          position: a.position?.name || a.position?.displayName || a.position?.abbreviation || curatedNba?.position,
          height: a.displayHeight || curatedNba?.height,
          weight: a.displayWeight || curatedNba?.weight,
          age: a.age || curatedNba?.age,
          college: a.college?.name || curatedNba?.college,
          experience: a.experience?.years !== undefined ? (a.experience.years === 0 ? 'Rookie' : `${a.experience.years} yrs`) : undefined,
          headshot: a.headshot?.href || curatedNba?.headshot || 'https://a.espncdn.com/combiner/i?img=/i/headshots/nophoto.png&w=260&h=190',
          teamName: a.team?.displayName || curatedNba?.team,
          teamLogo: a.team?.logos?.[0]?.href,
          statsSummary: data.statsSummary,
          overviewStats,
          biography: curatedNba
            ? `${curatedNba.archetype} — ${curatedNba.signatureStat}.`
            : (a.debutYear ? `Drafted / Debuted in ${a.debutYear}. Attended ${a.college?.name || 'collegiate athletics'}.` : undefined),
        };

        this.athleteCache.set(cacheKey, profile);
        return profile;
      }
    } catch (err) {}

    if (curatedNba) {
      const nbaProfile: AthleteProfileDetails = {
        id: curatedNba.id,
        name: curatedNba.name,
        jersey: curatedNba.jersey,
        position: curatedNba.position,
        height: curatedNba.height,
        weight: curatedNba.weight,
        age: curatedNba.age,
        college: curatedNba.college,
        headshot: curatedNba.headshot,
        teamName: curatedNba.team,
        overviewStats: [
          { label: 'PPG / RPG / APG', value: `${curatedNba.ppg} / ${curatedNba.rpg} / ${curatedNba.apg}` },
          { label: 'True Shooting (TS%)', value: `${curatedNba.tsPct}%` },
          { label: 'Effective FG (eFG%)', value: `${curatedNba.efgPct}%` },
          { label: 'PER / BPM / VORP', value: `${curatedNba.per} / +${curatedNba.bpm} / ${curatedNba.vorp}` },
          { label: 'Usage Rate (USG%)', value: `${curatedNba.usgPct}%` },
          { label: 'Hollinger GmSc Avg', value: `${curatedNba.gameScoreAvg}` },
        ],
        biography: `${curatedNba.archetype} — ${curatedNba.signatureStat}.`,
      };
      this.athleteCache.set(cacheKey, nbaProfile);
      return nbaProfile;
    }

    // Fallback profile if simulated or not found — check multi-sport showcase rosters first
    const allSportShowcases = Object.values(multiSportAnalyticsService.getMultiSportShowcaseGames()).flat();
    for (const g of allSportShowcases) {
      const found = [...g.rosters.team1, ...g.rosters.team2].find(
        p => p.id === athleteId || p.name.toLowerCase() === athleteId.toLowerCase()
      );
      if (found) {
        const sportProfile: AthleteProfileDetails = {
          id: found.id,
          name: found.name,
          jersey: found.jersey,
          position: found.position,
          height: found.height || "6' 1\"",
          weight: found.weight || '192 lbs',
          age: found.age || 25,
          college: found.college || found.teamName,
          headshot: found.headshot,
          teamName: found.teamName,
          overviewStats: (found.stats || []).slice(0, 6).map((v, i) => ({
            label: g.boxscoreCategories.team1[0]?.labels[i] || `Metric ${i + 1}`,
            value: v,
          })),
          biography: `${found.teamName} ${found.position} • Active in ${g.sportBadge}.`,
        };
        this.athleteCache.set(cacheKey, sportProfile);
        return sportProfile;
      }
    }

    const fallbackProfile: AthleteProfileDetails = {
      id: athleteId,
      name: athleteId.replace(/^ath_|^soc_|^nfl_|^nhl_|^cfb_|^ncaa_/i, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Athlete Profile',
      position: sport === 'soccer' ? 'MF/FW' : sport === 'hockey' ? 'C/RW' : sport === 'football' ? 'QB/WR' : 'Starter',
      height: sport === 'soccer' ? "5' 11\"" : "6' 3\"",
      weight: sport === 'soccer' ? '168 lbs' : '212 lbs',
      headshot: buildSvgAvatarDataUri(athleteId, '10'),
      overviewStats:
        sport === 'soccer'
          ? [
              { label: 'Expected Goals (xG)', value: '0.58' },
              { label: 'Expected Assists (xA)', value: '0.42' },
              { label: 'Pass Accuracy %', value: '90.4%' },
              { label: 'Opta Match Rating', value: '8.4' },
            ]
          : sport === 'hockey'
          ? [
              { label: '5v5 Corsi (CF%)', value: '58.9%' },
              { label: 'Expected Goals (xGF%)', value: '61.2%' },
              { label: 'Individual xG (ixG)', value: '0.68' },
              { label: 'Time on Ice (TOI)', value: '20:45' },
            ]
          : sport === 'football'
          ? [
              { label: 'EPA / Play', value: '+0.29' },
              { label: 'Success Rate %', value: '54.2%' },
              { label: 'ESPN QBR / PFF Grade', value: '86.4' },
              { label: 'Yards After Contact', value: '48 YAC' },
            ]
          : [
              { label: 'True Shooting (TS%)', value: '60.4%' },
              { label: 'Effective FG (eFG%)', value: '56.8%' },
              { label: 'Hollinger GmSc', value: '19.4' },
              { label: 'Net Rating', value: '+8.2' },
            ],
    };
    return fallbackProfile;
  }

  private async fetchFromESPN(stream: StreamItem): Promise<SportsGamecastIntel | null> {
    const sportPath = this.resolveSportPath(stream.category, stream.league);
    if (!sportPath) return null;

    const scoreboardUrl = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/scoreboard`;
    const res = await fetch(scoreboardUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;

    const scoreboard: any = await res.json();
    const events: any[] = scoreboard.events || [];

    // Parse team tokens
    const streamName = stream.name.toLowerCase();
    const t1Raw = (stream.team1?.name || streamName.split(/vs|at/i)[0] || '').toLowerCase().trim();
    const t2Raw = (stream.team2?.name || streamName.split(/vs|at/i)[1] || '').toLowerCase().trim();

    let matchedEvent: any = null;

    for (const event of events) {
      const evName = (event.name || '').toLowerCase();
      const comps: any[] = event.competitions?.[0]?.competitors || [];
      const c0Name = (comps[0]?.team?.displayName || '').toLowerCase();
      const c1Name = (comps[1]?.team?.displayName || '').toLowerCase();
      const c0Short = (comps[0]?.team?.shortDisplayName || '').toLowerCase();
      const c1Short = (comps[1]?.team?.shortDisplayName || '').toLowerCase();
      const c0Mascot = (comps[0]?.team?.name || '').toLowerCase();
      const c1Mascot = (comps[1]?.team?.name || '').toLowerCase();

      const team1Matches = t1Raw && (
        c0Name.includes(t1Raw) || t1Raw.includes(c0Name) ||
        c1Name.includes(t1Raw) || t1Raw.includes(c1Name) ||
        c0Short.includes(t1Raw) || t1Raw.includes(c0Short) ||
        c1Short.includes(t1Raw) || t1Raw.includes(c1Short) ||
        c0Mascot.includes(t1Raw) || t1Raw.includes(c0Mascot) ||
        c1Mascot.includes(t1Raw) || t1Raw.includes(c1Mascot)
      );

      const team2Matches = t2Raw && (
        c0Name.includes(t2Raw) || t2Raw.includes(c0Name) ||
        c1Name.includes(t2Raw) || t2Raw.includes(c1Name) ||
        c0Short.includes(t2Raw) || t2Raw.includes(c0Short) ||
        c1Short.includes(t2Raw) || t2Raw.includes(c1Short) ||
        c0Mascot.includes(t2Raw) || t2Raw.includes(c0Mascot) ||
        c1Mascot.includes(t2Raw) || t2Raw.includes(c1Mascot)
      );

      if ((team1Matches && team2Matches) || evName.includes(t1Raw) || evName.includes(t2Raw)) {
        matchedEvent = event;
        break;
      }
    }

    // Fetch News Articles
    let newsArticles: any[] = [];
    try {
      const newsRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sportPath}/news`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (newsRes.ok) {
        const newsJson: any = await newsRes.json();
        newsArticles = (newsJson.articles || []).slice(0, 4).map((a: any) => ({
          title: a.headline,
          description: a.description || '',
          link: a.links?.web?.href || 'https://espn.com',
          image: a.images?.[0]?.url,
          published: a.published,
        }));
      }
    } catch (e) {}

    if (!matchedEvent) {
      return null;
    }

    // Fetch deep summary (box score, players, drives, leaders)
    let summary: any = {};
    try {
      const sumRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sportPath}/summary?event=${matchedEvent.id}`);
      if (sumRes.ok) {
        summary = (await sumRes.json()) as any;
      }
    } catch (e) {}

    const comp = matchedEvent.competitions[0];
    const competitors: any[] = comp.competitors || [];

    // CRITICAL BUG FIX: Match comp1 with stream.team1, and comp2 with stream.team2
    // Never assume competitors[0] is team1 or home is team1!
    let comp1 = competitors.find((c: any) => {
      const dName = (c.team?.displayName || '').toLowerCase();
      const sName = (c.team?.shortDisplayName || '').toLowerCase();
      const loc = (c.team?.location || '').toLowerCase();
      const mas = (c.team?.name || '').toLowerCase();
      return (t1Raw && (dName.includes(t1Raw) || t1Raw.includes(dName) || sName.includes(t1Raw) || t1Raw.includes(sName) || mas.includes(t1Raw) || t1Raw.includes(mas) || loc.includes(t1Raw) || t1Raw.includes(loc)));
    });

    let comp2 = competitors.find((c: any) => {
      const dName = (c.team?.displayName || '').toLowerCase();
      const sName = (c.team?.shortDisplayName || '').toLowerCase();
      const loc = (c.team?.location || '').toLowerCase();
      const mas = (c.team?.name || '').toLowerCase();
      return (t2Raw && (dName.includes(t2Raw) || t2Raw.includes(dName) || sName.includes(t2Raw) || t2Raw.includes(sName) || mas.includes(t2Raw) || t2Raw.includes(mas) || loc.includes(t2Raw) || t2Raw.includes(loc)));
    });

    if (!comp1 && !comp2) {
      comp1 = competitors[0];
      comp2 = competitors[1];
    } else if (!comp1) {
      comp1 = competitors.find((c: any) => c !== comp2) || competitors[0];
    } else if (!comp2) {
      comp2 = competitors.find((c: any) => c !== comp1) || competitors[1];
    }

    // Correct Win Probability calculation
    let winProb: { team1Percentage: number; team2Percentage: number } | undefined;
    if (summary.winprobability && summary.winprobability.length > 0) {
      const latest = summary.winprobability[summary.winprobability.length - 1];
      const rawHomePct = Math.round((latest.homeWinPercentage || 0.5) * 100);

      // If comp1 is the home team, comp1 has homePct. If comp2 is home, comp1 has 100 - homePct!
      if (comp1.homeAway === 'home') {
        winProb = {
          team1Percentage: rawHomePct,
          team2Percentage: 100 - rawHomePct,
        };
      } else {
        winProb = {
          team1Percentage: 100 - rawHomePct,
          team2Percentage: rawHomePct,
        };
      }
    }

    // Team comparison stats
    const statsList: Array<{ label: string; team1Value: string; team2Value: string }> = [];
    if (summary.boxscore?.teams) {
      // Find the stats array corresponding to comp1 and comp2
      const teamBoxscores = summary.boxscore.teams;
      const t1StatsObj = teamBoxscores.find((tb: any) => tb.team?.id === comp1.team?.id) || teamBoxscores[0];
      const t2StatsObj = teamBoxscores.find((tb: any) => tb.team?.id === comp2.team?.id) || teamBoxscores[1];

      const t1Stats = t1StatsObj?.statistics || [];
      const t2Stats = t2StatsObj?.statistics || [];

      for (let i = 0; i < Math.min(t1Stats.length, t2Stats.length, 10); i++) {
        statsList.push({
          label: t1Stats[i].label || t1Stats[i].name,
          team1Value: t1Stats[i].displayValue || String(t1Stats[i].value),
          team2Value: t2Stats[i].displayValue || String(t2Stats[i].value),
        });
      }
    }

    // Key Leaders (StatMuse / Reference style)
    const leadersList: Array<{
      category: string;
      athlete: AthleteInfo;
      statline: string;
      teamName?: string;
    }> = [];

    if (summary.leaders && Array.isArray(summary.leaders)) {
      const flatCats: any[] = [];
      for (const item of summary.leaders) {
        if (item.team && Array.isArray(item.leaders)) {
          for (const subCat of item.leaders) {
            flatCats.push({
              ...subCat,
              teamName: item.team?.displayName,
            });
          }
        } else {
          flatCats.push(item);
        }
      }

      for (const cat of flatCats.slice(0, 6)) {
        const leaderObj = cat.leaders?.[0];
        if (leaderObj?.athlete) {
          leadersList.push({
            category: cat.displayName || cat.name || 'Key Leader',
            athlete: {
              id: leaderObj.athlete.id,
              name: leaderObj.athlete.displayName,
              headshot: leaderObj.athlete.headshot?.href || 'https://a.espncdn.com/combiner/i?img=/i/headshots/nophoto.png&w=120&h=90',
              position: leaderObj.athlete.position?.abbreviation,
              jersey: leaderObj.athlete.jersey,
            },
            statline: leaderObj.displayValue ? `${leaderObj.displayValue} ${cat.displayName || ''}`.trim() : (leaderObj.value ? String(leaderObj.value) : ''),
            teamName: cat.teamName || leaderObj.team?.displayName,
          });
        }
      }
    }

    // DEEP BOX SCORE (Players by Category)
    let parsedBoxScore: { team1: TeamBoxScore; team2: TeamBoxScore } | undefined;
    const team1Roster: AthleteInfo[] = [];
    const team2Roster: AthleteInfo[] = [];
    const advPlayersT1: PlayerAdvancedBoxRow[] = [];
    const advPlayersT2: PlayerAdvancedBoxRow[] = [];

    if (summary.boxscore?.players && Array.isArray(summary.boxscore.players)) {
      const p1Obj = summary.boxscore.players.find((p: any) => p.team?.id === comp1.team?.id) || summary.boxscore.players[0];
      const p2Obj = summary.boxscore.players.find((p: any) => p.team?.id === comp2.team?.id) || summary.boxscore.players[1];

      const parsePlayerTeam = (pObj: any, rosterArr: AthleteInfo[], advRowsOut: PlayerAdvancedBoxRow[]): TeamBoxScore => {
        const cats: BoxScoreCategory[] = [];
        const seenAthletes = new Set<string>();
        const teamName = pObj?.team?.displayName || 'Team';
        const teamAbbr = pObj?.team?.abbreviation || teamName.slice(0, 3).toUpperCase();

        for (const statCat of (pObj?.statistics || [])) {
          const catAthletes: AthleteInfo[] = [];
          const starters: AthleteInfo[] = [];
          const bench: AthleteInfo[] = [];
          const advancedAthletes: AthleteInfo[] = [];
          const labels: string[] = statCat.labels || [];

          for (const aObj of (statCat.athletes || [])) {
            const a = aObj.athlete || {};
            const athInfo: AthleteInfo = {
              id: a.id,
              name: a.displayName || 'Player',
              jersey: a.jersey,
              position: a.position?.abbreviation || a.position?.name,
              headshot: a.headshot?.href || 'https://a.espncdn.com/combiner/i?img=/i/headshots/nophoto.png&w=120&h=90',
              stats: aObj.stats || [],
              teamName,
            };
            catAthletes.push(athInfo);

            if (aObj.starter === true) {
              starters.push(athInfo);
            } else if (aObj.starter === false) {
              bench.push(athInfo);
            }

            if (sportPath === 'basketball/nba' && Array.isArray(aObj.stats) && aObj.stats.length > 0 && !aObj.didNotPlay) {
              const advRow = basketballResearchService.buildPlayerAdvancedRow(aObj, labels, teamName, teamAbbr);
              advRowsOut.push(advRow);
              advancedAthletes.push({
                ...athInfo,
                stats: [
                  String(advRow.min),
                  String(advRow.pts),
                  String(advRow.gameScore),
                  `${advRow.tsPct}%`,
                  `${advRow.efgPct}%`,
                  `${advRow.usgPct}%`,
                  advRow.bpm >= 0 ? `+${advRow.bpm}` : String(advRow.bpm),
                  advRow.wpa >= 0 ? `+${advRow.wpa}%` : `${advRow.wpa}%`,
                  String(advRow.stocks),
                  advRow.plusMinus > 0 ? `+${advRow.plusMinus}` : String(advRow.plusMinus),
                ],
              });
            }

            if (a.id && !seenAthletes.has(a.id)) {
              seenAthletes.add(a.id);
              rosterArr.push(athInfo);
            }
          }

          if (starters.length > 0 && bench.length > 0) {
            cats.push({
              name: 'starters',
              displayName: 'Starters',
              labels,
              athletes: starters,
            });
            cats.push({
              name: 'bench',
              displayName: 'Bench',
              labels,
              athletes: bench,
            });
            if (advancedAthletes.length > 0) {
              cats.push({
                name: 'advanced',
                displayName: 'Advanced Analytics',
                labels: ['MIN', 'PTS', 'GmSc', 'TS%', 'eFG%', 'USG%', 'BPM', 'WPA', 'STOCKS', '+/-'],
                athletes: advancedAthletes,
              });
            }
            cats.push({
              name: 'all',
              displayName: 'All Players',
              labels,
              athletes: catAthletes,
            });
          } else {
            cats.push({
              name: statCat.name || statCat.type || 'stats',
              displayName: statCat.displayName || (statCat.name ? statCat.name.toUpperCase() : 'Full Team Stats'),
              labels,
              athletes: catAthletes,
            });
            if (advancedAthletes.length > 0) {
              cats.push({
                name: 'advanced',
                displayName: 'Advanced Analytics',
                labels: ['MIN', 'PTS', 'GmSc', 'TS%', 'eFG%', 'USG%', 'BPM', 'WPA', 'STOCKS', '+/-'],
                athletes: advancedAthletes,
              });
            }
          }
        }

        return {
          teamName,
          teamLogo: pObj?.team?.logo || '',
          categories: cats,
        };
      };

      parsedBoxScore = {
        team1: parsePlayerTeam(p1Obj, team1Roster, advPlayersT1),
        team2: parsePlayerTeam(p2Obj, team2Roster, advPlayersT2),
      };
    }

    // Scoring plays
    const scoringPlaysList: Array<{
      period: string;
      clock: string;
      teamLogo?: string;
      teamName: string;
      score: string;
      description: string;
    }> = [];

    if (summary.scoringPlays && Array.isArray(summary.scoringPlays)) {
      for (const sp of summary.scoringPlays.slice(-8)) {
        scoringPlaysList.push({
          period: sp.period?.displayName || `Q${sp.period?.number || 1}`,
          clock: sp.clock?.displayValue || '',
          teamLogo: sp.team?.logo,
          teamName: sp.team?.displayName || '',
          score: `${sp.awayScore || 0} - ${sp.homeScore || 0}`,
          description: sp.text || sp.type?.text || '',
        });
      }
    } else if (summary.plays && Array.isArray(summary.plays)) {
      // In basketball / soccer where scoringPlays is not present, extract latest plays
      const recentPlays = summary.plays.slice(-8);
      for (const sp of recentPlays) {
        scoringPlaysList.push({
          period: sp.period?.displayValue || `Period ${sp.period?.number || 1}`,
          clock: sp.clock?.displayValue || '',
          teamLogo: undefined,
          teamName: sp.team?.id ? (sp.team.id === comp1.team?.id ? comp1.team?.displayName : comp2.team?.displayName) : '',
          score: (sp.awayScore !== undefined && sp.homeScore !== undefined) ? `${sp.awayScore} - ${sp.homeScore}` : '',
          description: sp.text || sp.shortDescription || 'Live play in action',
        });
      }
    }

    // Venue & Odds
    const gameInfoObj = {
      venue: summary.gameInfo?.venue?.fullName || comp.venue?.fullName || 'Main Stadium',
      city: summary.gameInfo?.venue?.address?.city || comp.venue?.address?.city || '',
      attendance: summary.gameInfo?.attendance ? Number(summary.gameInfo.attendance).toLocaleString() : undefined,
      weather: summary.gameInfo?.weather?.displayValue,
      broadcast: comp.broadcasts?.[0]?.names?.join(', ') || 'Free_BallStats HD Stream',
      odds: summary.odds?.[0]?.details || summary.pickcenter?.[0]?.details,
      overUnder: summary.odds?.[0]?.overUnder ? `O/U ${summary.odds[0].overUnder}` : undefined,
    };

    const parseCompLinescores = (c: any): number[] => {
      if (Array.isArray(c?.linescores) && c.linescores.length > 0) {
        return c.linescores.map((ls: any) => Number(ls.displayValue || ls.value || 0));
      }
      return [];
    };

    const t1QuartersRaw = parseCompLinescores(comp1);
    const t2QuartersRaw = parseCompLinescores(comp2);
    const rawState = matchedEvent.status?.type?.state;
    const espnGameState: 'pre' | 'in' | 'post' =
      rawState === 'pre' ? 'pre' : rawState === 'in' ? 'in' : 'post';

    let basketballAnalytics: BasketballGameDeepAnalytics | undefined;
    if (sportPath === 'basketball/nba' || stream.category === 'basketball') {
      basketballAnalytics = basketballResearchService.buildGameAnalyticsFromPlayers({
        eventId: String(matchedEvent.id || stream.stream_key),
        gameState: espnGameState,
        status: matchedEvent.status?.type?.detail || 'Live Broadcast',
        detail: matchedEvent.status?.type?.shortDetail || 'LIVE',
        isLive: espnGameState === 'in',
        venue: gameInfoObj.venue || 'NBA Arena',
        broadcast: gameInfoObj.broadcast || 'NBA Broadcast',
        team1Meta: {
          id: String(comp1?.team?.id || '1'),
          name: comp1?.team?.displayName || stream.team1?.name || 'Team 1',
          abbr: comp1?.team?.abbreviation || 'TM1',
          logo: comp1?.team?.logo || stream.team1?.logo || '',
          score: Number(comp1?.score || 0),
          quarters: t1QuartersRaw.length > 0 ? t1QuartersRaw : undefined,
        },
        team2Meta: {
          id: String(comp2?.team?.id || '2'),
          name: comp2?.team?.displayName || stream.team2?.name || 'Team 2',
          abbr: comp2?.team?.abbreviation || 'TM2',
          logo: comp2?.team?.logo || stream.team2?.logo || '',
          score: Number(comp2?.score || 0),
          quarters: t2QuartersRaw.length > 0 ? t2QuartersRaw : undefined,
        },
        rawPlayers1: advPlayersT1,
        rawPlayers2: advPlayersT2,
      });
    }

    const linescoreObj = basketballAnalytics
      ? {
          periodHeaders: basketballAnalytics.linescore.periodHeaders,
          team1Quarters: basketballAnalytics.linescore.team1.quarters,
          team2Quarters: basketballAnalytics.linescore.team2.quarters,
          team1Total: basketballAnalytics.linescore.team1.total,
          team2Total: basketballAnalytics.linescore.team2.total,
        }
      : t1QuartersRaw.length > 0
      ? {
          periodHeaders: t1QuartersRaw.map((_, idx) => (idx < 4 ? `Q${idx + 1}` : `OT${idx - 3}`)),
          team1Quarters: t1QuartersRaw,
          team2Quarters: t2QuartersRaw,
          team1Total: Number(comp1?.score || 0),
          team2Total: Number(comp2?.score || 0),
        }
      : undefined;

    const fallbackForMissing = (!parsedBoxScore || (team1Roster.length === 0 && team2Roster.length === 0))
      ? this.generateComprehensiveFallback({
          ...stream,
          team1: { name: comp1?.team?.displayName || stream.team1?.name || 'Team 1', logo: comp1?.team?.logo || '' },
          team2: { name: comp2?.team?.displayName || stream.team2?.name || 'Team 2', logo: comp2?.team?.logo || '' },
        })
      : null;

    const sportAnalyticsObj = multiSportAnalyticsService.buildSportDeepAnalytics(
      {
        ...stream,
        team1: { name: comp1?.team?.displayName || stream.team1?.name || 'Team 1', logo: comp1?.team?.logo || '' },
        team2: { name: comp2?.team?.displayName || stream.team2?.name || 'Team 2', logo: comp2?.team?.logo || '' },
      },
      {
        team1Score: Number(comp1?.score || 0),
        team2Score: Number(comp2?.score || 0),
        gameState: espnGameState,
        status: matchedEvent.status?.type?.detail || 'Scheduled',
        detail: matchedEvent.status?.type?.shortDetail || 'LIVE',
        team1Quarters: t1QuartersRaw.length > 0 ? t1QuartersRaw : undefined,
        team2Quarters: t2QuartersRaw.length > 0 ? t2QuartersRaw : undefined,
        team1Record: comp1?.records?.[0]?.summary,
        team2Record: comp2?.records?.[0]?.summary,
        team1Logo: comp1?.team?.logo,
        team2Logo: comp2?.team?.logo,
      }
    );

    return {
      stream_key: stream.stream_key,
      source: 'espn',
      sportPath,
      scoreboard: {
        team1: {
          name: comp1?.team?.displayName || stream.team1?.name || 'Team 1',
          logo: comp1?.team?.logo || stream.team1?.logo || sportAnalyticsObj.team1Meta.logo,
          score: comp1?.score || String(sportAnalyticsObj.team1Meta.score),
          record: comp1?.records?.[0]?.summary || sportAnalyticsObj.team1Meta.record,
          isHome: comp1?.homeAway === 'home',
        },
        team2: {
          name: comp2?.team?.displayName || stream.team2?.name || 'Team 2',
          logo: comp2?.team?.logo || stream.team2?.logo || sportAnalyticsObj.team2Meta.logo,
          score: comp2?.score || String(sportAnalyticsObj.team2Meta.score),
          record: comp2?.records?.[0]?.summary || sportAnalyticsObj.team2Meta.record,
          isHome: comp2?.homeAway === 'home',
        },
        status: matchedEvent.status?.type?.detail || sportAnalyticsObj.status,
        detail: matchedEvent.status?.type?.shortDetail || sportAnalyticsObj.detail,
        clock: matchedEvent.status?.displayClock,
        period: matchedEvent.status?.period,
        downDistance: summary.drives?.current?.description || sportAnalyticsObj.situationBanner,
      },
      winProbability: winProb || {
        team1Percentage: sportAnalyticsObj.winProbTimeline[sportAnalyticsObj.winProbTimeline.length - 1]?.team1WinPct ?? 58,
        team2Percentage: 100 - (sportAnalyticsObj.winProbTimeline[sportAnalyticsObj.winProbTimeline.length - 1]?.team1WinPct ?? 58),
      },
      stats: statsList.length > 0 ? statsList : sportAnalyticsObj.teamStatsComparison,
      leaders: leadersList.length > 0 ? leadersList : (fallbackForMissing?.leaders || []),
      boxscore: (parsedBoxScore && (parsedBoxScore.team1.categories.length > 0 || parsedBoxScore.team2.categories.length > 0))
        ? parsedBoxScore
        : fallbackForMissing?.boxscore,
      rosters: (team1Roster.length > 0 || team2Roster.length > 0)
        ? { team1: team1Roster, team2: team2Roster }
        : fallbackForMissing?.rosters,
      scoringPlays: scoringPlaysList.length > 0 ? scoringPlaysList : sportAnalyticsObj.scoringTimeline,
      gameInfo: gameInfoObj,
      news: newsArticles,
      linescore: linescoreObj || sportAnalyticsObj.linescore,
      basketballAnalytics: basketballAnalytics || fallbackForMissing?.basketballAnalytics,
      sportAnalytics: sportAnalyticsObj,
    };
  }

  private resolveSportPath(category: string, league?: string): string | null {
    const cat = (category || '').toLowerCase();
    const l = (league || '').toLowerCase();

    if (cat === 'football' || l.includes('nfl') || l.includes('cfb') || l.includes('ncaa')) {
      if (l.includes('ncaa') || l.includes('college') || l.includes('cfb') || l.includes('sec') || l.includes('big ten')) {
        return 'football/college-football';
      }
      return 'football/nfl';
    }
    if (cat === 'basketball' || l.includes('nba') || l.includes('ncaa')) {
      if (l.includes('ncaa') || l.includes('college')) {
        return 'basketball/mens-college-basketball';
      }
      return 'basketball/nba';
    }
    if (cat === 'baseball' || l.includes('mlb')) return 'baseball/mlb';
    if (cat === 'hockey' || l.includes('nhl')) return 'hockey/nhl';

    if (cat === 'soccer') {
      if (l.includes('nations')) return 'soccer/uefa.nations';
      if (l.includes('champions') || l.includes('ucl')) return 'soccer/uefa.champions';
      if (l.includes('europa')) return 'soccer/uefa.europa';
      if (l.includes('premier') || l.includes('eng') || l.includes('epl')) return 'soccer/eng.1';
      if (l.includes('serie') || l.includes('ita')) return 'soccer/ita.1';
      if (l.includes('la liga') || l.includes('esp')) return 'soccer/esp.1';
      if (l.includes('bundesliga') || l.includes('ger')) return 'soccer/ger.1';
      if (l.includes('ligue') || l.includes('fra')) return 'soccer/fra.1';
      if (l.includes('mls') || l.includes('usa')) return 'soccer/usa.1';
      return 'soccer/eng.1';
    }

    return null;
  }

  private generateComprehensiveFallback(stream: StreamItem): SportsGamecastIntel {
    const detectedSport = multiSportAnalyticsService.detectSportType(stream);
    const isProBasketball = detectedSport === 'basketball';

    const t1Name = stream.team1?.name || stream.name.split(/vs|at|-/i)[0]?.trim() || 'Team A';
    const t2Name = stream.team2?.name || stream.name.split(/vs|at|-/i)[1]?.trim() || 'Team B';

    // For Soccer, NFL, College Football (NCAAF), NHL Hockey, College Basketball (NCAAB), etc.
    // use the dedicated MultiSportAnalyticsService for 100% authentic rosters, stats, SVG maps & Smart Cards
    if (!isProBasketball) {
      const sa = multiSportAnalyticsService.buildSportDeepAnalytics(stream);
      const sportPath =
        this.resolveSportPath(stream.category, stream.league) ||
        (sa.sportType === 'soccer'
          ? 'soccer/uefa.nations'
          : sa.sportType === 'hockey'
          ? 'hockey/nhl'
          : sa.sportType === 'ncaaf'
          ? 'football/college-football'
          : sa.sportType === 'ncaab'
          ? 'basketball/mens-college-basketball'
          : 'football/nfl');

      const p1Leader = sa.rosters.team1[0];
      const p2Leader = sa.rosters.team2[0];
      const lastWp = sa.winProbTimeline[sa.winProbTimeline.length - 1]?.team1WinPct ?? 64;

      return {
        stream_key: stream.stream_key,
        source: 'reference_engine',
        sportPath,
        scoreboard: {
          team1: {
            name: sa.team1Meta.name,
            logo: sa.team1Meta.logo,
            score: String(sa.team1Meta.score),
            record: sa.team1Meta.record,
            isHome: true,
          },
          team2: {
            name: sa.team2Meta.name,
            logo: sa.team2Meta.logo,
            score: String(sa.team2Meta.score),
            record: sa.team2Meta.record,
            isHome: false,
          },
          status: sa.status,
          detail: sa.detail,
          clock: sa.detail,
          period: sa.linescore.periodHeaders.length,
          downDistance: sa.situationBanner,
        },
        winProbability: {
          team1Percentage: lastWp,
          team2Percentage: 100 - lastWp,
        },
        stats: sa.teamStatsComparison,
        leaders: [
          ...(p1Leader
            ? [
                {
                  category: `${sa.team1Meta.abbreviation} Impact Leader (${sa.mvpPerformer.impactBadge})`,
                  athlete: p1Leader,
                  statline: `${sa.mvpPerformer.primaryLine} • ${sa.mvpPerformer.efficiencyLine}`,
                  teamName: sa.team1Meta.name,
                },
              ]
            : []),
          ...(p2Leader
            ? [
                {
                  category: `${sa.team2Meta.abbreviation} Key Performer`,
                  athlete: p2Leader,
                  statline: (p2Leader.stats || []).slice(0, 5).join(' • '),
                  teamName: sa.team2Meta.name,
                },
              ]
            : []),
        ],
        boxscore: {
          team1: {
            teamName: sa.team1Meta.name,
            teamLogo: sa.team1Meta.logo,
            categories: sa.boxscoreCategories.team1,
          },
          team2: {
            teamName: sa.team2Meta.name,
            teamLogo: sa.team2Meta.logo,
            categories: sa.boxscoreCategories.team2,
          },
        },
        rosters: sa.rosters,
        scoringPlays: sa.scoringTimeline,
        gameInfo: {
          venue: sa.venue,
          city: sa.sportBadge,
          broadcast: sa.broadcast,
          odds:
            sa.sportType === 'soccer'
              ? `${sa.team1Meta.abbreviation} -115 • Draw +235 (O/U 2.5 Goals)`
              : sa.sportType === 'hockey'
              ? `${sa.team1Meta.abbreviation} -1.5 Puck Line (O/U 6.5 Goals)`
              : `${sa.team1Meta.abbreviation} -3.5 (O/U 48.5)`,
          overUnder: sa.paceAndProjection.projectedFinal,
        },
        news: sa.inGameInsights.map(ins => ({
          title: `${ins.category}: ${ins.title}`,
          description: ins.detail,
          link: 'https://fbref.com',
        })),
        linescore: sa.linescore,
        sportAnalytics: sa,
      };
    }

    const isFootball = false;
    const isBasketball = true;
    const isSoccer = false;

    let mockAthletesT1: AthleteInfo[] = [];
    let mockAthletesT2: AthleteInfo[] = [];
    let t1Categories: BoxScoreCategory[] = [];
    let t2Categories: BoxScoreCategory[] = [];
    let fallbackBasketballAnalytics: BasketballGameDeepAnalytics | undefined;
    let fallbackLinescore: SportsGamecastIntel['linescore'] | undefined;

    if (isBasketball) {
      const nbaLabels = ['MIN', 'PTS', 'FG', '3PT', 'FT', 'REB', 'AST', 'TO', 'STL', 'BLK', '+/-'];
      const resolveNbaMeta = (tName: string, isT1: boolean): { abbr: string; logo: string } => {
        const low = tName.toLowerCase();
        if (low.includes('laker') || low === 'lal') return { abbr: 'LAL', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png' };
        if (low.includes('sun') || low.includes('phoenix') || low === 'phx') return { abbr: 'PHX', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/phx.png' };
        if (low.includes('piston') || low.includes('detroit') || low === 'det') return { abbr: 'DET', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/det.png' };
        if (low.includes('celtic') || low.includes('boston') || low === 'bos') return { abbr: 'BOS', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/bos.png' };
        if (low.includes('warrior') || low.includes('golden state') || low === 'gsw') return { abbr: 'GSW', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/gs.png' };
        if (low.includes('nugget') || low.includes('denver') || low === 'den') return { abbr: 'DEN', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/den.png' };
        if (low.includes('thunder') || low.includes('oklahoma') || low === 'okc') return { abbr: 'OKC', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/okc.png' };
        if (low.includes('knick') || low.includes('new york') || low === 'nyk') return { abbr: 'NYK', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/nyk.png' };
        if (low.includes('buck') || low.includes('milwaukee') || low === 'mil') return { abbr: 'MIL', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/mil.png' };
        if (low.includes('maverick') || low.includes('dallas') || low === 'dal') return { abbr: 'DAL', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/dal.png' };
        if (low.includes('timberwolv') || low.includes('minnesota') || low === 'min') return { abbr: 'MIN', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/min.png' };
        if (low.includes('cavalier') || low.includes('cleveland') || low === 'cle') return { abbr: 'CLE', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/cle.png' };
        if (low.includes('spur') || low.includes('san antonio') || low === 'sas') return { abbr: 'SAS', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/sas.png' };
        const abbr = tName.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || (isT1 ? 'TM1' : 'TM2');
        const c1 = isT1 ? '#7c3aed' : '#0284c7';
        const c2 = isT1 ? '#c084fc' : '#38bdf8';
        return {
          abbr,
          logo: stream.team1?.logo && isT1 ? stream.team1.logo : stream.team2?.logo && !isT1 ? stream.team2.logo : buildSvgTeamCrestDataUri(tName, c1, c2),
        };
      };

      const m1 = resolveNbaMeta(t1Name, true);
      const m2 = resolveNbaMeta(t2Name, false);
      const t1Abbr = m1.abbr;
      const t2Abbr = m2.abbr;

      const advRows1 = basketballResearchService.getDefaultTeamPlayers(t1Name, t1Abbr, true);
      const advRows2 = basketballResearchService.getDefaultTeamPlayers(t2Name, t2Abbr, false);

      const rowToAthleteInfo = (r: PlayerAdvancedBoxRow, tName: string): AthleteInfo => ({
        id: r.id,
        name: r.name,
        jersey: r.jersey,
        position: r.position,
        headshot: r.headshot,
        teamName: tName,
        stats: [
          String(r.min),
          String(r.pts),
          r.fg,
          r.threePt,
          r.ft,
          String(r.reb),
          String(r.ast),
          String(r.tov),
          String(r.stl),
          String(r.blk),
          r.plusMinus >= 0 ? `+${r.plusMinus}` : String(r.plusMinus),
        ],
      });

      mockAthletesT1 = advRows1.filter(r => r.starter).map(r => rowToAthleteInfo(r, t1Name));
      const benchT1 = advRows1.filter(r => !r.starter).map(r => rowToAthleteInfo(r, t1Name));
      mockAthletesT2 = advRows2.filter(r => r.starter).map(r => rowToAthleteInfo(r, t2Name));
      const benchT2 = advRows2.filter(r => !r.starter).map(r => rowToAthleteInfo(r, t2Name));
      const r1 = { abbr: t1Abbr, logo: m1.logo };
      const r2 = { abbr: t2Abbr, logo: m2.logo };

      const toAdvCategory = (rows: PlayerAdvancedBoxRow[], tName: string): BoxScoreCategory => ({
        name: 'advanced',
        displayName: 'Advanced Analytics',
        labels: ['MIN', 'PTS', 'GmSc', 'TS%', 'eFG%', 'USG%', 'BPM', 'WPA', 'STOCKS', '+/-'],
        athletes: rows.map(r => ({
          id: r.id,
          name: r.name,
          jersey: r.jersey,
          position: r.position,
          headshot: r.headshot,
          teamName: tName,
          stats: [
            String(r.min),
            String(r.pts),
            String(r.gameScore),
            `${r.tsPct}%`,
            `${r.efgPct}%`,
            `${r.usgPct}%`,
            r.bpm >= 0 ? `+${r.bpm}` : String(r.bpm),
            r.wpa >= 0 ? `+${r.wpa}%` : `${r.wpa}%`,
            String(r.stocks),
            r.plusMinus > 0 ? `+${r.plusMinus}` : String(r.plusMinus),
          ],
        })),
      });

      const allT1 = [...mockAthletesT1, ...benchT1];
      const allT2 = [...mockAthletesT2, ...benchT2];

      t1Categories = [
        { name: 'starters', displayName: 'Starters', labels: nbaLabels, athletes: mockAthletesT1 },
        { name: 'bench', displayName: 'Bench', labels: nbaLabels, athletes: benchT1 },
        toAdvCategory(advRows1, t1Name),
        { name: 'all', displayName: 'All Players', labels: nbaLabels, athletes: allT1 },
      ];
      t2Categories = [
        { name: 'starters', displayName: 'Starters', labels: nbaLabels, athletes: mockAthletesT2 },
        { name: 'bench', displayName: 'Bench', labels: nbaLabels, athletes: benchT2 },
        toAdvCategory(advRows2, t2Name),
        { name: 'all', displayName: 'All Players', labels: nbaLabels, athletes: allT2 },
      ];

      mockAthletesT1 = allT1;
      mockAthletesT2 = allT2;

      fallbackBasketballAnalytics = basketballResearchService.buildGameAnalyticsFromPlayers({
        eventId: stream.stream_key,
        status: '4th Quarter • 4:18 Remaining',
        detail: 'LIVE Q4',
        isLive: true,
        venue: 'NBA Championship Arena',
        broadcast: 'Free_BallStats Live Analytics Feed',
        team1Meta: {
          id: '1',
          name: t1Name,
          abbr: t1Abbr,
          logo: stream.team1?.logo || r1.logo,
          score: 109,
          quarters: [28, 27, 28, 26],
        },
        team2Meta: {
          id: '2',
          name: t2Name,
          abbr: t2Abbr,
          logo: stream.team2?.logo || r2.logo,
          score: 105,
          quarters: [26, 28, 25, 26],
        },
        rawPlayers1: advRows1,
        rawPlayers2: advRows2,
      });

      fallbackLinescore = {
        periodHeaders: ['Q1', 'Q2', 'Q3', 'Q4'],
        team1Quarters: [28, 27, 28, 26],
        team2Quarters: [26, 28, 25, 26],
        team1Total: 109,
        team2Total: 105,
      };
    }

    return {
      stream_key: stream.stream_key,
      source: 'reference_engine',
      sportPath: this.resolveSportPath(stream.category, stream.league) || 'basketball/nba',
      scoreboard: {
        team1: {
          name: t1Name,
          logo: fallbackBasketballAnalytics?.linescore.team1.logo || stream.team1?.logo || buildSvgTeamCrestDataUri(t1Name, '#9146ff', '#00f2fe'),
          score: '109',
          record: '41-19',
          isHome: true,
        },
        team2: {
          name: t2Name,
          logo: fallbackBasketballAnalytics?.linescore.team2.logo || stream.team2?.logo || buildSvgTeamCrestDataUri(t2Name, '#0ea5e9', '#10b981'),
          score: '105',
          record: '38-22',
          isHome: false,
        },
        status: isBasketball ? '4th Quarter • 4:18 Remaining' : 'In Progress • 2nd Half',
        detail: 'LIVE BROADCAST',
        clock: isBasketball ? '4:18' : '34:20',
        period: isBasketball ? 4 : 2,
      },
      winProbability: {
        team1Percentage: 68,
        team2Percentage: 32,
      },
      stats: this.getCategoryDefaultStats(stream.category),
      leaders: [
        {
          category: isBasketball ? 'Top Scorer (31.4 GmSc)' : (isFootball ? 'Passing Leader' : 'Key Attacker'),
          athlete: mockAthletesT1[0],
          statline: isBasketball ? '26 PTS, 9 AST, 67.7% TS' : (isFootball ? '270 YDS, 2 TD' : '1 Goal, 4 Shots'),
          teamName: t1Name,
        },
        {
          category: isBasketball ? 'Top Scorer (22.8 GmSc)' : (isFootball ? 'Passing Leader' : 'Midfield Anchor'),
          athlete: mockAthletesT2[0],
          statline: isBasketball ? '25 PTS, 8 AST, 60.2% TS' : (isFootball ? '215 YDS, 1 TD' : '90% Pass Accuracy'),
          teamName: t2Name,
        },
      ],
      boxscore: {
        team1: {
          teamName: t1Name,
          teamLogo: stream.team1?.logo || '',
          categories: t1Categories,
        },
        team2: {
          teamName: t2Name,
          teamLogo: stream.team2?.logo || '',
          categories: t2Categories,
        },
      },
      rosters: {
        team1: mockAthletesT1,
        team2: mockAthletesT2,
      },
      scoringPlays: [
        {
          period: isBasketball ? 'Q1' : '1st Half',
          clock: '8:40',
          teamName: t1Name,
          score: isBasketball ? '18 - 12' : (isFootball ? '7 - 0' : '1 - 0'),
          description: isBasketball ? `${t1Name} 9-2 run sparked by transition 3-pointer and paint rim-run.` : `Opening score by ${t1Name} on clinical transition drive.`,
        },
        {
          period: isBasketball ? 'Q4' : '2nd Half',
          clock: '4:18',
          teamName: t1Name,
          score: isBasketball ? '106 - 100' : (isFootball ? '14 - 10' : '1 - 0'),
          description: isBasketball ? `Step-back 3PT dagger extends ${t1Name} lead to 6 in crunch time.` : `Field score response by ${t2Name} keeping the margin close.`,
        },
      ],
      gameInfo: {
        venue: 'Official Arena',
        city: 'Metropolitan Center',
        broadcast: 'Free_BallStats Live Stream',
        odds: `${t1Name} -3.5`,
        overUnder: isBasketball ? 'O/U 224.5' : (isFootball ? 'O/U 46.5' : 'O/U 2.5'),
      },
      news: [
        {
          title: `${t1Name} vs ${t2Name}: Four Factors & In-Game Possession Breakdown`,
          description: 'Dean Oliver Four Factors (eFG%, TOV%, ORB%, FTR), rotation splits, and True Shooting trends.',
          link: 'https://www.basketball-reference.com',
        },
        {
          title: `Statistical Deep Dive: Hollinger Game Score & Pace-Adjusted Ratings`,
          description: 'Offensive and defensive efficiency per 100 possessions and live lineup net ratings.',
          link: 'https://statmuse.com',
        },
      ],
      linescore: fallbackLinescore,
      basketballAnalytics: fallbackBasketballAnalytics,
    };
  }

  private getCategoryDefaultStats(category: string): Array<{ label: string; team1Value: string; team2Value: string }> {
    const cat = (category || '').toLowerCase();

    if (cat === 'football') {
      return [
        { label: 'Total Yards', team1Value: '342', team2Value: '285' },
        { label: 'Passing Yards', team1Value: '235', team2Value: '190' },
        { label: 'Rushing Yards', team1Value: '107', team2Value: '95' },
        { label: 'First Downs', team1Value: '21', team2Value: '17' },
        { label: '3rd Down Efficiency', team1Value: '6-12 (50%)', team2Value: '4-11 (36%)' },
        { label: 'Turnovers', team1Value: '0', team2Value: '1' },
        { label: 'Time of Possession', team1Value: '32:15', team2Value: '27:45' },
      ];
    }

    if (cat === 'basketball') {
      return [
        { label: 'Field Goal %', team1Value: '48.2%', team2Value: '44.5%' },
        { label: '3-Point %', team1Value: '37.5%', team2Value: '32.1%' },
        { label: 'Free Throw %', team1Value: '85.0%', team2Value: '78.6%' },
        { label: 'Rebounds', team1Value: '44', team2Value: '39' },
        { label: 'Assists', team1Value: '26', team2Value: '21' },
        { label: 'Turnovers', team1Value: '11', team2Value: '14' },
        { label: 'Points in Paint', team1Value: '48', team2Value: '42' },
      ];
    }

    if (cat === 'soccer') {
      return [
        { label: 'Possession', team1Value: '58%', team2Value: '42%' },
        { label: 'Total Shots', team1Value: '14', team2Value: '8' },
        { label: 'Shots on Target', team1Value: '6', team2Value: '3' },
        { label: 'Corner Kicks', team1Value: '7', team2Value: '3' },
        { label: 'Fouls Committed', team1Value: '9', team2Value: '12' },
        { label: 'Expected Goals (xG)', team1Value: '1.84', team2Value: '0.92' },
        { label: 'Pass Accuracy', team1Value: '87%', team2Value: '79%' },
      ];
    }

    return [
      { label: 'Scoring Opportunities', team1Value: '12', team2Value: '9' },
      { label: 'Efficiency Rating', team1Value: '+8.4', team2Value: '+3.1' },
      { label: 'Discipline / Penalties', team1Value: '2', team2Value: '4' },
    ];
  }
}

export const sportsIntelService = new SportsIntelService();
