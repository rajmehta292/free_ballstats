import type { FastifyPluginAsync } from 'fastify';
import { streamFreeClient } from '../services/streamfree-client.js';
import { customStreamsService } from '../services/custom-streams.js';
import { sseService } from '../services/sse-service.js';
import { sportsIntelService } from '../services/sports-intel-service.js';
import { basketballResearchService } from '../services/basketball-research-service.js';
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
   * GET /api/v1/intel/:stream_key
   * Live gamecast statistics, box score, key leaders (StatMuse/Reference), win probability, and news
   */
  fastify.get<{
    Params: { stream_key: string };
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
      const isBasketballKey = /lakers|celtics|warriors|knicks|pistons|bulls|heat|bucks|suns|nuggets|mavericks|clippers|76ers|sixers|thunder|cavaliers|cavs|magic|pacers|hawks|nets|raptors|hornets|wizards|spurs|rockets|grizzlies|pelicans|timberwolves|wolves|kings|blazers|jazz|nba|basketball/i.test(cleanKey);
      stream = {
        id: stream_key,
        name: cleanKey.replace(/\b\w/g, l => l.toUpperCase()),
        category: isBasketballKey ? 'basketball' : 'football',
        league: isBasketballKey ? 'NBA' : 'NFL',
        stream_key,
        match_timestamp: Math.floor(Date.now() / 1000),
        sources: [],
      };
    }

    const intel = await sportsIntelService.getGamecastIntel(stream);
    return reply.send(intel);
  });

  /**
   * GET /api/v1/basketball/hub
   * Dedicated Basketball Research Hub: Live/Recent NBA games with Four Factors, Unit Splits, Standings, Leaders, Glossary
   */
  fastify.get('/basketball/hub', {
    schema: {
      description: 'Get complete Basketball Research Lab hub data (Four Factors, In-Game Supporting Stats, Standings, Leaders, Glossary)',
      tags: ['Basketball Research'],
    },
  }, async (_request, reply) => {
    const hub = await basketballResearchService.getResearchHub();
    return reply.send(hub);
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
      stream = {
        id: stream_key,
        name: cleanKey.replace(/\b\w/g, l => l.toUpperCase()),
        category: 'basketball',
        league: 'NBA',
        stream_key,
        match_timestamp: Math.floor(Date.now() / 1000),
        sources: [],
      };
    }

    const intel = await sportsIntelService.getGamecastIntel(stream);
    let bball = intel.basketballAnalytics;

    // Ensure rich Smart Screen telemetry is always available even if the stream is cross-sport or pre-game
    if (!bball) {
      const showcase = basketballResearchService.getCuratedShowcaseGames()[0];
      const t1Name = intel.scoreboard?.team1?.name || stream.team1?.name || 'Home Team';
      const t2Name = intel.scoreboard?.team2?.name || stream.team2?.name || 'Away Team';
      const t1Abbr = t1Name.slice(0, 3).toUpperCase();
      const t2Abbr = t2Name.slice(0, 3).toUpperCase();
      bball = basketballResearchService.buildGameAnalyticsFromPlayers({
        eventId: stream_key,
        status: intel.scoreboard?.status || showcase.status,
        detail: intel.scoreboard?.detail || showcase.detail,
        isLive: true,
        venue: intel.gameInfo?.venue || showcase.venue,
        broadcast: intel.gameInfo?.broadcast || showcase.broadcast,
        team1Meta: {
          id: '1',
          name: t1Name,
          abbr: t1Abbr,
          logo: intel.scoreboard?.team1?.logo || showcase.team1Analytics.logo,
          score: Number(intel.scoreboard?.team1?.score) || showcase.team1Analytics.score,
        },
        team2Meta: {
          id: '2',
          name: t2Name,
          abbr: t2Abbr,
          logo: intel.scoreboard?.team2?.logo || showcase.team2Analytics.logo,
          score: Number(intel.scoreboard?.team2?.score) || showcase.team2Analytics.score,
        },
        rawPlayers1: showcase.playersTeam1.map(p => ({ ...p, teamName: t1Name, teamAbbr: t1Abbr })),
        rawPlayers2: showcase.playersTeam2.map(p => ({ ...p, teamName: t2Name, teamAbbr: t2Abbr })),
      });
    }

    return reply.send({
      stream_key,
      streamName: stream.name,
      category: stream.category,
      statusDetail: bball.detail,
      scoreboard: intel.scoreboard,
      team1: bball.team1Analytics,
      team2: bball.team2Analytics,
      fourFactors: {
        team1: bball.team1Analytics.fourFactors,
        team2: bball.team2Analytics.fourFactors,
      },
      winProbability: intel.winProbability || {
        team1Percentage: bball.winProbTimeline[bball.winProbTimeline.length - 1]?.team1WinPct ?? 55,
        team2Percentage: 100 - (bball.winProbTimeline[bball.winProbTimeline.length - 1]?.team1WinPct ?? 55),
      },
      linescore: intel.linescore || {
        periodHeaders: bball.linescore.periodHeaders,
        team1Quarters: bball.linescore.team1.quarters,
        team2Quarters: bball.linescore.team2.quarters,
        team1Total: bball.linescore.team1.total,
        team2Total: bball.linescore.team2.total,
      },
      leverageIndex: bball.leverageIndex,
      leverageTier: bball.leverageTier,
      isClutchTime: bball.isClutchTime,
      bonusState: bball.bonusState,
      smartCards: bball.smartCards,
      onCourtLineup: bball.onCourtLineup,
      shotChart: bball.shotChart,
      winProbTimeline: bball.winProbTimeline,
      stintTimeline: bball.stintTimeline,
      team1Analytics: bball.team1Analytics,
      team2Analytics: bball.team2Analytics,
      mvpPerformer: bball.mvpPerformer,
      inGameInsights: bball.inGameInsights,
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

