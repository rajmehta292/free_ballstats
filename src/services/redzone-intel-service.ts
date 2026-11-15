import { LRUCache } from 'lru-cache';
import type { StreamItem } from '../types/stream.js';
import type { SportsGamecastIntel } from './sports-intel-service.js';

export type RedZoneHeatTier =
  | 'GOAL_TO_GO'
  | 'RED_ZONE'
  | 'WITCHING_HOUR'
  | 'SCORING_RANGE'
  | 'LIVE'
  | 'HALFTIME'
  | 'UPCOMING'
  | 'FINAL';

export interface RedZoneTeamSide {
  id: string;
  abbr: string;
  name: string;
  displayName: string;
  logo: string;
  score: number;
  record: string;
  timeouts: number;
  linescores: number[];
}

export interface RedZoneSituation {
  isRedZone: boolean;
  isGoalToGo: boolean;
  isScoringRange: boolean;
  isTwoMinuteDrill: boolean;
  isWitchingHour: boolean;
  down: number | null;
  distance: number | null;
  yardsToEndZone: number | null;
  ballPosPct: number | null; // 0 (Own GL) -> 80 (RedZone Line) -> 100 (Opp GL)
  downDistanceText: string;
  possessionText: string;
  possessionTeamId: string | null;
  possessionTeamAbbr: string | null;
}

export interface RedZoneLastPlay {
  id: string;
  text: string;
  typeText: string;
  statYardage: number;
  scoreValue: number;
  driveDescription: string;
  wpSwingPct: number;
  athleteName?: string;
  athleteHeadshot?: string;
  athletePosition?: string;
}

export interface RedZoneLeaderLine {
  category: 'PASS' | 'RUSH' | 'REC';
  athleteId: string;
  name: string;
  teamAbbr: string;
  headshot: string;
  statLine: string;
  estimatedPpr: number;
}

export interface RedZoneGameNode {
  eventId: string;
  shortName: string;
  name: string;
  gameState: 'pre' | 'in' | 'post';
  statusDetail: string;
  clock: string;
  period: number;
  away: RedZoneTeamSide;
  home: RedZoneTeamSide;
  situation: RedZoneSituation;
  winProbability: {
    awayWinPct: number;
    homeWinPct: number;
    leverageIndex: number;
  };
  lastPlay: RedZoneLastPlay | null;
  leaders: RedZoneLeaderLine[];
  heatScore: number;
  heatTier: RedZoneHeatTier;
  heatReason: string;
  odds: {
    details?: string;
    overUnder?: string;
  };
  venue: string;
  broadcast: string;
  startDateIso: string;
}

export interface RedZoneEventFeedItem {
  id: string;
  eventId: string;
  matchup: string;
  timestamp: number;
  clockLabel: string;
  type: 'TOUCHDOWN' | 'RED_ZONE' | 'TURNOVER' | 'FIELD_GOAL' | 'EXPLOSIVE_PLAY' | 'WITCHING_HOUR';
  badge: string;
  headline: string;
  detail: string;
  wpSwingText: string;
  playerHeadshot?: string;
  teamLogo?: string;
  teamAbbr: string;
  scoreBadge: string;
  accentColor: 'red' | 'gold' | 'cyan' | 'purple' | 'green';
}

export interface RedZoneFantasyLeader {
  id: string;
  name: string;
  teamAbbr: string;
  matchup: string;
  eventId: string;
  category: 'PASS' | 'RUSH' | 'REC';
  headshot: string;
  statLine: string;
  estimatedPpr: number;
  isInRedZoneNow: boolean;
}

export interface RedZoneSmartCard {
  id: string;
  category: string;
  badge: string;
  headline: string;
  detail: string;
  metricHighlight: string;
  accentColor: 'gold' | 'cyan' | 'purple' | 'green' | 'red';
  playerHeadshot?: string;
  eventId?: string;
}

export interface RedZoneSlatePayload {
  streamKey: 'redzone';
  sportType: 'nfl_redzone';
  sportBadge: string;
  updatedAt: string;
  snapshotTimestamp: number;
  slatePhase: 'PRE_SLATE' | 'EARLY_WINDOW' | 'WITCHING_HOUR' | 'LATE_WINDOW' | 'POST_SLATE';
  slateHeadline: string;
  summaryCounts: {
    totalGames: number;
    liveGames: number;
    inRedZoneCount: number;
    witchingHourCount: number;
    halftimeCount: number;
    finalGames: number;
    upcomingGames: number;
  };
  pinnedEventId: string;
  secondaryEventId: string | null;
  games: RedZoneGameNode[];
  eventFeed: RedZoneEventFeedItem[];
  fantasyLeaders: RedZoneFantasyLeader[];
  smartCards: RedZoneSmartCard[];
  spotlightIntel: SportsGamecastIntel | null;
  secondaryGame: RedZoneGameNode | null;
}

