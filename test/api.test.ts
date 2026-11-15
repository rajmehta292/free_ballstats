import test from 'node:test';
import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';
import { basketballResearchService } from '../src/services/basketball-research-service.js';

test('StreamFree API Streamer Suite', async (t) => {
  const server = await buildServer();

  await t.test('GET /health returns healthy status', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/health',
    });
    assert.equal(res.statusCode, 200);
    const data = res.json();
    assert.equal(data.status, 'healthy');
    assert.ok(data.uptime >= 0);
  });

  await t.test('GET /api/v1/categories returns list of categories', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/categories',
    });
    assert.equal(res.statusCode, 200);
    const data = res.json();
    assert.ok(Array.isArray(data.categories));
    assert.ok(data.categories.length > 0);
    assert.ok(data.categories.includes('soccer'));
  });

  await t.test('GET /api/v1/streams returns list of streams', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/streams',
    });
    assert.equal(res.statusCode, 200);
    const data = res.json();
    assert.ok(typeof data.count === 'number');
    assert.ok(Array.isArray(data.streams));
  });

  await t.test('GET /api/v1/streams with category filter', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/streams?category=soccer',
    });
    assert.equal(res.statusCode, 200);
    const data = res.json();
    assert.ok(Array.isArray(data.streams));
    for (const stream of data.streams) {
      assert.equal(stream.category.toLowerCase(), 'soccer');
    }
  });

  await t.test('POST and DELETE /api/v1/custom-streams works', async () => {
    const customStream = {
      name: 'Unit Test Stream',
      category: 'test',
      league: 'Test League',
      stream_key: 'unit-test-stream-123',
      match_timestamp: Math.floor(Date.now() / 1000),
      sources: [
        { quality: 'FHD', url: 'https://test-streams.mux.dev/test.m3u8', live: true },
      ],
    };

    // Create
    const createRes = await server.inject({
      method: 'POST',
      url: '/api/v1/custom-streams',
      payload: customStream,
    });
    assert.equal(createRes.statusCode, 201);
    const createdData = createRes.json();
    assert.equal(createdData.stream_key, 'unit-test-stream-123');

    // Retrieve single
    const getRes = await server.inject({
      method: 'GET',
      url: '/api/v1/streams/unit-test-stream-123',
    });
    assert.equal(getRes.statusCode, 200);
    assert.equal(getRes.json().name, 'Unit Test Stream');

    // Delete
    const delRes = await server.inject({
      method: 'DELETE',
      url: '/api/v1/custom-streams/unit-test-stream-123',
    });
    assert.equal(delRes.statusCode, 200);
  });

  await t.test('GET /embed/:category/:stream_key returns player HTML', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/embed/soccer/test-stream',
    });
    assert.equal(res.statusCode, 200);
    assert.match(res.headers['content-type'] || '', /text\/html/);
    assert.ok(res.body.includes('player-container'));
  });

  await t.test('POST /api/feedback handles user feedback', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/feedback',
      payload: { message: 'Great stream quality!' },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().ok, true);
  });

  await t.test('GET /api/v1/export/playlist.m3u returns IPTV playlist', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/export/playlist.m3u',
    });
    assert.equal(res.statusCode, 200);
    assert.match(res.headers['content-type'] || '', /mpegurl/);
    assert.ok(res.body.includes('#EXTM3U'));
    assert.ok(res.body.includes('#EXTINF:'));
  });

  await t.test('GET /api/v1/export/epg.xml returns XMLTV guide', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/export/epg.xml',
    });
    assert.equal(res.statusCode, 200);
    assert.match(res.headers['content-type'] || '', /xml/);
    assert.ok(res.body.includes('<tv'));
    assert.ok(res.body.includes('</tv>'));
  });

  await t.test('GET /api/v1/intel/:stream_key returns live gamecast intelligence', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/intel/nfl-texans-chargers',
    });
    assert.equal(res.statusCode, 200);
    const data = res.json();
    assert.ok(data.scoreboard);
    assert.ok(data.scoreboard.team1);
    assert.ok(data.scoreboard.team2);
    assert.ok(Array.isArray(data.stats));
    assert.ok(Array.isArray(data.leaders));
    assert.ok(data.boxscore);
    assert.ok(data.rosters);
  });

  await t.test('GET /api/v1/athlete/:sport/:league/:athlete_id returns athlete profile', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/athlete/football/nfl/4361579',
    });
    assert.equal(res.statusCode, 200);
    const data = res.json();
    assert.ok(data.name);
    assert.ok(data.headshot);
    assert.ok(Array.isArray(data.overviewStats));
  });

  await t.test('GET /api/v1/intel/:stream_key for basketball returns Four Factors, Linescore, and Advanced Boxscore', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/intel/nba-lakers-vs-celtics',
    });
    assert.equal(res.statusCode, 200);
    const data = res.json();
    assert.ok(data.linescore);
    assert.ok(Array.isArray(data.linescore.periodHeaders));
    assert.ok(data.basketballAnalytics);
    assert.ok(data.basketballAnalytics.team1Analytics.fourFactors);
    assert.ok(typeof data.basketballAnalytics.team1Analytics.fourFactors.efgPct === 'number');
    assert.ok(Array.isArray(data.basketballAnalytics.inGameInsights));
    const advCat = data.boxscore?.team1?.categories?.find((c: any) => c.name === 'advanced');
    assert.ok(advCat, 'Expected Advanced Analytics boxscore category for basketball game');
  });

  await t.test('GET /api/v1/basketball/hub returns full Basketball Research Lab payload', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/basketball/hub',
    });
    assert.equal(res.statusCode, 200);
    const data = res.json();
    assert.ok(Array.isArray(data.games) && data.games.length > 0);
    assert.ok(Array.isArray(data.players) && data.players.length >= 10);
    assert.ok(data.standings?.eastern && data.standings?.western);
    assert.ok(Array.isArray(data.glossary) && data.glossary.length > 0);
  });

  await t.test('GET /api/v1/basketball/game/:event_id returns deep game analytics including v3.0 CourtOptix, Synergy, 5v5 Lineups, and WPA Worm', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/basketball/game/sim_lal_bos_2026',
    });
    assert.equal(res.statusCode, 200);
    const data = res.json();
    assert.equal(data.eventId, 'sim_lal_bos_2026');
    assert.ok(data.team1Analytics.fourFactors.efgPct > 0);
    assert.ok(data.team1Analytics.unitSplits.startersPts > 0);
    assert.ok(data.mvpPerformer && typeof data.mvpPerformer.gameScore === 'number');
    assert.ok(typeof data.mvpPerformer.xEfgPct === 'number');
    assert.ok(typeof data.mvpPerformer.bpm === 'number');
    assert.ok(typeof data.mvpPerformer.wpa === 'number');
    assert.ok(data.shotChart && Array.isArray(data.shotChart.shots) && data.shotChart.shots.length > 0);
    assert.ok(Array.isArray(data.shotChart.team1Zones) && data.shotChart.team1Zones.length === 6);
    assert.ok(data.onCourtLineup && Array.isArray(data.onCourtLineup.team1Five) && data.onCourtLineup.team1Five.length === 5);
    assert.ok(Array.isArray(data.winProbTimeline) && data.winProbTimeline.length > 0);
    assert.ok(Array.isArray(data.stintTimeline) && data.stintTimeline.length > 0);
    assert.ok(Array.isArray(data.smartCards) && data.smartCards.length > 0);
    assert.ok(Array.isArray(data.team1Analytics.playTypes) && data.team1Analytics.playTypes.length >= 6);
  });

  await t.test('GET /api/v1/basketball/smart-hud/:stream_key returns low-latency Smart Screen broadcast HUD telemetry', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/basketball/smart-hud/nba-lakers-vs-celtics',
    });
    assert.equal(res.statusCode, 200);
    const hud = res.json();
    assert.ok(hud.team1 && hud.team2);
    assert.ok(typeof hud.leverageIndex === 'number');
    assert.ok(hud.fourFactors && hud.fourFactors.team1 && hud.fourFactors.team2);
    assert.ok(hud.shotChart && Array.isArray(hud.shotChart.shots));
    assert.ok(hud.onCourtLineup && Array.isArray(hud.onCourtLineup.team1Five));
    assert.ok(Array.isArray(hud.winProbTimeline));
    assert.ok(Array.isArray(hud.smartCards) && hud.smartCards.length > 0);
  });

  await t.test('GET /api/v1/basketball/players supports sorting and position filtering', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/basketball/players?sort=tspct&position=C',
    });
    assert.equal(res.statusCode, 200);
    const data = res.json();
    assert.ok(data.count > 0);
    assert.equal(data.players[0].position, 'C');
  });

  await t.test('GET /api/v1/basketball/compare compares two NBA players head-to-head', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/basketball/compare?p1=Nikola%20Jokic&p2=Luka%20Doncic',
    });
    assert.equal(res.statusCode, 200);
    const data = res.json();
    assert.equal(data.player1.name, 'Nikola Jokic');
    assert.equal(data.player2.name, 'Luka Doncic');
    assert.ok(Array.isArray(data.metricsComparison) && data.metricsComparison.length >= 10);
    assert.ok(data.summaryVerdict);
  });

  await t.test('GET /api/v1/basketball/query executes StatMuse-style natural language queries', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/basketball/query?q=True%20Shooting%20leaders',
    });
    assert.equal(res.statusCode, 200);
    const data = res.json();
    assert.ok(data.headline);
    assert.ok(data.narrative);
    assert.ok(Array.isArray(data.tableRows) && data.tableRows.length > 0);
  });

  await t.test('GET /basketball serves the Basketball Research Lab HTML page', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/basketball',
    });
    assert.equal(res.statusCode, 200);
    assert.match(res.headers['content-type'] || '', /text\/html/);
    assert.ok(res.body.includes('Basketball Research'));
  });

  await t.test('GET /api/v1/intel/uefa-england-vs-spain and smart-hud return authentic Soccer Opta xG & Pitch telemetry without NBA cross-contamination', async () => {
    const intelRes = await server.inject({
      method: 'GET',
      url: '/api/v1/intel/uefa-england-vs-spain',
    });
    assert.equal(intelRes.statusCode, 200);
    const intel = intelRes.json();
    assert.ok(intel.sportAnalytics, 'Expected sportAnalytics on soccer intel');
    assert.equal(intel.sportAnalytics.sportType, 'soccer');
    assert.equal(intel.sportAnalytics.surfaceType, 'soccer_pitch');
    const rosterNames = intel.rosters.team1.map((r: any) => r.name);
    assert.ok(rosterNames.includes('Harry Kane') || rosterNames.includes('Jude Bellingham'), 'Expected real England players');
    assert.ok(!rosterNames.some((n: string) => n.includes('England Striker')), 'Must not contain generic placeholder names');

    const hudRes = await server.inject({
      method: 'GET',
      url: '/api/v1/basketball/smart-hud/uefa-england-vs-spain',
    });
    assert.equal(hudRes.statusCode, 200);
    const hud = hudRes.json();
    assert.equal(hud.sportType, 'soccer');
    assert.equal(hud.surfaceType, 'soccer_pitch');
    const cardHeadlines = (hud.smartCards || []).map((c: any) => `${c.headline} ${c.subline}`).join(' ');
    assert.ok(!cardHeadlines.includes('Jaylen Brown'), 'Soccer smart cards must never leak NBA players like Jaylen Brown');
    assert.ok(!cardHeadlines.includes('Personal Fouls'), 'Soccer smart cards must not show NBA personal foul alerts');
  });

  await t.test('GET /api/v1/basketball/smart-hud/:stream_key supports NFL, NHL, College Football, and College Basketball with sport-specific surfaces', async () => {
    const cases = [
      { key: 'nfl-chiefs-vs-bills', expectedSport: 'nfl', expectedSurface: 'football_field' },
      { key: 'cfb-oregon-vs-ohio-state', expectedSport: 'ncaaf', expectedSurface: 'football_field' },
      { key: 'nhl-oilers-vs-panthers', expectedSport: 'hockey', expectedSurface: 'hockey_rink' },
      { key: 'ncaab-duke-vs-kansas', expectedSport: 'ncaab', expectedSurface: 'basketball_halfcourt' },
    ];

    for (const c of cases) {
      const res = await server.inject({
        method: 'GET',
        url: `/api/v1/basketball/smart-hud/${c.key}`,
      });
      assert.equal(res.statusCode, 200);
      const data = res.json();
      assert.equal(data.sportType, c.expectedSport, `Expected ${c.expectedSport} for ${c.key}`);
      assert.equal(data.surfaceType, c.expectedSurface, `Expected ${c.expectedSurface} for ${c.key}`);
      assert.ok(data.sportAnalytics && Array.isArray(data.sportAnalytics.fourPillars) && data.sportAnalytics.fourPillars.length === 4);
      assert.ok(Array.isArray(data.smartCards) && data.smartCards.length > 0);
    }
  });

  await t.test('Pre-game 0-0 state (e.g. LAL vs PHX before tip-off) produces realistic scouting baselines, 0-0 linescore, 1.0x LI, 0 fouls, and full projected starting 5s', async () => {
    const preGame = basketballResearchService.buildGameAnalyticsFromPlayers({
      eventId: 'espn-pregame-lal-phx',
      status: 'Scheduled',
      detail: '11/15 - 4:00 PM EST',
      isLive: false,
      gameState: 'pre',
      venue: 'Footprint Center, Phoenix',
      broadcast: 'ESPN',
      team1Meta: {
        name: 'Los Angeles Lakers',
        abbreviation: 'LAL',
        logo: 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png',
        score: '0',
        record: '10-4',
      },
      team2Meta: {
        name: 'Phoenix Suns',
        abbreviation: 'PHX',
        logo: 'https://a.espncdn.com/i/teamlogos/nba/500/phx.png',
        score: '0',
        record: '9-5',
      },
      rawPlayers1: [],
      rawPlayers2: [],
    });

    assert.equal(preGame.gameState, 'pre');
    assert.equal(preGame.linescore.team1.total, 0, 'Pre-game linescore total must be 0, never 108');
    assert.equal(preGame.linescore.team2.total, 0, 'Pre-game linescore total must be 0, never 108');
    assert.deepEqual(preGame.linescore.team1.quarters, [0, 0, 0, 0]);
    assert.deepEqual(preGame.linescore.team2.quarters, [0, 0, 0, 0]);
    assert.ok(preGame.team1Analytics.ortg >= 94 && preGame.team1Analytics.ortg <= 136, `ORTG must be realistic, got ${preGame.team1Analytics.ortg}`);
    assert.ok(preGame.team1Analytics.efgPct > 45, `eFG% must never be 0%, got ${preGame.team1Analytics.efgPct}`);
    assert.equal(preGame.leverageIndex, 1.0, 'Pre-game leverage index must be 1.0x');
    assert.equal(preGame.bonusState.team1FoulsInPeriod, 0, 'Pre-game fouls must be 0');
    assert.equal(preGame.bonusState.team2FoulsInPeriod, 0, 'Pre-game fouls must be 0');
    assert.equal(preGame.onCourtLineup.team1Five.length, 5, 'LAL projected starting 5 must be populated');
    assert.equal(preGame.onCourtLineup.team2Five.length, 5, 'PHX projected starting 5 must be populated');
    assert.ok(preGame.onCourtLineup.team2Five.some((p) => p.name.includes('Kevin Durant') || p.name.includes('Devin Booker')));
    assert.ok(preGame.mvpPerformer !== null, 'Pre-game star watch performer must never be null');
    const cardTitles = preGame.smartCards.map((c) => `${c.badge} ${c.title}`).join(' ');
    assert.ok(!cardTitles.includes('9-2 run'), 'Pre-game smart cards must not show fake in-game runs');
    assert.ok(cardTitles.includes('PRE-GAME'), 'Pre-game smart cards should show pre-game scouting insights');
  });

  await server.close();
});


