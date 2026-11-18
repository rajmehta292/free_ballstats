import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { buildServer } from '../src/server.js';
import { basketballResearchService } from '../src/services/basketball-research-service.js';
import { redZoneIntelService } from '../src/services/redzone-intel-service.js';
import { sportsIntelService } from '../src/services/sports-intel-service.js';

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

  await t.test('RedZone Multi-Game Heat Engine prioritizes Goal-to-Go & Witching Hour, tracks PPR leaders & Fantasy RZ threats, and exposes /api/v1/redzone/intel', async () => {
    const mockEvents = [
      {
        id: 'evt-halftime',
        shortName: 'ARI @ SEA',
        name: 'Arizona Cardinals at Seattle Seahawks',
        date: '2026-11-15T21:05Z',
        status: { displayClock: '0:00', period: 2, type: { state: 'in', shortDetail: 'Halftime' } },
        competitions: [{
          competitors: [
            { homeAway: 'home', score: '14', team: { id: '26', abbreviation: 'SEA', shortDisplayName: 'Seahawks', displayName: 'Seattle Seahawks' } },
            { homeAway: 'away', score: '3', team: { id: '22', abbreviation: 'ARI', shortDisplayName: 'Cardinals', displayName: 'Arizona Cardinals' } },
          ],
          situation: { isRedZone: false, homeTimeouts: 3, awayTimeouts: 3 },
          leaders: [],
        }],
      },
      {
        id: 'evt-witch',
        shortName: 'KC @ BUF',
        name: 'Kansas City Chiefs at Buffalo Bills',
        date: '2026-11-15T21:25Z',
        status: { displayClock: '1:54', period: 4, type: { state: 'in', shortDetail: '1:54 - 4th' } },
        competitions: [{
          competitors: [
            { homeAway: 'home', score: '24', team: { id: '2', abbreviation: 'BUF', shortDisplayName: 'Bills', displayName: 'Buffalo Bills' } },
            { homeAway: 'away', score: '21', team: { id: '12', abbreviation: 'KC', shortDisplayName: 'Chiefs', displayName: 'Kansas City Chiefs' } },
          ],
          situation: {
            isRedZone: false,
            down: 3,
            distance: 6,
            possession: '12',
            possessionText: 'BUF 42',
            downDistanceText: '3rd & 6 at BUF 42',
            lastPlay: { id: 'p-witch', text: 'P.Mahomes pass 14 yds to T.Kelce', statYardage: 14, scoreValue: 0, probability: { homeWinPercentage: 0.56 } },
          },
          leaders: [],
        }],
      },
      {
        id: 'evt-gtg',
        shortName: 'HOU @ LAC',
        name: 'Houston Texans at Los Angeles Chargers',
        date: '2026-11-15T21:05Z',
        status: { displayClock: '5:12', period: 3, type: { state: 'in', shortDetail: '5:12 - 3rd' } },
        competitions: [{
          competitors: [
            { homeAway: 'home', score: '17', team: { id: '24', abbreviation: 'LAC', shortDisplayName: 'Chargers', displayName: 'Los Angeles Chargers' } },
            { homeAway: 'away', score: '20', team: { id: '34', abbreviation: 'HOU', shortDisplayName: 'Texans', displayName: 'Houston Texans' } },
          ],
          situation: {
            isRedZone: true,
            down: 2,
            distance: 4,
            yardLine: 4,
            possession: '34',
            possessionText: 'LAC 4',
            downDistanceText: '2nd & Goal at LAC 4',
            lastPlay: { id: 'p-gtg', text: 'N.Collins 22-yard catch inside the 5', statYardage: 22, scoreValue: 0, drive: { description: '7 plays, 71 yds, 3:10' }, probability: { homeWinPercentage: 0.34 } },
          },
          leaders: [
            {
              shortDisplayName: 'REC',
              leaders: [{ athlete: { id: '4258173', displayName: 'Nico Collins' }, team: { id: '34' }, displayValue: '7 REC, 118 YDS, 1 TD' }],
            },
          ],
        }],
      },
    ];

    const slate = await redZoneIntelService.buildSlateFromEvents(mockEvents);
    assert.equal(slate.games.length, 3);
    assert.equal(slate.games[0].eventId, 'evt-gtg', 'Goal-to-Go inside Opp 4 must rank #1 in RedZone Heat');
    assert.equal(slate.games[0].heatTier, 'GOAL_TO_GO');
    assert.equal(slate.games[0].situation.yardsToEndZone, 4);
    assert.equal(slate.games[0].situation.ballPosPct, 96);
    assert.equal(slate.secondaryEventId, 'evt-witch', 'Double-Box secondary game should select #2 hottest live game');
    assert.ok(slate.games[1].situation.isWitchingHour, 'Close Q4 inside 2 minutes must flag Witching Hour');
    assert.ok(slate.fantasyLeaders.length > 0 && slate.fantasyLeaders[0].isInRedZoneNow, 'Fantasy leader on offense in RedZone should be flagged isInRedZoneNow');
    assert.ok(slate.fantasyLeaders[0].estimatedPpr > 20, 'PPR calculation for 7 REC 118 YDS 1 TD should be 24.8');

    const rzApiRes = await server.inject({ method: 'GET', url: '/api/v1/redzone/intel' });
    assert.equal(rzApiRes.statusCode, 200);
    const rzData = rzApiRes.json();
    assert.ok(rzData.redzoneIntel && rzData.redzoneIntel.sportType === 'nfl_redzone');
    assert.ok(Array.isArray(rzData.redzoneIntel.games) && rzData.redzoneIntel.games.length > 0);

    const rzHudRes = await server.inject({ method: 'GET', url: '/api/v1/basketball/smart-hud/redzone' });
    assert.equal(rzHudRes.statusCode, 200);
    const rzHud = rzHudRes.json();
    assert.equal(rzHud.sportType, 'nfl_redzone');
    assert.ok(rzHud.redzoneIntel && Array.isArray(rzHud.smartCards));
  });

  await t.test('RedZone Event Feed & Smart Cards never attach a non-scoring subsequent drive play or wrong-team defender headshot to a Touchdown/PAT card', async () => {
    const sfLogo = 'https://a.espncdn.com/i/teamlogos/nfl/500/sf.png';
    const dalLogo = 'https://a.espncdn.com/i/teamlogos/nfl/500/dal.png';
    const sfDefenderHeadshot = 'https://a.espncdn.com/i/headshots/nfl/players/full/sf-stout.png';
    const dalQbHeadshot = 'https://a.espncdn.com/i/headshots/nfl/players/full/dal-dak.png';
    const sfWrHeadshot = 'https://a.espncdn.com/i/headshots/nfl/players/full/sf-rice.png';

    const makeSfDalEvent = (sfScore: number, dalScore: number, lastPlay: any, possId = '6') => ([
      {
        id: 'evt-sf-dal-bugcheck',
        shortName: 'SF @ DAL',
        name: 'San Francisco 49ers at Dallas Cowboys',
        date: '2026-11-15T21:25Z',
        status: { displayClock: '8:12', period: 4, type: { state: 'in', shortDetail: '8:12 - 4th' } },
        competitions: [{
          competitors: [
            { homeAway: 'away', score: String(sfScore), team: { id: '25', abbreviation: 'SF', shortDisplayName: '49ers', displayName: 'San Francisco 49ers', logo: sfLogo } },
            { homeAway: 'home', score: String(dalScore), team: { id: '6', abbreviation: 'DAL', shortDisplayName: 'Cowboys', displayName: 'Dallas Cowboys', logo: dalLogo } },
          ],
          situation: {
            isRedZone: false,
            down: 1,
            distance: 10,
            possession: possId,
            possessionText: 'SF 48',
            downDistanceText: '1st & 10 at SF 48',
            lastPlay,
          },
          leaders: [],
        }],
      },
    ]);

    // Poll 1: SF 24 - DAL 19
    await redZoneIntelService.buildSlateFromEvents(
      makeSfDalEvent(24, 19, {
        id: 'p-sf-1',
        text: 'M.Wishnowsky punts 44 yards to DAL 25.',
        type: { text: 'Punt' },
        statYardage: 44,
        scoreValue: 0,
        team: { id: '25' },
        probability: { homeWinPercentage: 0.25 },
      })
    );

    // Poll 2: SF jumps to 31, while ESPN lastPlay has already moved on to DAL's subsequent pass play
    // and athletesInvolved[0] is SF defender U.Stout.
    const slateAfterScoreLag = await redZoneIntelService.buildSlateFromEvents(
      makeSfDalEvent(31, 19, {
        id: 'p-dal-next',
        text: '(Shotgun) D.Prescott pass short middle to L.Schoonmaker to SF 48 for 12 yards (U.Stout; F.Warner).',
        type: { text: 'Pass Reception' },
        statYardage: 12,
        scoreValue: 0,
        team: { id: '6' },
        athletesInvolved: [
          { id: 'u-stout', displayName: 'U.Stout', headshot: sfDefenderHeadshot, position: 'CB', team: { id: '25' } },
          { id: 'd-prescott', displayName: 'Dak Prescott', shortName: 'D.Prescott', headshot: dalQbHeadshot, position: 'QB', team: { id: '6' } },
        ],
        probability: { homeWinPercentage: 0.16 },
      })
    );

    const laggedNode = slateAfterScoreLag.games.find((g) => g.eventId === 'evt-sf-dal-bugcheck');
    assert.ok(laggedNode?.lastPlay);
    assert.equal(laggedNode.lastPlay?.athleteName, 'Dak Prescott', 'Primary athlete on DAL pass must be Dak Prescott, not defender U.Stout at index 0');
    assert.equal(laggedNode.lastPlay?.athleteHeadshot, dalQbHeadshot);

    const sfTdFeed = slateAfterScoreLag.eventFeed.find(
      (f) => f.eventId === 'evt-sf-dal-bugcheck' && f.type === 'TOUCHDOWN'
    );
    assert.ok(sfTdFeed, 'Should emit TOUCHDOWN feed item for SF 24 -> 31 score jump');
    assert.ok(!sfTdFeed.detail.includes('D.Prescott'), 'SF TD card detail must NEVER contain DAL non-scoring pass text');
    assert.ok(!sfTdFeed.detail.includes('L.Schoonmaker'), 'SF TD card detail must NEVER contain DAL receiver text');
    assert.equal(sfTdFeed.playerHeadshot, sfLogo, 'When lastPlay moved to DAL drive, SF TD card must fall back to SF logo instead of opposing/defender headshot');

    // Poll 3: Direct TD play with defender listed at index 0 and actual SF scorer at index 1
    const slateDirectTd = await redZoneIntelService.buildSlateFromEvents(
      makeSfDalEvent(37, 19, {
        id: 'p-sf-td-2',
        text: 'B.Purdy pass deep left to J.Jennings for 24 yards, TOUCHDOWN (T.Diggs).',
        type: { text: 'Passing Touchdown' },
        statYardage: 24,
        scoreValue: 6,
        team: { id: '25' },
        athletesInvolved: [
          { id: 't-diggs', displayName: 'Trevon Diggs', headshot: dalQbHeadshot, position: 'CB', team: { id: '6' } },
          { id: 'j-jennings', displayName: 'Jauan Jennings', shortName: 'J.Jennings', headshot: sfWrHeadshot, position: 'WR', team: { id: '25' } },
        ],
        probability: { homeWinPercentage: 0.05 },
      }, '25')
    );

    const sfDirectTd = slateDirectTd.eventFeed.find((f) => f.id.includes('p-sf-td-2'));
    assert.ok(sfDirectTd && sfDirectTd.type === 'TOUCHDOWN');
    assert.equal(sfDirectTd.playerHeadshot, sfWrHeadshot, 'Direct TD card must pick SF scorer headshot over DAL defender at index 0');
    assert.ok(sfDirectTd.detail.includes('B.Purdy pass deep left to J.Jennings'));

    // Poll 4: Extra point (+1) must NEVER produce a false TOUCHDOWN or FIELD_GOAL entry
    const slatePat = await redZoneIntelService.buildSlateFromEvents(
      makeSfDalEvent(38, 19, {
        id: 'p-sf-pat',
        text: 'J.Moody extra point is GOOD.',
        type: { text: 'Extra Point Good' },
        statYardage: 0,
        scoreValue: 1,
        team: { id: '25' },
        probability: { homeWinPercentage: 0.04 },
      }, '25')
    );

    const patItem = slatePat.eventFeed.find((f) => f.id.includes('p-sf-pat'));
    assert.ok(patItem, 'PAT should be tracked cleanly');
    assert.equal(patItem.type, 'EXTRA_POINT', 'PAT +1 must classify as EXTRA_POINT, never TOUCHDOWN or FIELD_GOAL');
    assert.ok(!slatePat.smartCards.some((c) => c.id.includes('p-sf-pat') && c.badge.includes('TOUCHDOWN')));
  });

  await t.test('Official ESPN team roster parser hydrates complete active squads & exact positions (QB, WR, CB, PG, GK) across grouped & flat sports', async () => {
    const groupedNflPayload = {
      team: { displayName: 'Pittsburgh Steelers' },
      athletes: [
        {
          position: 'offense',
          items: [
            { id: '1', fullName: 'Aaron Rodgers', jersey: '8', position: { abbreviation: 'QB' } },
            { id: '2', fullName: 'DK Metcalf', jersey: '14', position: { abbreviation: 'WR' } },
          ],
        },
        {
          position: 'defense',
          items: [
            { id: '3', fullName: 'Jalen Ramsey', jersey: '5', position: { abbreviation: 'CB' } },
          ],
        },
        {
          position: 'specialTeam',
          items: [
            { id: '4', fullName: 'Chris Boswell', jersey: '9', position: { abbreviation: 'K' } },
          ],
        },
        {
          position: 'practiceSquad',
          items: [
            { id: '99', fullName: 'Practice Guy', jersey: '49', position: { abbreviation: 'WR' } },
          ],
        },
      ],
    };

    const parsedNfl = sportsIntelService.parseEspnTeamRosterPayload(groupedNflPayload, 'Pittsburgh Steelers', 'football/nfl');
    assert.equal(parsedNfl.length, 4, 'Should include Offense, Defense, and Special Teams while excluding practiceSquad');
    assert.equal(parsedNfl[0].position, 'QB');
    assert.equal(parsedNfl[0].unit, 'Offense');
    assert.equal(parsedNfl[2].position, 'CB');
    assert.equal(parsedNfl[2].unit, 'Defense');
    assert.equal(parsedNfl[3].position, 'K');
    assert.equal(parsedNfl[3].unit, 'Special Teams');

    const flatSoccerPayload = {
      team: { displayName: 'Liverpool' },
      athletes: [
        { id: '10', displayName: 'Alisson Becker', jersey: '1', position: { abbreviation: 'G', displayName: 'Goalkeeper' } },
        { id: '11', displayName: 'Mohamed Salah', jersey: '11', position: { abbreviation: 'F', displayName: 'Forward' } },
      ],
    };
    const parsedSoccer = sportsIntelService.parseEspnTeamRosterPayload(flatSoccerPayload, 'Liverpool', 'soccer/eng.1');
    assert.equal(parsedSoccer.length, 2);
    assert.equal(parsedSoccer[0].position, 'G');
    assert.equal(parsedSoccer[0].unit, 'Goalkeepers');
    assert.equal(parsedSoccer[1].position, 'F');
    assert.equal(parsedSoccer[1].unit, 'Forwards');

    // Live check on RedZone spotlight / NFL intel endpoint ensures full roster with real positions
    const rzLiveRes = await server.inject({ method: 'GET', url: '/api/v1/intel/redzone' });
    assert.equal(rzLiveRes.statusCode, 200);
    const rzLive = rzLiveRes.json();
    const t1Ros = rzLive.rosters?.team1 || [];
    assert.ok(t1Ros.length >= 20, `Expected full active NFL roster (>=20 players), got ${t1Ros.length}`);
    assert.ok(t1Ros.every((a: any) => Boolean(a.position) && a.position !== 'Player'), 'Every NFL roster entry must have a real position');
    assert.ok(t1Ros.some((a: any) => a.unit === 'Offense') && t1Ros.some((a: any) => a.unit === 'Defense'), 'Roster must include Offense and Defense units');
  });

  await t.test('NBA streams (e.g. Rockets vs Wizards) never contaminate intel.sportAnalytics with NFL football telemetry', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/intel/houston-rockets-vs-washington-wizards' });
    assert.equal(res.statusCode, 200);
    const data = res.json();
    assert.equal(data.sportAnalytics?.sportType, 'basketball', 'sportAnalytics.sportType must be basketball, never nfl');
    assert.equal(data.sportAnalytics?.surfaceType, 'basketball_halfcourt', 'surfaceType must be basketball_halfcourt');
    const banner = String(data.sportAnalytics?.situationBanner || '');
    assert.ok(!/Yard Line|Red Zone|EPA|Drive:/i.test(banner), `NBA situationBanner must not contain NFL football terms: ${banner}`);
    assert.ok(Array.isArray(data.news) && data.news.length >= 6, `Expected rich multi-source news (>=6 stories) for Rockets vs Wizards, got ${data.news?.length}`);
    assert.ok(data.news.every((n: any) => Boolean(n.categoryTag) && Boolean(n.categoryLabel) && Boolean(n.source)), 'News stories must carry categoryTag, categoryLabel, and source');
  });

  await t.test('All remaining global categories (Baseball, Combat, Racing, Tennis, Cricket) return authentic sport surfaces, smart cards, and event news', async () => {
    const sportChecks = [
      { key: 'mlb-yankees-vs-dodgers', expectedSport: 'baseball', expectedSurface: 'baseball_diamond' },
      { key: 'ufc-309-jones-vs-miocic', expectedSport: 'combat', expectedSurface: 'combat_octagon' },
      { key: 'skyf1', expectedSport: 'racing', expectedSurface: 'racing_circuit' },
      { key: 'skysportstennis', expectedSport: 'tennis', expectedSurface: 'tennis_court' },
      { key: 'willow', expectedSport: 'cricket', expectedSurface: 'cricket_wagon' },
    ];

    for (const sc of sportChecks) {
      const hudRes = await server.inject({ method: 'GET', url: `/api/v1/basketball/smart-hud/${sc.key}` });
      assert.equal(hudRes.statusCode, 200);
      const hud = hudRes.json();
      assert.equal(hud.sportType, sc.expectedSport, `Expected ${sc.expectedSport} for ${sc.key}`);
      assert.equal(hud.surfaceType, sc.expectedSurface, `Expected ${sc.expectedSurface} for ${sc.key}`);
      assert.ok(hud.sportAnalytics && Array.isArray(hud.sportAnalytics.fourPillars) && hud.sportAnalytics.fourPillars.length === 4);
      assert.ok(Array.isArray(hud.smartCards) && hud.smartCards.length > 0);

      const intelRes = await server.inject({ method: 'GET', url: `/api/v1/intel/${sc.key}` });
      assert.equal(intelRes.statusCode, 200);
      const intel = intelRes.json();
      assert.ok(Array.isArray(intel.news) && intel.news.length >= 5, `Expected multi-source news for ${sc.key}, got ${intel.news?.length}`);
    }
  });

  await t.test('GET /api/v1/streams/live-context returns live catalog card tickers, UFC bouts/results, and F1 driver standings', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/streams/live-context' });
    assert.equal(res.statusCode, 200);
    const data = res.json();
    assert.ok(data.tickers && typeof data.tickers === 'object');
    assert.ok(data.sportHighlights?.f1?.eventName && data.sportHighlights.f1.topDrivers.length >= 3, 'F1 highlights must include top-3 driver standings');
    assert.ok(data.sportHighlights?.ufc?.eventName && data.sportHighlights.ufc.currentOrMainFight, 'UFC highlights must include current/main bout');
    assert.ok(Object.keys(data.tickers).length > 0, 'At least some active catalog streams must have live tickers hydrated');
  });

  await t.test('Research queries answer MVP Race, Team Records, and Player Aliases (Jokic vs SGA), and ORL pre-game never shows OKC players', async () => {
    const mvpRes = await server.inject({ method: 'GET', url: '/api/v1/basketball/query?q=' + encodeURIComponent('who is the leaders of the mvp race') });
    assert.equal(mvpRes.statusCode, 200);
    const mvp = mvpRes.json();
    assert.equal(mvp.type, 'mvp_race');
    assert.ok(mvp.headline.includes('MVP Race Ladder'));
    assert.ok(mvp.tableHeaders.includes('MVP IDX'));

    const sgaCompRes = await server.inject({ method: 'GET', url: '/api/v1/basketball/query?q=' + encodeURIComponent('jokic vs sga') });
    assert.equal(sgaCompRes.statusCode, 200);
    const comp = sgaCompRes.json();
    assert.equal(comp.type, 'comparison');
    assert.ok(comp.headline.includes('Shai Gilgeous-Alexander'));

    const teamRes = await server.inject({ method: 'GET', url: '/api/v1/basketball/query?q=' + encodeURIComponent('How are the Celtics doing?') });
    assert.equal(teamRes.statusCode, 200);
    const team = teamRes.json();
    assert.equal(team.type, 'team_scouting');
    assert.ok(team.headline.includes('Boston Celtics'));

    const orlPre = basketballResearchService.buildGameAnalyticsFromPlayers({
      eventId: 'pre-bos-orl',
      status: 'Scheduled',
      detail: '11/16 - 7:00 PM EST',
      isLive: false,
      gameState: 'pre',
      venue: 'Kia Center',
      broadcast: 'NBA League Pass',
      team1Meta: { id: '2', name: 'Boston Celtics', abbr: 'BOS', logo: '', score: '0' },
      team2Meta: { id: '19', name: 'Orlando Magic', abbr: 'ORL', logo: '', score: '0' },
      rawPlayers1: [],
      rawPlayers2: [],
    });
    assert.ok(orlPre.onCourtLineup.team2Five.some((p) => p.name.includes('Paolo Banchero') || p.name.includes('Franz Wagner')));
    assert.ok(!orlPre.onCourtLineup.team2Five.some((p) => p.name.includes('Gilgeous-Alexander')), 'ORL pre-game must never show OKC players');
  });

  await t.test('Research queries fuzzy-match typos (buddy heild -> Buddy Hield), fetch live leaders, and never dump generic PER on unknown text', async () => {
    const hieldRes = await server.inject({ method: 'GET', url: '/api/v1/basketball/query?q=' + encodeURIComponent('buddy heild') });
    assert.equal(hieldRes.statusCode, 200);
    const hield = hieldRes.json();
    assert.equal(hield.type, 'player_spotlight');
    assert.ok(hield.headline.includes('Buddy Hield'), `Expected Buddy Hield spotlight, got: ${hield.headline}`);
    assert.ok(hield.correctedNote && hield.correctedNote.includes('Buddy Hield'), 'Expected typo correction badge');
    assert.ok(Array.isArray(hield.tableRows) && hield.tableRows.length > 0);

    const bullsRes = await server.inject({ method: 'GET', url: '/api/v1/basketball/query?q=' + encodeURIComponent('Chicago Bulls roster') });
    assert.equal(bullsRes.statusCode, 200);
    const bulls = bullsRes.json();
    assert.equal(bulls.type, 'team_scouting');
    assert.ok(bulls.headline.includes('Bulls'), `Expected Bulls team scouting, got: ${bulls.headline}`);

    const bogusRes = await server.inject({ method: 'GET', url: '/api/v1/basketball/query?q=' + encodeURIComponent('xyzqwertynotaplayer') });
    assert.equal(bogusRes.statusCode, 200);
    const bogus = bogusRes.json();
    assert.equal(bogus.type, 'no_exact_match');
    assert.ok(!bogus.headline.includes('Player Efficiency Rating'), 'Unknown query must not silently dump PER table');
    assert.ok(Array.isArray(bogus.suggestions) && bogus.suggestions.length > 0);
  });

  await t.test('All frontend scripts in src/public/js parse cleanly without syntax errors', async () => {
    const jsDir = path.join(process.cwd(), 'src', 'public', 'js');
    const files = fs.readdirSync(jsDir).filter((f) => f.endsWith('.js'));
    assert.ok(files.length >= 4, 'Expected frontend JS files');
    for (const file of files) {
      const code = fs.readFileSync(path.join(jsDir, file), 'utf8');
      assert.doesNotThrow(() => new vm.Script(code, { filename: file }), `Syntax error in frontend script ${file}`);
    }
  });

  await t.test('Embed player merges /api/v1/sources/:key so live upstream streams do not lock behind Stream Starting Soon', async () => {
    const forceRes = await server.inject({ method: 'GET', url: '/embed/basketball/unit-check-stream?force=1' });
    assert.equal(forceRes.statusCode, 200);
    assert.ok(forceRes.body.includes('display: none;'), 'Expected waiting banner hidden when stream is live or forced');
    assert.ok(forceRes.body.includes('Load Stream Anyway'), 'Expected manual Load Stream Anyway bypass button on waiting banner');

    const demoRes = await server.inject({ method: 'GET', url: '/embed/demo/custom-demo-stream' });
    assert.equal(demoRes.statusCode, 200);
    assert.ok(!demoRes.body.includes('waiting-box {\n      display: flex;'), 'Expected live demo stream not to show blocking waiting overlay');
  });

  await t.test('GET /api/v1/athlete/:sport/:league/:athlete_id pulls live full stats, career tables, gamelogs & splits on demand (e.g. Egor Demin)', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/athlete/basketball/nba/5175643' });
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['cache-control'], 'no-store');
    const data = res.json();
    assert.equal(data.name, 'Egor Demin');
    assert.ok(Array.isArray(data.overviewStats) && data.overviewStats.length >= 4, 'Expected live season PPG/RPG/APG KPIs');
    assert.ok(!data.overviewStats.some((s: any) => s.label === 'Roster' && s.value === 'Verified'), 'Must not fall back to placeholder Tier/Roster boxes');
    assert.ok(Array.isArray(data.statCategories) && data.statCategories.length >= 1, 'Expected career year-by-year statCategories');
    assert.ok(data.gameLog && Array.isArray(data.gameLog.games) && data.gameLog.games.length >= 1, 'Expected full gameLog games');
    assert.ok(Array.isArray(data.splitCategories) && data.splitCategories.length >= 1, 'Expected situational splitCategories');
  });

  await t.test('Open Federated Sports Data Gateway serves live scoreboard, standings, injury wire (JSON+CSV), Team 360 hub & API Portal', async () => {
    const sbRes = await server.inject({ method: 'GET', url: '/api/v1/data/scoreboard/basketball/nba' });
    assert.equal(sbRes.statusCode, 200);
    const sb = sbRes.json();
    assert.equal(sb.league, 'nba');
    assert.ok(Array.isArray(sb.events));

    const injRes = await server.inject({ method: 'GET', url: '/api/v1/data/injuries/basketball/nba' });
    assert.equal(injRes.statusCode, 200);
    const inj = injRes.json();
    assert.ok(Array.isArray(inj.injuries) && inj.injuries.length > 0, 'Expected live league injury wire items');

    const csvRes = await server.inject({ method: 'GET', url: '/api/v1/data/standings/basketball/nba?format=csv' });
    assert.equal(csvRes.statusCode, 200);
    assert.match(csvRes.headers['content-type'] || '', /text\/csv/);
    assert.ok(csvRes.body.includes('teamId,team,abbr'), 'Expected RFC-4180 CSV header row');

    const teamRes = await server.inject({ method: 'GET', url: '/api/v1/data/team/basketball/nba/BOS' });
    assert.equal(teamRes.statusCode, 200);
    const team = teamRes.json();
    assert.equal(team.team.abbreviation, 'BOS');
    assert.ok(Object.keys(team.depthChart || {}).length >= 3, 'Expected positional depth chart');
    assert.ok(Array.isArray(team.roster) && team.roster.length >= 8, 'Expected active Celtics roster');

    const hubPage = await server.inject({ method: 'GET', url: '/api-explorer.html' });
    assert.equal(hubPage.statusCode, 200);
    assert.ok(hubPage.body.includes('Unified Open Sports Data API'));
  });

  await t.test('Proxy SSRF guard blocks loopback and cloud metadata URLs cleanly', async () => {
    const loopbackRes = await server.inject({
      method: 'GET',
      url: '/api/v1/proxy/m3u8?url=http://127.0.0.1:3000/health',
    });
    assert.equal(loopbackRes.statusCode, 400);

    const metadataRes = await server.inject({
      method: 'GET',
      url: '/api/v1/proxy/segment?url=http://169.254.169.254/latest/meta-data',
    });
    assert.equal(metadataRes.statusCode, 400);
  });

  await t.test('Federated Gateway provenance, capability matrix, provider health, sparse fields, H2H intel & Athlete DNA/Rolling Form', async () => {
    const capRes = await server.inject({ method: 'GET', url: '/api/v1/data/capabilities' });
    assert.equal(capRes.statusCode, 200);
    const cap = capRes.json();
    assert.ok(Array.isArray(cap.leagues) && cap.leagues.length >= 6, 'Expected multi-sport capability matrix');
    assert.ok(cap.features && cap.features.sparseFieldSelection && cap.features.liveSseScoreboard);
    assert.ok(cap.leagues.some((l: any) => Array.isArray(l.providers) && l.providers.includes('nhl_official')));

    const healthRes = await server.inject({ method: 'GET', url: '/api/v1/providers/health' });
    assert.equal(healthRes.statusCode, 200);
    const health = healthRes.json();
    assert.ok(Array.isArray(health.providers) && health.providers.length >= 4);

    const sparseRes = await server.inject({
      method: 'GET',
      url: '/api/v1/data/scoreboard/basketball/nba?fields=eventId,name&limit=2',
      headers: { 'x-api-key': 'test-client-key' },
    });
    assert.equal(sparseRes.statusCode, 200);
    const sparse = sparseRes.json();
    assert.ok(sparse.provenance && sparse.provenance.provider && sparse.provenance.cacheStatus);
    assert.ok(Array.isArray(sparse.events) && sparse.events.length <= 2);
    if (sparse.events.length > 0) {
      assert.ok('eventId' in sparse.events[0] && 'name' in sparse.events[0]);
      assert.equal('venue' in sparse.events[0], false, 'Sparse fields filter should omit unrequested fields');
    }

    const h2hRes = await server.inject({ method: 'GET', url: '/api/v1/data/h2h/BOS/CLE' });
    assert.equal(h2hRes.statusCode, 200);
    const h2h = h2hRes.json();
    assert.ok(h2h.teamA && h2h.teamB && typeof h2h.modelEdgeSummary === 'string');
    assert.equal(h2h.provenance?.confidence, 'estimated');

    const athRes = await server.inject({ method: 'GET', url: '/api/v1/athlete/basketball/nba/5175643' });
    assert.equal(athRes.statusCode, 200);
    const ath = athRes.json();
    assert.ok(ath.rollingWindows && ath.rollingWindows.provenance === 'computed_from_verified_gamelog');
    assert.ok(ath.playerDna && ath.playerDna.provenance === 'derived_estimate_from_season_stats');
    assert.ok(Array.isArray(ath.playerDna.axes) && ath.playerDna.axes.length === 6);

    const nflStRes = await server.inject({ method: 'GET', url: '/api/v1/data/standings/football/nfl' });
    assert.equal(nflStRes.statusCode, 200);
    const nflSt = nflStRes.json();
    assert.ok(Array.isArray(nflSt.teams) && nflSt.teams.length >= 30, 'Expected 32 NFL standings teams');

    const eplLdrRes = await server.inject({ method: 'GET', url: '/api/v1/data/leaders/soccer/eng.1' });
    assert.equal(eplLdrRes.statusCode, 200);
    const eplLdr = eplLdrRes.json();
    assert.ok(Array.isArray(eplLdr.categories), 'Soccer leaders should return 200 with empty categories instead of 500');
  });

  await server.close();
});


