import type { FastifyPluginAsync } from 'fastify';
import { streamFreeClient } from '../services/streamfree-client.js';
import { customStreamsService } from '../services/custom-streams.js';
import { sseService } from '../services/sse-service.js';
import { sportsIntelService } from '../services/sports-intel-service.js';
import { basketballResearchService } from '../services/basketball-research-service.js';
import { multiSportAnalyticsService } from '../services/multi-sport-analytics-service.js';
import { catalogTickerService } from '../services/catalog-ticker-service.js';
import type { FeedbackInput, StreamItem } from '../types/stream.js';

export const apiRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/v1/categories
   * List all stream categories
   */
  fastify.get('/categories', {
    schema: {
      description: 'Get all available sports and media categories',
      tags: ['Catalog'],
      response: {
        200: {
          type: 'object',
          properties: {
            categories: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  }, async (_request, reply) => {
    const data = await streamFreeClient.getCategories();
    return reply.send(data);
  });

  /**
   * GET /api/v1/streams
   * List all active and scheduled streams with filtering
   */
  fastify.get<{
    Querystring: {
      category?: string;
      search?: string;
      q?: string;
      live?: string;
      sort?: 'viewers' | 'time' | 'name';
    };
  }>('/streams', {
    schema: {
      description: 'Get list of active and scheduled streams with optional category, search, and live filter',
      tags: ['Streams'],
      querystring: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Filter by category (e.g. soccer, basketball, hockey)' },
          search: { type: 'string', description: 'Search by team name, match name, or league' },
          q: { type: 'string', description: 'Alias for search' },
          live: { type: 'string', description: 'Set to "true" to return only streams with an active live source' },
          sort: { type: 'string', enum: ['viewers', 'time', 'name'], description: 'Sort order' },
        },
      },
    },
  }, async (request, reply) => {
    const { category, search, q, live, sort } = request.query;
    const filterTerm = (search || q || '').toLowerCase().trim();
    const filterLiveOnly = live === 'true' || live === '1';

    let data = await streamFreeClient.getStreams(category);
    let streams = [...data.streams];

    if (filterTerm) {
      streams = streams.filter(s =>
        s.name.toLowerCase().includes(filterTerm) ||
        (s.league && s.league.toLowerCase().includes(filterTerm)) ||
        (s.team1 && s.team1.name.toLowerCase().includes(filterTerm)) ||
        (s.team2 && s.team2.name.toLowerCase().includes(filterTerm)) ||
        s.stream_key.toLowerCase().includes(filterTerm)
      );
    }

    if (filterLiveOnly) {
      streams = streams.filter(s => s.sources.some(src => src.live));
    }

    if (sort === 'viewers') {
      streams.sort((a, b) => (b.viewers || 0) - (a.viewers || 0));
    } else if (sort === 'time') {
      streams.sort((a, b) => a.match_timestamp - b.match_timestamp);
    } else if (sort === 'name') {
      streams.sort((a, b) => a.name.localeCompare(b.name));
    }

    return reply.send({
      count: streams.length,
      streams,
    });
  });

  /**
   * GET /api/v1/streams/live-context
   * Cached live scorebug, UFC fight card, F1 GP + standings, Tennis tournament, and RedZone tickers for catalog cards
   */
  fastify.get('/streams/live-context', {
    schema: {
      description: 'Get live scores, UFC current/last fight results, F1 GP standings, and RedZone radar tickers for catalog stream cards',
      tags: ['Streams', 'Sports Intelligence'],
    },
  }, async (_request, reply) => {
    const { streams } = await streamFreeClient.getStreams();
    const payload = await catalogTickerService.getLiveContext(streams);
    return reply.send(payload);
  });

  /**
   * GET /api/v1/streams/:stream_key
   * Get single stream details
   */
  fastify.get<{
    Params: { stream_key: string };
  }>('/streams/:stream_key', {
    schema: {
      description: 'Get details for a single stream by key',
      tags: ['Streams'],
      params: {
        type: 'object',
        properties: {
          stream_key: { type: 'string' },
        },
        required: ['stream_key'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            category: { type: 'string' },
            league: { type: 'string' },
            stream_key: { type: 'string' },
            match_timestamp: { type: 'number' },
            viewers: { type: 'number' },
            is_external: { type: 'boolean' },
            thumbnail_url: { type: 'string' },
            sources: { type: 'array' },
            team1: { type: 'object' },
            team2: { type: 'object' },
            custom: { type: 'boolean' },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { stream_key } = request.params;
    const stream = await streamFreeClient.getStreamByKey(stream_key);
    if (!stream) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `Stream '${stream_key}' is not active or does not exist.`,
      });
    }
    return reply.send(stream);
  });

  /**
   * GET /api/v1/sources/:stream_key
   * Lightweight source list for single stream
   */
  fastify.get<{
    Params: { stream_key: string };
  }>('/sources/:stream_key', {
    schema: {
      description: 'Get source URLs and live statuses for a stream',
      tags: ['Streams'],
      params: {
        type: 'object',
        properties: {
          stream_key: { type: 'string' },
        },
        required: ['stream_key'],
      },
    },
  }, async (request, reply) => {
    const { stream_key } = request.params;
    const sources = await streamFreeClient.getSources(stream_key);
    if (!sources) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `Stream sources for '${stream_key}' were not found.`,
      });
    }
    return reply.send(sources);
  });

  /**
   * GET /api/v1/redzone/intel
   * Dedicated Multi-Game NFL RedZone Command & Radar telemetry (live threat ranking, fantasy PPR leaders, spotlight & double-box compare)
   */
  fastify.get<{
    Querystring: { pinnedEventId?: string; pinnedB?: string };
  }>('/redzone/intel', {
    schema: {
      description: 'Get NFL RedZone multi-game slate intelligence, RedZone Heat ranking, TD/turnover feed, Fantasy PPR leaders, and pinned game intel',
      tags: ['Sports Intelligence'],
    },
  }, async (request, reply) => {
    const stream: StreamItem = {
      id: 'redzone',
      name: 'RedZone',
      category: 'football',
      league: 'NFL',
      stream_key: 'redzone',
      match_timestamp: Math.floor(Date.now() / 1000),
      sources: [],
    };
    const intel = await sportsIntelService.getGamecastIntel(stream, {
      pinnedEventId: request.query.pinnedEventId,
      secondaryEventId: request.query.pinnedB,
    });
    return reply.send(intel);
  });

  /**
   * GET /api/v1/intel/:stream_key
   * Live gamecast statistics, box score, key leaders (StatMuse/Reference), win probability, and news
   */
  fastify.get<{
    Params: { stream_key: string };
    Querystring: { pinnedEventId?: string; pinnedB?: string };
  }>('/intel/:stream_key', {
    schema: {
      description: 'Get deep gamecast live stats, boxscore, team comparison, StatMuse-style leaders, and news',
      tags: ['Sports Intelligence'],
      params: {
        type: 'object',
        properties: {
          stream_key: { type: 'string' },
        },
        required: ['stream_key'],
      },
    },
  }, async (request, reply) => {
    const { stream_key } = request.params;
    let stream: StreamItem | null = await streamFreeClient.getStreamByKey(stream_key);
    if (!stream) {
      const cleanKey = decodeURIComponent(stream_key).replace(/[-_]/g, ' ');
      const isBasketballKey = /lakers|celtics|warriors|knicks|pistons|bulls|heat|bucks|suns|nuggets|mavericks|clippers|76ers|sixers|thunder|cavaliers|cavs|magic|pacers|hawks|nets|raptors|hornets|wizards|spurs|rockets|grizzlies|pelicans|timberwolves|wolves|kings|blazers|jazz|nba|basketball|duke|kansas|auburn|uconn|ncaa/i.test(cleanKey);
      const isSoccerKey = /england|spain|france|germany|italy|brazil|argentina|portugal|netherlands|real madrid|barcelona|liverpool|arsenal|manchester|chelsea|bayern|psg|inter|milan|juventus|uefa|nations|champions|premier|soccer|futbol/i.test(cleanKey);
      const isHockeyKey = /oilers|panthers|leafs|rangers|bruins|avalanche|lightning|stars|knights|canucks|devils|penguins|capitals|nhl|hockey/i.test(cleanKey);
      const cat = isSoccerKey ? 'soccer' : isHockeyKey ? 'hockey' : isBasketballKey ? 'basketball' : 'football';
      const lg = isSoccerKey ? 'UEFA / Premier' : isHockeyKey ? 'NHL' : isBasketballKey ? (/duke|kansas|auburn|uconn|ncaa/i.test(cleanKey) ? 'NCAAB' : 'NBA') : (/oregon|ohio state|texas|georgia|alabama|cfb|ncaa/i.test(cleanKey) ? 'NCAAF' : 'NFL');
      stream = {
        id: stream_key,
        name: cleanKey.replace(/\b\w/g, l => l.toUpperCase()),
        category: cat,
        league: lg,
        stream_key,
        match_timestamp: Math.floor(Date.now() / 1000),
        sources: [],
      };
    }

    const intel = await sportsIntelService.getGamecastIntel(stream, {
      pinnedEventId: request.query.pinnedEventId,
      secondaryEventId: request.query.pinnedB,
    });
    return reply.send(intel);
  });

  /**
   * GET /api/v1/basketball/hub
   * Dedicated Basketball & Multi-Sport Research Hub
   */
  fastify.get('/basketball/hub', {
    schema: {
      description: 'Get complete Basketball & Multi-Sport Research Lab hub data (Four Factors, In-Game Supporting Stats, Standings, Leaders, Glossary, Multi-Sport Showcases)',
      tags: ['Basketball Research'],
    },
  }, async (_request, reply) => {
    const hub = await basketballResearchService.getResearchHub();
    return reply.send({
      ...hub,
      multiSportGames: multiSportAnalyticsService.getMultiSportShowcaseGames(),
    });
  });

  /**
   * GET /api/v1/basketball/game/:event_id
   * Deep basketball analytics for a specific game (Linescore, Four Factors, Unit Splits, Shot Diet, In-Game Insights)
   */
  fastify.get<{
    Params: { event_id: string };
  }>('/basketball/game/:event_id', {
    schema: {
      description: 'Get deep basketball analytics for a game including Four Factors, Starters vs Bench splits, Shot Diet, and Hollinger GmSc',
      tags: ['Basketball Research'],
      params: {
        type: 'object',
        properties: {
          event_id: { type: 'string' },
        },
        required: ['event_id'],
      },
    },
  }, async (request, reply) => {
    const data = await basketballResearchService.getGameDeepAnalytics(request.params.event_id);
    return reply.send(data);
  });

  /**
   * GET /api/v1/basketball/players
   * Sortable and filterable NBA Advanced Player Leaderboard Matrix
   */
  fastify.get<{
    Querystring: { sort?: string; position?: string; search?: string };
  }>('/basketball/players', {
    schema: {
      description: 'Get NBA players with advanced metrics (TS%, eFG%, PER, BPM, VORP, USG%, NetRTG, GmSc)',
      tags: ['Basketball Research'],
    },
  }, async (request, reply) => {
    const players = basketballResearchService.getPlayers(request.query);
    return reply.send({ count: players.length, players });
  });

  /**
   * GET /api/v1/basketball/compare
   * Head-to-Head Player Comparison Lab with 6-axis radar percentiles and category edges
   */
  fastify.get<{
    Querystring: { p1?: string; p2?: string };
  }>('/basketball/compare', {
    schema: {
      description: 'Compare two NBA players across traditional and advanced metrics with radar percentiles',
      tags: ['Basketball Research'],
    },
  }, async (request, reply) => {
    const result = basketballResearchService.comparePlayers(request.query.p1, request.query.p2);
    return reply.send(result);
  });

  /**
   * GET /api/v1/basketball/query
   * StatMuse-style Natural Language Basketball Research Query Engine
   */
  fastify.get<{
    Querystring: { q?: string };
  }>('/basketball/query', {
    schema: {
      description: 'Execute a natural-language basketball analytics query (StatMuse / Basketball-Reference style)',
      tags: ['Basketball Research'],
    },
  }, async (request, reply) => {
    const result = await basketballResearchService.queryResearch(request.query.q || '');
    return reply.send(result);
  });

  /**
   * GET /api/v1/basketball/smart-hud/:stream_key
   * Unified Smart Screen Broadcast HUD & L-Bar Telemetry payload for live viewing
   */
  fastify.get<{
    Params: { stream_key: string };
    Querystring: { pinnedEventId?: string; pinnedB?: string };
  }>('/basketball/smart-hud/:stream_key', {
    schema: {
      description: 'Get unified Smart Screen HUD telemetry (L-Bar Squeeze-Back stats, Auto-Triggered Smart Cards, Interactive Shot Chart, On-Court 5v5 Lineups, Leverage Index, and Win Prob Worm)',
      tags: ['Basketball Research', 'Sports Intelligence'],
      params: {
        type: 'object',
        properties: {
          stream_key: { type: 'string' },
        },
        required: ['stream_key'],
      },
    },
  }, async (request, reply) => {
    const { stream_key } = request.params;
    let stream: StreamItem | null = await streamFreeClient.getStreamByKey(stream_key);
    if (!stream) {
      const cleanKey = decodeURIComponent(stream_key).replace(/[-_]/g, ' ');
      const isBasketballKey = /lakers|celtics|warriors|knicks|pistons|bulls|heat|bucks|suns|nuggets|mavericks|clippers|76ers|sixers|thunder|cavaliers|cavs|magic|pacers|hawks|nets|raptors|hornets|wizards|spurs|rockets|grizzlies|pelicans|timberwolves|wolves|kings|blazers|jazz|nba|basketball/i.test(cleanKey);
      const isNcaabKey = /duke|kansas|auburn|uconn|kentucky|gonzaga|purdue|ncaab/i.test(cleanKey);
      const isSoccerKey = /england|spain|france|germany|italy|brazil|argentina|portugal|netherlands|real madrid|barcelona|liverpool|arsenal|manchester|chelsea|bayern|psg|inter|milan|juventus|uefa|nations|champions|premier|soccer|futbol/i.test(cleanKey);
      const isHockeyKey = /oilers|panthers|leafs|rangers|bruins|avalanche|lightning|stars|knights|canucks|devils|penguins|capitals|nhl|hockey/i.test(cleanKey);
      const isNcaafKey = /oregon|ohio state|texas|georgia|alabama|notre dame|cfb|ncaaf/i.test(cleanKey);
      const isBaseballKey = /mlb|baseball|yankees|dodgers|astros|phillies|braves|padres|mets/i.test(cleanKey);
      const isCombatKey = /ufc|mma|boxing|fight night|bellator|pfl/i.test(cleanKey);
      const isRacingKey = /skyf1|formula|grand prix|f1|nascar|motogp|indy/i.test(cleanKey);
      const isTennisKey = /tennis|atp|wta|wimbledon|us open|roland garros/i.test(cleanKey);
      const isCricketKey = /willow|cricket|ipl|icc|ashes|t20|odi/i.test(cleanKey);
      const cat = isSoccerKey
        ? 'soccer'
        : isHockeyKey
        ? 'hockey'
        : isBasketballKey || isNcaabKey
        ? 'basketball'
        : isBaseballKey
        ? 'baseball'
        : isCombatKey
        ? 'combat'
        : isRacingKey
        ? 'racing'
        : isTennisKey
        ? 'tennis'
        : isCricketKey
        ? 'cricket'
        : 'football';
      const lg = isSoccerKey
        ? 'UEFA / Premier'
        : isHockeyKey
        ? 'NHL'
        : isNcaabKey
        ? 'NCAAB'
        : isBasketballKey
        ? 'NBA'
        : isNcaafKey
        ? 'NCAAF'
        : isBaseballKey
        ? 'MLB'
        : isCombatKey
        ? 'UFC / MMA'
        : isRacingKey
        ? 'Formula 1'
        : isTennisKey
        ? 'ATP / WTA'
        : isCricketKey
        ? 'Cricket / ICC'
        : 'NFL';
      stream = {
        id: stream_key,
        name: cleanKey.replace(/\b\w/g, l => l.toUpperCase()),
        category: cat,
        league: lg,
        stream_key,
        match_timestamp: Math.floor(Date.now() / 1000),
        sources: [],
      };
    }

    const intel = await sportsIntelService.getGamecastIntel(stream, {
      pinnedEventId: request.query.pinnedEventId,
      secondaryEventId: request.query.pinnedB,
    });
    const bball = intel.basketballAnalytics;
    const sa = intel.sportAnalytics;
    const rz = intel.redzoneIntel;

    // Dedicated Multi-Game NFL RedZone Command telemetry
    if (rz) {
      return reply.send({
        stream_key,
        streamName: stream.name,
        category: stream.category,
        sportType: 'nfl_redzone',
        sportLabel: rz.sportBadge,
        sportBadge: rz.sportBadge,
        surfaceType: 'football_field',
        statusDetail: rz.slateHeadline,
        gameState: rz.summaryCounts.liveGames > 0 ? 'in' : rz.summaryCounts.upcomingGames > 0 ? 'pre' : 'post',
        isLive: rz.summaryCounts.liveGames > 0,
        situationBanner: rz.slateHeadline,
        scoreboard: intel.scoreboard,
        redzoneIntel: rz,
        sportAnalytics: sa,
        team1: sa ? {
          teamName: sa.team1Meta.name,
          abbreviation: sa.team1Meta.abbreviation,
          logo: sa.team1Meta.logo,
          score: sa.team1Meta.score,
        } : undefined,
        team2: sa ? {
          teamName: sa.team2Meta.name,
          abbreviation: sa.team2Meta.abbreviation,
          logo: sa.team2Meta.logo,
          score: sa.team2Meta.score,
        } : undefined,
        team1Analytics: sa ? {
          teamName: sa.team1Meta.name,
          abbreviation: sa.team1Meta.abbreviation,
          logo: sa.team1Meta.logo,
          score: sa.team1Meta.score,
        } : undefined,
        team2Analytics: sa ? {
          teamName: sa.team2Meta.name,
          abbreviation: sa.team2Meta.abbreviation,
          logo: sa.team2Meta.logo,
          score: sa.team2Meta.score,
        } : undefined,
        winProbability: intel.winProbability,
        linescore: sa?.linescore,
        leverageIndex: rz.games.find((g) => g.eventId === rz.pinnedEventId)?.winProbability.leverageIndex || 1.5,
        leverageTier: rz.summaryCounts.witchingHourCount > 0 ? 'HIGH' : 'MEDIUM',
        isClutchTime: rz.summaryCounts.witchingHourCount > 0 || rz.summaryCounts.inRedZoneCount > 0,
        smartCards: rz.smartCards,
        shotChart: sa ? {
          surfaceType: sa.surfaceType,
          shots: sa.spatialMap.events.map((ev) => ({
            ...ev,
            teamSide: ev.team,
            made: ev.isSuccess,
            shotType: ev.outcomeLabel,
            value: ev.isSuccess ? 1 : 0,
            xEfg: 50,
          })),
          team1Zones: sa.spatialMap.zones,
          team2Zones: sa.spatialMap.zones,
        } : undefined,
        winProbTimeline: sa?.winProbTimeline || [],
        mvpPerformer: sa?.mvpPerformer,
        inGameInsights: sa?.inGameInsights || [],
      });
    }

    // If this is a non-NBA sport (Soccer, NFL, College Football, NHL Hockey, College Basketball),
    // return 100% sport-authentic Smart Screen telemetry from UniversalSportDeepAnalytics!
    if ((!bball || sa?.sportType === 'ncaab') && sa) {
      return reply.send({
        stream_key,
        streamName: stream.name,
        category: stream.category,
        sportType: sa.sportType,
        sportLabel: sa.sportBadge,
        sportBadge: sa.sportBadge,
        surfaceType: sa.surfaceType,
        statusDetail: sa.detail,
        gameState: sa.isLive ? 'in' : Number(sa.team1Meta.score) === 0 && Number(sa.team2Meta.score) === 0 ? 'pre' : 'post',
        isLive: sa.isLive,
        situationBanner: sa.situationBanner,
        scoreboard: intel.scoreboard,
        sportAnalytics: sa,
        team1: {
          teamName: sa.team1Meta.name,
          abbreviation: sa.team1Meta.abbreviation,
          logo: sa.team1Meta.logo,
          score: sa.team1Meta.score,
          ortg: sa.fourPillars[0]?.team1Value || '',
          efgPct: sa.fourPillars[0]?.team1Numeric || 55,
          tsPct: sa.fourPillars[1]?.team1Numeric || 55,
          fourFactors: {
            efgPct: sa.fourPillars[0]?.team1Value || '',
            tovPct: sa.fourPillars[1]?.team1Value || '',
            orbPct: sa.fourPillars[2]?.team1Value || '',
            ftRate: sa.fourPillars[3]?.team1Value || '',
          },
          playTypes: (sa.tacticalMatrix || []).map((t) => ({
            playType: t.playType,
            label: t.label,
            freqPct: t.team1FreqPct,
            ppp: t.team1Efficiency,
            efgPct: t.edge,
            percentile: t.team1Percentile,
          })),
        },
        team2: {
          teamName: sa.team2Meta.name,
          abbreviation: sa.team2Meta.abbreviation,
          logo: sa.team2Meta.logo,
          score: sa.team2Meta.score,
          ortg: sa.fourPillars[0]?.team2Value || '',
          efgPct: sa.fourPillars[0]?.team2Numeric || 48,
          tsPct: sa.fourPillars[1]?.team2Numeric || 48,
          fourFactors: {
            efgPct: sa.fourPillars[0]?.team2Value || '',
            tovPct: sa.fourPillars[1]?.team2Value || '',
            orbPct: sa.fourPillars[2]?.team2Value || '',
            ftRate: sa.fourPillars[3]?.team2Value || '',
          },
          playTypes: (sa.tacticalMatrix || []).map((t) => ({
            playType: t.playType,
            label: t.label,
            freqPct: t.team2FreqPct,
            ppp: t.team2Efficiency,
            efgPct: t.edge,
            percentile: t.team2Percentile,
          })),
        },
        team1Analytics: {
          teamName: sa.team1Meta.name,
          abbreviation: sa.team1Meta.abbreviation,
          logo: sa.team1Meta.logo,
          score: sa.team1Meta.score,
          ortg: sa.fourPillars[0]?.team1Value || '',
          efgPct: sa.fourPillars[0]?.team1Value || '',
          xEfgPct: sa.fourPillars[1]?.team1Value || '',
          fourFactors: {
            efgPct: sa.fourPillars[0]?.team1Value || '',
            tovPct: sa.fourPillars[1]?.team1Value || '',
            orbPct: sa.fourPillars[2]?.team1Value || '',
            ftRate: sa.fourPillars[3]?.team1Value || '',
          },
        },
        team2Analytics: {
          teamName: sa.team2Meta.name,
          abbreviation: sa.team2Meta.abbreviation,
          logo: sa.team2Meta.logo,
          score: sa.team2Meta.score,
          ortg: sa.fourPillars[0]?.team2Value || '',
          efgPct: sa.fourPillars[0]?.team2Value || '',
          xEfgPct: sa.fourPillars[1]?.team2Value || '',
          fourFactors: {
            efgPct: sa.fourPillars[0]?.team2Value || '',
            tovPct: sa.fourPillars[1]?.team2Value || '',
            orbPct: sa.fourPillars[2]?.team2Value || '',
            ftRate: sa.fourPillars[3]?.team2Value || '',
          },
        },
        fourFactors: {
          team1: {
            efgPct: sa.fourPillars[0]?.team1Value || '',
            tovPct: sa.fourPillars[1]?.team1Value || '',
            orbPct: sa.fourPillars[2]?.team1Value || '',
            ftRate: sa.fourPillars[3]?.team1Value || '',
          },
          team2: {
            efgPct: sa.fourPillars[0]?.team2Value || '',
            tovPct: sa.fourPillars[1]?.team2Value || '',
            orbPct: sa.fourPillars[2]?.team2Value || '',
            ftRate: sa.fourPillars[3]?.team2Value || '',
          },
        },
        winProbability: intel.winProbability || {
          team1Percentage: sa.winProbTimeline[sa.winProbTimeline.length - 1]?.team1WinPct ?? 62,
          team2Percentage: 100 - (sa.winProbTimeline[sa.winProbTimeline.length - 1]?.team1WinPct ?? 62),
        },
        linescore: sa.linescore,
        leverageIndex: sa.leverageIndex,
        leverageTier: sa.leverageTier,
        isClutchTime: sa.isClutchTime,
        bonusState: {
          team1InBonus: false,
          team2InBonus: false,
          team1FoulsInPeriod: 0,
          team2FoulsInPeriod: 0,
        },
        smartCards: sa.smartCards,
        onCourtLineup: {
          team1Five: sa.activeUnit.team1Players,
          team2Five: sa.activeUnit.team2Players,
          team1UnitNetRtg: sa.activeUnit.team1NetMetric,
          team2UnitNetRtg: sa.activeUnit.team2NetMetric,
          activeStintMargin: sa.situationBanner,
          keyMatchupNote: sa.unitSplits.summaryEdge,
        },
        shotChart: {
          surfaceType: sa.surfaceType,
          shots: sa.spatialMap.events.map((ev) => ({
            ...ev,
            teamSide: ev.team,
            made: ev.isSuccess,
            shotType: ev.outcomeLabel,
            value: ev.isSuccess ? 1 : 0,
            xEfg: 50,
          })),
          team1Zones: sa.spatialMap.zones,
          team2Zones: sa.spatialMap.zones,
        },
        winProbTimeline: sa.winProbTimeline,
        stintTimeline: sa.activeUnit.stintTimeline,
        mvpPerformer: sa.mvpPerformer,
        inGameInsights: sa.inGameInsights,
      });
    }

    const activeBball = bball || basketballResearchService.getCuratedShowcaseGames()[0];

    return reply.send({
      stream_key,
      streamName: stream.name,
      category: stream.category,
      sportType: 'basketball',
      sportBadge: 'NBA COURTOPTIX & DEAN OLIVER FOUR FACTORS',
      surfaceType: 'basketball_halfcourt',
      statusDetail: activeBball.detail,
      gameState: activeBball.gameState || (activeBball.isLive ? 'in' : 'post'),
      isLive: activeBball.isLive,
      projectedPaceScore: activeBball.projectedPaceScore,
      scoreboard: intel.scoreboard,
      team1: activeBball.team1Analytics,
      team2: activeBball.team2Analytics,
      fourFactors: {
        team1: activeBball.team1Analytics.fourFactors,
        team2: activeBball.team2Analytics.fourFactors,
      },
      winProbability: intel.winProbability || {
        team1Percentage: activeBball.winProbTimeline[activeBball.winProbTimeline.length - 1]?.team1WinPct ?? 55,
        team2Percentage: 100 - (activeBball.winProbTimeline[activeBball.winProbTimeline.length - 1]?.team1WinPct ?? 55),
      },
      linescore: intel.linescore || {
        periodHeaders: activeBball.linescore.periodHeaders,
        team1Quarters: activeBball.linescore.team1.quarters,
        team2Quarters: activeBball.linescore.team2.quarters,
        team1Total: activeBball.linescore.team1.total,
        team2Total: activeBball.linescore.team2.total,
      },
      leverageIndex: activeBball.leverageIndex,
      leverageTier: activeBball.leverageTier,
      isClutchTime: activeBball.isClutchTime,
      bonusState: activeBball.bonusState,
      smartCards: activeBball.smartCards,
      onCourtLineup: activeBball.onCourtLineup,
      shotChart: activeBball.shotChart,
      winProbTimeline: activeBball.winProbTimeline,
      stintTimeline: activeBball.stintTimeline,
      team1Analytics: activeBball.team1Analytics,
      team2Analytics: activeBball.team2Analytics,
      mvpPerformer: activeBball.mvpPerformer,
      inGameInsights: activeBball.inGameInsights,
    });
  });

  /**
   * GET /api/v1/athlete/:sport/:league/:athlete_id
   * Deep player profile bio, physical measurements, college, draft, and statistics
   */
  fastify.get<{
    Params: { sport: string; league: string; athlete_id: string };
  }>('/athlete/:sport/:league/:athlete_id', {
    schema: {
      description: 'Get deep StatMuse/Reference-style athlete bio, season stats, height, weight, and college',
      tags: ['Sports Intelligence'],
      params: {
        type: 'object',
        properties: {
          sport: { type: 'string' },
          league: { type: 'string' },
          athlete_id: { type: 'string' },
        },
        required: ['sport', 'league', 'athlete_id'],
      },
    },
  }, async (request, reply) => {
    const { sport, league, athlete_id } = request.params;
    const profile = await sportsIntelService.getAthleteProfile(sport, league, athlete_id);
    return reply.send(profile);
  });

  /**
   * GET /api/v1/events/live-updates
   * Real-time Server-Sent Events stream for connected clients
   */
  fastify.get('/events/live-updates', {
    schema: {
      description: 'Subscribe to real-time Server-Sent Events (SSE) for live stream updates',
      tags: ['Real-Time'],
    },
  }, async (request, reply) => {
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.flushHeaders?.();

    const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    sseService.addClient(clientId, reply);

    request.raw.on('close', () => {
      sseService.removeClient(clientId);
    });

    // Keep connection alive
    return new Promise<void>(() => {});
  });

  /**
   * POST /api/v1/custom-streams
   * Add a custom stream
   */
  fastify.post<{
    Body: StreamItem;
  }>('/custom-streams', {
    schema: {
      description: 'Add a custom user stream (local HLS or external source)',
      tags: ['Custom Streams'],
    },
  }, async (request, reply) => {
    const body = request.body;
    if (!body || !body.name || !body.stream_key || !body.category || !Array.isArray(body.sources)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'name, stream_key, category, and sources array are required.',
      });
    }

    const created = customStreamsService.addStream({
      ...body,
      id: body.id || body.stream_key,
      match_timestamp: body.match_timestamp || Math.floor(Date.now() / 1000),
      custom: true,
    });

    return reply.status(201).send(created);
  });

  /**
   * DELETE /api/v1/custom-streams/:stream_key
   */
  fastify.delete<{
    Params: { stream_key: string };
  }>('/custom-streams/:stream_key', {
    schema: {
      description: 'Remove a custom stream',
      tags: ['Custom Streams'],
    },
  }, async (request, reply) => {
    const success = customStreamsService.removeStream(request.params.stream_key);
    if (!success) {
      return reply.status(404).send({ error: 'Not Found', message: 'Custom stream not found' });
    }
    return reply.send({ success: true, message: 'Custom stream removed' });
  });

  /**
   * GET /api/v1/mirrors
   * Get mirror status and failover stats
   */
  fastify.get('/mirrors', {
    schema: {
      description: 'Get upstream StreamFree mirrors status and health',
      tags: ['Diagnostics'],
    },
  }, async (_request, reply) => {
    return reply.send({
      activeMirror: streamFreeClient.getActiveMirror(),
      mirrors: streamFreeClient.getMirrors(),
      sseClients: sseService.getClientCount(),
    });
  });

  /**
   * POST /api/feedback
   * Mirrors the StreamFree feedback API
   */
  fastify.post<{
    Body: FeedbackInput;
  }>('/feedback', {
    schema: {
      description: 'Submit stream feedback or report an issue',
      tags: ['Feedback'],
    },
  }, async (request, reply) => {
    const { message, stream_key, category } = request.body || {};
    if (!message || !message.trim()) {
      return reply.status(400).send({ error: 'Please write some feedback first.' });
    }

    fastify.log.info({ feedback: { message, stream_key, category } }, 'User feedback received');
    return reply.send({ ok: true, message: 'Thanks! Your feedback was received.' });
  });
};

