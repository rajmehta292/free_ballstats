import { LRUCache } from 'lru-cache';
import type { StreamItem } from '../types/stream.js';
import { basketballResearchService, type BasketballGameDeepAnalytics, type PlayerAdvancedBoxRow } from './basketball-research-service.js';
import {
  multiSportAnalyticsService,
  buildSvgTeamCrestDataUri,
  buildSvgAvatarDataUri,
  type UniversalSportDeepAnalytics,
} from './multi-sport-analytics-service.js';
import {
  redZoneIntelService,
  isRedZoneStream,
  type RedZoneSlatePayload,
} from './redzone-intel-service.js';
import { newsAggregatorService } from './news-aggregator-service.js';

export interface AthleteInfo {
  id: string;
  name: string;
  jersey?: string;
  position?: string;
  unit?: string;
  starter?: boolean;
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
    source?: string;
    categoryTag?: string;
    categoryLabel?: string;
    isEventSpecific?: boolean;
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
  redzoneIntel?: RedZoneSlatePayload;
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
  birthplace?: string;
  draftInfo?: string;
  status?: string;
  headshot: string;
  teamName?: string;
  teamLogo?: string;
  dataSource?: string;
  fetchedAt?: string;
  statsSummary?: any;
  overviewStats?: Array<{ label: string; value: string }>;
  biography?: string;
  statCategories?: Array<{
    name: string;
    displayName: string;
    labels: string[];
    glossary?: Array<{ abbreviation: string; displayName: string }>;
    rows: Array<{ season: string; team: string; stats: string[] }>;
    totals?: string[];
  }>;
  gameLog?: {
    labels: string[];
    availableSeasons: Array<{ year: string; displayName: string }>;
    selectedSeason: string;
    games: Array<{
      eventId: string;
      date: string;
      matchup: string;
      result: string;
      stats: string[];
    }>;
  };
  splitCategories?: Array<{
    name: string;
    displayName: string;
    labels: string[];
    rows: Array<{ label: string; abbr: string; stats: string[] }>;
  }>;
  rotowire?: { headline?: string; story?: string; description?: string; published?: string };
  awards?: string[];
  fantasy?: { draftRank?: string; positionRank?: string; percentOwned?: string };
}

class SportsIntelService {
  private cache: LRUCache<string, SportsGamecastIntel>;
  private athleteCache: LRUCache<string, AthleteProfileDetails>;
  private teamRosterCache: LRUCache<string, AthleteInfo[]>;

  constructor() {
    this.cache = new LRUCache<string, SportsGamecastIntel>({
      max: 200,
      ttl: 20000, // 20 seconds cache for live sports
    });

    this.athleteCache = new LRUCache<string, AthleteProfileDetails>({
      max: 500,
      ttl: 3600000, // 1 hour for athlete profiles
    });

    this.teamRosterCache = new LRUCache<string, AthleteInfo[]>({
      max: 300,
      ttl: 900000, // 15 minutes for official ESPN team rosters & positions
    });
  }

  async getGamecastIntel(
    stream: StreamItem,
    options: { pinnedEventId?: string; secondaryEventId?: string } = {}
  ): Promise<SportsGamecastIntel> {
    if (isRedZoneStream(stream)) {
      const rzSlate = await redZoneIntelService.getRedZoneSlate({
        pinnedEventId: options.pinnedEventId,
        secondaryEventId: options.secondaryEventId,
        eventSummaryFetcher: async (rawEvent, newsArticles) => {
          const comps = rawEvent.competitions?.[0]?.competitors || [];
          const awayC = comps.find((c: any) => c.homeAway === 'away') || comps[1] || comps[0];
          const homeC = comps.find((c: any) => c.homeAway === 'home') || comps[0] || comps[1];
          const syntheticStream: StreamItem = {
            ...stream,
            name: rawEvent.name || 'NFL Spotlight',
            category: 'football',
            league: 'NFL',
            team1: { name: awayC?.team?.displayName || 'Away', logo: awayC?.team?.logo || '' },
            team2: { name: homeC?.team?.displayName || 'Home', logo: homeC?.team?.logo || '' },
          };
          return this.buildGamecastIntelFromEvent(syntheticStream, 'football/nfl', rawEvent, newsArticles);
        },
      });

      if (rzSlate.spotlightIntel) {
        return {
          ...rzSlate.spotlightIntel,
          stream_key: stream.stream_key,
          redzoneIntel: rzSlate,
        };
      }

      const fallback = this.generateComprehensiveFallback({
        ...stream,
        name: 'NFL RedZone Multi-Game Command',
        team1: { name: 'AFC Spotlight', logo: '' },
        team2: { name: 'NFC Spotlight', logo: '' },
      });
      return {
        ...fallback,
        stream_key: stream.stream_key,
        redzoneIntel: rzSlate,
      };
    }

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
    try {
      const liveNews = await newsAggregatorService.getEventNews(
        stream,
        this.resolveSportPath(stream.category, stream.league),
        []
      );
      if (liveNews.length > 0) {
        fallback.news = liveNews;
      }
    } catch {}
    this.cache.set(stream.stream_key, fallback);
    return fallback;
  }

