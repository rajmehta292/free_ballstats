/**
 * Free_BallStats — Dedicated Basketball Research & In-Game Analytics Controller
 */
(function () {
  let hubData = null;
  let activeGameIndex = 0;
  let activeMultiSportIndex = 0;
  let activeMultiSportFilter = 'all';
  let activeMultiSportCategory = 'all';
  let activeBoxTeam = 'team1';
  let activeBoxMode = 'advanced';
  let activeConference = 'western';
  let activeWorkspace = 'nba-game';
  let showAllWorkspaces = false;
  let nlResultCollapsed = false;
  let injuryStatusFilter = 'all';

  const NBA_FRANCHISES = [
    ['ATL', 'Atlanta Hawks'], ['BOS', 'Boston Celtics'], ['BKN', 'Brooklyn Nets'],
    ['CHA', 'Charlotte Hornets'], ['CHI', 'Chicago Bulls'], ['CLE', 'Cleveland Cavaliers'],
    ['DAL', 'Dallas Mavericks'], ['DEN', 'Denver Nuggets'], ['DET', 'Detroit Pistons'],
    ['GSW', 'Golden State Warriors'], ['HOU', 'Houston Rockets'], ['IND', 'Indiana Pacers'],
    ['LAC', 'LA Clippers'], ['LAL', 'Los Angeles Lakers'], ['MEM', 'Memphis Grizzlies'],
    ['MIA', 'Miami Heat'], ['MIL', 'Milwaukee Bucks'], ['MIN', 'Minnesota Timberwolves'],
    ['NOP', 'New Orleans Pelicans'], ['NYK', 'New York Knicks'], ['OKC', 'Oklahoma City Thunder'],
    ['ORL', 'Orlando Magic'], ['PHI', 'Philadelphia 76ers'], ['PHX', 'Phoenix Suns'],
    ['POR', 'Portland Trail Blazers'], ['SAC', 'Sacramento Kings'], ['SAS', 'San Antonio Spurs'],
    ['TOR', 'Toronto Raptors'], ['UTA', 'Utah Jazz'], ['WAS', 'Washington Wizards'],
  ];

  function resolveWorkspaceFromHash() {
    const h = (window.location.hash || '').replace(/^#/, '').toLowerCase();
    const map = {
      'ingame-lab': 'nba-game',
      'comparison-lab': 'compare',
      'team-h2h-lab': 'compare',
      'leaderboard-matrix': 'rankings',
      'standings-glossary': 'rankings',
      'team-hub': 'team360',
      'injury-wire': 'injury',
      'multisport-lab': 'multisport',
    };
    return map[h] || null;
  }

  function switchWorkspace(wsId) {
    activeWorkspace = wsId || 'nba-game';
    document.querySelectorAll('[data-ws-tab]').forEach((btn) => {
      const isMatch = btn.getAttribute('data-ws-tab') === activeWorkspace;
      btn.classList.toggle('active', isMatch);
      btn.setAttribute('aria-selected', isMatch ? 'true' : 'false');
    });
    document.querySelectorAll('.workspace-panel[data-ws-group]').forEach((sec) => {
      sec.classList.toggle('active-ws', sec.getAttribute('data-ws-group') === activeWorkspace);
    });
  }

  async function initBasketballLab() {
    const params = new URLSearchParams(window.location.search);
    // Only auto-mount the floating mini-player dock if explicitly requested via ?dock=
    if (params.get('dock') && window.FreeBallStatsSmartScreen && window.FreeBallStatsSmartScreen.mountResearchLabSmartDock) {
      window.FreeBallStatsSmartScreen.mountResearchLabSmartDock(true);
    }

    const hashWs = resolveWorkspaceFromHash();
    if (hashWs) switchWorkspace(hashWs);

    try {
      const res = await fetch(`/api/v1/basketball/hub?t=${Date.now()}`);
      hubData = await res.json();

      renderLeagueBenchmarks(hubData.leagueAverages);
      renderGameSelectorTabs();
      renderActiveGameLab();
      renderMultiSportLab();
      initComparisonSelectors(hubData.players || []);
      initTeamH2HSelectors();
      renderLeaderboardMatrix(hubData.players || []);
      renderStandingsTable();
      renderGlossary(hubData.glossary || []);

      // Run initial natural language showcase query (or ?q= passed from Player Explorer)
      const urlQ = params.get('q');
      const initQ = urlQ || 'Nikola Jokic vs Luka Doncic advanced comparison';
      const qInput = document.getElementById('nl-query-input');
      if (qInput && urlQ) qInput.value = urlQ;
      await executeNaturalLanguageQuery(initQ);

      // Hydrate Live Team 360 Hub & League Injury Wire in parallel
      loadTeam360Hub('BOS');
      loadInjuryWire();
    } catch (err) {
      console.error('Error initializing Basketball Research Lab:', err);
    }

    bindEventListeners();
  }

  function renderLeagueBenchmarks(bm) {
    if (!bm) return;
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    set('bm-pace', bm.pace);
    set('bm-ortg', bm.ortg);
    set('bm-efg', `${bm.efgPct}%`);
    set('bm-ts', `${bm.tsPct}%`);
    set('bm-3par', `${bm.threePar}%`);
  }

  // =========================================================================
  // 1. NATURAL LANGUAGE QUERY ENGINE (STATMUSE / REFERENCE STYLE)
  // =========================================================================
  async function executeNaturalLanguageQuery(queryText) {
    const container = document.getElementById('nl-query-result');
    if (!container) return;
    container.innerHTML = `<div style="padding:1rem;color:var(--text-secondary);">Synthesizing basketball telemetry for <strong>"${escapeHtml(queryText)}"</strong>...</div>`;

    try {
      const res = await fetch(`/api/v1/basketball/query?q=${encodeURIComponent(queryText)}&t=${Date.now()}`);
      const data = await res.json();

      const hero = data.heroPlayer || {};
      const sec = data.secondaryPlayer;

      const avatarsHtml = sec
        ? `<div class="nl-dual-avatars">
             <img src="${hero.headshot}" alt="${escapeHtml(hero.name)}" onerror="this.src='https://a.espncdn.com/combiner/i?img=/i/headshots/nophoto.png&w=120&h=90'" />
             <img src="${sec.headshot}" alt="${escapeHtml(sec.name)}" onerror="this.src='https://a.espncdn.com/combiner/i?img=/i/headshots/nophoto.png&w=120&h=90'" />
           </div>`
        : `<img class="nl-single-avatar" src="${hero.headshot}" alt="${escapeHtml(hero.name || 'NBA')}" onerror="this.src='https://a.espncdn.com/combiner/i?img=/i/headshots/nophoto.png&w=120&h=90'" />`;

      const statsHtml = (data.keyStats || [])
        .map(
          s => `
          <div class="nl-stat-pill">
            <span class="nl-stat-label">${escapeHtml(s.label)}</span>
            <strong class="nl-stat-val">${escapeHtml(String(s.value))}</strong>
          </div>`
        )
        .join('');

      const headersHtml = (data.tableHeaders || []).map(h => `<th>${escapeHtml(h)}</th>`).join('');
      const rowsHtml = (data.tableRows || [])
        .map(
          row =>
            `<tr>${row
              .map((cell, idx) => `<td class="${idx === 0 ? 'font-bold' : 'mono-cell'}">${escapeHtml(String(cell))}</td>`)
              .join('')}</tr>`
        )
        .join('');

      const correctionHtml = data.correctedNote
        ? `<div class="nl-correction-badge" style="display:inline-flex;align-items:center;gap:6px;margin-bottom:6px;padding:3px 10px;border-radius:999px;background:rgba(0,242,254,0.12);border:1px solid rgba(0,242,254,0.35);color:#67e8f9;font-size:0.76rem;font-weight:700;">✨ ${escapeHtml(data.correctedNote)}</div>`
        : '';

      const suggestionsList = Array.isArray(data.suggestions) ? data.suggestions.filter(Boolean) : [];
      const suggestionsHtml = suggestionsList.length
        ? `<div class="nl-suggestions-row" style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:0.75rem;">
             <span style="font-size:0.76rem;color:var(--text-muted);font-weight:600;">${data.type === 'no_exact_match' ? 'Did you mean:' : 'Related Searches:'}</span>
             ${suggestionsList.map(s => `<button type="button" class="preset-pill nl-suggest-btn" data-suggest="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join('')}
           </div>`
        : '';

      container.innerHTML = `
        <div class="nl-result-header-bar">
          <div class="nl-query-tag">STATMUSE / LIVE NBA INTELLIGENCE • QUERY: "${escapeHtml(data.query)}"</div>
          <div style="display:flex;gap:8px;align-items:center;">
            ${hero.id ? `<button type="button" class="nl-collapse-btn" id="nl-open-hero-btn">👤 Open ${escapeHtml(hero.name || 'Player')} Explorer</button>` : ''}
            <button type="button" class="nl-collapse-btn" id="nl-toggle-collapse-btn">${nlResultCollapsed ? '▸ Expand Answer' : '▾ Collapse Answer'}</button>
          </div>
        </div>
        <div class="nl-answer-main" id="nl-answer-body" style="display:${nlResultCollapsed ? 'none' : 'block'};">
          <div class="nl-answer-top">
            ${avatarsHtml}
            <div class="nl-answer-copy">
              ${correctionHtml}
              <h3 class="nl-headline">${escapeHtml(data.headline)}</h3>
              <p class="nl-narrative">${escapeHtml(data.narrative)}</p>
              ${suggestionsHtml}
            </div>
          </div>
          <div class="nl-stats-strip">${statsHtml}</div>
          <div class="table-responsive" style="margin-top:0.85rem;">
            <table class="bball-table compact-table">
              <thead><tr>${headersHtml}</tr></thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        </div>
      `;

      document.getElementById('nl-toggle-collapse-btn')?.addEventListener('click', (e) => {
        nlResultCollapsed = !nlResultCollapsed;
        const bodyEl = document.getElementById('nl-answer-body');
        if (bodyEl) bodyEl.style.display = nlResultCollapsed ? 'none' : 'block';
        e.currentTarget.textContent = nlResultCollapsed ? '▸ Expand Answer' : '▾ Collapse Answer';
      });
      document.getElementById('nl-open-hero-btn')?.addEventListener('click', () => {
        if (hero.id) openPlayerModal(hero.id, 'basketball/nba');
      });

      container.querySelectorAll('.nl-suggest-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          nlResultCollapsed = false;
          const nextQ = btn.getAttribute('data-suggest') || '';
          const input = document.getElementById('nl-query-input');
          if (input) input.value = nextQ;
          if (nextQ) executeNaturalLanguageQuery(nextQ);
        });
      });

      // Make any table rows matching known NBA players clickable
      const rosterLookup = new Map((hubData?.players || []).map((p) => [String(p.name || '').toLowerCase(), p.id]));
      container.querySelectorAll('tbody tr').forEach((tr) => {
        const firstCell = tr.querySelector('td');
        const txt = String(firstCell?.textContent || '').replace(/^\d+\.\s*/, '').trim().toLowerCase();
        const pid = rosterLookup.get(txt) || (hero.name && String(hero.name).toLowerCase() === txt ? hero.id : null);
        if (pid) {
          tr.classList.add('clickable-row');
          tr.title = `Click to open full Live Stats Explorer for ${firstCell.textContent.trim()}`;
          tr.addEventListener('click', () => openPlayerModal(pid, 'basketball/nba'));
        }
      });

      const avatarEl = container.querySelector('.nl-single-avatar');
      if (avatarEl && hero.id) {
        avatarEl.style.cursor = 'pointer';
        avatarEl.title = `Open full athlete card for ${hero.name || 'Player'}`;
        avatarEl.addEventListener('click', () => openPlayerModal(hero.id, 'basketball/nba'));
      }
    } catch (err) {
      container.innerHTML = `<div style="padding:1rem;color:var(--danger);">Unable to process query.</div>`;
    }
  }

  // =========================================================================
  // 2. LIVE & IN-GAME SUPPORTING ANALYTICS LAB
  // =========================================================================
  function renderGameSelectorTabs() {
    const wrap = document.getElementById('game-selector-tabs');
    if (!wrap || !hubData?.games) return;

    wrap.innerHTML = hubData.games
      .map((g, idx) => {
        const t1 = g.team1Analytics;
        const t2 = g.team2Analytics;
        const activeClass = idx === activeGameIndex ? 'active' : '';
        const liveDot = g.isLive ? '<span class="pulse-dot online" style="width:7px;height:7px;"></span>' : '';
        return `
          <button type="button" class="game-tab-btn ${activeClass}" data-idx="${idx}">
            ${liveDot}
            <span>${escapeHtml(t1.abbreviation)} ${t1.score} - ${t2.score} ${escapeHtml(t2.abbreviation)}</span>
            <small>${escapeHtml(g.detail)}</small>
          </button>
        `;
      })
      .join('');

    wrap.querySelectorAll('.game-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeGameIndex = Number(btn.getAttribute('data-idx') || 0);
        renderGameSelectorTabs();
        renderActiveGameLab();
      });
    });
  }

  function renderActiveGameLab() {
    const games = hubData?.games || [];
    const game = games[activeGameIndex];
    if (!game) return;

    const t1 = game.team1Analytics;
    const t2 = game.team2Analytics;
    const ls = game.linescore;

    // 1. Overview + Linescore + Pace & Efficiency Gauges
    const overviewEl = document.getElementById('active-game-overview');
    if (overviewEl) {
      const qHeaders = ls.periodHeaders.map(h => `<th>${escapeHtml(h)}</th>`).join('');
      const t1Quarters = ls.team1.quarters.map(q => `<td class="mono-cell">${q}</td>`).join('');
      const t2Quarters = ls.team2.quarters.map(q => `<td class="mono-cell">${q}</td>`).join('');

      overviewEl.innerHTML = `
        <div class="ingame-scoreboard-card">
          <div class="ingame-teams-row">
            <div class="ingame-team-block">
              <img src="${t1.logo}" alt="${escapeHtml(t1.teamName)}" onerror="this.style.display='none'" />
              <div>
                <div class="ingame-team-name">${escapeHtml(t1.teamName)}</div>
                <div class="ingame-team-sub">ORTG: <strong>${t1.ortg}</strong> • TS%: <strong>${t1.tsPct}%</strong> • eFG%: <strong>${t1.efgPct}%</strong></div>
              </div>
              <div class="ingame-team-score">${t1.score}</div>
            </div>

            <div class="ingame-vs-center">
              <span class="ingame-status-pill">${escapeHtml(game.status)}</span>
              <span class="ingame-venue-sub">${escapeHtml(game.venue)} • ${escapeHtml(game.broadcast)}</span>
              <span class="ingame-run-badge">🔥 ${escapeHtml(game.projectedPaceScore.activeRun)}</span>
            </div>

            <div class="ingame-team-block right">
              <div class="ingame-team-score">${t2.score}</div>
              <div>
                <div class="ingame-team-name">${escapeHtml(t2.teamName)}</div>
                <div class="ingame-team-sub">ORTG: <strong>${t2.ortg}</strong> • TS%: <strong>${t2.tsPct}%</strong> • eFG%: <strong>${t2.efgPct}%</strong></div>
              </div>
              <img src="${t2.logo}" alt="${escapeHtml(t2.teamName)}" onerror="this.style.display='none'" />
            </div>
          </div>

          <div class="ingame-linescore-row">
            <div class="linescore-table-wrap">
              <table class="bball-table linescore-table">
                <thead>
                  <tr>
                    <th>TEAM</th>
                    ${qHeaders}
                    <th>TOTAL</th>
                    <th>PACE</th>
                    <th>ORTG</th>
                    <th>NET RTG</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="font-bold">${escapeHtml(t1.abbreviation)}</td>
                    ${t1Quarters}
                    <td class="mono-cell font-bold accent-text">${ls.team1.total}</td>
                    <td class="mono-cell">${t1.pace}</td>
                    <td class="mono-cell">${t1.ortg}</td>
                    <td class="mono-cell ${t1.netRtg >= 0 ? 'pos-val' : 'neg-val'}">${t1.netRtg >= 0 ? '+' : ''}${t1.netRtg}</td>
                  </tr>
                  <tr>
                    <td class="font-bold">${escapeHtml(t2.abbreviation)}</td>
                    ${t2Quarters}
                    <td class="mono-cell font-bold accent-text">${ls.team2.total}</td>
                    <td class="mono-cell">${t2.pace}</td>
                    <td class="mono-cell">${t2.ortg}</td>
                    <td class="mono-cell ${t2.netRtg >= 0 ? 'pos-val' : 'neg-val'}">${t2.netRtg >= 0 ? '+' : ''}${t2.netRtg}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="pace-projection-box">
              <div class="pace-box-title">⏱️ 48-MIN PACE, ODDS &amp; LIVE CONTEXT</div>
              <div class="pace-metrics-grid">
                <div><span>Active Pace</span><strong>${game.projectedPaceScore.pace48} poss/48</strong></div>
                <div><span>Projected Score</span><strong>${escapeHtml(t1.abbreviation)} ${game.projectedPaceScore.team1Projected} - ${game.projectedPaceScore.team2Projected} ${escapeHtml(t2.abbreviation)}</strong></div>
                <div><span>${game.bettingOdds ? escapeHtml(game.bettingOdds.provider) : '3PT Attempt Rate'}</span><strong>${game.bettingOdds ? `${escapeHtml(game.bettingOdds.spread)}${game.bettingOdds.overUnder ? ` • O/U ${game.bettingOdds.overUnder}` : ''}` : `${t1.abbreviation} ${t1.threePar}% | ${t2.abbreviation} ${t2.threePar}%`}</strong></div>
                <div><span>Peak GmSc MVP</span><strong>${game.mvpPerformer ? `${escapeHtml(game.mvpPerformer.name)} (${game.mvpPerformer.gameScore})` : 'N/A'}</strong></div>
              </div>
              ${(game.seasonSeries || game.realShotCount || (game.gameInjuries && game.gameInjuries.length)) ? `
                <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.08);display:flex;gap:8px;flex-wrap:wrap;font-size:11px;color:#cbd5e1;">
                  ${game.seasonSeries ? `<span style="padding:2px 7px;border-radius:5px;background:rgba(145,70,255,0.16);color:#c4b5fd;">📅 ${escapeHtml(game.seasonSeries)}</span>` : ''}
                  ${game.realShotCount ? `<span style="padding:2px 7px;border-radius:5px;background:rgba(0,242,254,0.14);color:#67e8f9;">🎯 ${game.realShotCount} Live PBP XY Shots</span>` : ''}
                  ${(game.gameInjuries || []).slice(0, 4).map(inj => `<span class="clickable-inj" data-athlete-id="${escapeHtml(inj.athleteId || '')}" style="padding:2px 7px;border-radius:5px;background:rgba(239,68,68,0.14);color:#fca5a5;cursor:${inj.athleteId ? 'pointer' : 'default'};">🏥 ${escapeHtml(inj.teamAbbr)} ${escapeHtml(inj.player)} (${escapeHtml(inj.status)})</span>`).join('')}
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      `;
      overviewEl.querySelectorAll('.clickable-inj').forEach(el => {
        const aid = el.getAttribute('data-athlete-id');
        if (aid) el.addEventListener('click', () => openPlayerModal(aid));
      });
    }

    // 2. Dean Oliver's Four Factors Panel
    const ffEl = document.getElementById('four-factors-panel');
    if (ffEl) {
      const factors = [
        {
          label: 'Effective FG% (eFG%)',
          weight: '40% Weight',
          v1: t1.fourFactors.efgPct,
          v2: t2.fourFactors.efgPct,
          unit: '%',
          higherBetter: true,
          desc: '(FGM + 0.5 × 3PM) / FGA',
        },
        {
          label: 'Turnover Rate (TOV%)',
          weight: '25% Weight',
          v1: t1.fourFactors.tovPct,
          v2: t2.fourFactors.tovPct,
          unit: '%',
          higherBetter: false,
          desc: 'TOV / (FGA + 0.44 × FTA + TOV)',
        },
        {
          label: 'Offensive Rebound % (ORB%)',
          weight: '20% Weight',
          v1: t1.fourFactors.orbPct,
          v2: t2.fourFactors.orbPct,
          unit: '%',
          higherBetter: true,
          desc: 'ORB / (ORB + Opp DRB)',
        },
        {
          label: 'Free Throw Rate (FTR)',
          weight: '15% Weight',
          v1: t1.fourFactors.ftRate,
          v2: t2.fourFactors.ftRate,
          unit: '%',
          higherBetter: true,
          desc: 'FTM / FGA',
        },
      ];

      ffEl.innerHTML = `
        <div class="panel-title-row">
          <h3>📐 Dean Oliver's Four Factors</h3>
          <span class="badge-mini">WIN CORRELATION</span>
        </div>
        <div class="factors-list">
          ${factors
            .map(f => {
              const sum = Math.max(1, f.v1 + f.v2);
              const p1Width = Math.round((f.v1 / sum) * 100);
              const p2Width = 100 - p1Width;
              const t1Wins = f.higherBetter ? f.v1 >= f.v2 : f.v1 <= f.v2;
              return `
                <div class="factor-item">
                  <div class="factor-header">
                    <span class="factor-val ${t1Wins ? 'winner-val' : ''}">${t1.abbreviation}: ${f.v1}${f.unit}</span>
                    <div class="factor-center-title">
                      <strong>${f.label}</strong>
                      <small>${f.weight} • <code>${f.desc}</code></small>
                    </div>
                    <span class="factor-val ${!t1Wins ? 'winner-val' : ''}">${t2.abbreviation}: ${f.v2}${f.unit}</span>
                  </div>
                  <div class="dual-progress-bar">
                    <div class="bar-left" style="width:${p1Width}%"></div>
                    <div class="bar-right" style="width:${p2Width}%"></div>
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
      `;
    }

    // 3. Starters vs Bench Rotation Unit Splits Panel
    const splitsEl = document.getElementById('unit-splits-panel');
    if (splitsEl) {
      const u1 = t1.unitSplits;
      const u2 = t2.unitSplits;
      splitsEl.innerHTML = `
        <div class="panel-title-row">
          <h3>🔄 Starters vs. Bench Rotation Splits</h3>
          <span class="badge-mini">LINEUP DEPTH</span>
        </div>
        <div class="table-responsive">
        <table class="bball-table compact-table">
          <thead>
            <tr>
              <th>UNIT METRIC</th>
              <th>${escapeHtml(t1.abbreviation)}</th>
              <th>${escapeHtml(t2.abbreviation)}</th>
              <th>EDGE</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Starters Points</td>
              <td class="mono-cell font-bold">${u1.startersPts} PTS</td>
              <td class="mono-cell font-bold">${u2.startersPts} PTS</td>
              <td><span class="edge-pill">${u1.startersPts >= u2.startersPts ? t1.abbreviation : t2.abbreviation}</span></td>
            </tr>
            <tr>
              <td>Bench Points (2nd Unit)</td>
              <td class="mono-cell font-bold">${u1.benchPts} (${u1.benchScoringSharePct}%)</td>
              <td class="mono-cell font-bold">${u2.benchPts} (${u2.benchScoringSharePct}%)</td>
              <td><span class="edge-pill">${u1.benchPts >= u2.benchPts ? t1.abbreviation : t2.abbreviation}</span></td>
            </tr>
            <tr>
              <td>Starters FG%</td>
              <td class="mono-cell">${u1.startersFgPct}%</td>
              <td class="mono-cell">${u2.startersFgPct}%</td>
              <td><span class="edge-pill">${u1.startersFgPct >= u2.startersFgPct ? t1.abbreviation : t2.abbreviation}</span></td>
            </tr>
            <tr>
              <td>Bench FG%</td>
              <td class="mono-cell">${u1.benchFgPct}%</td>
              <td class="mono-cell">${u2.benchFgPct}%</td>
              <td><span class="edge-pill">${u1.benchFgPct >= u2.benchFgPct ? t1.abbreviation : t2.abbreviation}</span></td>
            </tr>
            <tr>
              <td>Starters REB / AST</td>
              <td class="mono-cell">${u1.startersReb}R / ${u1.startersAst}A</td>
              <td class="mono-cell">${u2.startersReb}R / ${u2.startersAst}A</td>
              <td><span class="edge-pill">${u1.startersReb + u1.startersAst >= u2.startersReb + u2.startersAst ? t1.abbreviation : t2.abbreviation}</span></td>
            </tr>
            <tr>
              <td>Bench REB / AST</td>
              <td class="mono-cell">${u1.benchReb}R / ${u1.benchAst}A</td>
              <td class="mono-cell">${u2.benchReb}R / ${u2.benchAst}A</td>
              <td><span class="edge-pill">${u1.benchReb + u1.benchAst >= u2.benchReb + u2.benchAst ? t1.abbreviation : t2.abbreviation}</span></td>
            </tr>
            <tr>
              <td>Bench Net Plus/Minus</td>
              <td class="mono-cell ${u1.benchPlusMinus >= 0 ? 'pos-val' : 'neg-val'}">${u1.benchPlusMinus >= 0 ? '+' : ''}${u1.benchPlusMinus}</td>
              <td class="mono-cell ${u2.benchPlusMinus >= 0 ? 'pos-val' : 'neg-val'}">${u2.benchPlusMinus >= 0 ? '+' : ''}${u2.benchPlusMinus}</td>
              <td><span class="edge-pill">${u1.benchPlusMinus >= u2.benchPlusMinus ? t1.abbreviation : t2.abbreviation}</span></td>
            </tr>
          </tbody>
        </table>
        </div>
      `;
    }

    // 4. Spatial Shot Diet & Scoring Profile Panel
    const dietEl = document.getElementById('shot-diet-panel');
    if (dietEl) {
      const sd1 = t1.shotDiet;
      const sd2 = t2.shotDiet;

      const renderDietBar = (teamAbbr, sd) => {
        const segTxt = (label, pct) => {
          if (pct >= 14) return `${label} ${pct}%`;
          if (pct >= 7) return `${pct}%`;
          return '';
        };
        return `
        <div class="shot-diet-team">
          <div class="shot-diet-header">
            <strong>${escapeHtml(teamAbbr)} Spatial Scoring Breakdown</strong>
            <span>Fastbreak: ${sd.fastbreakPts} PTS • Max Lead: +${sd.biggestLead}</span>
          </div>
          <div class="stacked-diet-bar">
            <div class="diet-seg paint" style="width:${sd.paintPtsSharePct}%" title="Paint: ${sd.paintPts} PTS (${sd.paintPtsSharePct}%)">${segTxt('Paint', sd.paintPtsSharePct)}</div>
            <div class="diet-seg perim" style="width:${sd.perimeterPtsSharePct}%" title="3PT Perimeter: ${sd.perimeterPts} PTS (${sd.perimeterPtsSharePct}%)">${segTxt('3PT', sd.perimeterPtsSharePct)}</div>
            <div class="diet-seg mid" style="width:${sd.midrangePtsSharePct}%" title="Mid-Range: ${sd.midrangePts} PTS (${sd.midrangePtsSharePct}%)">${segTxt('Mid', sd.midrangePtsSharePct)}</div>
            <div class="diet-seg ft" style="width:${sd.ftPtsSharePct}%" title="Free Throws: ${sd.ftPts} PTS (${sd.ftPtsSharePct}%)">${segTxt('FT', sd.ftPtsSharePct)}</div>
          </div>
          <div class="shot-diet-legend">
            <span><i class="dot paint"></i> Paint: ${sd.paintPts} (${sd.paintPtsSharePct}%)</span>
            <span><i class="dot perim"></i> 3PT: ${sd.perimeterPts} (${sd.perimeterPtsSharePct}%)</span>
            <span><i class="dot mid"></i> Mid: ${sd.midrangePts} (${sd.midrangePtsSharePct}%)</span>
            <span><i class="dot ft"></i> FT: ${sd.ftPts} (${sd.ftPtsSharePct}%)</span>
          </div>
        </div>
      `;
      };

      dietEl.innerHTML = `
        <div class="panel-title-row">
          <h3>🎯 Spatial Shot Diet &amp; Zone Profile</h3>
          <span class="badge-mini">CLEANING THE GLASS</span>
        </div>
        <div class="shot-diet-stack">
          ${renderDietBar(t1.abbreviation, sd1)}
          ${renderDietBar(t2.abbreviation, sd2)}
        </div>
      `;
    }

    // 4b. v3.0 CourtOptix Shot Chart, On-Court 5v5 Lineup & Stints, Win Prob Worm, and Synergy Play Types
    if (window.FreeBallStatsSmartScreen) {
      const shotChartEl = document.getElementById('spatial-shot-chart-panel');
      if (shotChartEl) {
        let activeShotFilter = 'all';
        const drawLabShotChart = () => {
          shotChartEl.innerHTML = `
            <div class="panel-title-row">
              <h3>🎯 CourtOptix 6-Zone Spatial Shot Chart &amp; xEFG%</h3>
              <span class="badge-mini">INTERACTIVE ZONES</span>
            </div>
            ${window.FreeBallStatsSmartScreen.renderSvgHalfCourtShotChart(game, { filterSide: activeShotFilter })}
          `;
          shotChartEl.querySelectorAll('[data-sc-filter]').forEach((btn) => {
            btn.addEventListener('click', () => {
              activeShotFilter = btn.getAttribute('data-sc-filter') || 'all';
              drawLabShotChart();
            });
          });
        };
        drawLabShotChart();
      }

      const lineupEl = document.getElementById('oncourt-lineup-stints-panel');
      if (lineupEl) {
        lineupEl.innerHTML = `
          <div class="panel-title-row">
            <h3>👟 On-Court 5v5 Lineup Matrix &amp; Stint GameFlow</h3>
            <span class="badge-mini">POPCORNMACHINE</span>
          </div>
          ${window.FreeBallStatsSmartScreen.renderOnCourt5v5AndStints(game)}
        `;
      }

      const wormEl = document.getElementById('win-prob-worm-panel');
      if (wormEl) {
        wormEl.innerHTML = `
          <div class="panel-title-row">
            <h3>📈 Win Probability Worm &amp; Leverage Index (LI)</h3>
            <span class="badge-mini" title="Inpredictable-style Leverage Index & Win Probability Added model">WIN PROB MODEL</span>
          </div>
          ${window.FreeBallStatsSmartScreen.renderWinProbWormChart(game)}
        `;
      }

      const synergyEl = document.getElementById('synergy-playtypes-panel');
      if (synergyEl) {
        synergyEl.innerHTML = `
          <div class="panel-title-row">
            <h3>⚙️ Synergy Play-Type Efficiency (PPP)</h3>
            <span class="badge-mini">SYNERGY SPORTS</span>
          </div>
          ${window.FreeBallStatsSmartScreen.renderSynergyPlayTypes(game)}
        `;
      }
    }

    // 5. Automated In-Game Analytical Insights
    const insightsEl = document.getElementById('ingame-insights-grid');
    if (insightsEl) {
      insightsEl.innerHTML = (game.inGameInsights || [])
        .map(
          ins => `
          <div class="insight-card">
            <div class="insight-card-top">
              <span class="insight-cat">${escapeHtml(ins.category)}</span>
              <span class="insight-badge">${escapeHtml(ins.metricBadge)}</span>
            </div>
            <h4>${escapeHtml(ins.title)}</h4>
            <p>${escapeHtml(ins.detail)}</p>
          </div>
        `
        )
        .join('');
    }

    // 6. Box Score Team Switcher + Table
    const teamSwitchEl = document.getElementById('box-team-switch');
    if (teamSwitchEl) {
      teamSwitchEl.innerHTML = `
        <button type="button" class="seg-btn ${activeBoxTeam === 'team1' ? 'active' : ''}" data-team="team1">${escapeHtml(t1.teamName)}</button>
        <button type="button" class="seg-btn ${activeBoxTeam === 'team2' ? 'active' : ''}" data-team="team2">${escapeHtml(t2.teamName)}</button>
      `;
      teamSwitchEl.querySelectorAll('.seg-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          activeBoxTeam = btn.getAttribute('data-team') || 'team1';
          renderActiveGameLab();
        });
      });
    }

    renderInGameBoxScoreTable(game);
  }

  function renderInGameBoxScoreTable(game) {
    const wrap = document.getElementById('ingame-boxscore-table-wrap');
    if (!wrap) return;

    const players = activeBoxTeam === 'team1' ? game.playersTeam1 : game.playersTeam2;

    if (activeBoxMode === 'advanced') {
      wrap.innerHTML = `
        <table class="bball-table">
          <thead>
            <tr>
              <th>ATHLETE</th>
              <th>ROLE</th>
              <th>MIN</th>
              <th>PTS</th>
              <th title="John Hollinger's Game Score">GmSc ★</th>
              <th title="True Shooting %">TS%</th>
              <th title="Effective Field Goal %">eFG%</th>
              <th title="CourtOptix Expected eFG% & Shot-Making Delta">xEFG% (Δ)</th>
              <th title="Usage Percentage">USG%</th>
              <th title="Box Plus/Minus">BPM</th>
              <th title="Win Probability Added">WPA</th>
              <th title="Steals + Blocks">STOCKS</th>
              <th title="48-Minute Pace Projection">48-PACE</th>
              <th>+/-</th>
              <th>IMPACT TIER</th>
            </tr>
          </thead>
          <tbody>
            ${players
              .map(
                p => `
              <tr class="clickable-row" data-player-id="${escapeHtml(p.id)}">
                <td>
                  <div class="player-cell">
                    <img src="${p.headshot}" alt="${escapeHtml(p.name)}" onerror="this.src='https://a.espncdn.com/combiner/i?img=/i/headshots/nophoto.png&w=120&h=90'" />
                    <div>
                      <div class="font-bold">${escapeHtml(p.name)} ${(p.hotStreak || p.onHotStreak) ? '<span title="Hot Hand">🔥</span>' : ''} ${(p.foulTrouble || p.inFoulTrouble) ? '<span title="Foul Trouble">⚠️</span>' : ''}</div>
                      <small class="text-muted">#${escapeHtml(p.jersey)} • ${escapeHtml(p.position)}</small>
                    </div>
                  </div>
                </td>
                <td><span class="role-badge ${p.starter ? 'starter' : 'bench'}">${p.starter ? 'STARTER' : 'BENCH'}</span></td>
                <td class="mono-cell">${p.min}</td>
                <td class="mono-cell font-bold">${p.pts}</td>
                <td class="mono-cell font-bold accent-text">${p.gameScore}</td>
                <td class="mono-cell ${p.tsPct >= 60 ? 'pos-val' : ''}">${p.tsPct}%</td>
                <td class="mono-cell">${p.efgPct}%</td>
                <td class="mono-cell ${p.shotMakingDelta >= 0 ? 'pos-val' : 'neg-val'}">${p.xEfgPct ?? p.efgPct}% (${(p.shotMakingDelta ?? 0) >= 0 ? '+' : ''}${p.shotMakingDelta ?? 0}%)</td>
                <td class="mono-cell">${p.usgPct}%</td>
                <td class="mono-cell ${(p.bpm ?? 0) >= 0 ? 'pos-val font-bold' : 'neg-val'}">${(p.bpm ?? 0) > 0 ? '+' : ''}${p.bpm ?? 0}</td>
                <td class="mono-cell ${(p.wpa ?? 0) >= 0 ? 'pos-val font-bold' : 'neg-val'}">${(p.wpa ?? 0) >= 0 ? '+' : ''}${p.wpa ?? 0}%</td>
                <td class="mono-cell">${p.stocks} (${p.stl}S/${p.blk}B)</td>
                <td class="mono-cell">${p.projected48 ? `${p.projected48.pts}/${p.projected48.reb}/${p.projected48.ast}` : '-'}</td>
                <td class="mono-cell ${p.plusMinus >= 0 ? 'pos-val' : 'neg-val'}">${p.plusMinus > 0 ? '+' : ''}${p.plusMinus}</td>
                <td><span class="tier-pill">${escapeHtml(p.impactTier)}</span></td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      `;
    } else {
      wrap.innerHTML = `
        <table class="bball-table">
          <thead>
            <tr>
              <th>ATHLETE</th>
              <th>ROLE</th>
              <th>MIN</th>
              <th>PTS</th>
              <th>REB (O/D)</th>
              <th>AST</th>
              <th>FG</th>
              <th>FG%</th>
              <th>3PT</th>
              <th>3P%</th>
              <th>FT</th>
              <th>STL</th>
              <th>BLK</th>
              <th>TOV</th>
              <th>+/-</th>
            </tr>
          </thead>
          <tbody>
            ${players
              .map(
                p => `
              <tr class="clickable-row" data-player-id="${escapeHtml(p.id)}">
                <td>
                  <div class="player-cell">
                    <img src="${p.headshot}" alt="${escapeHtml(p.name)}" onerror="this.src='https://a.espncdn.com/combiner/i?img=/i/headshots/nophoto.png&w=120&h=90'" />
                    <div>
                      <div class="font-bold">${escapeHtml(p.name)}</div>
                      <small class="text-muted">#${escapeHtml(p.jersey)} • ${escapeHtml(p.position)}</small>
                    </div>
                  </div>
                </td>
                <td><span class="role-badge ${p.starter ? 'starter' : 'bench'}">${p.starter ? 'STARTER' : 'BENCH'}</span></td>
                <td class="mono-cell">${p.min}</td>
                <td class="mono-cell font-bold">${p.pts}</td>
                <td class="mono-cell">${p.reb} (${p.orb}/${p.drb})</td>
                <td class="mono-cell">${p.ast}</td>
                <td class="mono-cell">${escapeHtml(p.fg)}</td>
                <td class="mono-cell">${p.fgPct}%</td>
                <td class="mono-cell">${escapeHtml(p.threePt)}</td>
                <td class="mono-cell">${p.tpPct}%</td>
                <td class="mono-cell">${escapeHtml(p.ft)}</td>
                <td class="mono-cell">${p.stl}</td>
                <td class="mono-cell">${p.blk}</td>
                <td class="mono-cell">${p.tov}</td>
                <td class="mono-cell ${p.plusMinus >= 0 ? 'pos-val' : 'neg-val'}">${p.plusMinus > 0 ? '+' : ''}${p.plusMinus}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      `;
    }

    wrap.querySelectorAll('.clickable-row').forEach(row => {
      row.addEventListener('click', () => {
        const pid = row.getAttribute('data-player-id');
        if (pid) openPlayerModal(pid);
      });
    });
  }

  // =========================================================================
  // 2B. UNIVERSAL MULTI-SPORT DEEP TELEMETRY LAB (SOCCER, NFL, CFB, NHL, NCAAB)
  // =========================================================================
  function renderMultiSportLab() {
    const sportFiltersWrap = document.getElementById('multisport-sport-filters');
    const tabsWrap = document.getElementById('multisport-selector-tabs');
    const contentWrap = document.getElementById('multisport-lab-content');
    const allMsGames = hubData?.multiSportGames || [];
    if (!tabsWrap || !contentWrap || allMsGames.length === 0) return;

    const sportIcons = {
      soccer: '⚽',
      nfl: '🏈',
      ncaaf: '🎓🏈',
      hockey: '🏒',
      ncaab: '🎓🏀',
    };

    if (sportFiltersWrap) {
      const catDefs = [
        ['all', 'All Sports'],
        ['soccer', '⚽ Soccer'],
        ['nfl', '🏈 NFL'],
        ['ncaaf', '🎓 CFB'],
        ['hockey', '🏒 NHL'],
        ['ncaab', '🎓 NCAAB'],
      ];
      sportFiltersWrap.innerHTML = catDefs
        .map(([k, lbl]) => `<button type="button" class="seg-btn ${activeMultiSportCategory === k ? 'active' : ''}" data-ms-cat="${k}">${lbl}</button>`)
        .join('');
      sportFiltersWrap.querySelectorAll('[data-ms-cat]').forEach((btn) => {
        btn.addEventListener('click', () => {
          activeMultiSportCategory = btn.getAttribute('data-ms-cat') || 'all';
          activeMultiSportIndex = 0;
          activeMultiSportFilter = 'all';
          renderMultiSportLab();
        });
      });
    }

    const msGames = activeMultiSportCategory === 'all'
      ? allMsGames
      : allMsGames.filter((g) => g.sportType === activeMultiSportCategory);
    if (msGames.length === 0) {
      tabsWrap.innerHTML = '';
      contentWrap.innerHTML = `<div style="padding:1.5rem;color:var(--text-muted);">No tracked events in this sport filter right now.</div>`;
      return;
    }
    if (activeMultiSportIndex >= msGames.length) activeMultiSportIndex = 0;

    tabsWrap.innerHTML = msGames
      .map((sa, idx) => {
        const icon = sportIcons[sa.sportType] || '🌐';
        const activeClass = idx === activeMultiSportIndex ? 'active' : '';
        const sportLbl = sa.sportLabel || (sa.sportBadge || '').split('•')[0].trim() || sa.sportType.toUpperCase();
        return `
          <button type="button" class="game-tab-btn ${activeClass}" data-ms-idx="${idx}">
            <span class="pulse-dot online" style="width:7px;height:7px;"></span>
            <span>${icon} ${escapeHtml(sa.team1Meta.abbreviation)} ${sa.team1Meta.score} - ${sa.team2Meta.score} ${escapeHtml(sa.team2Meta.abbreviation)}</span>
            <small>${escapeHtml(sportLbl)}</small>
          </button>
        `;
      })
      .join('');

    tabsWrap.querySelectorAll('[data-ms-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeMultiSportIndex = Number(btn.getAttribute('data-ms-idx') || 0);
        activeMultiSportFilter = 'all';
        renderMultiSportLab();
      });
    });

    const sa = msGames[activeMultiSportIndex] || msGames[0];
    const ss = window.FreeBallStatsSmartScreen;
    const hudCompat = {
      surfaceType: sa.surfaceType,
      sportAnalytics: sa,
      leverageIndex: sa.leverageIndex,
      leverageTier: sa.leverageTier,
      winProbTimeline: sa.winProbTimeline,
    };

    const spatialHtml = ss ? ss.renderSvgHalfCourtShotChart(hudCompat, { filterSide: activeMultiSportFilter }) : '';
    const unitHtml = ss ? ss.renderOnCourt5v5AndStints(hudCompat) : '';
    const wormHtml = ss ? ss.renderWinProbWormChart(hudCompat) : '';
    const tacticalHtml = ss ? ss.renderSynergyPlayTypes(hudCompat) : '';

    const t1 = sa.team1Meta;
    const t2 = sa.team2Meta;
    const p0 = sa.fourPillars?.[0];
    const p1 = sa.fourPillars?.[1];

    contentWrap.innerHTML = `
      <div class="ingame-scoreboard-card" style="margin-bottom:1.1rem;">
        <div class="ingame-teams-row">
          <div class="ingame-team-block">
            <img src="${escapeHtml(t1.logo)}" alt="${escapeHtml(t1.name)}" onerror="this.style.display='none'" />
            <div>
              <div class="ingame-team-name">${escapeHtml(t1.name)} <small style="color:var(--text-dim);">(${escapeHtml(t1.record)})</small></div>
              <div class="ingame-team-sub">${escapeHtml(t1.formationOrScheme || '')} • ${escapeHtml(p0?.code || 'EFF')}: <strong>${escapeHtml(p0?.team1Value || '')}</strong> • ${escapeHtml(p1?.code || 'RATE')}: <strong>${escapeHtml(p1?.team1Value || '')}</strong></div>
            </div>
            <div class="ingame-team-score">${t1.score}</div>
          </div>

          <div class="ingame-vs-center">
            <span class="ingame-status-pill">${escapeHtml(sa.sportBadge || sa.sportLabel || '')} • ${escapeHtml(sa.status)}</span>
            <span class="ingame-venue-sub">${escapeHtml(sa.venue)} • ${escapeHtml(sa.broadcast)}</span>
            <span class="ingame-run-badge">⚡ ${escapeHtml(sa.situationBanner)}</span>
          </div>

          <div class="ingame-team-block right">
            <div class="ingame-team-score">${t2.score}</div>
            <div>
              <div class="ingame-team-name">${escapeHtml(t2.name)} <small style="color:var(--text-dim);">(${escapeHtml(t2.record)})</small></div>
              <div class="ingame-team-sub">${escapeHtml(t2.formationOrScheme || '')} • ${escapeHtml(p0?.code || 'EFF')}: <strong>${escapeHtml(p0?.team2Value || '')}</strong> • ${escapeHtml(p1?.code || 'RATE')}: <strong>${escapeHtml(p1?.team2Value || '')}</strong></div>
            </div>
            <img src="${escapeHtml(t2.logo)}" alt="${escapeHtml(t2.name)}" onerror="this.style.display='none'" />
          </div>
        </div>
      </div>

      <div class="ingame-two-col">
        <div class="analytics-panel">${spatialHtml}</div>
        <div class="analytics-panel">${unitHtml}</div>
      </div>

      <div class="ingame-two-col" style="margin-top:1.1rem;">
        <div class="analytics-panel">
          <div class="panel-title-row">
            <h3>📐 ${escapeHtml(sa.sportBadge)} — Four Core Analytical Pillars</h3>
            <span class="badge-mini">LIVE TELEMETRY</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:10px;margin-top:8px;">
            ${(sa.fourPillars || []).map((p) => {
              const n1 = Math.abs(Number(p.team1Numeric) || 50);
              const n2 = Math.abs(Number(p.team2Numeric) || 50);
              const tot = n1 + n2 || 100;
              const bar1 = p.team1BarPct ?? Math.round((n1 / tot) * 100);
              const bar2 = p.team2BarPct ?? (100 - bar1);
              return `
                <div style="background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:10px;">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                    <strong style="color:#e2e8f0;font-size:12px;">${escapeHtml(p.label)} <span style="color:#a78bfa;font-size:10.5px;">[${escapeHtml(p.weightLabel)}]</span></strong>
                    <span style="font-family:monospace;font-size:12px;font-weight:800;color:#00f2fe;">
                      ${escapeHtml(t1.abbreviation)} ${escapeHtml(p.team1Value)} vs ${escapeHtml(t2.abbreviation)} ${escapeHtml(p.team2Value)}
                    </span>
                  </div>
                  <div style="height:6px;background:#1e293b;border-radius:999px;overflow:hidden;display:flex;margin-bottom:4px;">
                    <div style="width:${bar1}%;background:#00f2fe;"></div>
                    <div style="width:${bar2}%;background:#f97316;"></div>
                  </div>
                  <div style="font-size:11px;color:#94a3b8;">${escapeHtml(p.description)}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
        <div class="analytics-panel">
          ${wormHtml}
          <div style="margin-top:12px;">${tacticalHtml}</div>
        </div>
      </div>

      <div class="insights-cards-grid" style="margin-top:1.1rem;">
        ${(sa.inGameInsights || []).map((ins) => `
          <div class="insight-card">
            <div class="insight-top">
              <span class="insight-cat">${escapeHtml(ins.category)}</span>
              <span class="insight-badge">${escapeHtml(ins.metricBadge)}</span>
            </div>
            <h4>${escapeHtml(ins.title)}</h4>
            <p>${escapeHtml(ins.detail)}</p>
          </div>
        `).join('')}
      </div>
    `;

    contentWrap.querySelectorAll('[data-sc-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeMultiSportFilter = btn.getAttribute('data-sc-filter') || 'all';
        renderMultiSportLab();
      });
    });
  }

  // =========================================================================
  // 3. HEAD-TO-HEAD PLAYER COMPARISON LAB & SVG RADAR CHART
  // =========================================================================
  function initComparisonSelectors(players) {
    const s1 = document.getElementById('compare-p1-select');
    const s2 = document.getElementById('compare-p2-select');
    if (!s1 || !s2 || !players.length) return;

    const optionsHtml = players
      .map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)} (${escapeHtml(p.teamAbbr)} - ${escapeHtml(p.position)})</option>`)
      .join('');

    s1.innerHTML = optionsHtml;
    s2.innerHTML = optionsHtml;
    if (players.length > 1) s2.selectedIndex = 1;

    const triggerCompare = () => loadPlayerComparison(s1.value, s2.value);
    s1.addEventListener('change', triggerCompare);
    s2.addEventListener('change', triggerCompare);

    triggerCompare();
  }

  async function loadPlayerComparison(p1Id, p2Id) {
    const container = document.getElementById('comparison-lab-content');
    if (!container) return;

    try {
      const res = await fetch(`/api/v1/basketball/compare?p1=${encodeURIComponent(p1Id)}&p2=${encodeURIComponent(p2Id)}&t=${Date.now()}`);
      const data = await res.json();
      const p1 = data.player1;
      const p2 = data.player2;

      const svgRadar = buildRadarChartSvg(p1, p2);

      container.innerHTML = `
        <div class="compare-top-cards">
          <div class="compare-player-card p1-border" style="cursor:pointer;" data-open-pid="${escapeHtml(p1.id)}" title="Click to open live career profile">
            <img src="${p1.headshot}" alt="${escapeHtml(p1.name)}" onerror="this.src='https://a.espncdn.com/combiner/i?img=/i/headshots/nophoto.png&w=120&h=90'" />
            <div>
              <span class="badge-mini" style="background:rgba(145,70,255,0.2);color:#c4b5fd;">${escapeHtml(p1.team)} • #${escapeHtml(p1.jersey)} ${escapeHtml(p1.position)}</span>
              <h3>${escapeHtml(p1.name)}</h3>
              <p class="archetype-tag">${escapeHtml(p1.archetype)}</p>
              <small class="text-muted">${escapeHtml(p1.signatureStat)}</small>
            </div>
          </div>

          <div class="compare-radar-box">
            ${svgRadar}
            <div class="radar-legend">
              <span><i class="dot p1-dot"></i> ${escapeHtml(p1.name)}</span>
              <span><i class="dot p2-dot"></i> ${escapeHtml(p2.name)}</span>
            </div>
          </div>

          <div class="compare-player-card p2-border" style="cursor:pointer;" data-open-pid="${escapeHtml(p2.id)}" title="Click to open live career profile">
            <img src="${p2.headshot}" alt="${escapeHtml(p2.name)}" onerror="this.src='https://a.espncdn.com/combiner/i?img=/i/headshots/nophoto.png&w=120&h=90'" />
            <div>
              <span class="badge-mini" style="background:rgba(0,242,254,0.18);color:#67e8f9;">${escapeHtml(p2.team)} • #${escapeHtml(p2.jersey)} ${escapeHtml(p2.position)}</span>
              <h3>${escapeHtml(p2.name)}</h3>
              <p class="archetype-tag">${escapeHtml(p2.archetype)}</p>
              <small class="text-muted">${escapeHtml(p2.signatureStat)}</small>
            </div>
          </div>
        </div>

        <div class="verdict-banner">
          <strong>⚖️ Analytical Verdict:</strong> ${escapeHtml(data.summaryVerdict)}
        </div>

        <div class="table-responsive">
          <table class="bball-table">
            <thead>
              <tr>
                <th>${escapeHtml(p1.name.toUpperCase())} (${escapeHtml(p1.teamAbbr)})</th>
                <th style="text-align:center;">ADVANCED / TRADITIONAL METRIC</th>
                <th style="text-align:right;">${escapeHtml(p2.name.toUpperCase())} (${escapeHtml(p2.teamAbbr)})</th>
                <th style="text-align:center;">STATISTICAL EDGE</th>
              </tr>
            </thead>
            <tbody>
              ${(data.metricsComparison || [])
                .map(m => {
                  const p1Wins = m.edge === p1.teamAbbr;
                  const p2Wins = m.edge === p2.teamAbbr;
                  return `
                    <tr>
                      <td class="mono-cell ${p1Wins ? 'font-bold pos-val' : ''}">${m.p1}${m.unit}</td>
                      <td style="text-align:center;font-weight:600;">${escapeHtml(m.label)}</td>
                      <td class="mono-cell ${p2Wins ? 'font-bold pos-val' : ''}" style="text-align:right;">${m.p2}${m.unit}</td>
                      <td style="text-align:center;"><span class="edge-pill">${escapeHtml(m.edge)}</span></td>
                    </tr>
                  `;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      `;
      container.querySelectorAll('[data-open-pid]').forEach((card) => {
        card.addEventListener('click', () => {
          const pid = card.getAttribute('data-open-pid');
          if (pid) openPlayerModal(pid, 'basketball/nba');
        });
      });
    } catch (err) {
      console.error('Error comparing players:', err);
    }
  }

  function buildRadarChartSvg(p1, p2) {
    const axes = [
      { key: 'scoring', label: 'SCORING', anchor: 'middle' },
      { key: 'playmaking', label: 'PLAYMAKING', anchor: 'start' },
      { key: 'rebounding', label: 'REBOUNDING', anchor: 'start' },
      { key: 'efficiency', label: 'TS% EFF', anchor: 'middle' },
      { key: 'defense', label: 'DEFENSE', anchor: 'end' },
      { key: 'impact', label: 'BPM IMPACT', anchor: 'end' },
    ];
    const cx = 190;
    const cy = 148;
    const radius = 84;

    const getPoint = (idx, pct, customR = radius) => {
      const angle = (Math.PI * 2 * idx) / axes.length - Math.PI / 2;
      const r = (Math.max(10, Math.min(100, pct)) / 100) * customR;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    };

    const gridRings = [0.25, 0.5, 0.75, 1.0]
      .map(scale => {
        const pts = axes.map((_, idx) => getPoint(idx, scale * 100)).join(' ');
        return `<polygon points="${pts}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1" />`;
      })
      .join('');

    const axisLines = axes
      .map((ax, idx) => {
        const end = getPoint(idx, 100).split(',');
        const lblPt = getPoint(idx, 100, radius + 22).split(',');
        return `
          <line x1="${cx}" y1="${cy}" x2="${end[0]}" y2="${end[1]}" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
          <text x="${lblPt[0]}" y="${lblPt[1]}" fill="#cbd5e1" font-size="9.5" font-weight="800" text-anchor="${ax.anchor}" dominant-baseline="middle">${ax.label}</text>
        `;
      })
      .join('');

    const p1Pts = axes.map((ax, idx) => getPoint(idx, p1.radarPercentiles?.[ax.key] || 80)).join(' ');
    const p2Pts = axes.map((ax, idx) => getPoint(idx, p2.radarPercentiles?.[ax.key] || 80)).join(' ');

    return `
      <svg viewBox="0 0 380 296" width="350" height="272" class="radar-svg">
        ${gridRings}
        ${axisLines}
        <polygon points="${p1Pts}" fill="rgba(145, 70, 255, 0.32)" stroke="#9146ff" stroke-width="2.4" />
        <polygon points="${p2Pts}" fill="rgba(0, 242, 254, 0.25)" stroke="#00f2fe" stroke-width="2.4" />
      </svg>
    `;
  }

  // =========================================================================
  // 3B. FRANCHISE HEAD-TO-HEAD INTELLIGENCE MATRIX (/api/v1/data/h2h)
  // =========================================================================
  function initTeamH2HSelectors() {
    const sA = document.getElementById('team-h2h-a-select');
    const sB = document.getElementById('team-h2h-b-select');
    if (!sA || !sB) return;

    const optsHtml = NBA_FRANCHISES.map(([abbr, name]) => `<option value="${abbr}">${escapeHtml(name)} (${abbr})</option>`).join('');
    sA.innerHTML = optsHtml;
    sB.innerHTML = optsHtml;
    sA.value = 'BOS';
    sB.value = 'CLE';

    const trigger = () => loadTeamH2H(sA.value, sB.value);
    sA.addEventListener('change', trigger);
    sB.addEventListener('change', trigger);
    trigger();
  }

  async function loadTeamH2H(teamA, teamB) {
    const wrap = document.getElementById('team-h2h-result');
    if (!wrap) return;
    wrap.innerHTML = `<div style="padding:1.25rem;color:var(--text-secondary);">Synthesizing live H2H matchup matrix for <strong>${escapeHtml(teamA)} vs ${escapeHtml(teamB)}</strong>...</div>`;
    try {
      const res = await fetch(`/api/v1/data/h2h/${encodeURIComponent(teamA)}/${encodeURIComponent(teamB)}?t=${Date.now()}`);
      const d = await res.json();
      const tA = d.teamA || {};
      const tB = d.teamB || {};

      wrap.innerHTML = `
        <div class="compare-top-cards" style="grid-template-columns:1fr 1fr;">
          <div class="compare-player-card p1-border">
            ${tA.logo ? `<img src="${escapeHtml(tA.logo)}" alt="${escapeHtml(tA.abbreviation)}" style="width:56px;height:56px;border-radius:10px;object-fit:contain;" />` : ''}
            <div>
              <span class="badge-mini">${escapeHtml(tA.standingSummary || 'NBA')}</span>
              <h3>${escapeHtml(tA.name || teamA)} (${escapeHtml(tA.record || '-')})</h3>
              <small class="text-muted">${(tA.injuries || []).length} Listed Injuries • Click Team 360° for full roster</small>
            </div>
          </div>
          <div class="compare-player-card p2-border">
            ${tB.logo ? `<img src="${escapeHtml(tB.logo)}" alt="${escapeHtml(tB.abbreviation)}" style="width:56px;height:56px;border-radius:10px;object-fit:contain;" />` : ''}
            <div>
              <span class="badge-mini" style="background:rgba(0,242,254,0.16);color:#67e8f9;">${escapeHtml(tB.standingSummary || 'NBA')}</span>
              <h3>${escapeHtml(tB.name || teamB)} (${escapeHtml(tB.record || '-')})</h3>
              <small class="text-muted">${(tB.injuries || []).length} Listed Injuries • Provenance: ${escapeHtml(d.provenance?.confidence || 'estimated')}</small>
            </div>
          </div>
        </div>
        <div class="verdict-banner">
          <strong>⚖️ Derived Composite H2H Edge:</strong> ${escapeHtml(d.modelEdgeSummary || '')}
        </div>
        <div class="table-responsive">
          <table class="bball-table compact-table">
            <thead>
              <tr>
                <th>${escapeHtml(tA.abbreviation || teamA)}</th>
                <th style="text-align:center;">MATCHUP METRIC</th>
                <th style="text-align:right;">${escapeHtml(tB.abbreviation || teamB)}</th>
              </tr>
            </thead>
            <tbody>
              ${(d.comparisonMetrics || []).map((m) => `
                <tr>
                  <td class="mono-cell font-bold">${escapeHtml(String(m.teamA))}</td>
                  <td style="text-align:center;color:var(--text-muted);font-weight:700;">${escapeHtml(m.metric)}</td>
                  <td class="mono-cell font-bold" style="text-align:right;">${escapeHtml(String(m.teamB))}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (e) {
      wrap.innerHTML = `<div style="padding:1rem;color:var(--danger);">Unable to load H2H matchup matrix.</div>`;
    }
  }

  // =========================================================================
  // 4. NBA ADVANCED REFERENCE LEADERBOARD MATRIX
  // =========================================================================
  async function refreshLeaderboardMatrix() {
    const search = document.getElementById('matrix-search')?.value || '';
    const position = document.getElementById('matrix-pos-filter')?.value || 'ALL';
    const sort = document.getElementById('matrix-sort-select')?.value || 'per';

    try {
      const res = await fetch(
        `/api/v1/basketball/players?sort=${encodeURIComponent(sort)}&position=${encodeURIComponent(position)}&search=${encodeURIComponent(search)}&t=${Date.now()}`
      );
      const data = await res.json();
      renderLeaderboardMatrix(data.players || []);
    } catch (e) {}
  }

  function renderLeaderboardMatrix(players) {
    const wrap = document.getElementById('leaderboard-table-wrap');
    if (!wrap) return;

    wrap.innerHTML = `
      <table class="bball-table">
        <thead>
          <tr>
            <th>RK</th>
            <th>PLAYER</th>
            <th>POS</th>
            <th>ARCHETYPE</th>
            <th>PPG</th>
            <th>RPG</th>
            <th>APG</th>
            <th title="True Shooting %">TS%</th>
            <th title="Effective FG %">eFG%</th>
            <th title="Player Efficiency Rating">PER ★</th>
            <th title="Box Plus/Minus">BPM</th>
            <th title="Value Over Replacement Player">VORP</th>
            <th title="Usage Rate %">USG%</th>
            <th title="Hollinger Game Score Avg">GmSc</th>
            <th title="Net Rating">NET RTG</th>
            <th title="Steals + Blocks">STOCKS</th>
          </tr>
        </thead>
        <tbody>
          ${players
            .map(
              (p, idx) => `
            <tr class="clickable-row" data-player-id="${escapeHtml(p.id)}">
              <td class="mono-cell font-bold">${idx + 1}</td>
              <td>
                <div class="player-cell">
                  <img src="${p.headshot}" alt="${escapeHtml(p.name)}" onerror="this.src='https://a.espncdn.com/combiner/i?img=/i/headshots/nophoto.png&w=120&h=90'" />
                  <div>
                    <div class="font-bold">${escapeHtml(p.name)}</div>
                    <small class="text-muted">${escapeHtml(p.team)} (${escapeHtml(p.teamAbbr)})</small>
                  </div>
                </div>
              </td>
              <td><span class="badge-mini">${escapeHtml(p.position)}</span></td>
              <td><span class="tier-pill">${escapeHtml(p.archetype)}</span></td>
              <td class="mono-cell font-bold">${p.ppg}</td>
              <td class="mono-cell">${p.rpg}</td>
              <td class="mono-cell">${p.apg}</td>
              <td class="mono-cell ${p.tsPct >= 62 ? 'pos-val font-bold' : ''}">${p.tsPct}%</td>
              <td class="mono-cell">${p.efgPct}%</td>
              <td class="mono-cell font-bold accent-text">${p.per}</td>
              <td class="mono-cell pos-val">+${p.bpm}</td>
              <td class="mono-cell">${p.vorp}</td>
              <td class="mono-cell">${p.usgPct}%</td>
              <td class="mono-cell">${p.gameScoreAvg}</td>
              <td class="mono-cell pos-val">+${p.netRtg}</td>
              <td class="mono-cell">${p.stocks}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    `;

    wrap.querySelectorAll('.clickable-row').forEach(row => {
      row.addEventListener('click', () => {
        const pid = row.getAttribute('data-player-id');
        if (pid) openPlayerModal(pid);
      });
    });
  }

  // =========================================================================
  // 5. CONFERENCE STANDINGS & FORMULA GLOSSARY
  // =========================================================================
  function renderStandingsTable() {
    const wrap = document.getElementById('standings-table-wrap');
    if (!wrap || !hubData?.standings) return;

    const rows = activeConference === 'eastern' ? hubData.standings.eastern : hubData.standings.western;

    wrap.innerHTML = `
      <table class="bball-table compact-table">
        <thead>
          <tr>
            <th>RK</th>
            <th>TEAM</th>
            <th>W-L</th>
            <th>PCT</th>
            <th>PPG</th>
            <th>OPP</th>
            <th>DIFF</th>
            <th>HOME</th>
            <th>AWAY</th>
            <th>L10</th>
            <th>STRK</th>
          </tr>
        </thead>
        <tbody>
          ${(rows || [])
            .map(
              r => `
            <tr>
              <td class="mono-cell font-bold">${r.rank}</td>
              <td>
                <div class="player-cell">
                  <img src="${r.logo}" alt="${escapeHtml(r.abbreviation)}" style="width:24px;height:24px;" onerror="this.style.display='none'" />
                  <span class="font-bold">${escapeHtml(r.teamName)}</span>
                </div>
              </td>
              <td class="mono-cell font-bold">${r.wins}-${r.losses}</td>
              <td class="mono-cell">${escapeHtml(r.winPct)}</td>
              <td class="mono-cell">${r.ppg}</td>
              <td class="mono-cell">${r.oppPpg}</td>
              <td class="mono-cell ${String(r.netDiff).startsWith('+') ? 'pos-val' : 'neg-val'}">${escapeHtml(r.netDiff)}</td>
              <td class="mono-cell">${escapeHtml(r.homeRecord)}</td>
              <td class="mono-cell">${escapeHtml(r.awayRecord)}</td>
              <td class="mono-cell">${escapeHtml(r.last10)}</td>
              <td class="mono-cell font-bold">${escapeHtml(r.streak)}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    `;
  }

  function renderGlossary(glossary) {
    const wrap = document.getElementById('glossary-grid');
    if (!wrap) return;

    wrap.innerHTML = glossary
      .map(
        g => `
        <div class="glossary-item">
          <div class="glossary-top">
            <span class="glossary-code">${escapeHtml(g.code)}</span>
            <strong>${escapeHtml(g.name)}</strong>
            <span class="glossary-cat">${escapeHtml(g.category)}</span>
          </div>
          <div class="glossary-formula"><code>${escapeHtml(g.formula)}</code></div>
          <p>${escapeHtml(g.description)}</p>
          <div class="glossary-bench">${escapeHtml(g.benchmark)}</div>
        </div>
      `
      )
      .join('');
  }

  // =========================================================================
  // 6. ATHLETE PROFILE MODAL
  // =========================================================================
  function normalizeSportLeaguePath(rawSportLeague) {
    const s = String(rawSportLeague || 'basketball/nba').toLowerCase().trim();
    if (s.includes('/')) return s;
    const map = {
      basketball: 'basketball/nba',
      ncaab: 'basketball/mens-college-basketball',
      nfl: 'football/nfl',
      football: 'football/nfl',
      ncaaf: 'football/college-football',
      hockey: 'hockey/nhl',
      nhl: 'hockey/nhl',
      baseball: 'baseball/mlb',
      mlb: 'baseball/mlb',
      soccer: 'soccer/eng.1',
    };
    return map[s] || 'basketball/nba';
  }

  async function openPlayerModal(athleteId, sportLeague = 'basketball/nba') {
    const modal = document.getElementById('player-profile-modal');
    const body = document.getElementById('player-modal-body');
    const nameEl = document.getElementById('player-modal-name');
    const posEl = document.getElementById('player-modal-pos');
    if (!modal || !body || !athleteId) return;

    const leaguePath = normalizeSportLeaguePath(sportLeague);
    if (window.FreeBallStatsAthleteExplorer) {
      window.FreeBallStatsAthleteExplorer.resetState();
    }
    modal.classList.remove('hidden');

    const loadLive = async (seasonYear) => {
      body.innerHTML = `<div style="padding:2.5rem;text-align:center;color:var(--text-secondary);">Pulling live career stats, game logs &amp; splits directly from ESPN API...</div>`;
      try {
        const qs = seasonYear ? `?season=${encodeURIComponent(seasonYear)}&t=${Date.now()}` : `?t=${Date.now()}`;
        const res = await fetch(`/api/v1/athlete/${leaguePath}/${encodeURIComponent(athleteId)}${qs}`, { cache: 'no-store' });
        const p = await res.json();

        if (nameEl) nameEl.textContent = p.name || 'Live Athlete Profile';
        if (posEl) posEl.textContent = p.position || leaguePath.split('/')[1].toUpperCase();

        if (window.FreeBallStatsAthleteExplorer) {
          window.FreeBallStatsAthleteExplorer.renderInto(body, p, loadLive);
        }
      } catch (e) {
        body.innerHTML = `<div style="padding:1rem;color:var(--danger);">Failed to load live athlete explorer.</div>`;
      }
    };

    await loadLive();
  }

  // Expose globally so On-Court 5v5 and Multi-Sport Active Unit cards inside smart-screen.js open seamlessly
  window.openAthleteProfile = (athleteId, sportLeague) => openPlayerModal(athleteId, sportLeague);

  function bindEventListeners() {
    // Workspace navigation tabs & stacked view toggle
    document.querySelectorAll('[data-ws-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetWs = btn.getAttribute('data-ws-tab') || 'nba-game';
        showAllWorkspaces = false;
        document.querySelector('.bball-lab-container')?.classList.remove('show-all-ws');
        document.getElementById('ws-view-all-btn')?.classList.remove('active');
        switchWorkspace(targetWs);
      });
    });

    document.getElementById('ws-view-all-btn')?.addEventListener('click', (e) => {
      showAllWorkspaces = !showAllWorkspaces;
      const container = document.querySelector('.bball-lab-container');
      if (container) container.classList.toggle('show-all-ws', showAllWorkspaces);
      e.currentTarget.classList.toggle('active', showAllWorkspaces);
      e.currentTarget.textContent = showAllWorkspaces ? '◫ Focused Tabs' : '⊞ Stacked View';
    });

    document.getElementById('team360-h2h-btn')?.addEventListener('click', () => {
      const chosen = document.getElementById('team360-select')?.value || 'BOS';
      const sA = document.getElementById('team-h2h-a-select');
      const sB = document.getElementById('team-h2h-b-select');
      if (sA && sB) {
        sA.value = chosen;
        if (sB.value === chosen) sB.value = chosen === 'BOS' ? 'CLE' : 'BOS';
        loadTeamH2H(sA.value, sB.value);
      }
      switchWorkspace('compare');
      document.getElementById('team-h2h-lab')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    document.querySelectorAll('#injury-status-filters [data-inj-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#injury-status-filters .seg-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        injuryStatusFilter = btn.getAttribute('data-inj-filter') || 'all';
        renderInjuryWireTable(document.getElementById('injury-search-input')?.value || '');
      });
    });
    const form = document.getElementById('nl-query-form');
    const input = document.getElementById('nl-query-input');
    if (form && input) {
      form.addEventListener('submit', e => {
        e.preventDefault();
        if (input.value.trim()) {
          nlResultCollapsed = false;
          executeNaturalLanguageQuery(input.value.trim());
        }
      });
    }

    document.querySelectorAll('.preset-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        nlResultCollapsed = false;
        const q = btn.getAttribute('data-query') || '';
        if (input) input.value = q;
        executeNaturalLanguageQuery(q);
      });
    });

    // Box score mode toggle
    document.querySelectorAll('#box-mode-switch .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#box-mode-switch .seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeBoxMode = btn.getAttribute('data-mode') || 'advanced';
        const game = hubData?.games?.[activeGameIndex];
        if (game) renderInGameBoxScoreTable(game);
      });
    });

    // Standings conference toggle
    document.querySelectorAll('#standings-conf-switch .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#standings-conf-switch .seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeConference = btn.getAttribute('data-conf') || 'western';
        renderStandingsTable();
      });
    });

    // Leaderboard Matrix controls
    document.getElementById('matrix-search')?.addEventListener('input', refreshLeaderboardMatrix);
    document.getElementById('matrix-pos-filter')?.addEventListener('change', refreshLeaderboardMatrix);
    document.getElementById('matrix-sort-select')?.addEventListener('change', refreshLeaderboardMatrix);

    // Modal close
    document.getElementById('close-player-modal')?.addEventListener('click', () => {
      document.getElementById('player-profile-modal')?.classList.add('hidden');
    });
    document.getElementById('player-modal-backdrop')?.addEventListener('click', () => {
      document.getElementById('player-profile-modal')?.classList.add('hidden');
    });

    // Team 360 & Injury Wire controls
    document.getElementById('team360-select')?.addEventListener('change', (e) => {
      const val = e.target.value;
      const link = document.getElementById('team360-api-link');
      if (link) link.href = `/api/v1/data/team/basketball/nba/${encodeURIComponent(val)}`;
      loadTeam360Hub(val);
    });
    document.getElementById('injury-search-input')?.addEventListener('input', (e) => {
      renderInjuryWireTable(e.target.value || '');
    });
  }

  // =========================================================================
  // 7. TEAM 360 HUB (DEPTH CHART, ROSTER, SCHEDULE) & LIVE INJURY WIRE
  // =========================================================================
  let cachedInjuryList = [];

  async function loadTeam360Hub(teamAbbr) {
    const wrap = document.getElementById('team360-content');
    if (!wrap) return;
    wrap.innerHTML = `<div style="padding:1.5rem;color:var(--text-secondary);">Pulling live Depth Chart, Roster &amp; Schedule for <strong>${escapeHtml(teamAbbr)}</strong>...</div>`;
    try {
      const res = await fetch(`/api/v1/data/team/basketball/nba/${encodeURIComponent(teamAbbr)}?t=${Date.now()}`);
      const d = await res.json();
      const tm = d.team || {};
      const dcEntries = Object.entries(d.depthChart || {});

      wrap.innerHTML = `
        <div style="display:flex;align-items:center;gap:14px;padding:12px 14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:10px;margin-bottom:14px;flex-wrap:wrap;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:12px;">
            ${tm.logo ? `<img src="${escapeHtml(tm.logo)}" alt="${escapeHtml(tm.abbreviation)}" style="width:44px;height:44px;object-fit:contain;" />` : ''}
            <div>
              <div style="font-size:1.1rem;font-weight:900;">${escapeHtml(tm.name || teamAbbr)} <span style="color:#00f2fe;">(${escapeHtml(tm.record || '-')})</span></div>
              <div style="font-size:0.8rem;color:#94a3b8;">${escapeHtml(tm.standingSummary || '')} • ${d.rosterCount || 0} Active Roster Players</div>
            </div>
          </div>
          <span style="font-size:11px;padding:4px 9px;border-radius:999px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.35);color:#6ee7b7;font-weight:700;">● Live ESPN Team API</span>
        </div>

        <div class="ingame-two-col">
          <div class="analytics-panel">
            <div class="panel-title-row"><h3>🗺️ Positional Depth Chart</h3><span class="badge-mini">CLICK PLAYER FOR STATS</span></div>
            <div class="depth-chart-grid">
              ${dcEntries.length ? dcEntries.map(([pos, list]) => `
                <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:8px;">
                  <div style="font-size:11px;font-weight:800;color:#00f2fe;margin-bottom:5px;">${escapeHtml(pos)}</div>
                  ${(list || []).slice(0, 4).map((p, idx) => `
                    <div class="team360-player-link" data-player-id="${escapeHtml(p.id)}" style="font-size:12px;padding:3px 0;cursor:pointer;color:${idx === 0 ? '#fff' : '#94a3b8'};font-weight:${idx === 0 ? '700' : '500'};">
                      ${idx + 1}. ${escapeHtml(p.name)}
                    </div>
                  `).join('')}
                </div>
              `).join('') : '<div style="color:#94a3b8;font-size:12px;">Depth chart data unavailable.</div>'}
            </div>

            <div class="panel-title-row" style="margin-top:14px;"><h3>📅 Recent &amp; Upcoming Schedule</h3><span class="badge-mini">LAST 5 / NEXT 5</span></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
              <div>
                <div style="font-size:11px;font-weight:800;color:#c4b5fd;margin-bottom:5px;">RECENT RESULTS</div>
                ${(d.recentGames || []).slice(0, 5).map(g => `
                  <div style="font-size:11.5px;padding:4px 6px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;justify-content:space-between;">
                    <span>${escapeHtml(g.homeAway)} ${escapeHtml(g.opponentAbbr)}</span>
                    <strong class="${g.result === 'W' ? 'pos-val' : 'neg-val'}">${escapeHtml(g.result)} ${escapeHtml(g.score)}</strong>
                  </div>
                `).join('')}
              </div>
              <div>
                <div style="font-size:11px;font-weight:800;color:#67e8f9;margin-bottom:5px;">UPCOMING</div>
                ${(d.upcomingGames || []).slice(0, 5).map(g => `
                  <div style="font-size:11.5px;padding:4px 6px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;justify-content:space-between;">
                    <span>${escapeHtml(g.homeAway)} ${escapeHtml(g.opponentAbbr)}</span>
                    <small style="color:#94a3b8;">${escapeHtml(g.status)}</small>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <div class="analytics-panel">
            <div class="panel-title-row"><h3>👥 Active Roster &amp; Physicals</h3><span class="badge-mini">LIVE STATS EXPLORER</span></div>
            <div class="table-responsive dark-scroll-box" style="max-height:360px;">
              <table class="bball-table compact-table">
                <thead><tr><th>PLAYER</th><th>POS</th><th>#</th><th>AGE</th><th>HT</th><th>ORIGIN</th></tr></thead>
                <tbody>
                  ${(d.roster || []).map(p => `
                    <tr class="clickable-row" data-player-id="${escapeHtml(p.id)}">
                      <td>
                        <div class="player-cell">
                          <img src="${escapeHtml(p.headshot)}" alt="${escapeHtml(p.name)}" onerror="this.src='https://a.espncdn.com/combiner/i?img=/i/headshots/nophoto.png&w=120&h=90'" />
                          <span class="font-bold">${escapeHtml(p.name)}</span>
                        </div>
                      </td>
                      <td><span class="badge-mini">${escapeHtml(p.position)}</span></td>
                      <td class="mono-cell">#${escapeHtml(p.jersey)}</td>
                      <td class="mono-cell">${escapeHtml(p.age ?? '-')}</td>
                      <td class="mono-cell">${escapeHtml(p.height || '-')}</td>
                      <td><small style="color:#94a3b8;">${escapeHtml(p.college || '-')}</small></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      wrap.querySelectorAll('[data-player-id]').forEach(el => {
        const pid = el.getAttribute('data-player-id');
        if (pid) el.addEventListener('click', () => openPlayerModal(pid));
      });
    } catch (e) {
      wrap.innerHTML = `<div style="padding:1rem;color:var(--danger);">Failed to load Team 360 Hub.</div>`;
    }
  }

  async function loadInjuryWire() {
    const wrap = document.getElementById('injury-wire-grid');
    if (!wrap) return;
    wrap.innerHTML = `<div style="padding:1.25rem;color:var(--text-secondary);">Syncing league-wide official ESPN injury wire...</div>`;
    try {
      const res = await fetch(`/api/v1/data/injuries/basketball/nba?t=${Date.now()}`);
      const d = await res.json();
      cachedInjuryList = d.injuries || [];
      renderInjuryWireTable('');
    } catch (e) {
      wrap.innerHTML = `<div style="padding:1rem;color:var(--danger);">Unable to load NBA Injury Wire.</div>`;
    }
  }

  function renderInjuryWireTable(filterText) {
    const wrap = document.getElementById('injury-wire-grid');
    const summaryEl = document.getElementById('injury-summary-pills');
    if (!wrap) return;

    if (summaryEl) {
      const total = cachedInjuryList.length;
      const outCnt = cachedInjuryList.filter((i) => /\bout\b/i.test(i.status)).length;
      const gtdCnt = total - outCnt;
      summaryEl.innerHTML = `
        <span class="inj-kpi-pill">📋 Total Listed: <strong>${total}</strong></span>
        <span class="inj-kpi-pill" style="border-color:rgba(239,68,68,0.35);color:#fca5a5;">🚫 Out: <strong>${outCnt}</strong></span>
        <span class="inj-kpi-pill" style="border-color:rgba(251,191,36,0.35);color:#fde68a;">⚠️ Questionable / DTD: <strong>${gtdCnt}</strong></span>
      `;
    }

    const f = (filterText || '').trim().toLowerCase();
    let list = f
      ? cachedInjuryList.filter(i => `${i.player} ${i.teamName} ${i.teamAbbr} ${i.status} ${i.comment}`.toLowerCase().includes(f))
      : cachedInjuryList;

    if (injuryStatusFilter === 'out') {
      list = list.filter((i) => /\bout\b/i.test(i.status));
    } else if (injuryStatusFilter === 'gtd') {
      list = list.filter((i) => !/\bout\b/i.test(i.status));
    }

    if (list.length === 0) {
      wrap.innerHTML = `<div style="padding:1rem;color:var(--text-muted);">No matching injuries found.</div>`;
      return;
    }

    wrap.innerHTML = `
      <table class="bball-table compact-table">
        <thead><tr><th>PLAYER</th><th>TEAM</th><th>POS</th><th>STATUS</th><th>RETURN EST</th><th>LATEST REPORT</th></tr></thead>
        <tbody>
          ${list.slice(0, 60).map(i => {
            const isOut = /out/i.test(i.status);
            return `
              <tr class="${i.athleteId ? 'clickable-row' : ''}" data-player-id="${escapeHtml(i.athleteId || '')}">
                <td class="font-bold" style="color:${i.athleteId ? '#67e8f9' : '#fff'};">${escapeHtml(i.player)}</td>
                <td class="mono-cell">${escapeHtml(i.teamAbbr || i.teamName)}</td>
                <td><span class="badge-mini">${escapeHtml(i.position)}</span></td>
                <td><span style="padding:2px 7px;border-radius:999px;font-size:11px;font-weight:700;background:${isOut ? 'rgba(239,68,68,0.18)' : 'rgba(251,191,36,0.18)'};color:${isOut ? '#fca5a5' : '#fde68a'};">${escapeHtml(i.status)}</span></td>
                <td class="mono-cell">${escapeHtml(i.returnDate || '-')}</td>
                <td><small style="color:#94a3b8;white-space:normal;display:block;min-width:260px;max-width:540px;line-height:1.4;">${escapeHtml(i.comment)}</small></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    wrap.querySelectorAll('[data-player-id]').forEach(row => {
      const pid = row.getAttribute('data-player-id');
      if (pid) row.addEventListener('click', () => openPlayerModal(pid));
    });
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  document.addEventListener('DOMContentLoaded', initBasketballLab);
})();
