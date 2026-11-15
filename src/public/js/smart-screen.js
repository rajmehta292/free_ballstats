/**
 * Free_BallStats v3.0 — Smart Screen Interactive Broadcast Canvas & Basketball Telemetry Visualizers
 * Provides:
 *  1. Smart Screen Broadcast Modes (Smart Triggers, L-Bar Squeeze-Back, CourtView Glass HUD)
 *  2. Fullscreen-capable Smart Overlay & Auto-Rotating Contextual Smart Cards
 *  3. Interactive SVG Half-Court Shot Chart & 6-Zone CourtOptix Heatmap
 *  4. On-Court 5v5 Lineup Matrix & PopcornMachine Stint GameFlow
 *  5. Interactive SVG Win Probability Worm & Leverage Index Curve
 *  6. Synergy Play-Type Efficiency Matrix
 *  7. Cross-Page Persistent Smart Mini-Player Dock for the Basketball Research Lab
 */

(function () {
  const SMART_DOCK_STORAGE_KEY = 'fbs_active_smart_dock_v3';

  function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Persist active stream for cross-page Smart Mini-Player Dock in /basketball.html
   */
  function saveActiveStreamForDock(streamMeta) {
    if (!streamMeta || !streamMeta.stream_key) return;
    try {
      localStorage.setItem(
        SMART_DOCK_STORAGE_KEY,
        JSON.stringify({
          stream_key: streamMeta.stream_key,
          name: streamMeta.name || streamMeta.stream_key,
          category: streamMeta.category || 'basketball',
          savedAt: Date.now(),
        })
      );
    } catch (e) {}
  }

  function getSavedDockStream() {
    try {
      const raw = localStorage.getItem(SMART_DOCK_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  /**
   * Render Interactive SVG Half-Court Shot Chart & CourtOptix 6-Zone Efficiency Map
   */
  function renderSvgHalfCourtShotChart(hudData, opts = {}) {
    if (!hudData || !hudData.shotChart) {
      return '<div style="padding:16px;color:#94a3b8;text-align:center;">Shot chart telemetry loading...</div>';
    }
    const compact = Boolean(opts.compact);
    const filterSide = opts.filterSide || 'all'; // 'all' | 'team1' | 'team2' | 'zones'
    const t1 = hudData.team1Analytics || {};
    const t2 = hudData.team2Analytics || {};
    const shots = (hudData.shotChart.shots || []).filter((s) => {
      if (filterSide === 'team1') return s.teamSide === 'team1';
      if (filterSide === 'team2') return s.teamSide === 'team2';
      return true;
    });

    const zones = filterSide === 'team2' ? (hudData.shotChart.team2Zones || []) : (hudData.shotChart.team1Zones || []);
    const activeTeamAbbr = filterSide === 'team2' ? (t2.abbreviation || 'TM2') : (t1.abbreviation || 'TM1');

    // Zone heat color helper
    const getZoneFill = (delta) => {
      if (delta >= 4.0) return 'rgba(16, 185, 129, 0.32)';
      if (delta >= 0.5) return 'rgba(0, 242, 254, 0.24)';
      if (delta >= -2.5) return 'rgba(145, 70, 255, 0.20)';
      return 'rgba(239, 68, 68, 0.25)';
    };

    const zMap = {};
    zones.forEach((z) => {
      zMap[z.zone] = z;
    });

    const dotsSvg =
      filterSide === 'zones'
        ? ''
        : shots
            .map((s) => {
              const isT1 = s.teamSide === 'team1';
              const color = s.made ? (isT1 ? '#00f2fe' : '#f97316') : 'rgba(239, 68, 68, 0.78)';
              if (s.made) {
                return `<circle cx="${s.x}" cy="${s.y}" r="${compact ? 5.2 : 6}" fill="${color}" stroke="#06070a" stroke-width="1.5" opacity="0.92">
                  <title>${esc(s.playerName)} (${esc(s.teamAbbr)}) • MADE ${s.value}PT • ${esc(s.shotType)} (Q${s.period} ${esc(s.clock)}) • xEFG: ${s.xEfg}%</title>
                </circle>`;
              } else {
                const d = compact ? 4.2 : 4.8;
                return `<g opacity="0.72">
                  <line x1="${s.x - d}" y1="${s.y - d}" x2="${s.x + d}" y2="${s.y + d}" stroke="${color}" stroke-width="2"/>
                  <line x1="${s.x + d}" y1="${s.y - d}" x2="${s.x - d}" y2="${s.y + d}" stroke="${color}" stroke-width="2"/>
                  <title>${esc(s.playerName)} (${esc(s.teamAbbr)}) • MISSED ${s.value}PT • ${esc(s.shotType)} (Q${s.period} ${esc(s.clock)}) • xEFG: ${s.xEfg}%</title>
                </g>`;
              }
            })
            .join('');

    const zoneLabelsSvg = [
      { key: 'restricted_area', x: 250, y: 74 },
      { key: 'paint_non_ra', x: 250, y: 148 },
      { key: 'midrange', x: 135, y: 170 },
      { key: 'corner_3_left', x: 30, y: 95 },
      { key: 'corner_3_right', x: 470, y: 95 },
      { key: 'above_break_3', x: 250, y: 315 },
    ]
      .map((pos) => {
        const z = zMap[pos.key];
        if (!z) return '';
        const sign = z.deltaVsLeague >= 0 ? '+' : '';
        return `<g transform="translate(${pos.x}, ${pos.y})">
          <rect x="-42" y="-16" width="84" height="32" rx="6" fill="rgba(7, 9, 14, 0.84)" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>
          <text x="0" y="-2" text-anchor="middle" fill="#ffffff" font-size="10" font-weight="800">${z.fgm}/${z.fga} (${z.fgPct}%)</text>
          <text x="0" y="10" text-anchor="middle" fill="${z.deltaVsLeague >= 0 ? '#10b981' : '#f87171'}" font-size="8.5" font-weight="700">${sign}${z.deltaVsLeague}% vs Lg</text>
        </g>`;
      })
      .join('');

    const raZone = zMap['restricted_area'] || { deltaVsLeague: 2 };
    const paintZone = zMap['paint_non_ra'] || { deltaVsLeague: 0 };
    const ab3Zone = zMap['above_break_3'] || { deltaVsLeague: 1 };

    return `
      <div class="fbs-shotchart-wrap">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:8px;flex-wrap:wrap;">
          <div style="font-size:11px;font-weight:800;color:#e2e8f0;display:flex;align-items:center;gap:8px;">
            <span>🎯 COURTOPTIX SPATIAL SHOT CHART</span>
            <span style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(0,242,254,0.12);color:#00f2fe;">
              ${esc(t1.abbreviation || 'TM1')} xEFG: ${t1.xEfgPct || 54.8}% (${(t1.shotMakingDelta || 0) >= 0 ? '+' : ''}${t1.shotMakingDelta || 0}%)
            </span>
            <span style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(249,115,22,0.14);color:#fb923c;">
              ${esc(t2.abbreviation || 'TM2')} xEFG: ${t2.xEfgPct || 53.9}% (${(t2.shotMakingDelta || 0) >= 0 ? '+' : ''}${t2.shotMakingDelta || 0}%)
            </span>
          </div>
          <div class="fbs-shotchart-filters" style="display:flex;gap:4px;">
            <button type="button" class="fbs-sc-filter-btn ${filterSide === 'all' ? 'active' : ''}" data-sc-filter="all">All</button>
            <button type="button" class="fbs-sc-filter-btn ${filterSide === 'team1' ? 'active' : ''}" data-sc-filter="team1">${esc(t1.abbreviation || 'TM1')}</button>
            <button type="button" class="fbs-sc-filter-btn ${filterSide === 'team2' ? 'active' : ''}" data-sc-filter="team2">${esc(t2.abbreviation || 'TM2')}</button>
            <button type="button" class="fbs-sc-filter-btn ${filterSide === 'zones' ? 'active' : ''}" data-sc-filter="zones">Zones</button>
          </div>
        </div>

        <svg viewBox="0 0 500 420" style="width:100%;height:auto;max-height:${compact ? '230px' : '310px'};background:linear-gradient(180deg, #0b101b 0%, #070a12 100%);border:1px solid rgba(255,255,255,0.12);border-radius:10px;display:block;">
          <!-- Zone Heat Shading -->
          <rect x="10" y="10" width="480" height="400" fill="${getZoneFill(ab3Zone.deltaVsLeague)}" opacity="0.35"/>
          <!-- Paint Lane (16ft = 160px wide, 19ft = 190px tall) -->
          <rect x="170" y="10" width="160" height="190" fill="${getZoneFill(paintZone.deltaVsLeague)}" stroke="rgba(255,255,255,0.28)" stroke-width="1.8"/>
          <!-- Restricted Area Arc -->
          <path d="M 210 52.5 A 40 40 0 0 0 290 52.5 Z" fill="${getZoneFill(raZone.deltaVsLeague)}" stroke="rgba(0,242,254,0.45)" stroke-width="1.5"/>
          <!-- Free Throw Circle -->
          <circle cx="250" cy="200" r="60" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.5" stroke-dasharray="4 4"/>
          <!-- 3-Point Line (Corner lines x=30 and x=470 up to y=140, then 237.5px radius arc) -->
          <line x1="30" y1="10" x2="30" y2="142" stroke="rgba(255,255,255,0.38)" stroke-width="2"/>
          <line x1="470" y1="10" x2="470" y2="142" stroke="rgba(255,255,255,0.38)" stroke-width="2"/>
          <path d="M 30 142 A 237.5 237.5 0 0 0 470 142" fill="none" stroke="rgba(255,255,255,0.38)" stroke-width="2"/>
          <!-- Backboard & Rim -->
          <line x1="220" y1="40" x2="280" y2="40" stroke="#e2e8f0" stroke-width="3"/>
          <circle cx="250" cy="52.5" r="9" fill="none" stroke="#f97316" stroke-width="2.5"/>
          <!-- Outer Half-Court Boundary -->
          <rect x="10" y="10" width="480" height="400" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
          <!-- Center Court Half Circle -->
          <path d="M 190 410 A 60 60 0 0 1 310 410" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1.5"/>

          <!-- Shot Coordinates -->
          ${dotsSvg}

          <!-- Zone Efficiency Callouts (${esc(activeTeamAbbr)}) -->
          ${zoneLabelsSvg}
        </svg>

        <div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#94a3b8;margin-top:6px;">
          <span><strong style="color:#00f2fe;">●</strong> ${esc(t1.abbreviation || 'TM1')} Make &nbsp; <strong style="color:#f97316;">●</strong> ${esc(t2.abbreviation || 'TM2')} Make &nbsp; <strong style="color:#ef4444;">✕</strong> Miss</span>
          <span>Zone Pills: <strong>${esc(activeTeamAbbr)}</strong> FG% &amp; Delta vs NBA League Avg</span>
        </div>
      </div>
    `;
  }

  /**
   * Render On-Court 5v5 Floor Lineup Matrix & PopcornMachine Stint GameFlow
   */
  function renderOnCourt5v5AndStints(hudData, opts = {}) {
    if (!hudData || !hudData.onCourtLineup) {
      return '<div style="padding:14px;color:#94a3b8;">Loading active 5v5 on-court lineups...</div>';
    }
    const compact = Boolean(opts.compact);
    const oc = hudData.onCourtLineup;
    const t1 = hudData.team1Analytics || {};
    const t2 = hudData.team2Analytics || {};
    const bonus = hudData.bonusState || {};

    const renderFiveRow = (players, abbr, unitNetRtg, inBonus, foulsInPeriod, accent) => `
      <div style="background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:11px;font-weight:900;color:${accent};">${esc(abbr)} ON-COURT 5</span>
            <span style="font-size:10px;padding:1px 6px;border-radius:4px;background:rgba(255,255,255,0.07);color:#cbd5e1;">
              Unit NetRTG: <strong>${unitNetRtg >= 0 ? '+' : ''}${unitNetRtg}</strong>
            </span>
          </div>
          <div style="font-size:10px;color:${inBonus ? '#f59e0b' : '#94a3b8'};font-weight:700;">
            Fouls: ${foulsInPeriod || 2} ${inBonus ? '• BONUS' : ''}
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(5, 1fr);gap:5px;">
          ${(players || []).slice(0, 5).map((p) => {
            const foulWarn = p.pf >= 4;
            return `
              <div style="background:rgba(6,7,10,0.75);border:1px solid ${p.hotStreak ? 'rgba(245,158,11,0.5)' : foulWarn ? 'rgba(239,68,68,0.55)' : 'rgba(255,255,255,0.07)'};border-radius:6px;padding:5px;text-align:center;cursor:pointer;" onclick="if(window.openAthleteProfile) window.openAthleteProfile('${esc(p.id)}', 'basketball/nba', '${esc(p.name)}')">
                <div style="font-size:9px;color:#94a3b8;font-weight:700;">${esc(p.position)} #${esc(p.jersey)}</div>
                <div style="font-size:10.5px;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${esc(p.name)}">${esc(p.name.split(' ').slice(-1)[0])}</div>
                <div style="font-size:10px;color:${accent};font-weight:800;margin-top:2px;">${p.pts}p/${p.reb}r/${p.ast}a</div>
                <div style="font-size:9px;color:#cbd5e1;display:flex;justify-content:center;gap:4px;margin-top:2px;">
                  <span>${p.plusMinus >= 0 ? '+' : ''}${p.plusMinus}</span>
                  <span style="color:${foulWarn ? '#f87171' : '#94a3b8'};">${p.pf}PF</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    const stintsHtml = compact
      ? ''
      : `
        <div style="margin-top:8px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:8px;">
          <div style="font-size:10px;font-weight:800;color:#a78bfa;margin-bottom:6px;text-transform:uppercase;">
            🔄 PopcornMachine Rotation Stint GameFlow • ${esc(oc.activeStintMargin || '')}
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:6px;">
            ${(hudData.stintTimeline || []).map((st) => `
              <div style="background:rgba(0,0,0,0.45);border-left:3px solid ${st.netSwing >= 0 ? '#00f2fe' : '#f97316'};padding:6px 8px;border-radius:4px;font-size:10.5px;">
                <div style="display:flex;justify-content:space-between;font-weight:800;color:#e2e8f0;">
                  <span>${esc(st.label)}</span>
                  <span style="color:${st.netSwing >= 0 ? '#00f2fe' : '#fb923c'};">${esc(st.dominantTeam)} ${st.netSwing >= 0 ? '+' : ''}${st.netSwing}</span>
                </div>
                <div style="font-size:9.5px;color:#94a3b8;margin-top:2px;">${esc(st.startMark)} → ${esc(st.endMark)} (${st.team1Score}-${st.team2Score})</div>
                <div style="font-size:9.5px;color:#cbd5e1;margin-top:2px;">${esc(st.summary)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;

    return `
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${renderFiveRow(oc.team1Five, t1.abbreviation || 'TM1', oc.team1UnitNetRtg, bonus.team1InBonus, bonus.team1FoulsInPeriod, '#00f2fe')}
        ${renderFiveRow(oc.team2Five, t2.abbreviation || 'TM2', oc.team2UnitNetRtg, bonus.team2InBonus, bonus.team2FoulsInPeriod, '#f97316')}
        ${stintsHtml}
      </div>
    `;
  }

  /**
   * Render Win Probability Worm & Leverage Index Curve
   */
  function renderWinProbWormChart(hudData) {
    if (!hudData || !Array.isArray(hudData.winProbTimeline) || hudData.winProbTimeline.length === 0) {
      return '<div style="padding:12px;color:#94a3b8;">Win probability timeline loading...</div>';
    }
    const pts = hudData.winProbTimeline;
    const t1 = hudData.team1Analytics || {};
    const t2 = hudData.team2Analytics || {};
    const width = 460;
    const height = 135;
    const padX = 24;
    const padY = 16;
    const plotW = width - padX * 2;
    const plotH = height - padY * 2;

    const coords = pts.map((pt, i) => {
      const x = padX + (i / Math.max(1, pts.length - 1)) * plotW;
      const y = padY + ((100 - pt.team1WinPct) / 100) * plotH;
      return { x: Math.round(x), y: Math.round(y), pt };
    });

    const polylinePoints = coords.map((c) => `${c.x},${c.y}`).join(' ');
    const areaPoints = `${coords[0].x},${padY + plotH / 2} ${polylinePoints} ${coords[coords.length - 1].x},${padY + plotH / 2}`;

    return `
      <div style="background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:6px;">
          <div style="font-size:11px;font-weight:800;color:#e2e8f0;">
            📈 INPREDICTABLE WIN PROBABILITY WORM &amp; LEVERAGE INDEX
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            <span style="font-size:10px;padding:2px 7px;border-radius:999px;background:rgba(245,158,11,0.18);color:#fbbf24;font-weight:800;">
              Leverage Index: ${hudData.leverageIndex || 1.85}x (${esc(hudData.leverageTier || 'High')})
            </span>
          </div>
        </div>

        <svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;max-height:130px;background:#070910;border-radius:8px;border:1px solid rgba(255,255,255,0.07);">
          <!-- 50% Midline -->
          <line x1="${padX}" y1="${padY + plotH / 2}" x2="${width - padX}" y2="${padY + plotH / 2}" stroke="rgba(255,255,255,0.2)" stroke-dasharray="3 3" stroke-width="1"/>
          <text x="6" y="${padY + 8}" fill="#00f2fe" font-size="8.5" font-weight="800">${esc(t1.abbreviation || 'TM1')}</text>
          <text x="6" y="${height - 6}" fill="#f97316" font-size="8.5" font-weight="800">${esc(t2.abbreviation || 'TM2')}</text>

          <polygon points="${areaPoints}" fill="rgba(0, 242, 254, 0.14)"/>
          <polyline fill="none" stroke="#00f2fe" stroke-width="2.5" points="${polylinePoints}"/>

          ${coords.map((c) => `
            <circle cx="${c.x}" cy="${c.y}" r="${c.pt.isKeyPlay ? 4.8 : 3}" fill="${c.pt.isKeyPlay ? '#fbbf24' : '#00f2fe'}" stroke="#06070a" stroke-width="1.2">
              <title>${esc(c.pt.period)} ${esc(c.pt.clock)} • Score: ${esc(c.pt.scoreStr)} • ${esc(t1.abbreviation || 'TM1')} Win Prob: ${c.pt.team1WinPct}% ${c.pt.eventNote ? '• ' + esc(c.pt.eventNote) : ''}</title>
            </circle>
          `).join('')}
        </svg>

        <div style="display:flex;justify-content:space-between;font-size:10px;color:#94a3b8;margin-top:5px;">
          <span>Q1 Tip-Off (50%)</span>
          <span>Halftime</span>
          <span><strong style="color:#fbbf24;">●</strong> Key WPA Inflection Plays</span>
          <span style="color:#00f2fe;font-weight:800;">Current: ${esc(t1.abbreviation || 'TM1')} ${coords[coords.length - 1].pt.team1WinPct}%</span>
        </div>
      </div>
    `;
  }

  /**
   * Render Synergy Play-Type Efficiency Matrix
   */
  function renderSynergyPlayTypes(hudData) {
    const t1 = hudData?.team1Analytics;
    const t2 = hudData?.team2Analytics;
    if (!t1 || !Array.isArray(t1.playTypes)) return '';

    const renderTeamPlayTable = (team, accent) => `
      <div style="background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:10px;">
        <div style="font-size:11px;font-weight:800;color:${accent};margin-bottom:6px;">
          🏀 ${esc(team.teamName)} — SYNERGY PLAY-TYPE EFFICIENCY
        </div>
        <table style="width:100%;font-size:10.5px;border-collapse:collapse;">
          <thead>
            <tr style="color:#94a3b8;border-bottom:1px solid rgba(255,255,255,0.08);text-align:right;">
              <th style="text-align:left;padding:4px;">PLAY TYPE</th>
              <th style="padding:4px;">FREQ%</th>
              <th style="padding:4px;">PPP</th>
              <th style="padding:4px;">eFG%</th>
              <th style="padding:4px;">%ILE</th>
            </tr>
          </thead>
          <tbody>
            ${team.playTypes.map((pt) => `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.04);text-align:right;">
                <td style="text-align:left;padding:4px;font-weight:700;color:#e2e8f0;">${esc(pt.playType)}</td>
                <td style="padding:4px;color:#cbd5e1;">${pt.freqPct}%</td>
                <td style="padding:4px;font-weight:800;color:${pt.ppp >= 1.10 ? '#10b981' : '#fff'};">${pt.ppp}</td>
                <td style="padding:4px;color:#00f2fe;">${pt.efgPct}%</td>
                <td style="padding:4px;">
                  <span style="padding:1px 5px;border-radius:4px;font-size:9.5px;font-weight:800;background:${pt.percentile >= 75 ? 'rgba(16,185,129,0.2)' : 'rgba(145,70,255,0.2)'};color:${pt.percentile >= 75 ? '#34d399' : '#c4b5fd'};">
                    ${pt.percentile}th
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    return `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px;margin-top:10px;">
        ${renderTeamPlayTable(t1, '#00f2fe')}
        ${t2 && Array.isArray(t2.playTypes) ? renderTeamPlayTable(t2, '#f97316') : ''}
      </div>
    `;
  }

  /**
   * Smart Screen Broadcast Controller
   * Attaches to a video stage container (e.g. .player-frame-wrapper in index.html or #video-wrapper in player.html)
   */
  class SmartScreenController {
    constructor(stageEl, options = {}) {
      this.stageEl = stageEl;
      this.options = options;
      this.streamKey = null;
      this.streamMeta = null;
      this.hudData = null;
      this.mode = options.defaultMode || 'triggers'; // 'triggers' | 'lbar' | 'hud' | 'off'
      this.activeRailTab = 'shotchart'; // 'shotchart' | 'lineup' | 'fourfactors' | 'worm'
      this.shotChartFilter = 'all';
      this.cardIndex = 0;
      this.cardTimer = null;

      this.initDom();
    }

    initDom() {
      if (!this.stageEl || this.stageEl.dataset.smartScreenMounted === 'true') return;
      this.stageEl.dataset.smartScreenMounted = 'true';
      this.stageEl.classList.add('fbs-smart-screen-stage');

      // Wrap existing video/iframe inside .fbs-smart-video-core so L-Bar Squeeze-Back can resize it cleanly
      const existingChildren = Array.from(this.stageEl.children);
      this.videoCore = document.createElement('div');
      this.videoCore.className = 'fbs-smart-video-core';
      existingChildren.forEach((ch) => this.videoCore.appendChild(ch));
      this.stageEl.appendChild(this.videoCore);

      // Top Floating Smart Screen Command Bar + Mini Scorebug
      this.topBar = document.createElement('div');
      this.topBar.className = 'fbs-smart-topbar';
      this.stageEl.appendChild(this.topBar);

      // Auto-Triggered Smart Broadcast Card (Bottom-Right of Video Core)
      this.smartCardEl = document.createElement('div');
      this.smartCardEl.className = 'fbs-smart-trigger-card';
      this.videoCore.appendChild(this.smartCardEl);

      // CourtView Glass HUD Corner Widgets
      this.glassHudEl = document.createElement('div');
      this.glassHudEl.className = 'fbs-smart-glass-hud';
      this.videoCore.appendChild(this.glassHudEl);

      // Right L-Bar Telemetry Rail
      this.rightRail = document.createElement('aside');
      this.rightRail.className = 'fbs-smart-lbar-right';
      this.stageEl.appendChild(this.rightRail);

      // Bottom L-Bar Ticker & Worm Rail
      this.bottomRail = document.createElement('div');
      this.bottomRail.className = 'fbs-smart-lbar-bottom';
      this.stageEl.appendChild(this.bottomRail);

      this.renderTopBar();
      this.applyModeClasses();

      // Rotate contextual Smart Cards every 9 seconds
      this.cardTimer = setInterval(() => {
        if (this.hudData && Array.isArray(this.hudData.smartCards) && this.hudData.smartCards.length > 1) {
          this.cardIndex = (this.cardIndex + 1) % this.hudData.smartCards.length;
          this.renderSmartTriggerCard();
        }
      }, 9000);
    }

    async loadStream(streamKey, streamMeta = {}) {
      this.streamKey = streamKey;
      this.streamMeta = {
        stream_key: streamKey,
        name: streamMeta.name || streamKey,
        category: streamMeta.category || 'basketball',
      };
      saveActiveStreamForDock(this.streamMeta);

      // Auto-enable L-Bar or Triggers nicely
      this.renderTopBar();

      try {
        const res = await fetch(`/api/v1/basketball/smart-hud/${encodeURIComponent(streamKey)}?t=${Date.now()}`);
        if (res.ok) {
          this.hudData = await res.json();
          this.cardIndex = 0;
          this.renderAll();
        }
      } catch (err) {
        console.error('[SmartScreen] Failed to fetch smart-hud telemetry:', err);
      }
    }

    updateFromIntel(intel) {
      if (!intel) return;
      if (intel.stream_key && intel.stream_key !== this.streamKey) {
        this.loadStream(intel.stream_key, { name: intel.scoreboard?.team1?.name + ' vs ' + intel.scoreboard?.team2?.name, category: 'basketball' });
        return;
      }
      if (intel.basketballAnalytics) {
        const ba = intel.basketballAnalytics;
        this.hudData = {
          stream_key: intel.stream_key,
          scoreboard: intel.scoreboard,
          winProbability: intel.winProbability,
          linescore: intel.linescore,
          leverageIndex: ba.leverageIndex,
          leverageTier: ba.leverageTier,
          isClutchTime: ba.isClutchTime,
          bonusState: ba.bonusState,
          smartCards: ba.smartCards,
          onCourtLineup: ba.onCourtLineup,
          shotChart: ba.shotChart,
          winProbTimeline: ba.winProbTimeline,
          stintTimeline: ba.stintTimeline,
          team1Analytics: ba.team1Analytics,
          team2Analytics: ba.team2Analytics,
          mvpPerformer: ba.mvpPerformer,
          inGameInsights: ba.inGameInsights,
        };
        this.renderAll();
      } else if (this.streamKey && !this.hudData) {
        this.loadStream(this.streamKey, this.streamMeta || {});
      }
    }

    setMode(newMode) {
      this.mode = newMode;
      this.applyModeClasses();
      this.renderAll();
    }

    applyModeClasses() {
      if (!this.stageEl) return;
      this.stageEl.classList.remove('mode-triggers', 'mode-lbar', 'mode-hud', 'mode-off');
      this.stageEl.classList.add(`mode-${this.mode}`);
    }

    toggleFullscreen() {
      if (!this.stageEl) return;
      if (!document.fullscreenElement) {
        this.stageEl.requestFullscreen?.().catch(() => {});
      } else {
        document.exitFullscreen?.().catch(() => {});
      }
    }

    openInResearchLabWithDock() {
      if (this.streamMeta) {
        saveActiveStreamForDock(this.streamMeta);
      }
      const keyParam = this.streamKey ? `?dock=${encodeURIComponent(this.streamKey)}` : '';
      window.location.href = `/basketball.html${keyParam}`;
    }

    renderAll() {
      this.renderTopBar();
      this.renderSmartTriggerCard();
      this.renderGlassHud();
      this.renderLBarRails();
    }

    renderTopBar() {
      if (!this.topBar) return;
      const sb = this.hudData?.scoreboard;
      const t1 = this.hudData?.team1Analytics;
      const t2 = this.hudData?.team2Analytics;
      const li = this.hudData?.leverageIndex || 1.85;
      const isClutch = Boolean(this.hudData?.isClutchTime || li >= 2.2);

      const scorebugHtml = sb
        ? `
          <div class="fbs-mini-scorebug ${isClutch ? 'is-clutch' : ''}">
            <span class="fbs-ms-team">${esc(t1?.abbreviation || sb.team1?.name || 'TM1')} <strong>${esc(sb.team1?.score ?? t1?.score ?? '0')}</strong></span>
            <span class="fbs-ms-sep">•</span>
            <span class="fbs-ms-team">${esc(t2?.abbreviation || sb.team2?.name || 'TM2')} <strong>${esc(sb.team2?.score ?? t2?.score ?? '0')}</strong></span>
            <span class="fbs-ms-clock">${esc(sb.detail || 'LIVE')}</span>
            <span class="fbs-ms-li" title="Inpredictable Game Leverage Index">${li}x LI</span>
          </div>
        `
        : `<div class="fbs-mini-scorebug"><span>🏀 SMART SCREEN TELEMETRY</span></div>`;

      this.topBar.innerHTML = `
        ${scorebugHtml}
        <div class="fbs-smart-mode-controls">
          <button type="button" class="fbs-sm-btn ${this.mode === 'triggers' ? 'active' : ''}" data-sm-mode="triggers" title="Clean Broadcast + Auto-Triggered Context Cards">
            ⚡ Smart Cards
          </button>
          <button type="button" class="fbs-sm-btn ${this.mode === 'lbar' ? 'active' : ''}" data-sm-mode="lbar" title="Prime X-Ray / ESPN Squeeze-Back L-Bar Mode (Hotkey: L)">
            📐 L-Bar Squeeze-Back
          </button>
          <button type="button" class="fbs-sm-btn ${this.mode === 'hud' ? 'active' : ''}" data-sm-mode="hud" title="Translucent CourtView Glass HUD Overlay (Hotkey: H)">
            🥽 Glass HUD
          </button>
          <button type="button" class="fbs-sm-btn ${this.mode === 'off' ? 'active' : ''}" data-sm-mode="off" title="Hide All Overlays">
            Clean
          </button>
          <button type="button" class="fbs-sm-btn fbs-sm-action" data-sm-action="dock-lab" title="Keep Live Stream in Mini-Player & Open Basketball Research Lab">
            🔬 Dock to Lab
          </button>
          <button type="button" class="fbs-sm-btn fbs-sm-action" data-sm-action="fullscreen" title="Fullscreen WITH Smart Screen Overlays & L-Bar">
            ⛶ Smart Fullscreen
          </button>
        </div>
      `;

      this.topBar.querySelectorAll('[data-sm-mode]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.setMode(btn.getAttribute('data-sm-mode'));
        });
      });

      this.topBar.querySelector('[data-sm-action="fullscreen"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleFullscreen();
      });

      this.topBar.querySelector('[data-sm-action="dock-lab"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openInResearchLabWithDock();
      });
    }

    renderSmartTriggerCard() {
      if (!this.smartCardEl) return;
      if (this.mode === 'off' || !this.hudData || !Array.isArray(this.hudData.smartCards) || this.hudData.smartCards.length === 0) {
        this.smartCardEl.style.display = 'none';
        return;
      }

      const cards = this.hudData.smartCards;
      const card = cards[this.cardIndex % cards.length];
      this.smartCardEl.style.display = 'flex';
      this.smartCardEl.innerHTML = `
        <div class="fbs-stc-inner accent-${esc(card.accentColor || 'purple')}">
          ${card.playerHeadshot ? `<img class="fbs-stc-avatar" src="${esc(card.playerHeadshot)}" alt="" onerror="this.style.display='none'">` : ''}
          <div class="fbs-stc-body">
            <div class="fbs-stc-header">
              <span class="fbs-stc-badge">${esc(card.badge)}</span>
              <span class="fbs-stc-metric">${esc(card.primaryMetric)}</span>
            </div>
            <div class="fbs-stc-title">${esc(card.title)}</div>
            <div class="fbs-stc-sub">${esc(card.subtitle)}</div>
          </div>
          <div class="fbs-stc-actions">
            <button type="button" class="fbs-stc-next" title="Next Live Insight (${(this.cardIndex % cards.length) + 1}/${cards.length})">↻</button>
          </div>
        </div>
      `;

      this.smartCardEl.querySelector('.fbs-stc-next')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.cardIndex = (this.cardIndex + 1) % cards.length;
        this.renderSmartTriggerCard();
      });
    }

    renderGlassHud() {
      if (!this.glassHudEl) return;
      if (this.mode !== 'hud' || !this.hudData) {
        this.glassHudEl.style.display = 'none';
        return;
      }
      this.glassHudEl.style.display = 'block';
      const t1 = this.hudData.team1Analytics || {};
      const t2 = this.hudData.team2Analytics || {};
      const oc = this.hudData.onCourtLineup || {};

      this.glassHudEl.innerHTML = `
        <!-- Top-Right Four Factors & CourtOptix Pill -->
        <div class="fbs-hud-corner top-right">
          <div class="fbs-hud-title">📐 FOUR FACTORS &amp; SHOT QUALITY</div>
          <div class="fbs-hud-row"><span>eFG% (Actual)</span><strong>${esc(t1.abbreviation)} ${t1.efgPct}% • ${esc(t2.abbreviation)} ${t2.efgPct}%</strong></div>
          <div class="fbs-hud-row"><span>xEFG% (Expected)</span><strong>${esc(t1.abbreviation)} ${t1.xEfgPct}% • ${esc(t2.abbreviation)} ${t2.xEfgPct}%</strong></div>
          <div class="fbs-hud-row"><span>Turnover %</span><strong>${esc(t1.abbreviation)} ${t1.fourFactors?.tovPct}% • ${esc(t2.abbreviation)} ${t2.fourFactors?.tovPct}%</strong></div>
          <div class="fbs-hud-row"><span>Off Reb %</span><strong>${esc(t1.abbreviation)} ${t1.fourFactors?.orbPct}% • ${esc(t2.abbreviation)} ${t2.fourFactors?.orbPct}%</strong></div>
          <div class="fbs-hud-row"><span>Pace / 48m</span><strong>${this.hudData.team1Analytics?.pace || 99.5} Poss</strong></div>
        </div>

        <!-- Bottom-Left Active 5v5 On-Court Lineup Chips -->
        <div class="fbs-hud-corner bottom-left">
          <div class="fbs-hud-title">👥 ON-COURT 5v5 LINEUP (${esc(oc.activeStintMargin || 'Live Stint')})</div>
          <div style="font-size:10px;color:#00f2fe;margin-bottom:3px;">
            <strong>${esc(t1.abbreviation)}:</strong> ${(oc.team1Five || []).map((p) => `${esc(p.name.split(' ').slice(-1)[0])} (${p.pts}p)`).join(' • ')}
          </div>
          <div style="font-size:10px;color:#fb923c;">
            <strong>${esc(t2.abbreviation)}:</strong> ${(oc.team2Five || []).map((p) => `${esc(p.name.split(' ').slice(-1)[0])} (${p.pts}p)`).join(' • ')}
          </div>
        </div>
      `;
    }

    renderLBarRails() {
      if (!this.rightRail || !this.bottomRail) return;
      if (this.mode !== 'lbar' || !this.hudData) {
        this.rightRail.style.display = 'none';
        this.bottomRail.style.display = 'none';
        return;
      }

      this.rightRail.style.display = 'flex';
      this.bottomRail.style.display = 'grid';

      const t1 = this.hudData.team1Analytics || {};
      const t2 = this.hudData.team2Analytics || {};

      let railBodyHtml = '';
      if (this.activeRailTab === 'shotchart') {
        railBodyHtml = renderSvgHalfCourtShotChart(this.hudData, { compact: true, filterSide: this.shotChartFilter });
      } else if (this.activeRailTab === 'lineup') {
        railBodyHtml = renderOnCourt5v5AndStints(this.hudData, { compact: true });
      } else if (this.activeRailTab === 'fourfactors') {
        railBodyHtml = `
          <div style="display:flex;flex-direction:column;gap:8px;font-size:11px;">
            <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:8px;">
              <div style="font-weight:800;color:#00f2fe;margin-bottom:6px;">DEAN OLIVER FOUR FACTORS</div>
              <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>eFG% (40%)</span><strong>${esc(t1.abbreviation)} ${t1.efgPct}% vs ${esc(t2.abbreviation)} ${t2.efgPct}%</strong></div>
              <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>xEFG% (Shot Quality)</span><strong>${esc(t1.abbreviation)} ${t1.xEfgPct}% vs ${esc(t2.abbreviation)} ${t2.xEfgPct}%</strong></div>
              <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>TOV% (25%)</span><strong>${esc(t1.abbreviation)} ${t1.fourFactors?.tovPct}% vs ${esc(t2.abbreviation)} ${t2.fourFactors?.tovPct}%</strong></div>
              <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>ORB% (20%)</span><strong>${esc(t1.abbreviation)} ${t1.fourFactors?.orbPct}% vs ${esc(t2.abbreviation)} ${t2.fourFactors?.orbPct}%</strong></div>
              <div style="display:flex;justify-content:space-between;"><span>FT Rate (15%)</span><strong>${esc(t1.abbreviation)} ${t1.fourFactors?.ftRate}% vs ${esc(t2.abbreviation)} ${t2.fourFactors?.ftRate}%</strong></div>
            </div>
            ${renderSynergyPlayTypes({ team1Analytics: t1 })}
          </div>
        `;
      } else if (this.activeRailTab === 'worm') {
        railBodyHtml = renderWinProbWormChart(this.hudData);
      }

      this.rightRail.innerHTML = `
        <div class="fbs-lbar-tabs">
          <button type="button" class="fbs-lbar-tab ${this.activeRailTab === 'shotchart' ? 'active' : ''}" data-rail-tab="shotchart">🎯 Shot Map</button>
          <button type="button" class="fbs-lbar-tab ${this.activeRailTab === 'lineup' ? 'active' : ''}" data-rail-tab="lineup">👥 5v5 Floor</button>
          <button type="button" class="fbs-lbar-tab ${this.activeRailTab === 'fourfactors' ? 'active' : ''}" data-rail-tab="fourfactors">📐 4 Factors</button>
          <button type="button" class="fbs-lbar-tab ${this.activeRailTab === 'worm' ? 'active' : ''}" data-rail-tab="worm">📈 WPA Worm</button>
        </div>
        <div class="fbs-lbar-body">
          ${railBodyHtml}
        </div>
      `;

      this.rightRail.querySelectorAll('[data-rail-tab]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.activeRailTab = btn.getAttribute('data-rail-tab');
          this.renderLBarRails();
        });
      });

      this.rightRail.querySelectorAll('[data-sc-filter]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.shotChartFilter = btn.getAttribute('data-sc-filter');
          this.renderLBarRails();
        });
      });

      // Bottom Rail: Live Quarter Linescore + MVP Pace Projection + Stint Momentum
      const mvp = this.hudData.mvpPerformer;
      const ls = this.hudData.linescore;
      this.bottomRail.innerHTML = `
        <div class="fbs-lbar-bottom-cell">
          <div style="font-size:10px;font-weight:800;color:#00f2fe;margin-bottom:3px;">📊 LIVE LINESCORE &amp; PACE</div>
          <div style="font-size:11px;color:#e2e8f0;font-family:monospace;">
            ${esc(t1.abbreviation)}: ${(ls?.team1Quarters || []).join(' | ')} = <strong>${t1.score}</strong><br>
            ${esc(t2.abbreviation)}: ${(ls?.team2Quarters || []).join(' | ')} = <strong>${t2.score}</strong>
          </div>
        </div>
        <div class="fbs-lbar-bottom-cell">
          <div style="font-size:10px;font-weight:800;color:#fbbf24;margin-bottom:3px;">🌟 PEAK FLOOR IMPACT (GMSC / BPM / WPA)</div>
          <div style="font-size:11px;color:#fff;font-weight:700;">
            ${mvp ? `${esc(mvp.name)} (${esc(mvp.teamAbbr)}): ${mvp.pts} PTS, ${mvp.reb} REB, ${mvp.ast} AST • ${mvp.gameScore} GmSc • +${mvp.bpm} BPM • +${mvp.wpa}% WPA` : 'Calculating live player impact...'}
          </div>
          <div style="font-size:10px;color:#94a3b8;">
            ${mvp?.projected48?.milestoneAlert ? `🚀 ${esc(mvp.projected48.milestoneAlert)}` : `48-Min Pace: ${t1.pace || 99.4} Possessions`}
          </div>
        </div>
        <div class="fbs-lbar-bottom-cell">
          <div style="font-size:10px;font-weight:800;color:#a78bfa;margin-bottom:3px;">⚡ ACTIVE STINT &amp; SHOT QUALITY</div>
          <div style="font-size:11px;color:#e2e8f0;">
            ${esc(this.hudData.onCourtLineup?.activeStintMargin || 'Balanced rotation stint')}
          </div>
          <div style="font-size:10px;color:#10b981;">
            ${esc(t1.abbreviation)} xEFG: ${t1.xEfgPct}% | ${esc(t2.abbreviation)} xEFG: ${t2.xEfgPct}%
          </div>
        </div>
      `;
    }
  }

  /**
   * Mount Persistent Smart Mini-Player Dock inside /basketball.html (Research Lab)
   */
  function mountResearchLabSmartDock() {
    const params = new URLSearchParams(window.location.search);
    const dockParam = params.get('dock');
    const saved = getSavedDockStream();
    const activeStreamKey = dockParam || saved?.stream_key;
    if (!activeStreamKey) return;

    const streamCategory = saved?.category || 'basketball';
    const streamTitle = saved?.name || activeStreamKey;

    if (document.getElementById('fbs-research-smart-dock')) return;

    const dockEl = document.createElement('div');
    dockEl.id = 'fbs-research-smart-dock';
    dockEl.className = 'fbs-research-smart-dock';
    dockEl.innerHTML = `
      <div class="fbs-rsd-header">
        <div style="display:flex;align-items:center;gap:6px;overflow:hidden;">
          <span class="dot" style="width:7px;height:7px;border-radius:50%;background:#ef4444;display:inline-block;"></span>
          <span style="font-size:11px;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" id="fbs-rsd-title">${esc(streamTitle)}</span>
        </div>
        <div style="display:flex;gap:4px;">
          <button type="button" class="fbs-rsd-btn" id="fbs-rsd-expand" title="Open Full Smart Screen Player">⛶</button>
          <button type="button" class="fbs-rsd-btn" id="fbs-rsd-minimize" title="Minimize / Restore Mini-Player">_</button>
          <button type="button" class="fbs-rsd-btn" id="fbs-rsd-close" title="Close Dock">&times;</button>
        </div>
      </div>
      <div class="fbs-rsd-video-wrap" id="fbs-rsd-video-wrap">
        <iframe src="/embed/${encodeURIComponent(streamCategory)}/${encodeURIComponent(activeStreamKey)}" allow="autoplay; fullscreen" allowfullscreen style="width:100%;height:100%;border:0;"></iframe>
      </div>
      <div class="fbs-rsd-telemetry" id="fbs-rsd-telemetry">
        <span>Loading live Smart Screen telemetry...</span>
      </div>
    `;

    document.body.appendChild(dockEl);

    document.getElementById('fbs-rsd-close')?.addEventListener('click', () => {
      dockEl.remove();
    });

    document.getElementById('fbs-rsd-minimize')?.addEventListener('click', () => {
      dockEl.classList.toggle('minimized');
    });

    document.getElementById('fbs-rsd-expand')?.addEventListener('click', () => {
      window.location.href = `/player.html?key=${encodeURIComponent(activeStreamKey)}&category=${encodeURIComponent(streamCategory)}`;
    });

    // Fetch live HUD summary for the docked mini-player
    const refreshDockHud = async () => {
      try {
        const res = await fetch(`/api/v1/basketball/smart-hud/${encodeURIComponent(activeStreamKey)}?t=${Date.now()}`);
        if (res.ok) {
          const hud = await res.json();
          const t1 = hud.team1Analytics || {};
          const t2 = hud.team2Analytics || {};
          const telEl = document.getElementById('fbs-rsd-telemetry');
          if (telEl) {
            telEl.innerHTML = `
              <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
                <strong>${esc(t1.abbreviation || 'TM1')} ${t1.score ?? 0} - ${t2.score ?? 0} ${esc(t2.abbreviation || 'TM2')}</strong>
                <span style="color:#00f2fe;">eFG: ${t1.efgPct}%/${t2.efgPct}%</span>
                <span style="color:#fbbf24;">${hud.leverageIndex || 1.8}x LI</span>
              </div>
            `;
          }
        }
      } catch (e) {}
    };
    refreshDockHud();
    setInterval(refreshDockHud, 15000);
  }

  // Global keyboard shortcuts (L = L-Bar Squeeze-Back, H = Glass HUD) when not typing in an input
  document.addEventListener('keydown', (e) => {
    const tag = (e.target?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    const activeCtrl = window.fbsActiveSmartScreen;
    if (!activeCtrl) return;
    if (e.key === 'l' || e.key === 'L') {
      activeCtrl.setMode(activeCtrl.mode === 'lbar' ? 'triggers' : 'lbar');
    } else if (e.key === 'h' || e.key === 'H') {
      activeCtrl.setMode(activeCtrl.mode === 'hud' ? 'triggers' : 'hud');
    }
  });

  window.FreeBallStatsSmartScreen = {
    SmartScreenController,
    renderSvgHalfCourtShotChart,
    renderOnCourt5v5AndStints,
    renderWinProbWormChart,
    renderSynergyPlayTypes,
    saveActiveStreamForDock,
    mountResearchLabSmartDock,
  };
})();