  async getAthleteProfile(
    sport: string,
    league: string,
    athleteId: string,
    opts?: { season?: string }
  ): Promise<AthleteProfileDetails> {
    // Live on-demand pull directly from ESPN Web APIs (never locked behind stale static cache)
    const curatedNba = basketballResearchService.getPlayers().find(p => p.id === athleteId);
    const cleanSport = (sport || 'basketball').toLowerCase();
    const cleanLeague = (league || (cleanSport === 'basketball' ? 'nba' : cleanSport === 'football' ? 'nfl' : cleanSport === 'hockey' ? 'nhl' : 'mlb')).toLowerCase();
    const base = `https://site.web.api.espn.com/apis/common/v3/sports/${encodeURIComponent(cleanSport)}/${encodeURIComponent(cleanLeague)}/athletes/${encodeURIComponent(athleteId)}`;
    const seasonSuffix = opts?.season ? `?season=${encodeURIComponent(opts.season)}` : '';
    const fetchJson = async (url: string): Promise<any> => {
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(4200),
        });
        return res.ok ? await res.json() : null;
      } catch {
        return null;
      }
    };

    const [infoData, overviewData, statsData, gamelogData, splitsData] = await Promise.all([
      fetchJson(base),
      fetchJson(`${base}/overview`),
      fetchJson(`${base}/stats`),
      fetchJson(`${base}/gamelog${seasonSuffix}`),
      fetchJson(`${base}/splits${seasonSuffix}`),
    ]);

    if (infoData || overviewData || statsData || gamelogData || splitsData) {
      const a = infoData?.athlete || {};

      // Parse full career & year-by-year statistical tables from /stats
      const statCategories: NonNullable<AthleteProfileDetails['statCategories']> = (statsData?.categories || []).map((cat: any) => ({
        name: String(cat.name || 'stats'),
        displayName: String(cat.displayName || cat.name || 'Statistics'),
        labels: Array.isArray(cat.labels) ? cat.labels.map(String) : [],
        glossary: Array.isArray(cat.glossary)
          ? cat.glossary.map((g: any) => ({ abbreviation: String(g.abbreviation || ''), displayName: String(g.displayName || '') }))
          : [],
        rows: (cat.statistics || []).map((st: any) => ({
          season: st.season?.displayName || String(st.season?.year || 'Season'),
          team: String(st.teamSlug || st.teamId || '').replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) || (a.team?.abbreviation || 'PRO'),
          stats: Array.isArray(st.stats) ? st.stats.map(String) : [],
        })).reverse(),
        totals: Array.isArray(cat.totals) ? cat.totals.map(String) : undefined,
      }));

      // Parse full season game-by-game logs from /gamelog
      const glLabels: string[] = Array.isArray(gamelogData?.labels) ? gamelogData.labels.map(String) : [];
      const glEventsMap: Record<string, any> = gamelogData?.events || {};
      const parsedGames: NonNullable<AthleteProfileDetails['gameLog']>['games'] = [];
      for (const stType of (gamelogData?.seasonTypes || [])) {
        for (const cat of (stType?.categories || [])) {
          for (const ev of (cat?.events || [])) {
            const eid = String(ev.eventId || '');
            const meta = glEventsMap[eid] || {};
            const dateStr = meta.gameDate
              ? new Date(meta.gameDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
              : 'Recent';
            const oppAbbr = meta.opponent?.abbreviation || meta.opponent?.displayName || 'OPP';
            const matchup = `${meta.atVs || 'vs'} ${oppAbbr}`;
            const result = `${meta.gameResult || ''} ${meta.score || ''}`.trim() || '-';
            parsedGames.push({
              eventId: eid,
              date: dateStr,
              matchup,
              result,
              stats: Array.isArray(ev.stats) ? ev.stats.map(String) : [],
            });
          }
        }
      }

      const seasonFilter = (gamelogData?.filters || []).find((f: any) => f.name === 'season');
      const availableSeasons = Array.isArray(seasonFilter?.options)
        ? seasonFilter.options.map((o: any) => ({ year: String(o.value), displayName: String(o.displayValue || o.value) }))
        : [];
      const selectedSeason = String(seasonFilter?.value || opts?.season || availableSeasons[0]?.year || 'Current');

      // Parse situational splits (Home/Road, Month, Result, Rest, Conference, Opponent)
      const spLabels: string[] = Array.isArray(splitsData?.labels) ? splitsData.labels.map(String) : [];
      const splitCategories: NonNullable<AthleteProfileDetails['splitCategories']> = (splitsData?.splitCategories || []).map((sc: any) => ({
        name: String(sc.name || 'split'),
        displayName: sc.displayName === 'split' ? 'Situational (Home / Road / Rest / Conf)' : String(sc.displayName || sc.name || 'Splits'),
        labels: spLabels,
        rows: (sc.splits || []).map((row: any) => ({
          label: String(row.displayName || row.abbreviation || '-'),
          abbr: String(row.abbreviation || row.displayName || '-'),
          stats: Array.isArray(row.stats) ? row.stats.map(String) : [],
        })),
      }));

      // Build rich live KPI overview cards from Regular Season /overview + /stats + computed efficiency
      const overviewStats: Array<{ label: string; value: string }> = [];
      const ovLabels: string[] = Array.isArray(overviewData?.statistics?.labels) ? overviewData.statistics.labels : [];
      const ovRegSplit = (overviewData?.statistics?.splits || []).find((s: any) => /regular/i.test(s.displayName || '')) || overviewData?.statistics?.splits?.[0];
      const ovCarSplit = (overviewData?.statistics?.splits || []).find((s: any) => /career/i.test(s.displayName || ''));
      const ovVal = (lbl: string): string | undefined => {
        const i = ovLabels.indexOf(lbl);
        return i >= 0 && ovRegSplit?.stats?.[i] !== undefined ? String(ovRegSplit.stats[i]) : undefined;
      };

      if (cleanSport === 'basketball' && ovRegSplit?.stats?.length) {
        const pts = ovVal('PTS');
        const reb = ovVal('REB');
        const ast = ovVal('AST');
        const fg = ovVal('FG%');
        const tp = ovVal('3P%');
        const ft = ovVal('FT%');
        const min = ovVal('MIN');
        const gp = ovVal('GP');
        const stl = ovVal('STL');
        const blk = ovVal('BLK');
        if (pts !== undefined) overviewStats.push({ label: 'PPG (Season)', value: pts });
        if (reb !== undefined) overviewStats.push({ label: 'RPG (Season)', value: reb });
        if (ast !== undefined) overviewStats.push({ label: 'APG (Season)', value: ast });
        if (fg !== undefined) overviewStats.push({ label: 'FG% / 3P% / FT%', value: `${fg}% / ${tp ?? '-'}% / ${ft ?? '-'}%` });
        if (min !== undefined || gp !== undefined) overviewStats.push({ label: 'Minutes • Games', value: `${min ?? '-'} MPG • ${gp ?? '-'} GP` });
        if (stl !== undefined || blk !== undefined) overviewStats.push({ label: 'STL / BLK Per Game', value: `${stl ?? '0'} / ${blk ?? '0'}` });

        // Dynamically calculate True Shooting % & eFG% from live Regular Season Averages row (no static cache)
        const avgCat = statCategories.find(c => /averages/i.test(c.name) || /averages/i.test(c.displayName));
        const latestRow = avgCat?.rows?.[0];
        if (latestRow && avgCat) {
          const getCatStat = (label: string) => {
            const idx = avgCat.labels.indexOf(label);
            return idx >= 0 ? latestRow.stats[idx] : undefined;
          };
          const [fgm, fga] = basketballResearchService.parseMadeAttempted(getCatStat('FG'));
          const [tpm] = basketballResearchService.parseMadeAttempted(getCatStat('3PT'));
          const [, fta] = basketballResearchService.parseMadeAttempted(getCatStat('FT'));
          const ptsNum = parseFloat(getCatStat('PTS') || pts || '0');
          if (fga > 0 && ptsNum > 0) {
            const ts = basketballResearchService.computeTrueShootingPct(ptsNum, fga, fta);
            const efg = basketballResearchService.computeEffectiveFgPct(fgm, tpm, fga);
            overviewStats.push({ label: 'Live TS% / eFG%', value: `${ts}% / ${efg}%` });
          }
        }
        if (ovCarSplit?.stats?.length) {
          const cIdx = ovLabels.indexOf('PTS');
          const c3Idx = ovLabels.indexOf('3P%');
          if (cIdx >= 0) {
            overviewStats.push({ label: 'Career Avg', value: `${ovCarSplit.stats[cIdx]} PPG${c3Idx >= 0 ? ` • ${ovCarSplit.stats[c3Idx]}% 3P` : ''}` });
          }
        }
      } else if (ovRegSplit?.stats?.length) {
        ovLabels.slice(0, 8).forEach((lbl, idx) => {
          if (ovRegSplit.stats[idx] !== undefined) {
            overviewStats.push({ label: lbl, value: String(ovRegSplit.stats[idx]) });
          }
        });
      } else if (infoData?.statsSummary?.statistics?.length) {
        for (const stat of infoData.statsSummary.statistics.slice(0, 8)) {
          overviewStats.push({
            label: stat.displayName || stat.label || stat.name,
            value: stat.displayValue || String(stat.value),
          });
        }
      }

      if (curatedNba) {
        overviewStats.push(
          { label: 'PER / BPM / VORP', value: `${curatedNba.per} / +${curatedNba.bpm} / ${curatedNba.vorp}` },
          { label: 'Usage Rate (USG%)', value: `${curatedNba.usgPct}%` },
        );
      }

      const rotowire = overviewData?.rotowire
        ? {
            headline: overviewData.rotowire.headline,
            story: overviewData.rotowire.story,
            description: overviewData.rotowire.description,
            published: overviewData.rotowire.published,
          }
        : undefined;
      const awards = Array.isArray(overviewData?.awards)
        ? overviewData.awards.map((aw: any) => `${aw.displayCount ? `${aw.displayCount} ` : ''}${aw.name}`).filter(Boolean)
        : [];
      const fantasy = overviewData?.fantasy
        ? {
            draftRank: overviewData.fantasy.draftRank ? String(overviewData.fantasy.draftRank) : undefined,
            positionRank: overviewData.fantasy.positionRank ? String(overviewData.fantasy.positionRank) : undefined,
            percentOwned: overviewData.fantasy.percentOwned ? String(overviewData.fantasy.percentOwned) : undefined,
          }
        : undefined;

      const draftText = a.draft?.displayText || (a.debutYear ? `Debuted ${a.debutYear}` : undefined);

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
        birthplace: a.displayBirthPlace || undefined,
        draftInfo: draftText,
        status: a.status?.name || 'Active',
        headshot: a.headshot?.href || curatedNba?.headshot || `https://a.espncdn.com/i/headshots/${cleanLeague}/players/full/${athleteId}.png`,
        teamName: a.team?.displayName || curatedNba?.team,
        teamLogo: a.team?.logos?.[0]?.href,
        dataSource: 'Live ESPN API (On-Demand)',
        fetchedAt: new Date().toISOString(),
        statsSummary: infoData?.statsSummary,
        overviewStats,
        biography: rotowire?.headline
          ? `${rotowire.headline} ${rotowire.story || ''}`.trim()
          : curatedNba
          ? `${curatedNba.archetype} — ${curatedNba.signatureStat}.`
          : draftText
          ? `${draftText}. ${a.displayBirthPlace ? `Born in ${a.displayBirthPlace}.` : ''}`.trim()
          : undefined,
        statCategories,
        gameLog: {
          labels: glLabels,
          availableSeasons,
          selectedSeason,
          games: parsedGames,
        },
        splitCategories,
        rotowire,
        awards,
        fantasy,
      };

      return profile;
    }

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

      if ((team1Matches && team2Matches) || (t1Raw.length >= 3 && evName.includes(t1Raw)) || (t2Raw.length >= 3 && evName.includes(t2Raw))) {
        matchedEvent = event;
        break;
      }
    }

    if (!matchedEvent) {
      return null;
    }

    // Multi-source event-specific news (ESPN Gamecast + League Wire + Google News Matchup / Injuries / Industry)
    const enrichedNews = await newsAggregatorService.getEventNews(
      stream,
      sportPath,
      [],
      matchedEvent.name
    );

    return this.buildGamecastIntelFromEvent(stream, sportPath, matchedEvent, enrichedNews);
  }

  public async buildGamecastIntelFromEvent(
    stream: StreamItem,
    sportPath: string,
    matchedEvent: any,
    newsArticles: any[] = []
  ): Promise<SportsGamecastIntel> {
    const streamName = (stream.name || '').toLowerCase();
    const t1Raw = (stream.team1?.name || streamName.split(/vs|at/i)[0] || '').toLowerCase().trim();
    const t2Raw = (stream.team2?.name || streamName.split(/vs|at/i)[1] || '').toLowerCase().trim();

    const comp = matchedEvent.competitions?.[0] || {};
    const competitors: any[] = comp.competitors || [];

    // Match comp1 with stream.team1, and comp2 with stream.team2 before parallel summary + roster fetches
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

    // Fetch deep summary + full official team rosters (for complete player lists & exact positions) in parallel
    let summary: any = {};
    const [sumResult, officialRoster1, officialRoster2] = await Promise.all([
      fetch(`https://site.api.espn.com/apis/site/v2/sports/${sportPath}/summary?event=${matchedEvent.id}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      })
        .then((r) => (r.ok ? r.json() : {}))
        .catch(() => ({})),
      this.fetchTeamRoster(sportPath, comp1?.team?.id, comp1?.team?.displayName || stream.team1?.name),
      this.fetchTeamRoster(sportPath, comp2?.team?.id, comp2?.team?.displayName || stream.team2?.name),
    ]);
    summary = (sumResult || {}) as any;

    const rosterById1 = new Map<string, AthleteInfo>();
    const rosterById2 = new Map<string, AthleteInfo>();
    for (const a of officialRoster1) {
      if (a.id) rosterById1.set(String(a.id), a);
    }
    for (const a of officialRoster2) {
      if (a.id) rosterById2.set(String(a.id), a);
    }
    const allOfficialById = new Map<string, AthleteInfo>([...rosterById1, ...rosterById2]);

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
          const officialAth = leaderObj.athlete.id ? allOfficialById.get(String(leaderObj.athlete.id)) : undefined;
          const inferredPos =
            leaderObj.athlete.position?.abbreviation ||
            officialAth?.position ||
            this.inferFallbackPosition(cat.name || cat.displayName);
          leadersList.push({
            category: cat.displayName || cat.name || 'Key Leader',
            athlete: {
              id: leaderObj.athlete.id,
              name: leaderObj.athlete.displayName,
              headshot: leaderObj.athlete.headshot?.href || officialAth?.headshot || 'https://a.espncdn.com/combiner/i?img=/i/headshots/nophoto.png&w=120&h=90',
              position: inferredPos,
              unit: officialAth?.unit,
              jersey: leaderObj.athlete.jersey || officialAth?.jersey,
            },
            statline: leaderObj.displayValue ? `${leaderObj.displayValue} ${cat.displayName || ''}`.trim() : (leaderObj.value ? String(leaderObj.value) : ''),
            teamName: cat.teamName || leaderObj.team?.displayName,
          });
        }
      }
    }

    // DEEP BOX SCORE (Players by Category) + Matchday Lineup / Official Full Roster Merge
    let parsedBoxScore: { team1: TeamBoxScore; team2: TeamBoxScore } | undefined;
    const boxAthletesT1 = new Map<string, AthleteInfo>();
    const boxAthletesT2 = new Map<string, AthleteInfo>();
    const advPlayersT1: PlayerAdvancedBoxRow[] = [];
    const advPlayersT2: PlayerAdvancedBoxRow[] = [];

    if (summary.boxscore?.players && Array.isArray(summary.boxscore.players)) {
      const p1Obj = summary.boxscore.players.find((p: any) => p.team?.id === comp1.team?.id) || summary.boxscore.players[0];
      const p2Obj = summary.boxscore.players.find((p: any) => p.team?.id === comp2.team?.id) || summary.boxscore.players[1];

      const parsePlayerTeam = (
        pObj: any,
        rosterLookup: Map<string, AthleteInfo>,
        boxMapOut: Map<string, AthleteInfo>,
        advRowsOut: PlayerAdvancedBoxRow[]
      ): TeamBoxScore => {
        const cats: BoxScoreCategory[] = [];
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
            const offMatch = a.id ? (rosterLookup.get(String(a.id)) || allOfficialById.get(String(a.id))) : undefined;
            const resolvedPos =
              a.position?.abbreviation ||
              a.position?.name ||
              offMatch?.position ||
              this.inferFallbackPosition(statCat.name || statCat.displayName);
            const resolvedUnit = offMatch?.unit || this.inferUnitFromPosition(resolvedPos, sportPath);
            const athInfo: AthleteInfo = {
              id: a.id,
              name: a.displayName || offMatch?.name || 'Athlete',
              jersey: a.jersey || offMatch?.jersey,
              position: resolvedPos,
              unit: resolvedUnit,
              starter: typeof aObj.starter === 'boolean' ? aObj.starter : offMatch?.starter,
              headshot: a.headshot?.href || offMatch?.headshot || 'https://a.espncdn.com/combiner/i?img=/i/headshots/nophoto.png&w=120&h=90',
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

            if (a.id && !boxMapOut.has(String(a.id))) {
              boxMapOut.set(String(a.id), athInfo);
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
        team1: parsePlayerTeam(p1Obj, rosterById1, boxAthletesT1, advPlayersT1),
        team2: parsePlayerTeam(p2Obj, rosterById2, boxAthletesT2, advPlayersT2),
      };
    }

    // Parse ESPN matchday `summary.rosters` when present (e.g. Soccer lineups/subs where position lives on entry.position)
    const summaryRosterMap1 = new Map<string, AthleteInfo>();
    const summaryRosterMap2 = new Map<string, AthleteInfo>();
    if (Array.isArray(summary.rosters)) {
      const r1Obj = summary.rosters.find((r: any) => r.team?.id === comp1.team?.id) || summary.rosters[0];
      const r2Obj = summary.rosters.find((r: any) => r.team?.id === comp2.team?.id) || summary.rosters[1];
      const fillSummaryRoster = (rObj: any, officialLookup: Map<string, AthleteInfo>, outMap: Map<string, AthleteInfo>) => {
        const teamName = rObj?.team?.displayName || 'Team';
        for (const entry of (rObj?.roster || [])) {
          const a = entry.athlete || {};
          if (!a.id) continue;
          const off = officialLookup.get(String(a.id));
          const pos = entry.position?.abbreviation || entry.position?.name || a.position?.abbreviation || off?.position;
          outMap.set(String(a.id), {
            id: String(a.id),
            name: a.displayName || off?.name || 'Athlete',
            jersey: entry.jersey || a.jersey || off?.jersey,
            position: pos,
            unit: off?.unit || this.inferUnitFromPosition(pos, sportPath),
            starter: Boolean(entry.starter),
            headshot: a.headshot?.href || off?.headshot || 'https://a.espncdn.com/combiner/i?img=/i/headshots/nophoto.png&w=120&h=90',
            teamName,
          });
        }
      };
      if (r1Obj) fillSummaryRoster(r1Obj, rosterById1, summaryRosterMap1);
      if (r2Obj) fillSummaryRoster(r2Obj, rosterById2, summaryRosterMap2);
    }

    const mergeTeamRoster = (
      official: AthleteInfo[],
      boxMap: Map<string, AthleteInfo>,
      summaryMap: Map<string, AthleteInfo>
    ): AthleteInfo[] => {
      const mergedMap = new Map<string, AthleteInfo>();
      for (const ath of official) {
        const id = String(ath.id);
        const box = boxMap.get(id);
        const sumEntry = summaryMap.get(id);
        mergedMap.set(id, {
          ...ath,
          jersey: ath.jersey || box?.jersey || sumEntry?.jersey,
          position: ath.position || sumEntry?.position || box?.position,
          unit: ath.unit || sumEntry?.unit || box?.unit,
          starter: box?.starter ?? sumEntry?.starter ?? ath.starter,
          stats: box?.stats || ath.stats,
          headshot: box?.headshot && !box.headshot.includes('nophoto') ? box.headshot : ath.headshot,
        });
      }
      for (const [id, sumEntry] of summaryMap.entries()) {
        if (!mergedMap.has(id)) mergedMap.set(id, sumEntry);
      }
      for (const [id, box] of boxMap.entries()) {
        if (!mergedMap.has(id)) mergedMap.set(id, box);
      }
      return this.sortRosterAthletes(Array.from(mergedMap.values()));
    };

    const team1Roster = mergeTeamRoster(officialRoster1, boxAthletesT1, summaryRosterMap1);
    const team2Roster = mergeTeamRoster(officialRoster2, boxAthletesT2, summaryRosterMap2);

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
        situationBanner:
          summary.drives?.current?.description ||
          basketballAnalytics?.onCourtLineup?.activeStintMargin ||
          undefined,
      }
    );

    // Synchronize real NBA ESPN metrics into sportAnalytics (without overwriting NCAAB sportType)
    if (basketballAnalytics && sportAnalyticsObj.sportType !== 'ncaab') {
      const ba = basketballAnalytics;
      const t1AbbrNba = comp1?.team?.abbreviation || ba.team1Analytics.abbreviation || sportAnalyticsObj.team1Meta.abbreviation;
      const t2AbbrNba = comp2?.team?.abbreviation || ba.team2Analytics.abbreviation || sportAnalyticsObj.team2Meta.abbreviation;
      sportAnalyticsObj.sportType = 'basketball';
      sportAnalyticsObj.surfaceType = 'basketball_halfcourt';
      sportAnalyticsObj.team1Meta.abbreviation = t1AbbrNba;
      sportAnalyticsObj.team2Meta.abbreviation = t2AbbrNba;
      sportAnalyticsObj.linescore = linescoreObj || sportAnalyticsObj.linescore;
      sportAnalyticsObj.leverageIndex = ba.leverageIndex;
      sportAnalyticsObj.leverageTier =
        ba.leverageTier === 'Clutch Critical'
          ? 'CRUNCH TIME'
          : (String(ba.leverageTier || 'LOW').toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRUNCH TIME');
      sportAnalyticsObj.isClutchTime = ba.isClutchTime;
      sportAnalyticsObj.situationBanner =
        ba.gameState === 'pre'
          ? `🏀 Pre-Game Scouting Preview • ${t1AbbrNba} vs ${t2AbbrNba}`
          : `🏀 ${ba.detail} • ${ba.onCourtLineup?.activeStintMargin || ba.projectedPaceScore?.activeRun || `${t1AbbrNba} vs ${t2AbbrNba}`} • Bonus: ${ba.bonusState.team1InBonus ? t1AbbrNba : ''}${ba.bonusState.team1InBonus && ba.bonusState.team2InBonus ? ' & ' : ''}${ba.bonusState.team2InBonus ? t2AbbrNba : !ba.bonusState.team1InBonus ? 'None' : ''}`;
      if (ba.projectedPaceScore) {
        sportAnalyticsObj.paceAndProjection = {
          tempoLabel: '48-MIN PACE',
          tempoValue: `${ba.projectedPaceScore.pace48} Poss / 48 Min`,
          projectedFinal: `Pace Projection: ${t1AbbrNba} ${ba.projectedPaceScore.team1Projected} — ${ba.projectedPaceScore.team2Projected} ${t2AbbrNba}`,
          primaryRateLabel: 'TEAM ORTG',
          team1RateValue: String(ba.team1Analytics.ortg),
          team2RateValue: String(ba.team2Analytics.ortg),
        };
      }
      if (ba.mvpPerformer) {
        sportAnalyticsObj.mvpPerformer = {
          id: ba.mvpPerformer.id,
          name: ba.mvpPerformer.name,
          teamAbbr: ba.mvpPerformer.teamAbbr,
          position: ba.mvpPerformer.position,
          jersey: ba.mvpPerformer.jersey,
          headshot: ba.mvpPerformer.headshot,
          primaryLine: `${ba.mvpPerformer.pts} PTS • ${ba.mvpPerformer.reb} REB • ${ba.mvpPerformer.ast} AST (${ba.mvpPerformer.fg} FG)`,
          efficiencyLine: `${ba.mvpPerformer.gameScore} GmSc • ${ba.mvpPerformer.tsPct}% TS% • ${ba.mvpPerformer.bpm >= 0 ? '+' : ''}${ba.mvpPerformer.bpm} BPM`,
          impactBadge: ba.mvpPerformer.impactTier || 'FLOOR LEADER',
        };
      }
      sportAnalyticsObj.fourPillars = [
        {
          code: 'eFG%',
          label: 'Effective Field Goal %',
          weightLabel: '40% WEIGHT',
          team1Value: `${ba.team1Analytics.efgPct}%`,
          team2Value: `${ba.team2Analytics.efgPct}%`,
          team1Numeric: ba.team1Analytics.efgPct,
          team2Numeric: ba.team2Analytics.efgPct,
          leagueAverage: '54.2%',
          edgeTeam: ba.team1Analytics.efgPct >= ba.team2Analytics.efgPct ? 'team1' : 'team2',
          description: 'Live shooting efficiency weighting 3-pointers at 1.5x field goal value.',
        },
        {
          code: 'TOV%',
          label: 'Turnover Rate',
          weightLabel: '25% WEIGHT',
          team1Value: `${ba.team1Analytics.fourFactors.tovPct}%`,
          team2Value: `${ba.team2Analytics.fourFactors.tovPct}%`,
          team1Numeric: ba.team1Analytics.fourFactors.tovPct,
          team2Numeric: ba.team2Analytics.fourFactors.tovPct,
          leagueAverage: '13.5%',
          edgeTeam: ba.team1Analytics.fourFactors.tovPct <= ba.team2Analytics.fourFactors.tovPct ? 'team1' : 'team2',
          description: 'Turnovers per 100 possessions (lower is better).',
        },
        {
          code: 'ORB%',
          label: 'Offensive Rebound Rate',
          weightLabel: '20% WEIGHT',
          team1Value: `${ba.team1Analytics.fourFactors.orbPct}%`,
          team2Value: `${ba.team2Analytics.fourFactors.orbPct}%`,
          team1Numeric: ba.team1Analytics.fourFactors.orbPct,
          team2Numeric: ba.team2Analytics.fourFactors.orbPct,
          leagueAverage: '26.5%',
          edgeTeam: ba.team1Analytics.fourFactors.orbPct >= ba.team2Analytics.fourFactors.orbPct ? 'team1' : 'team2',
          description: 'Second-chance offensive glass recovery percentage.',
        },
        {
          code: 'FTR',
          label: 'Free Throw Rate (FT/FGA)',
          weightLabel: '15% WEIGHT',
          team1Value: `${ba.team1Analytics.fourFactors.ftRate}%`,
          team2Value: `${ba.team2Analytics.fourFactors.ftRate}%`,
          team1Numeric: ba.team1Analytics.fourFactors.ftRate,
          team2Numeric: ba.team2Analytics.fourFactors.ftRate,
          leagueAverage: '25.8%',
          edgeTeam: ba.team1Analytics.fourFactors.ftRate >= ba.team2Analytics.fourFactors.ftRate ? 'team1' : 'team2',
          description: 'Free throw pressure per field goal attempt.',
        },
      ];
    }

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

  /**
   * Fetch and cache full official ESPN team roster (`/teams/{teamId}/roster`).
   * Supplies authoritative player positions (`QB`, `WR`, `CB`, `PG`, `LW`, `GK`, etc.)
   * and full active squads when ESPN `/summary` omits `athlete.position` or has partial early-game box scores.
   */
  private async fetchTeamRoster(sportPath: string, teamId?: string, teamName?: string): Promise<AthleteInfo[]> {
    if (!sportPath || !teamId) return [];
    const cacheKey = `${sportPath}:${teamId}`;
    const cached = this.teamRosterCache.get(cacheKey);
    if (cached) return cached;

    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/teams/${teamId}/roster`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) return [];
      const data: any = await res.json();
      const parsed = this.parseEspnTeamRosterPayload(data, teamName || data?.team?.displayName || 'Team', sportPath);
      if (parsed.length > 0) {
        this.teamRosterCache.set(cacheKey, parsed);
      }
      return parsed;
    } catch (err) {
      return [];
    }
  }

  /** Parse ESPN grouped (NFL/CFB/NHL) or flat (NBA/NCAAB/Soccer) `/teams/{id}/roster` payloads */
  public parseEspnTeamRosterPayload(data: any, teamName: string, sportPath = ''): AthleteInfo[] {
    const rawAthletes: any[] = Array.isArray(data?.athletes) ? data.athletes : [];
    if (rawAthletes.length === 0) return [];

    const resolvedTeamName = teamName || data?.team?.displayName || 'Team';
    const out: AthleteInfo[] = [];
    const seen = new Set<string>();

    const normalizeUnitLabel = (rawUnit?: string, posAbbr?: string): string | undefined => {
      const u = (rawUnit || '').toLowerCase();
      if (u === 'offense') return 'Offense';
      if (u === 'defense') return 'Defense';
      if (u === 'specialteam' || u === 'special_teams' || u === 'special teams') return 'Special Teams';
      if (u === 'forwards' || u === 'forward' || u === 'centers' || u === 'wings') return 'Forwards';
      if (u === 'defensemen') return 'Defense';
      if (u === 'goalies' || u === 'goalkeepers') return rawUnit || 'Goalies';
      return this.inferUnitFromPosition(posAbbr, sportPath);
    };

    const pushAthlete = (item: any, rawGroupUnit?: string) => {
      if (!item || !item.id) return;
      const id = String(item.id);
      if (seen.has(id)) return;
      seen.add(id);

      const pos =
        item.position?.abbreviation ||
        item.position?.displayName ||
        item.position?.name ||
        undefined;
      const unit = normalizeUnitLabel(rawGroupUnit || item.position?.parent?.abbreviation, pos);
      const headshot =
        item.headshot?.href ||
        (sportPath.startsWith('football/nfl')
          ? `https://a.espncdn.com/i/headshots/nfl/players/full/${id}.png`
          : 'https://a.espncdn.com/combiner/i?img=/i/headshots/nophoto.png&w=120&h=90');

      out.push({
        id,
        name: item.displayName || item.fullName || 'Athlete',
        jersey: item.jersey ? String(item.jersey) : undefined,
        position: pos,
        unit,
        headshot,
        teamName: resolvedTeamName,
        height: item.displayHeight,
        weight: item.displayWeight,
        age: typeof item.age === 'number' ? item.age : undefined,
        experience:
          item.experience?.years !== undefined
            ? item.experience.years === 0
              ? 'Rookie'
              : `${item.experience.years} Yrs`
            : undefined,
      });
    };

    const isGrouped = Boolean(rawAthletes[0] && Array.isArray(rawAthletes[0].items));
    if (isGrouped) {
      const excludedGroups = new Set(['practicesquad', 'suspended', 'injuredreserveorout']);
      for (const grp of rawAthletes) {
        const grpKey = String(grp.position || '').toLowerCase();
        if (excludedGroups.has(grpKey)) continue;
        for (const item of (grp.items || [])) {
          pushAthlete(item, grp.position);
        }
      }
      // Fallback if only IR/reserve existed in a pre-season payload
      if (out.length === 0) {
        for (const grp of rawAthletes) {
          for (const item of (grp.items || [])) {
            pushAthlete(item, grp.position);
          }
        }
      }
    } else {
      for (const item of rawAthletes) {
        pushAthlete(item);
      }
    }

    return out;
  }

  private inferFallbackPosition(statCatName?: string): string | undefined {
    const c = (statCatName || '').toLowerCase();
    if (!c) return undefined;
    if (c.includes('passing')) return 'QB';
    if (c.includes('rushing')) return 'RB';
    if (c.includes('receiving')) return 'WR';
    if (c.includes('defensive') || c.includes('tackle') || c.includes('interception') || c.includes('sack')) return 'DEF';
    if (c.includes('kickreturn')) return 'KR';
    if (c.includes('puntreturn')) return 'PR';
    if (c.includes('kicking')) return 'K';
    if (c.includes('punting')) return 'P';
    if (c.includes('goalie')) return 'G';
    return undefined;
  }

  private inferUnitFromPosition(pos?: string, sportPath = ''): string | undefined {
    const p = (pos || '').toUpperCase().trim();
    if (!p) return undefined;
    if (sportPath.includes('football') || ['QB', 'RB', 'FB', 'WR', 'TE', 'OT', 'OG', 'OC', 'OL', 'DE', 'DT', 'NT', 'DL', 'DEF', 'LB', 'OLB', 'ILB', 'MLB', 'EDGE', 'CB', 'FS', 'SS', 'DB', 'PK', 'LS'].includes(p)) {
      if (['QB', 'RB', 'FB', 'WR', 'TE', 'OT', 'OG', 'OC', 'C', 'G', 'T', 'OL'].includes(p)) return 'Offense';
      if (['DE', 'DT', 'NT', 'DL', 'DEF', 'LB', 'OLB', 'ILB', 'MLB', 'EDGE', 'CB', 'S', 'FS', 'SS', 'DB'].includes(p)) return 'Defense';
      if (['K', 'PK', 'P', 'LS', 'KR', 'PR'].includes(p)) return 'Special Teams';
    }
    if (sportPath.includes('basketball') || ['PG', 'SG', 'SF', 'PF'].includes(p)) {
      if (['PG', 'SG', 'G'].includes(p)) return 'Backcourt';
      if (['SF', 'PF', 'F', 'C'].includes(p)) return 'Frontcourt';
    }
    if (sportPath.includes('hockey')) {
      if (['C', 'LW', 'RW', 'W', 'F'].includes(p)) return 'Forwards';
      if (['D', 'LD', 'RD'].includes(p)) return 'Defense';
      if (['G'].includes(p)) return 'Goalies';
    }
    if (sportPath.includes('soccer') || ['GK', 'CAM', 'CDM', 'ST', 'CF', 'CB', 'LB', 'RB'].includes(p)) {
      if (['G', 'GK'].includes(p)) return 'Goalkeepers';
      if (['D', 'CD', 'CB', 'LB', 'RB', 'WB', 'LWB', 'RWB', 'FB'].includes(p)) return 'Defenders';
      if (['M', 'CM', 'CDM', 'CAM', 'LM', 'RM', 'AM', 'DM'].includes(p)) return 'Midfielders';
      if (['F', 'FW', 'ST', 'CF', 'LW', 'RW', 'W'].includes(p)) return 'Forwards';
    }
    return undefined;
  }

  private sortRosterAthletes(list: AthleteInfo[]): AthleteInfo[] {
    const unitRank = (unit?: string): number => {
      const u = (unit || '').toLowerCase();
      if (u === 'offense' || u === 'backcourt' || u === 'forwards') return 1;
      if (u === 'defense' || u === 'frontcourt' || u === 'midfielders') return 2;
      if (u === 'defenders') return 3;
      if (u === 'special teams' || u === 'goalies' || u === 'goalkeepers') return 4;
      return 5;
    };
    const posRank = (pos?: string): number => {
      const order: Record<string, number> = {
        QB: 1, RB: 2, FB: 3, WR: 4, TE: 5, OT: 6, T: 6, OG: 7, G: 7, C: 8, OL: 9,
        EDGE: 10, DE: 11, DT: 12, NT: 13, DL: 14, LB: 15, MLB: 15, ILB: 15, OLB: 16, CB: 17, S: 18, FS: 18, SS: 18, DB: 19,
        K: 20, PK: 20, P: 21, LS: 22,
        PG: 1, SG: 2, SF: 4, PF: 5, F: 6,
        GK: 1, ST: 2, CF: 2, LW: 3, RW: 3, CAM: 4, CM: 5, CDM: 6, D: 8,
      };
      return order[(pos || '').toUpperCase()] ?? 50;
    };

    return [...list].sort((a, b) => {
      // Starters or active boxscore performers surface first within each unit
      const uDiff = unitRank(a.unit) - unitRank(b.unit);
      if (uDiff !== 0) return uDiff;

      const aStarter = a.starter ? 0 : 1;
      const bStarter = b.starter ? 0 : 1;
      if (aStarter !== bStarter) return aStarter - bStarter;

      const pDiff = posRank(a.position) - posRank(b.position);
      if (pDiff !== 0) return pDiff;

      const aHasStats = a.stats && a.stats.length > 0 ? 0 : 1;
      const bHasStats = b.stats && b.stats.length > 0 ? 0 : 1;
      if (aHasStats !== bHasStats) return aHasStats - bHasStats;

      return Number(a.jersey || 999) - Number(b.jersey || 999);
    });
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
    if (cat === 'baseball' || l.includes('mlb') || l.includes('baseball')) return 'baseball/mlb';
    if (cat === 'hockey' || l.includes('nhl')) return 'hockey/nhl';
    if (cat === 'combat' || cat === 'mma' || cat === 'boxing' || l.includes('ufc') || l.includes('mma')) return 'mma/ufc';
    if (cat === 'racing' || cat === 'motorsport' || l.includes('f1') || l.includes('formula')) return 'racing/f1';
    if (cat === 'tennis' || l.includes('atp') || l.includes('wta')) return l.includes('wta') ? 'tennis/wta' : 'tennis/atp';

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
      sportAnalytics: multiSportAnalyticsService.buildSportDeepAnalytics(stream, {
        team1Score: fallbackBasketballAnalytics?.team1Analytics?.score ?? 108,
        team2Score: fallbackBasketballAnalytics?.team2Analytics?.score ?? 102,
        gameState: 'in',
        status: 'In Progress • Projected Pace',
        detail: 'LIVE TELEMETRY',
        team1Logo: stream.team1?.logo,
        team2Logo: stream.team2?.logo,
      }),
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