export function isRedZoneStream(stream?: Pick<StreamItem, 'stream_key' | 'name'> | null): boolean {
  if (!stream) return false;
  const key = (stream.stream_key || '').toLowerCase();
  const name = (stream.name || '').toLowerCase();
  return /redzone|red-zone|red zone/.test(key) || /redzone|red zone/.test(name);
}

/** Parse clock string like "2:14" or "15:00" into remaining seconds in period */
function parseClockSeconds(clockStr?: string): number {
  if (!clockStr || !clockStr.includes(':')) return 900;
  const parts = clockStr.split(':').map((n) => Number(n));
  if (parts.length !== 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return 900;
  return parts[0] * 60 + parts[1];
}

/** Estimate PPR fantasy points from ESPN scoreboard leader displayValue strings */
export function estimateFantasyPpr(category: 'PASS' | 'RUSH' | 'REC', statLine: string): number {
  if (!statLine) return 0;
  const ydsMatch = statLine.match(/(\d+)\s*YDS/i);
  const tdMatch = statLine.match(/(\d+)\s*TD/i);
  const intMatch = statLine.match(/(\d+)\s*INT/i);
  const recMatch = statLine.match(/(\d+)\s*REC/i);

  const yds = ydsMatch ? Number(ydsMatch[1]) : 0;
  const td = tdMatch ? Number(tdMatch[1]) : 0;
  const ints = intMatch ? Number(intMatch[1]) : 0;
  const rec = recMatch ? Number(recMatch[1]) : 0;

  if (category === 'PASS') {
    return Number((yds * 0.04 + td * 4 - ints * 2).toFixed(1));
  }
  if (category === 'REC') {
    return Number((rec * 1.0 + yds * 0.1 + td * 6).toFixed(1));
  }
  return Number((yds * 0.1 + td * 6).toFixed(1));
}

/**
 * Determine yards remaining to the opponent's end zone cleanly across ESPN conventions.
 * Example: possessionText = "LV 26" with possAbbr = "LV" -> 74 yards from goal (26 -> opp GL = 74).
 * Example: possessionText = "DAL 8" with possAbbr = "SF" -> 8 yards from goal!
 */
function resolveYardsToEndZone(
  possessionText: string | undefined,
  possAbbr: string | null,
  rawYardLine: number | undefined,
  isRedZone: boolean
): number | null {
  if (possessionText) {
    const clean = possessionText.trim();
    const parts = clean.split(/\s+/);
    if (parts.length >= 2) {
      const sideAbbr = parts[0].toUpperCase();
      const yardNum = Number(parts[parts.length - 1]);
      if (!Number.isNaN(yardNum) && yardNum >= 0 && yardNum <= 50) {
        if (possAbbr && sideAbbr === possAbbr.toUpperCase()) {
          return 100 - yardNum;
        }
        if (possAbbr && sideAbbr !== possAbbr.toUpperCase()) {
          return yardNum;
        }
      }
    }
  }
  if (typeof rawYardLine === 'number' && !Number.isNaN(rawYardLine)) {
    if (isRedZone && rawYardLine <= 20) return rawYardLine;
    if (isRedZone && rawYardLine >= 80) return 100 - rawYardLine;
    return Math.max(1, Math.min(99, rawYardLine));
  }
  return null;
}

class RedZoneIntelService {
  private slateCache: LRUCache<string, RedZoneSlatePayload>;
  private rollingEventFeed: RedZoneEventFeedItem[] = [];
  private seenPlayKeys = new Set<string>();
  private prevStateByEvent = new Map<string, {
    scoreSum: number;
    isRedZone: boolean;
    homeWp: number;
    awayScore: number;
    homeScore: number;
  }>();

  constructor() {
    this.slateCache = new LRUCache<string, RedZoneSlatePayload>({
      max: 10,
      ttl: 12000, // 12 seconds live slate refresh cadence
    });
  }

  /** Build complete RedZone Multi-Game Companion payload */
  public async getRedZoneSlate(
    options: {
      pinnedEventId?: string;
      secondaryEventId?: string;
      eventSummaryFetcher?: (rawEvent: any, newsArticles: any[]) => Promise<SportsGamecastIntel>;
    } = {}
  ): Promise<RedZoneSlatePayload> {
    const cacheKey = `rz_${options.pinnedEventId || 'auto'}_${options.secondaryEventId || 'auto'}`;
    const cached = this.slateCache.get(cacheKey);
    if (cached) return cached;

    let rawEvents: any[] = [];
    let nflNews: any[] = [];
    try {
      const [sbRes, newsRes] = await Promise.all([
        fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard', {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        }),
        fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/news', {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        }).catch(() => null),
      ]);

      if (sbRes.ok) {
        const sbJson: any = await sbRes.json();
        rawEvents = sbJson.events || [];
      }
      if (newsRes && newsRes.ok) {
        const newsJson: any = await newsRes.json();
        nflNews = (newsJson.articles || []).slice(0, 6).map((a: any) => ({
          title: a.headline,
          description: a.description || '',
          link: a.links?.web?.href || 'https://espn.com',
          image: a.images?.[0]?.url,
          published: a.published,
        }));
      }
    } catch (err) {
      console.error('[RedZoneIntelService] Failed to fetch NFL scoreboard:', err);
    }

    const payload = await this.buildSlateFromEvents(rawEvents, nflNews, options);
    this.slateCache.set(cacheKey, payload);
    return payload;
  }

  /** Transform raw ESPN scoreboard events into prioritized RedZone radar, feeds, fantasy leaders & spotlight */
  public async buildSlateFromEvents(
    rawEvents: any[],
    nflNews: any[] = [],
    options: {
      pinnedEventId?: string;
      secondaryEventId?: string;
      eventSummaryFetcher?: (rawEvent: any, newsArticles: any[]) => Promise<SportsGamecastIntel>;
    } = {}
  ): Promise<RedZoneSlatePayload> {
    const rawById = new Map<string, any>();
    const games: RedZoneGameNode[] = rawEvents.map((ev) => {
      const id = String(ev.id || '');
      rawById.set(id, ev);
      return this.parseEventToGameNode(ev);
    });

    // Update rolling multi-game play & scoring feed
    this.updateRollingEventFeed(games);

    // Sort games by RedZone Heat Score desc, then live/halftime/pre/post
    games.sort((a, b) => {
      if (b.heatScore !== a.heatScore) return b.heatScore - a.heatScore;
      const stateOrder = { in: 0, pre: 1, post: 2 };
      if (stateOrder[a.gameState] !== stateOrder[b.gameState]) {
        return stateOrder[a.gameState] - stateOrder[b.gameState];
      }
      return a.startDateIso.localeCompare(b.startDateIso);
    });

    const liveGames = games.filter((g) => g.gameState === 'in');
    const inRedZoneGames = liveGames.filter((g) => g.situation.isRedZone);
    const witchingHourGames = liveGames.filter((g) => g.situation.isWitchingHour);
    const halftimeGames = liveGames.filter((g) => g.heatTier === 'HALFTIME');
    const finalGames = games.filter((g) => g.gameState === 'post');
    const upcomingGames = games.filter((g) => g.gameState === 'pre');

    let slatePhase: RedZoneSlatePayload['slatePhase'] = 'PRE_SLATE';
    if (liveGames.length > 0) {
      slatePhase =
        witchingHourGames.length > 0
          ? 'WITCHING_HOUR'
          : finalGames.length >= 4
          ? 'LATE_WINDOW'
          : 'EARLY_WINDOW';
    } else if (finalGames.length > 0 && upcomingGames.length === 0) {
      slatePhase = 'POST_SLATE';
    } else if (finalGames.length > 0 && upcomingGames.length > 0) {
      slatePhase = 'LATE_WINDOW';
    }

    const topGame = games[0] || null;
    const pinnedEventId =
      options.pinnedEventId && rawById.has(options.pinnedEventId)
        ? options.pinnedEventId
        : topGame?.eventId || '';

    const secondaryCandidate =
      options.secondaryEventId && rawById.has(options.secondaryEventId)
        ? games.find((g) => g.eventId === options.secondaryEventId) || null
        : games.find((g) => g.eventId !== pinnedEventId && g.gameState === 'in') ||
          games.find((g) => g.eventId !== pinnedEventId) ||
          null;

    // Fetch deep ESPN summary ONLY for the single Spotlight / Pinned game
    let spotlightIntel: SportsGamecastIntel | null = null;
    const spotlightRaw = pinnedEventId ? rawById.get(pinnedEventId) : null;
    if (spotlightRaw && options.eventSummaryFetcher) {
      try {
        spotlightIntel = await options.eventSummaryFetcher(spotlightRaw, nflNews);
      } catch (err) {
        console.error('[RedZoneIntelService] Failed spotlight summary hydration:', err);
      }
    }

    const fantasyLeaders = this.buildFantasyLeaderboard(games);
    const smartCards = this.buildSmartCards(games, this.rollingEventFeed, fantasyLeaders, slatePhase);

    const slateHeadline =
      inRedZoneGames.length > 0
        ? `🚨 ${inRedZoneGames.length} IN RED ZONE • ${inRedZoneGames.map((g) => `${g.shortName} (${g.situation.downDistanceText || 'Inside 20'})`).slice(0, 2).join(' | ')}`
        : witchingHourGames.length > 0
        ? `🔮 WITCHING HOUR ACTIVE • ${witchingHourGames.length} One-Score Q4 Games Inside 5:00`
        : liveGames.length > 0
        ? `🏈 ${liveGames.length} LIVE NFL GAMES • Top Action: ${topGame?.shortName || 'NFL Sunday'}`
        : upcomingGames.length > 0
        ? `⏳ NEXT KICKOFF SLATE • ${upcomingGames[0]?.shortName} (${upcomingGames[0]?.statusDetail})`
        : `🏁 NFL SLATE WRAP-UP • ${finalGames.length} Final Scores`;

    return {
      streamKey: 'redzone',
      sportType: 'nfl_redzone',
      sportBadge: 'NFL REDZONE MULTI-GAME COMMAND',
      updatedAt: new Date().toISOString(),
      snapshotTimestamp: Date.now(),
      slatePhase,
      slateHeadline,
      summaryCounts: {
        totalGames: games.length,
        liveGames: liveGames.length,
        inRedZoneCount: inRedZoneGames.length,
        witchingHourCount: witchingHourGames.length,
        halftimeCount: halftimeGames.length,
        finalGames: finalGames.length,
        upcomingGames: upcomingGames.length,
      },
      pinnedEventId,
      secondaryEventId: secondaryCandidate?.eventId || null,
      games,
      eventFeed: this.rollingEventFeed.slice(0, 18),
      fantasyLeaders: fantasyLeaders.slice(0, 15),
      smartCards,
      spotlightIntel,
      secondaryGame: secondaryCandidate,
    };
  }

  private parseEventToGameNode(ev: any): RedZoneGameNode {
    const comp = ev.competitions?.[0] || {};
    const competitors: any[] = comp.competitors || [];
    const awayComp = competitors.find((c: any) => c.homeAway === 'away') || competitors[1] || competitors[0] || {};
    const homeComp = competitors.find((c: any) => c.homeAway === 'home') || competitors[0] || competitors[1] || {};

    const rawState = ev.status?.type?.state;
    const gameState: 'pre' | 'in' | 'post' =
      rawState === 'pre' ? 'pre' : rawState === 'in' ? 'in' : 'post';

    const statusDetail = ev.status?.type?.shortDetail || ev.status?.type?.detail || 'Scheduled';
    const clock = ev.status?.displayClock || '';
    const period = Number(ev.status?.period || 0);
    const isHalftime =
      gameState === 'in' && /halftime|half/i.test(statusDetail);

    const sit = comp.situation || {};
    const awayScore = Number(awayComp.score || 0);
    const homeScore = Number(homeComp.score || 0);
    const margin = Math.abs(awayScore - homeScore);
    const clockSec = parseClockSeconds(clock);

    const awayId = String(awayComp.team?.id || '');
    const homeId = String(homeComp.team?.id || '');
    const awayAbbr = String(awayComp.team?.abbreviation || 'AWY');
    const homeAbbr = String(homeComp.team?.abbreviation || 'HME');

    const possTeamId = sit.possession ? String(sit.possession) : sit.lastPlay?.team?.id ? String(sit.lastPlay.team.id) : null;
    const possTeamAbbr =
      possTeamId === awayId ? awayAbbr : possTeamId === homeId ? homeAbbr : null;

    const isRedZone = Boolean(gameState === 'in' && !isHalftime && sit.isRedZone);
    const yardsToEndZone =
      gameState === 'in' && !isHalftime
        ? resolveYardsToEndZone(sit.possessionText, possTeamAbbr, sit.yardLine, isRedZone)
        : null;
    const isGoalToGo = Boolean(
      isRedZone && ((yardsToEndZone !== null && yardsToEndZone <= 10) || /goal/i.test(sit.downDistanceText || ''))
    );
    const isScoringRange = Boolean(
      gameState === 'in' && !isHalftime && yardsToEndZone !== null && yardsToEndZone <= 38
    );
    const isTwoMinuteDrill = Boolean(
      gameState === 'in' && !isHalftime && (period === 2 || period >= 4) && clockSec <= 125
    );
    const isWitchingHour = Boolean(
      gameState === 'in' && !isHalftime && period >= 4 && clockSec <= 420 && margin <= 8
    );

    const rawHomeWp = sit.lastPlay?.probability?.homeWinPercentage;
    const homeWinPct =
      typeof rawHomeWp === 'number'
        ? Math.max(1, Math.min(99, Math.round(rawHomeWp * 100)))
        : homeScore === awayScore
        ? 50
        : homeScore > awayScore
        ? Math.min(92, 55 + margin * 2)
        : Math.max(8, 45 - margin * 2);
    const awayWinPct = 100 - homeWinPct;

    // Leverage Index: peaks in close Q4 / OT and RedZone threats
    let leverageIndex = 1.0;
    if (gameState === 'in' && !isHalftime) {
      const closeness = Math.max(0.2, 1 - margin / 24);
      const timeFactor = period >= 4 ? 1.85 : period === 3 ? 1.25 : 0.95;
      const rzFactor = isGoalToGo ? 1.5 : isRedZone ? 1.3 : 1.0;
      const fourthDownFactor = sit.down === 4 ? 1.35 : sit.down === 3 ? 1.15 : 1.0;
      leverageIndex = Number(
        Math.max(0.6, Math.min(4.8, closeness * timeFactor * rzFactor * fourthDownFactor * 1.4)).toFixed(2)
      );
    }

    // Heat Score Calculation (0 - 100)
    let heatScore = 0;
    let heatTier: RedZoneHeatTier = 'UPCOMING';
    let heatReason = statusDetail;

    if (gameState === 'in' && isHalftime) {
      heatScore = 24;
      heatTier = 'HALFTIME';
      heatReason = `Halftime • ${awayAbbr} ${awayScore} - ${homeAbbr} ${homeScore}`;
    } else if (gameState === 'in') {
      heatScore = 40;
      if (isRedZone) heatScore += 32;
      if (isGoalToGo) heatScore += 18;
      else if (isScoringRange) heatScore += 10;
      if (isWitchingHour) heatScore += 18;
      if (isTwoMinuteDrill) heatScore += 8;
      if (sit.down === 4) heatScore += 10;
      else if (sit.down === 3) heatScore += 4;
      if (sit.lastPlay?.scoreValue > 0) heatScore += 12;
      heatScore = Math.min(100, heatScore);

      if (isGoalToGo) {
        heatTier = 'GOAL_TO_GO';
        heatReason = `🚨 GOAL-TO-GO: ${possTeamAbbr || ''} • ${sit.downDistanceText || 'Inside 10'}`;
      } else if (isRedZone) {
        heatTier = 'RED_ZONE';
        heatReason = `🚨 RED ZONE: ${possTeamAbbr || ''} • ${sit.downDistanceText || 'Inside 20'}`;
      } else if (isWitchingHour) {
        heatTier = 'WITCHING_HOUR';
        heatReason = `🔮 WITCHING HOUR: ${margin}-pt game • ${statusDetail}`;
      } else if (isScoringRange) {
        heatTier = 'SCORING_RANGE';
        heatReason = `🎯 SCORING RANGE: ${sit.downDistanceText || `${possTeamAbbr || ''} driving`}`;
      } else {
        heatTier = 'LIVE';
        heatReason = sit.downDistanceText || `${statusDetail} • ${sit.lastPlay?.typeText || 'Live Action'}`;
      }
    } else if (gameState === 'pre') {
      heatScore = 10;
      heatTier = 'UPCOMING';
      heatReason = `Kickoff: ${statusDetail}`;
    } else {
      heatScore = 4;
      heatTier = 'FINAL';
      heatReason = `Final: ${awayAbbr} ${awayScore} - ${homeAbbr} ${homeScore}`;
    }

    const lp = sit.lastPlay;
    const prevState = this.prevStateByEvent.get(String(ev.id));
    const wpSwingPct = prevState ? Math.abs(homeWinPct - prevState.homeWp) : lp?.scoreValue ? 14 : 0;

    const firstAth = Array.isArray(lp?.athletesInvolved) ? lp.athletesInvolved[0] : null;
    const lastPlay: RedZoneLastPlay | null = lp
      ? {
          id: String(lp.id || `${ev.id}_${lp.text || ''}`),
          text: String(lp.text || ''),
          typeText: String(lp.type?.text || 'Play'),
          statYardage: Number(lp.statYardage || 0),
          scoreValue: Number(lp.scoreValue || 0),
          driveDescription: String(lp.drive?.description || ''),
          wpSwingPct,
          athleteName: firstAth?.displayName,
          athleteHeadshot: firstAth?.headshot,
          athletePosition: firstAth?.position,
        }
      : null;

    // Extract Passing / Rushing / Receiving leaders from ESPN scoreboard
    const leaders: RedZoneLeaderLine[] = [];
    for (const catObj of comp.leaders || []) {
      const catAbbr = (catObj.shortDisplayName || catObj.abbreviation || '').toUpperCase();
      if (catAbbr !== 'PASS' && catAbbr !== 'RUSH' && catAbbr !== 'REC') continue;
      const top = catObj.leaders?.[0];
      if (!top?.athlete) continue;
      const tId = String(top.team?.id || '');
      const tAbbr = tId === awayId ? awayAbbr : tId === homeId ? homeAbbr : possTeamAbbr || awayAbbr;
      const statLine = String(top.displayValue || '');
      leaders.push({
        category: catAbbr,
        athleteId: String(top.athlete.id || ''),
        name: String(top.athlete.displayName || top.athlete.shortName || 'Leader'),
        teamAbbr: tAbbr,
        headshot:
          top.athlete.headshot ||
          'https://a.espncdn.com/combiner/i?img=/i/headshots/nophoto.png&w=120&h=90',
        statLine,
        estimatedPpr: estimateFantasyPpr(catAbbr, statLine),
      });
    }

    const parseLs = (c: any): number[] =>
      Array.isArray(c?.linescores) ? c.linescores.map((l: any) => Number(l.displayValue || l.value || 0)) : [];

    return {
      eventId: String(ev.id || ''),
      shortName: String(ev.shortName || `${awayAbbr} @ ${homeAbbr}`),
      name: String(ev.name || `${awayComp.team?.displayName || awayAbbr} at ${homeComp.team?.displayName || homeAbbr}`),
      gameState,
      statusDetail,
      clock,
      period,
      away: {
        id: awayId,
        abbr: awayAbbr,
        name: String(awayComp.team?.shortDisplayName || awayComp.team?.name || awayAbbr),
        displayName: String(awayComp.team?.displayName || awayAbbr),
        logo: awayComp.team?.logo || '',
        score: awayScore,
        record: awayComp.records?.[0]?.summary || '',
        timeouts: Number(sit.awayTimeouts ?? 3),
        linescores: parseLs(awayComp),
      },
      home: {
        id: homeId,
        abbr: homeAbbr,
        name: String(homeComp.team?.shortDisplayName || homeComp.team?.name || homeAbbr),
        displayName: String(homeComp.team?.displayName || homeAbbr),
        logo: homeComp.team?.logo || '',
        score: homeScore,
        record: homeComp.records?.[0]?.summary || '',
        timeouts: Number(sit.homeTimeouts ?? 3),
        linescores: parseLs(homeComp),
      },
      situation: {
        isRedZone,
        isGoalToGo,
        isScoringRange,
        isTwoMinuteDrill,
        isWitchingHour,
        down: typeof sit.down === 'number' ? sit.down : null,
        distance: typeof sit.distance === 'number' ? sit.distance : null,
        yardsToEndZone,
        ballPosPct: yardsToEndZone !== null ? Math.max(1, Math.min(99, 100 - yardsToEndZone)) : null,
        downDistanceText: String(sit.downDistanceText || ''),
        possessionText: String(sit.possessionText || ''),
        possessionTeamId: possTeamId,
        possessionTeamAbbr: possTeamAbbr,
      },
      winProbability: {
        awayWinPct,
        homeWinPct,
        leverageIndex,
      },
      lastPlay,
      leaders,
      heatScore,
      heatTier,
      heatReason,
      odds: {
        details: comp.odds?.[0]?.details,
        overUnder: comp.odds?.[0]?.overUnder ? `O/U ${comp.odds[0].overUnder}` : undefined,
      },
      venue: comp.venue?.fullName || '',
      broadcast: comp.broadcasts?.[0]?.names?.join(', ') || '',
      startDateIso: String(ev.date || ''),
    };
  }

  /** Track state transitions & notable plays across all live games in a chronological feed */
  private updateRollingEventFeed(games: RedZoneGameNode[]): void {
    const now = Date.now();
    for (const g of games) {
      const prev = this.prevStateByEvent.get(g.eventId);
      const scoreSum = g.away.score + g.home.score;

      // 1. Score change / Scoring play detection
      if (g.gameState === 'in' && ((prev && scoreSum > prev.scoreSum) || (g.lastPlay && g.lastPlay.scoreValue > 0))) {
        const diff = prev ? scoreSum - prev.scoreSum : g.lastPlay?.scoreValue || 6;
        const playKey = `score_${g.eventId}_${g.away.score}_${g.home.score}_${g.lastPlay?.id || ''}`;
        if (!this.seenPlayKeys.has(playKey)) {
          this.seenPlayKeys.add(playKey);
          const isTd = diff >= 6 || /touchdown/i.test(g.lastPlay?.text || g.lastPlay?.typeText || '');
          const isAwayScored = prev ? g.away.score > prev.awayScore : g.situation.possessionTeamAbbr === g.away.abbr;
          const scoringSide = isAwayScored ? g.away : g.home;
          this.rollingEventFeed.unshift({
            id: playKey,
            eventId: g.eventId,
            matchup: g.shortName,
            timestamp: now,
            clockLabel: g.statusDetail,
            type: isTd ? 'TOUCHDOWN' : 'FIELD_GOAL',
            badge: isTd ? '🏈 TOUCHDOWN' : '🥅 FIELD GOAL',
            headline: `${g.shortName}: ${scoringSide.abbr} ${isTd ? 'Touchdown!' : 'Scores'} (${g.away.abbr} ${g.away.score} - ${g.home.abbr} ${g.home.score})`,
            detail: g.lastPlay?.text || `${scoringSide.displayName} added ${diff} points.`,
            wpSwingText: g.lastPlay?.wpSwingPct ? `+${g.lastPlay.wpSwingPct}% WP Swing` : `${scoringSide.abbr} Scoring Drive`,
            playerHeadshot: g.lastPlay?.athleteHeadshot,
            teamLogo: scoringSide.logo,
            teamAbbr: scoringSide.abbr,
            scoreBadge: `${g.away.abbr} ${g.away.score} - ${g.home.abbr} ${g.home.score}`,
            accentColor: isTd ? 'gold' : 'green',
          });
        }
      }

      // 2. Red Zone Entry Alert
      if (g.gameState === 'in' && g.situation.isRedZone && (!prev || !prev.isRedZone)) {
        const rzKey = `rz_${g.eventId}_${g.period}_${g.situation.possessionTeamAbbr}_${g.situation.downDistanceText}`;
        if (!this.seenPlayKeys.has(rzKey)) {
          this.seenPlayKeys.add(rzKey);
          const offenseSide = g.situation.possessionTeamId === g.away.id ? g.away : g.home;
          this.rollingEventFeed.unshift({
            id: rzKey,
            eventId: g.eventId,
            matchup: g.shortName,
            timestamp: now,
            clockLabel: g.statusDetail,
            type: 'RED_ZONE',
            badge: g.situation.isGoalToGo ? '🚨 GOAL-TO-GO' : '🚨 RED ZONE ENTRY',
            headline: `${offenseSide.abbr} threatens inside the ${g.situation.yardsToEndZone || 20}!`,
            detail: `${g.situation.downDistanceText || 'Inside the 20'}${g.lastPlay?.driveDescription ? ` • Drive: ${g.lastPlay.driveDescription}` : ''}`,
            wpSwingText: `${g.winProbability.leverageIndex}x LI`,
            playerHeadshot: g.lastPlay?.athleteHeadshot,
            teamLogo: offenseSide.logo,
            teamAbbr: offenseSide.abbr,
            scoreBadge: `${g.away.abbr} ${g.away.score} - ${g.home.abbr} ${g.home.score}`,
            accentColor: 'red',
          });
        }
      }

      // 3. Turnovers / Explosive Plays (20+ yards)
      if (g.gameState === 'in' && g.lastPlay) {
        const lpKey = `lp_${g.eventId}_${g.lastPlay.id}`;
        const isTurnover = /interception|fumble|turnover/i.test(g.lastPlay.typeText + ' ' + g.lastPlay.text);
        const isExplosive = Math.abs(g.lastPlay.statYardage) >= 20;
        if (!this.seenPlayKeys.has(lpKey) && (isTurnover || isExplosive)) {
          this.seenPlayKeys.add(lpKey);
          const offenseSide = g.situation.possessionTeamId === g.away.id ? g.away : g.home;
          this.rollingEventFeed.unshift({
            id: lpKey,
            eventId: g.eventId,
            matchup: g.shortName,
            timestamp: now,
            clockLabel: g.statusDetail,
            type: isTurnover ? 'TURNOVER' : 'EXPLOSIVE_PLAY',
            badge: isTurnover ? '⚡ TURNOVER' : `🚀 +${g.lastPlay.statYardage} YDS`,
            headline: isTurnover
              ? `${g.shortName}: Turnover swings momentum!`
              : `${g.shortName}: Explosive ${g.lastPlay.statYardage}-yard gain (${g.lastPlay.typeText})`,
            detail: g.lastPlay.text,
            wpSwingText: `${g.winProbability.leverageIndex}x LI`,
            playerHeadshot: g.lastPlay.athleteHeadshot,
            teamLogo: offenseSide.logo,
            teamAbbr: offenseSide.abbr,
            scoreBadge: `${g.away.abbr} ${g.away.score} - ${g.home.abbr} ${g.home.score}`,
            accentColor: isTurnover ? 'purple' : 'cyan',
          });
        }
      }

      this.prevStateByEvent.set(g.eventId, {
        scoreSum,
        isRedZone: g.situation.isRedZone,
        homeWp: g.winProbability.homeWinPct,
        awayScore: g.away.score,
        homeScore: g.home.score,
      });
    }

    // Keep bounded rolling history
    if (this.rollingEventFeed.length > 40) {
      this.rollingEventFeed = this.rollingEventFeed.slice(0, 40);
    }
    if (this.seenPlayKeys.size > 400) {
      this.seenPlayKeys.clear();
    }
  }

  private buildFantasyLeaderboard(games: RedZoneGameNode[]): RedZoneFantasyLeader[] {
    const all: RedZoneFantasyLeader[] = [];
    for (const g of games) {
      if (g.gameState === 'pre') continue;
      for (const l of g.leaders) {
        const isInRz =
          g.gameState === 'in' &&
          g.situation.isRedZone &&
          g.situation.possessionTeamAbbr === l.teamAbbr;
        all.push({
          id: l.athleteId || `${g.eventId}_${l.name}`,
          name: l.name,
          teamAbbr: l.teamAbbr,
          matchup: g.shortName,
          eventId: g.eventId,
          category: l.category,
          headshot: l.headshot,
          statLine: l.statLine,
          estimatedPpr: l.estimatedPpr,
          isInRedZoneNow: isInRz,
        });
      }
    }
    return all.sort((a, b) => b.estimatedPpr - a.estimatedPpr);
  }

  private buildSmartCards(
    games: RedZoneGameNode[],
    feed: RedZoneEventFeedItem[],
    fantasy: RedZoneFantasyLeader[],
    slatePhase: RedZoneSlatePayload['slatePhase']
  ): RedZoneSmartCard[] {
    const cards: RedZoneSmartCard[] = [];
    const liveGames = games.filter((g) => g.gameState === 'in');
    const rzGames = liveGames.filter((g) => g.situation.isRedZone);
    const witchGames = liveGames.filter((g) => g.situation.isWitchingHour);

    for (const g of rzGames.slice(0, 2)) {
      const offAbbr = g.situation.possessionTeamAbbr || g.away.abbr;
      cards.push({
        id: `sc_rz_${g.eventId}`,
        category: 'Red Zone Threat',
        badge: g.situation.isGoalToGo ? '🚨 GOAL-TO-GO ALERT' : '🚨 RED ZONE THREAT',
        headline: `${g.shortName}: ${offAbbr} at OPP ${g.situation.yardsToEndZone ?? '<20'} (${g.situation.downDistanceText || 'Inside 20'})`,
        detail: g.lastPlay?.text
          ? `${g.lastPlay.driveDescription ? `Drive (${g.lastPlay.driveDescription}) • ` : ''}${g.lastPlay.text}`
          : `${g.away.abbr} ${g.away.score} - ${g.home.abbr} ${g.home.score} (${g.statusDetail})`,
        metricHighlight: `${g.winProbability.leverageIndex}x LI`,
        accentColor: 'red',
        playerHeadshot: g.lastPlay?.athleteHeadshot,
        eventId: g.eventId,
      });
    }

    for (const f of feed.slice(0, 2)) {
      if (f.type === 'TOUCHDOWN' || f.type === 'TURNOVER') {
        cards.push({
          id: `sc_feed_${f.id}`,
          category: f.badge,
          badge: f.badge,
          headline: f.headline,
          detail: f.detail,
          metricHighlight: f.wpSwingText,
          accentColor: f.accentColor,
          playerHeadshot: f.playerHeadshot,
          eventId: f.eventId,
        });
      }
    }

    if (witchGames.length > 0) {
      const wg = witchGames[0];
      cards.push({
        id: `sc_witch_${wg.eventId}`,
        category: 'Witching Hour',
        badge: '🔮 WITCHING HOUR CLUTCH',
        headline: `${wg.shortName}: ${wg.away.score}-${wg.home.score} (${wg.statusDetail})`,
        detail: wg.situation.downDistanceText
          ? `${wg.situation.downDistanceText} • ${wg.away.abbr} ${wg.winProbability.awayWinPct}% / ${wg.home.abbr} ${wg.winProbability.homeWinPct}% WP`
          : `One-score crunch time!`,
        metricHighlight: `${wg.winProbability.leverageIndex}x LI`,
        accentColor: 'purple',
        eventId: wg.eventId,
      });
    }

    if (fantasy.length > 0) {
      const top = fantasy[0];
      cards.push({
        id: `sc_fan_${top.id}`,
        category: 'Fantasy Pace',
        badge: '🏆 FANTASY PPR LEADER',
        headline: `${top.name} (${top.teamAbbr}) • ${top.estimatedPpr} PPR`,
        detail: `${top.matchup}: ${top.statLine}`,
        metricHighlight: `${top.estimatedPpr} PTS`,
        accentColor: 'gold',
        playerHeadshot: top.headshot,
        eventId: top.eventId,
      });
    }

    if (cards.length === 0) {
      const upcoming = games.filter((g) => g.gameState === 'pre');
      const finals = games.filter((g) => g.gameState === 'post');
      if (upcoming.length > 0) {
        const next = upcoming[0];
        cards.push({
          id: `sc_pre_${next.eventId}`,
          category: 'Upcoming Window',
          badge: slatePhase === 'PRE_SLATE' ? '📋 SUNDAY SLATE PREVIEW' : '⏳ UPCOMING KICKOFF',
          headline: `${next.shortName} (${next.statusDetail})`,
          detail: `${next.venue}${next.odds.details ? ` • Line: ${next.odds.details}` : ''}${next.odds.overUnder ? ` (${next.odds.overUnder})` : ''}`,
          metricHighlight: `${upcoming.length} Upcoming`,
          accentColor: 'cyan',
          eventId: next.eventId,
        });
      } else if (finals.length > 0) {
        const topFinal = finals[0];
        cards.push({
          id: `sc_post_${topFinal.eventId}`,
          category: 'Slate Recap',
          badge: '🏁 NFL SLATE WRAP-UP',
          headline: `${topFinal.shortName}: ${topFinal.away.abbr} ${topFinal.away.score} - ${topFinal.home.abbr} ${topFinal.home.score} (Final)`,
          detail: topFinal.lastPlay?.text || `${finals.length} completed games on this week's NFL slate.`,
          metricHighlight: `${finals.length} Finals`,
          accentColor: 'cyan',
          eventId: topFinal.eventId,
        });
      }
    }

    return cards;
  }
}

export const redZoneIntelService = new RedZoneIntelService();
