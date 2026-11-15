import test from 'node:test';
import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';

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

  await t.test('GET /api/v1/basketball/game/:event_id returns deep game analytics', async () => {
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

  await server.close();
});

