/**
 * Free_BallStats v3.1 — Multi-Sport Smart Screen Interactive Broadcast Canvas & Telemetry Visualizers
 * Supports NBA, College Basketball (NCAAB), Soccer (Opta/StatsBomb xG), NFL (Next Gen Stats EPA),
 * College Football (NCAAF), and NHL Hockey (MoneyPuck/Natural Stat Trick Corsi & xGF).
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

  function getSportSurfaceType(hudData) {
    if (!hudData) return 'basketball_halfcourt';
    if (hudData.surfaceType) return hudData.surfaceType;
    if (hudData.shotChart?.surfaceType) return hudData.shotChart.surfaceType;
    if (hudData.sportAnalytics?.surfaceType) return hudData.sportAnalytics.surfaceType;
    return 'basketball_halfcourt';
  }

  /**
   * Render Multi-Sport Spatial Map:
   *  - basketball_halfcourt: CourtOptix 6-Zone Half-Court SVG Shot Chart (NBA & NCAAB)
   *  - soccer_pitch: Opta / StatsBomb 105x68m Pitch Shot & xG Map
   *  - football_field: Next Gen Stats 100-Yard Turf Drive & Air-Yards Map (NFL & NCAAF)
   *  - hockey_rink: NHL Edge / MoneyPuck 200x85ft Ice Rink & High-Danger Slot Map
   */
  function renderSvgHalfCourtShotChart(hudData, opts = {}) {
    if (!hudData) {
      return '<div style="padding:16px;color:#94a3b8;text-align:center;">Spatial telemetry loading...</div>';
    }
    const surfaceType = getSportSurfaceType(hudData);
    const sa = hudData.sportAnalytics;
    const compact = Boolean(opts.compact);
    const filterSide = opts.filterSide || 'all';

    const t1 = hudData.team1Analytics || sa?.team1Meta || hudData.scoreboard?.team1 || {};
    const t2 = hudData.team2Analytics || sa?.team2Meta || hudData.scoreboard?.team2 || {};
    const t1Abbr = t1.abbreviation || (t1.name ? t1.name.slice(0, 3).toUpperCase() : 'TM1');
    const t2Abbr = t2.abbreviation || (t2.name ? t2.name.slice(0, 3).toUpperCase() : 'TM2');

    // Non-NBA spatial events from sportAnalytics.spatialMap or shotChart.shots
    const rawEvents = sa?.spatialMap?.events || hudData.shotChart?.shots || [];
    const filteredEvents = rawEvents.filter((s) => {
      const side = s.teamSide || s.team;
      if (filterSide === 'team1') return side === 'team1';
      if (filterSide === 'team2') return side === 'team2';
      return true;
    });

    const formatZoneCard = (z) => {
      const zName = z.zoneName || z.label || z.zoneKey || 'Zone';
      const t1Stat = z.team1Stat || `${z.team1Volume || ''} (${z.team1Efficiency || ''})`;
      const t2Stat = z.team2Stat || `${z.team2Volume || ''} (${z.team2Efficiency || ''})`;
      const deltaLbl = z.deltaLabel || (z.benchmarkEfficiency ? `Benchmark: ${z.benchmarkEfficiency} • Edge: ${z.edge === 'team1' ? t1Abbr : z.edge === 'team2' ? t2Abbr : 'Even'}` : '');
      return `
        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:6px 8px;font-size:10px;">
          <div style="font-weight:800;color:#e2e8f0;margin-bottom:2px;">${esc(zName)}</div>
          <div style="display:flex;justify-content:space-between;color:#cbd5e1;gap:6px;">
            <span style="color:#00f2fe;">${esc(t1Abbr)}: ${esc(t1Stat)}</span>
            <span style="color:#fb923c;">${esc(t2Abbr)}: ${esc(t2Stat)}</span>
          </div>
          <div style="font-size:9px;color:#10b981;margin-top:2px;">${esc(deltaLbl)}</div>
        </div>`;
    };

    const filterButtonsHtml = `
      <div class="fbs-shotchart-filters" style="display:flex;gap:4px;">
        <button type="button" class="fbs-sc-filter-btn ${filterSide === 'all' ? 'active' : ''}" data-sc-filter="all">All</button>
        <button type="button" class="fbs-sc-filter-btn ${filterSide === 'team1' ? 'active' : ''}" data-sc-filter="team1">${esc(t1Abbr)}</button>
        <button type="button" class="fbs-sc-filter-btn ${filterSide === 'team2' ? 'active' : ''}" data-sc-filter="team2">${esc(t2Abbr)}</button>
        <button type="button" class="fbs-sc-filter-btn ${filterSide === 'zones' ? 'active' : ''}" data-sc-filter="zones">Zones</button>
      </div>
    `;

    // 1. SOCCER PITCH (105x68m Opta / StatsBomb xG Map)
    if (surfaceType === 'soccer_pitch') {
      const sp = sa?.spatialMap || {};
      const markersSvg =
        filterSide === 'zones'
          ? ''
          : filteredEvents
              .map((ev) => {
                const side = ev.teamSide || ev.team;
                const isT1 = side === 'team1';
                const evAbbr = ev.teamAbbr || (isT1 ? t1Abbr : t2Abbr);
                const isGoal = ev.isSuccess === true || ev.outcome === 'score' || ev.made === true;
                const isSaved = !isGoal && (ev.isHighValue === true || ev.outcome === 'saved_or_complete' || (ev.outcomeLabel || '').toLowerCase().includes('save') || (ev.outcomeLabel || '').toLowerCase().includes('post'));
                const color = isGoal ? '#fbbf24' : isT1 ? '#00f2fe' : '#f97316';
                const r = compact ? 5.5 : 6.8;
                const cx = ev.x <= 100 ? 20 + (ev.x / 100) * 460 : ev.x;
                const cy = ev.y <= 100 ? 15 + (ev.y / 100) * 290 : ev.y;
                const lbl = ev.outcomeLabel || ev.metricLabel || ev.shotType || '';
                if (isGoal) {
                  return `<g transform="translate(${cx.toFixed(1)}, ${cy.toFixed(1)})">
                    <circle cx="0" cy="0" r="${r + 2.5}" fill="rgba(251,191,36,0.28)" stroke="#fbbf24" stroke-width="1.8"/>
                    <circle cx="0" cy="0" r="${r - 1}" fill="#fbbf24"/>
                    <title>⚽ GOAL • ${esc(ev.playerName)} (${esc(evAbbr)}) • ${esc(ev.period)} • ${esc(lbl)}</title>
                  </g>`;
                }
                if (isSaved) {
                  return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r}" fill="${color}" stroke="#04120c" stroke-width="1.5" opacity="0.9">
                    <title>🎯 ON TARGET • ${esc(ev.playerName)} (${esc(evAbbr)}) • ${esc(ev.period)} • ${esc(lbl)}</title>
                  </circle>`;
                }
                return `<g opacity="0.78">
                  <line x1="${(cx - 4.5).toFixed(1)}" y1="${(cy - 4.5).toFixed(1)}" x2="${(cx + 4.5).toFixed(1)}" y2="${(cy + 4.5).toFixed(1)}" stroke="${color}" stroke-width="2"/>
                  <line x1="${(cx + 4.5).toFixed(1)}" y1="${(cy - 4.5).toFixed(1)}" x2="${(cx - 4.5).toFixed(1)}" y2="${(cy + 4.5).toFixed(1)}" stroke="${color}" stroke-width="2"/>
                  <title>✕ OFF TARGET / BLOCKED • ${esc(ev.playerName)} (${esc(evAbbr)}) • ${esc(lbl)}</title>
                </g>`;
              })
              .join('');

      const zonesHtml = (sp.zones || []).map(formatZoneCard).join('');

      return `
        <div class="fbs-shotchart-wrap">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:8px;flex-wrap:wrap;">
            <div style="font-size:11px;font-weight:800;color:#e2e8f0;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <span>⚽ ${esc(sp.title || 'OPTA / STATSBOMB PITCH xG & SHOT MAP')}</span>
              <span style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(0,242,254,0.12);color:#00f2fe;">${esc(sp.team1SummaryBadge || sp.team1PrimaryMetric || t1Abbr)}</span>
              <span style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(249,115,22,0.14);color:#fb923c;">${esc(sp.team2SummaryBadge || sp.team2PrimaryMetric || t2Abbr)}</span>
            </div>
            ${filterButtonsHtml}
          </div>

          <svg viewBox="0 0 500 320" style="width:100%;height:auto;max-height:${compact ? '215px' : '295px'};background:linear-gradient(180deg, #062319 0%, #041610 100%);border:1px solid rgba(16,185,129,0.28);border-radius:10px;display:block;">
            <!-- Pitch Turf Stripes -->
            <rect x="20" y="15" width="46" height="290" fill="rgba(255,255,255,0.015)"/>
            <rect x="112" y="15" width="46" height="290" fill="rgba(255,255,255,0.015)"/>
            <rect x="204" y="15" width="46" height="290" fill="rgba(255,255,255,0.015)"/>
            <rect x="296" y="15" width="46" height="290" fill="rgba(255,255,255,0.015)"/>
            <rect x="388" y="15" width="46" height="290" fill="rgba(255,255,255,0.015)"/>
            <!-- Outer Pitch Boundary -->
            <rect x="20" y="15" width="460" height="290" fill="none" stroke="rgba(255,255,255,0.42)" stroke-width="2"/>
            <!-- Halfway Line & Center Circle -->
            <line x1="250" y1="15" x2="250" y2="305" stroke="rgba(255,255,255,0.35)" stroke-width="1.8"/>
            <circle cx="250" cy="160" r="42" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.8"/>
            <circle cx="250" cy="160" r="3" fill="#fff"/>
            <!-- Left Penalty Area & 6-Yard Box -->
            <rect x="20" y="75" width="76" height="170" fill="rgba(249,115,22,0.06)" stroke="rgba(255,255,255,0.38)" stroke-width="1.8"/>
            <rect x="20" y="120" width="28" height="80" fill="none" stroke="rgba(255,255,255,0.38)" stroke-width="1.5"/>
            <path d="M 96 130 A 34 34 0 0 1 96 190" fill="none" stroke="rgba(255,255,255,0.32)" stroke-width="1.5"/>
            <!-- Right Penalty Area & 6-Yard Box -->
            <rect x="404" y="75" width="76" height="170" fill="rgba(0,242,254,0.06)" stroke="rgba(255,255,255,0.38)" stroke-width="1.8"/>
            <rect x="452" y="120" width="28" height="80" fill="none" stroke="rgba(255,255,255,0.38)" stroke-width="1.5"/>
            <path d="M 404 130 A 34 34 0 0 0 404 190" fill="none" stroke="rgba(255,255,255,0.32)" stroke-width="1.5"/>
            <!-- Zone 14 Highlight Boxes -->
            <rect x="350" y="110" width="54" height="100" fill="rgba(0,242,254,0.05)" stroke="rgba(0,242,254,0.22)" stroke-dasharray="3 3"/>
            <rect x="96" y="110" width="54" height="100" fill="rgba(249,115,22,0.05)" stroke="rgba(249,115,22,0.22)" stroke-dasharray="3 3"/>
            <text x="35" y="30" fill="#fb923c" font-size="9" font-weight="800">← ${esc(t2Abbr)} ATTACKING</text>
            <text x="465" y="30" text-anchor="end" fill="#00f2fe" font-size="9" font-weight="800">${esc(t1Abbr)} ATTACKING →</text>
            ${markersSvg}
          </svg>

          <div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#94a3b8;margin-top:6px;">
            <span><strong style="color:#fbbf24;">●</strong> Goal &nbsp; <strong style="color:#00f2fe;">●</strong> ${esc(t1Abbr)} On-Target &nbsp; <strong style="color:#f97316;">●</strong> ${esc(t2Abbr)} On-Target &nbsp; <strong>✕</strong> Off/Blocked</span>
            <span>Hover markers for xG, PSxG &amp; Shot Zone</span>
          </div>
          ${!compact && zonesHtml ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:6px;margin-top:8px;">${zonesHtml}</div>` : ''}
        </div>
      `;
    }

    // 2. FOOTBALL FIELD (100-Yard NFL & College Football Turf Map)
    if (surfaceType === 'football_field') {
      const sp = sa?.spatialMap || {};
      const markersSvg =
        filterSide === 'zones'
          ? ''
          : filteredEvents
              .map((ev) => {
                const side = ev.teamSide || ev.team;
                const isT1 = side === 'team1';
                const evAbbr = ev.teamAbbr || (isT1 ? t1Abbr : t2Abbr);
                const lbl = ev.outcomeLabel || ev.metricLabel || '';
                const isTd = lbl.toUpperCase().includes('TOUCHDOWN') || lbl.toUpperCase().includes('TD') || ev.outcome === 'score';
                const isComplete = !isTd && (ev.isSuccess === true || ev.isHighValue === true || ev.outcome === 'saved_or_complete');
                const color = isTd ? '#fbbf24' : isT1 ? '#00f2fe' : '#f97316';
                const r = compact ? 5.5 : 6.8;
                const cx = ev.x <= 100 ? 55 + (ev.x / 100) * 390 : ev.x;
                const cy = ev.y <= 100 ? 15 + (ev.y / 100) * 250 : ev.y;
                if (isTd) {
                  return `<g transform="translate(${cx.toFixed(1)}, ${cy.toFixed(1)})">
                    <circle cx="0" cy="0" r="${r + 2.5}" fill="rgba(251,191,36,0.3)" stroke="#fbbf24" stroke-width="1.8"/>
                    <circle cx="0" cy="0" r="${r - 1}" fill="#fbbf24"/>
                    <title>🏈 TOUCHDOWN • ${esc(ev.playerName)} (${esc(evAbbr)}) • ${esc(ev.period)} ${esc(ev.clock)} • ${esc(lbl)}</title>
                  </g>`;
                }
                if (isComplete) {
                  return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r}" fill="${color}" stroke="#04120c" stroke-width="1.5" opacity="0.92">
                    <title>⚡ EXPLOSIVE GAIN • ${esc(ev.playerName)} (${esc(evAbbr)}) • ${esc(ev.period)} ${esc(ev.clock)} • ${esc(lbl)}</title>
                  </circle>`;
                }
                return `<g opacity="0.8">
                  <line x1="${(cx - 4.5).toFixed(1)}" y1="${(cy - 4.5).toFixed(1)}" x2="${(cx + 4.5).toFixed(1)}" y2="${(cy + 4.5).toFixed(1)}" stroke="#ef4444" stroke-width="2"/>
                  <line x1="${(cx + 4.5).toFixed(1)}" y1="${(cy - 4.5).toFixed(1)}" x2="${(cx - 4.5).toFixed(1)}" y2="${(cy + 4.5).toFixed(1)}" stroke="#ef4444" stroke-width="2"/>
                  <title>✕ INCOMPLETE / SACK • ${esc(ev.playerName)} (${esc(evAbbr)}) • ${esc(lbl)}</title>
                </g>`;
              })
              .join('');

      const zonesHtml = (sp.zones || []).map(formatZoneCard).join('');

      return `
        <div class="fbs-shotchart-wrap">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:8px;flex-wrap:wrap;">
            <div style="font-size:11px;font-weight:800;color:#e2e8f0;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <span>🏈 ${esc(sp.title || 'NEXT GEN STATS 100-YARD FIELD & EPA MAP')}</span>
              <span style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(0,242,254,0.12);color:#00f2fe;">${esc(sp.team1SummaryBadge || sp.team1PrimaryMetric || t1Abbr)}</span>
              <span style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(249,115,22,0.14);color:#fb923c;">${esc(sp.team2SummaryBadge || sp.team2PrimaryMetric || t2Abbr)}</span>
            </div>
            ${filterButtonsHtml}
          </div>

          <svg viewBox="0 0 500 280" style="width:100%;height:auto;max-height:${compact ? '205px' : '275px'};background:linear-gradient(180deg, #072116 0%, #05160e 100%);border:1px solid rgba(16,185,129,0.3);border-radius:10px;display:block;">
            <!-- Endzones -->
            <rect x="15" y="15" width="40" height="250" fill="rgba(249,115,22,0.18)" stroke="rgba(255,255,255,0.4)" stroke-width="1.8"/>
            <rect x="445" y="15" width="40" height="250" fill="rgba(0,242,254,0.18)" stroke="rgba(255,255,255,0.4)" stroke-width="1.8"/>
            <!-- Red Zone Shading (Inside 20s) -->
            <rect x="55" y="15" width="78" height="250" fill="rgba(239,68,68,0.06)"/>
            <rect x="367" y="15" width="78" height="250" fill="rgba(239,68,68,0.06)"/>
            <!-- Outer Field -->
            <rect x="15" y="15" width="470" height="250" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="2"/>
            <!-- Yard Lines every 10 yards (390px / 10 = 39px per 10 yds) -->
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9]
              .map((idx) => {
                const x = 55 + idx * 39;
                const ydNum = idx <= 5 ? idx * 10 : (10 - idx) * 10;
                return `
                  <line x1="${x}" y1="15" x2="${x}" y2="265" stroke="rgba(255,255,255,${idx === 5 ? '0.45' : '0.22'})" stroke-width="${idx === 5 ? '2' : '1.2'}"/>
                  <text x="${x}" y="32" text-anchor="middle" fill="rgba(255,255,255,0.45)" font-size="9" font-weight="800">${ydNum}</text>
                  <text x="${x}" y="256" text-anchor="middle" fill="rgba(255,255,255,0.45)" font-size="9" font-weight="800">${ydNum}</text>
                `;
              })
              .join('')}
            <text x="35" y="144" text-anchor="middle" fill="#fb923c" font-size="10" font-weight="900" transform="rotate(-90 35 144)">${esc(t2Abbr)} ENDZONE</text>
            <text x="465" y="144" text-anchor="middle" fill="#00f2fe" font-size="10" font-weight="900" transform="rotate(90 465 144)">${esc(t1Abbr)} ENDZONE</text>
            ${markersSvg}
          </svg>

          <div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#94a3b8;margin-top:6px;">
            <span><strong style="color:#fbbf24;">●</strong> Touchdown &nbsp; <strong style="color:#00f2fe;">●</strong> ${esc(t1Abbr)} Explosive Play &nbsp; <strong style="color:#f97316;">●</strong> ${esc(t2Abbr)} Explosive Play &nbsp; <strong style="color:#ef4444;">✕</strong> Inc/Sack</span>
            <span>Hover plays for EPA &amp; Yardage</span>
          </div>
          ${!compact && zonesHtml ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:6px;margin-top:8px;">${zonesHtml}</div>` : ''}
        </div>
      `;
    }

    // 3. HOCKEY RINK (200x85ft NHL Edge / MoneyPuck Ice Rink & Slot Map)
    if (surfaceType === 'hockey_rink') {
      const sp = sa?.spatialMap || {};
      const markersSvg =
        filterSide === 'zones'
          ? ''
          : filteredEvents
              .map((ev) => {
                const side = ev.teamSide || ev.team;
                const isT1 = side === 'team1';
                const evAbbr = ev.teamAbbr || (isT1 ? t1Abbr : t2Abbr);
                const lbl = ev.outcomeLabel || ev.metricLabel || '';
                const isGoal = ev.isSuccess === true || ev.outcome === 'score' || ev.made === true;
                const isSaved = !isGoal && (ev.isHighValue === true || ev.outcome === 'saved_or_complete' || lbl.toLowerCase().includes('save') || lbl.toLowerCase().includes('pipe'));
                const color = isGoal ? '#fbbf24' : isT1 ? '#00f2fe' : '#f97316';
                const r = compact ? 5.5 : 6.5;
                const cx = ev.x <= 100 ? 50 + (ev.x / 100) * 400 : ev.x;
                const cy = ev.y <= 100 ? 22 + (ev.y / 100) * 216 : ev.y;
                if (isGoal) {
                  return `<g transform="translate(${cx.toFixed(1)}, ${cy.toFixed(1)})">
                    <circle cx="0" cy="0" r="${r + 2.5}" fill="rgba(251,191,36,0.3)" stroke="#fbbf24" stroke-width="1.8"/>
                    <circle cx="0" cy="0" r="${r - 1}" fill="#fbbf24"/>
                    <title>🚨 GOAL • ${esc(ev.playerName)} (${esc(evAbbr)}) • ${esc(ev.period)} ${esc(ev.clock)} • ${esc(lbl)}</title>
                  </g>`;
                }
                if (isSaved) {
                  return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r}" fill="${color}" stroke="#06101e" stroke-width="1.5" opacity="0.9">
                    <title>🥅 SHOT ON GOAL (SAVED) • ${esc(ev.playerName)} (${esc(evAbbr)}) • ${esc(lbl)}</title>
                  </circle>`;
                }
                return `<g opacity="0.75">
                  <line x1="${(cx - 4.5).toFixed(1)}" y1="${(cy - 4.5).toFixed(1)}" x2="${(cx + 4.5).toFixed(1)}" y2="${(cy + 4.5).toFixed(1)}" stroke="${color}" stroke-width="2"/>
                  <line x1="${(cx + 4.5).toFixed(1)}" y1="${(cy - 4.5).toFixed(1)}" x2="${(cx - 4.5).toFixed(1)}" y2="${(cy + 4.5).toFixed(1)}" stroke="${color}" stroke-width="2"/>
                  <title>✕ MISSED / BLOCKED • ${esc(ev.playerName)} (${esc(evAbbr)}) • ${esc(lbl)}</title>
                </g>`;
              })
              .join('');

      const zonesHtml = (sp.zones || []).map(formatZoneCard).join('');

      return `
        <div class="fbs-shotchart-wrap">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:8px;flex-wrap:wrap;">
            <div style="font-size:11px;font-weight:800;color:#e2e8f0;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <span>🏒 ${esc(sp.title || 'MONEYPUCK / NHL EDGE ICE RINK & HIGH-DANGER SLOT MAP')}</span>
              <span style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(0,242,254,0.12);color:#00f2fe;">${esc(sp.team1SummaryBadge || sp.team1PrimaryMetric || t1Abbr)}</span>
              <span style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(249,115,22,0.14);color:#fb923c;">${esc(sp.team2SummaryBadge || sp.team2PrimaryMetric || t2Abbr)}</span>
            </div>
            ${filterButtonsHtml}
          </div>

          <svg viewBox="0 0 500 260" style="width:100%;height:auto;max-height:${compact ? '200px' : '265px'};background:linear-gradient(180deg, #0b192c 0%, #071120 100%);border:1px solid rgba(56,189,248,0.3);border-radius:14px;display:block;">
            <!-- Outer Rink Boards -->
            <rect x="15" y="15" width="470" height="230" rx="46" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="2.2"/>
            <!-- Goal Lines -->
            <line x1="50" y1="22" x2="50" y2="238" stroke="rgba(239,68,68,0.5)" stroke-width="1.5"/>
            <line x1="450" y1="22" x2="450" y2="238" stroke="rgba(239,68,68,0.5)" stroke-width="1.5"/>
            <!-- Blue Lines & Center Red Line -->
            <line x1="175" y1="15" x2="175" y2="245" stroke="rgba(56,189,248,0.55)" stroke-width="3"/>
            <line x1="250" y1="15" x2="250" y2="245" stroke="rgba(239,68,68,0.65)" stroke-width="2.5" stroke-dasharray="6 4"/>
            <line x1="325" y1="15" x2="325" y2="245" stroke="rgba(56,189,248,0.55)" stroke-width="3"/>
            <!-- Center Ice Faceoff Circle -->
            <circle cx="250" cy="130" r="34" fill="none" stroke="rgba(56,189,248,0.4)" stroke-width="1.5"/>
            <!-- High-Danger Home-Plate Slots -->
            <polygon points="50,105 95,85 125,130 95,175 50,155" fill="rgba(249,115,22,0.12)" stroke="rgba(249,115,22,0.35)" stroke-dasharray="3 3"/>
            <polygon points="450,105 405,85 375,130 405,175 450,155" fill="rgba(0,242,254,0.12)" stroke="rgba(0,242,254,0.35)" stroke-dasharray="3 3"/>
            <!-- Goal Creases -->
            <path d="M 50 116 A 14 14 0 0 1 50 144 Z" fill="rgba(56,189,248,0.35)" stroke="#ef4444" stroke-width="1.2"/>
            <path d="M 450 116 A 14 14 0 0 0 450 144 Z" fill="rgba(56,189,248,0.35)" stroke="#ef4444" stroke-width="1.2"/>
            <text x="62" y="34" fill="#fb923c" font-size="9" font-weight="800">← ${esc(t2Abbr)} OFFENSIVE ZONE</text>
            <text x="438" y="34" text-anchor="end" fill="#00f2fe" font-size="9" font-weight="800">${esc(t1Abbr)} OFFENSIVE ZONE →</text>
            ${markersSvg}
          </svg>

          <div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#94a3b8;margin-top:6px;">
            <span><strong style="color:#fbbf24;">●</strong> Goal &nbsp; <strong style="color:#00f2fe;">●</strong> ${esc(t1Abbr)} SOG &nbsp; <strong style="color:#f97316;">●</strong> ${esc(t2Abbr)} SOG &nbsp; <strong>✕</strong> Miss/Block</span>
            <span>Home-Plate Polygon = High-Danger Slot</span>
          </div>
          ${!compact && zonesHtml ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:6px;margin-top:8px;">${zonesHtml}</div>` : ''}
        </div>
      `;
    }

    // 4. BASKETBALL HALF-COURT (NBA & NCAAB CourtOptix 6-Zone Half-Court Map)
    const zones = filterSide === 'team2' ? (hudData.shotChart?.team2Zones || []) : (hudData.shotChart?.team1Zones || []);
    const activeTeamAbbr = filterSide === 'team2' ? t2Abbr : t1Abbr;

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
        : filteredEvents
            .map((s) => {
              const side = s.teamSide || s.team;
              const isT1 = side === 'team1';
              const sAbbr = s.teamAbbr || (isT1 ? t1Abbr : t2Abbr);
              const isMade = s.made !== undefined ? s.made : (s.isSuccess === true || s.outcome === 'score');
              const color = isMade ? (isT1 ? '#00f2fe' : '#f97316') : 'rgba(239, 68, 68, 0.78)';
              const label = s.outcomeLabel || s.metricLabel || `${s.value || 2}PT • ${s.shotType || 'Jumper'} • xEFG: ${s.xEfg || 52}%`;
              const sx = s.x <= 100 && sa?.sportType === 'ncaab' ? 30 + (s.x / 100) * 440 : s.x;
              const sy = s.y <= 100 && sa?.sportType === 'ncaab' ? 35 + (s.y / 100) * 330 : s.y;
              if (isMade) {
                return `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${compact ? 5.2 : 6}" fill="${color}" stroke="#06070a" stroke-width="1.5" opacity="0.92">
                  <title>${esc(s.playerName)} (${esc(sAbbr)}) • MADE • ${esc(label)} (${esc(s.period)} ${esc(s.clock)})</title>
                </circle>`;
              } else {
                const d = compact ? 4.2 : 4.8;
                return `<g opacity="0.72">
                  <line x1="${(sx - d).toFixed(1)}" y1="${(sy - d).toFixed(1)}" x2="${(sx + d).toFixed(1)}" y2="${(sy + d).toFixed(1)}" stroke="${color}" stroke-width="2"/>
                  <line x1="${(sx + d).toFixed(1)}" y1="${(sy - d).toFixed(1)}" x2="${(sx - d).toFixed(1)}" y2="${(sy + d).toFixed(1)}" stroke="${color}" stroke-width="2"/>
                  <title>${esc(s.playerName)} (${esc(sAbbr)}) • MISSED • ${esc(label)} (${esc(s.period)} ${esc(s.clock)})</title>
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
        if (!z || z.fgm === undefined) return '';
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
          <div style="font-size:11px;font-weight:800;color:#e2e8f0;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span>🎯 ${esc(sa?.spatialMap?.title || 'COURTOPTIX SPATIAL SHOT CHART')}</span>
            <span style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(0,242,254,0.12);color:#00f2fe;">
              ${esc(sa?.spatialMap?.team1SummaryBadge || sa?.spatialMap?.team1PrimaryMetric || `${t1Abbr} xEFG: ${t1.xEfgPct || 54.8}%`)}
            </span>
            <span style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(249,115,22,0.14);color:#fb923c;">
              ${esc(sa?.spatialMap?.team2SummaryBadge || sa?.spatialMap?.team2PrimaryMetric || `${t2Abbr} xEFG: ${t2.xEfgPct || 53.9}%`)}
            </span>
          </div>
          ${filterButtonsHtml}
        </div>

        <svg viewBox="0 0 500 420" style="width:100%;height:auto;max-height:${compact ? '220px' : '305px'};background:linear-gradient(180deg, #0b101b 0%, #070a12 100%);border:1px solid rgba(255,255,255,0.12);border-radius:10px;display:block;">
          <rect x="10" y="10" width="480" height="400" fill="${getZoneFill(ab3Zone.deltaVsLeague)}" opacity="0.35"/>
          <rect x="170" y="10" width="160" height="190" fill="${getZoneFill(paintZone.deltaVsLeague)}" stroke="rgba(255,255,255,0.28)" stroke-width="1.8"/>
          <path d="M 210 52.5 A 40 40 0 0 0 290 52.5 Z" fill="${getZoneFill(raZone.deltaVsLeague)}" stroke="rgba(0,242,254,0.45)" stroke-width="1.5"/>
          <circle cx="250" cy="200" r="60" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.5" stroke-dasharray="4 4"/>
          <line x1="30" y1="10" x2="30" y2="142" stroke="rgba(255,255,255,0.38)" stroke-width="2"/>
          <line x1="470" y1="10" x2="470" y2="142" stroke="rgba(255,255,255,0.38)" stroke-width="2"/>
          <path d="M 30 142 A 237.5 237.5 0 0 0 470 142" fill="none" stroke="rgba(255,255,255,0.38)" stroke-width="2"/>
          <line x1="220" y1="40" x2="280" y2="40" stroke="#e2e8f0" stroke-width="3"/>
          <circle cx="250" cy="52.5" r="9" fill="none" stroke="#f97316" stroke-width="2.5"/>
          <rect x="10" y="10" width="480" height="400" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
          <path d="M 190 410 A 60 60 0 0 1 310 410" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1.5"/>
          ${dotsSvg}
          ${zoneLabelsSvg}
        </svg>

        <div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#94a3b8;margin-top:6px;">
          <span><strong style="color:#00f2fe;">●</strong> ${esc(t1Abbr)} Make &nbsp; <strong style="color:#f97316;">●</strong> ${esc(t2Abbr)} Make &nbsp; <strong style="color:#ef4444;">✕</strong> Miss</span>
          <span>Zone Pills: <strong>${esc(activeTeamAbbr)}</strong> FG% &amp; Delta vs Avg</span>
        </div>
      </div>
    `;
  }

  /**
   * Render Active On-Field / On-Ice / On-Court Unit & Stint / Phase Timeline
   */
  function renderOnCourt5v5AndStints(hudData, opts = {}) {
    if (!hudData) {
      return '<div style="padding:14px;color:#94a3b8;">Loading active unit telemetry...</div>';
    }
    const compact = Boolean(opts.compact);
    const sa = hudData.sportAnalytics;

    // Multi-Sport Active Unit (Soccer XI/Shape, NFL Personnel, NHL Shift, NCAAB 5v5)
    if (sa && sa.activeUnit) {
      const au = sa.activeUnit;
      const t1Abbr = sa.team1Meta?.abbreviation || 'TM1';
      const t2Abbr = sa.team2Meta?.abbreviation || 'TM2';
      const renderUnitGroup = (players, abbr, formation, ratingLabel, accent) => `
        <div style="background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:4px;">
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="font-size:11px;font-weight:900;color:${accent};">${esc(abbr)} ACTIVE UNIT</span>
              <span style="font-size:10px;padding:1px 6px;border-radius:4px;background:rgba(255,255,255,0.07);color:#cbd5e1;">
                ${esc(formation || '')}
              </span>
            </div>
            <div style="font-size:10px;color:#10b981;font-weight:800;">${esc(ratingLabel || '')}</div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(84px, 1fr));gap:5px;">
            ${(players || []).slice(0, 5).map((p) => {
              const keyMet = p.keyMetric || p.primaryStat || '';
              const subMet = p.subMetric || `${p.efficiencyBadge || ''} ${p.impactVal ? '• ' + p.impactVal : ''}`.trim();
              const isHot = Boolean(p.highlight || p.isHot);
              return `
                <div style="background:rgba(6,7,10,0.75);border:1px solid ${isHot ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.07)'};border-radius:6px;padding:5px;text-align:center;cursor:pointer;" onclick="if(window.openAthleteProfile) window.openAthleteProfile('${esc(p.id)}', '${esc(sa.sportType)}', '${esc(p.name)}')">
                  <div style="font-size:9px;color:#94a3b8;font-weight:700;">${esc(p.position)} #${esc(p.jersey)}</div>
                  <div style="font-size:10.5px;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${esc(p.name)}">${esc(p.name.split(' ').slice(-1)[0])}</div>
                  <div style="font-size:9.5px;color:${accent};font-weight:800;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(keyMet)}</div>
                  <div style="font-size:8.5px;color:#cbd5e1;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(subMet)}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;

      const stintsList = sa.stintTimeline || au.stintTimeline || [];
      const stintsHtml = compact
        ? ''
        : `
          <div style="margin-top:8px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:8px;">
            <div style="font-size:10px;font-weight:800;color:#a78bfa;margin-bottom:6px;text-transform:uppercase;">
              🔄 TACTICAL PHASE &amp; STINT FLOW • ${esc(au.activePhaseSummary || sa.situationBanner || '')}
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:6px;">
              ${stintsList.map((st) => {
                const lbl = st.label || st.periodLabel || '';
                const subRange = st.startMark ? `${st.startMark} → ${st.endMark}` : (st.timeRange || '');
                const summaryTxt = st.summary || st.headline || '';
                const swingTxt = st.dominantTeam ? `${st.dominantTeam} ${st.netSwing}` : (st.netDiff >= 0 ? `${t1Abbr} +${st.netDiff}` : `${t2Abbr} ${st.netDiff}`);
                return `
                  <div style="background:rgba(0,0,0,0.45);border-left:3px solid #00f2fe;padding:6px 8px;border-radius:4px;font-size:10.5px;">
                    <div style="display:flex;justify-content:space-between;font-weight:800;color:#e2e8f0;">
                      <span>${esc(lbl)}</span>
                      <span style="color:#00f2fe;">${esc(swingTxt)}</span>
                    </div>
                    <div style="font-size:9.5px;color:#94a3b8;margin-top:2px;">${esc(subRange)} (${st.team1Score}-${st.team2Score})</div>
                    <div style="font-size:9.5px;color:#cbd5e1;margin-top:2px;">${esc(summaryTxt)}</div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;

      return `
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${renderUnitGroup(au.team1Players, t1Abbr, au.team1Formation || au.team1Scheme, au.team1UnitRatingLabel || au.team1NetMetric, '#00f2fe')}
          ${renderUnitGroup(au.team2Players, t2Abbr, au.team2Formation || au.team2Scheme, au.team2UnitRatingLabel || au.team2NetMetric, '#f97316')}
          ${stintsHtml}
        </div>
      `;
    }

    if (!hudData.onCourtLineup) {
      return '<div style="padding:14px;color:#94a3b8;">Loading active 5v5 on-court lineups...</div>';
    }
    const oc = hudData.onCourtLineup;
    const t1 = hudData.team1Analytics || {};
    const t2 = hudData.team2Analytics || {};
    const bonus = hudData.bonusState || {};
    const isPreGame =
      hudData.gameState === 'pre' ||
      (!hudData.isLive && Number(t1.score || 0) === 0 && Number(t2.score || 0) === 0);

    const renderFiveRow = (players, abbr, unitNetRtg, inBonus, foulsInPeriod, accent) => `
      <div style="background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:11px;font-weight:900;color:${accent};">${esc(abbr)} ${isPreGame ? 'PROJECTED 5' : 'ON-COURT 5'}</span>
            <span style="font-size:10px;padding:1px 6px;border-radius:4px;background:rgba(255,255,255,0.07);color:#cbd5e1;">
              Unit NetRTG: <strong>${unitNetRtg >= 0 ? '+' : ''}${unitNetRtg}</strong>
            </span>
          </div>
          <div style="font-size:10px;color:${inBonus ? '#f59e0b' : '#94a3b8'};font-weight:700;">
            ${isPreGame ? 'Season Scouting Avg' : `Fouls: ${foulsInPeriod ?? 0} ${inBonus ? '• BONUS' : ''}`}
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
                  <span style="color:${foulWarn ? '#f87171' : '#94a3b8'};">${isPreGame ? 'AVG' : `${p.pf}PF`}</span>
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
    const timeline = hudData?.winProbTimeline || hudData?.sportAnalytics?.winProbTimeline || [];
    if (!Array.isArray(timeline) || timeline.length === 0) {
      return '<div style="padding:12px;color:#94a3b8;">Win probability timeline loading...</div>';
    }
    const pts = timeline;
    const sa = hudData.sportAnalytics;
    const t1Abbr = hudData.team1Analytics?.abbreviation || sa?.team1Meta?.abbreviation || 'TM1';
    const t2Abbr = hudData.team2Analytics?.abbreviation || sa?.team2Meta?.abbreviation || 'TM2';
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
            📈 WIN PROBABILITY WORM &amp; LEVERAGE INDEX
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            <span style="font-size:10px;padding:2px 7px;border-radius:999px;background:rgba(245,158,11,0.18);color:#fbbf24;font-weight:800;">
              Leverage Index: ${hudData.leverageIndex || sa?.leverageIndex || 1.85}x (${esc(hudData.leverageTier || sa?.leverageTier || 'High')})
            </span>
          </div>
        </div>

        <svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;max-height:130px;background:#070910;border-radius:8px;border:1px solid rgba(255,255,255,0.07);">
          <line x1="${padX}" y1="${padY + plotH / 2}" x2="${width - padX}" y2="${padY + plotH / 2}" stroke="rgba(255,255,255,0.2)" stroke-dasharray="3 3" stroke-width="1"/>
          <text x="6" y="${padY + 8}" fill="#00f2fe" font-size="8.5" font-weight="800">${esc(t1Abbr)}</text>
          <text x="6" y="${height - 6}" fill="#f97316" font-size="8.5" font-weight="800">${esc(t2Abbr)}</text>

          <polygon points="${areaPoints}" fill="rgba(0, 242, 254, 0.14)"/>
          <polyline fill="none" stroke="#00f2fe" stroke-width="2.5" points="${polylinePoints}"/>

          ${coords.map((c) => `
            <circle cx="${c.x}" cy="${c.y}" r="${c.pt.isKeyPlay ? 4.8 : 3}" fill="${c.pt.isKeyPlay ? '#fbbf24' : '#00f2fe'}" stroke="#06070a" stroke-width="1.2">
              <title>${esc(c.pt.period)} ${esc(c.pt.clock)} • Score: ${esc(c.pt.scoreStr)} • ${esc(t1Abbr)} Win Prob: ${c.pt.team1WinPct}% ${c.pt.eventNote ? '• ' + esc(c.pt.eventNote) : ''}</title>
            </circle>
          `).join('')}
        </svg>

        <div style="display:flex;justify-content:space-between;font-size:10px;color:#94a3b8;margin-top:5px;">
          <span>Opening (50%)</span>
          <span>Midpoint</span>
          <span><strong style="color:#fbbf24;">●</strong> Key WPA Inflection Plays</span>
          <span style="color:#00f2fe;font-weight:800;">Current: ${esc(t1Abbr)} ${coords[coords.length - 1].pt.team1WinPct}%</span>
        </div>
      </div>
    `;
  }

  /**
   * Render Tactical Matrix / Synergy Play-Type Efficiency Matrix
   */
  function renderSynergyPlayTypes(hudData) {
    const sa = hudData?.sportAnalytics;
    if (sa && Array.isArray(sa.tacticalMatrix) && sa.tacticalMatrix.length > 0) {
      const t1Abbr = sa.team1Meta?.abbreviation || 'TM1';
      const t2Abbr = sa.team2Meta?.abbreviation || 'TM2';
      return `
        <div style="background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:10px;margin-top:10px;">
          <div style="font-size:11px;font-weight:800;color:#00f2fe;margin-bottom:6px;">
            📐 TACTICAL STYLE &amp; PHASE EFFICIENCY MATRIX (${esc(sa.analyticsMethodology || sa.sportBadge || '')})
          </div>
          <div style="overflow-x:auto;">
            <table style="width:100%;font-size:10.5px;border-collapse:collapse;">
              <thead>
                <tr style="color:#94a3b8;border-bottom:1px solid rgba(255,255,255,0.08);text-align:right;">
                  <th style="text-align:left;padding:5px;">TACTICAL PHASE / PLAY TYPE</th>
                  <th style="padding:5px;color:#00f2fe;">${esc(t1Abbr)} FREQ</th>
                  <th style="padding:5px;color:#00f2fe;">${esc(t1Abbr)} EFF (%ILE)</th>
                  <th style="padding:5px;color:#fb923c;">${esc(t2Abbr)} FREQ</th>
                  <th style="padding:5px;color:#fb923c;">${esc(t2Abbr)} EFF (%ILE)</th>
                  <th style="padding:5px;">EDGE</th>
                </tr>
              </thead>
              <tbody>
                ${sa.tacticalMatrix.map((r) => `
                  <tr style="border-bottom:1px solid rgba(255,255,255,0.04);text-align:right;">
                    <td style="text-align:left;padding:5px;font-weight:700;color:#e2e8f0;">${esc(r.label || r.playType)}</td>
                    <td style="padding:5px;color:#cbd5e1;">${r.team1FreqPct}%</td>
                    <td style="padding:5px;font-weight:800;color:#00f2fe;">${esc(r.team1Efficiency)} <small style="color:#a78bfa;">(${r.team1Percentile}th)</small></td>
                    <td style="padding:5px;color:#cbd5e1;">${r.team2FreqPct}%</td>
                    <td style="padding:5px;font-weight:800;color:#fb923c;">${esc(r.team2Efficiency)} <small style="color:#a78bfa;">(${r.team2Percentile}th)</small></td>
                    <td style="padding:5px;"><span style="padding:1px 6px;border-radius:4px;font-size:9.5px;font-weight:800;background:rgba(16,185,129,0.18);color:#34d399;">${esc(r.edge)}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

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
      this.cardDismissed = false;
      this.cardTimer = null;

      this.initDom();
    }

    initDom() {
      if (!this.stageEl || this.stageEl.dataset.smartScreenMounted === 'true') return;
      this.stageEl.dataset.smartScreenMounted = 'true';
      this.stageEl.classList.add('fbs-smart-screen-stage');

      // Wrap existing video/iframe inside .fbs-smart-video-core so L-Bar Squeeze-Back can resize it cleanly
      const existingChildren = Array.from(this.stageEl.children);

      // Top Docked Smart Screen Command Bar + Mini Scorebug (sits ABOVE the video so it never blocks video playback)
      this.topBar = document.createElement('div');
      this.topBar.className = 'fbs-smart-topbar';
      this.stageEl.appendChild(this.topBar);

      this.videoCore = document.createElement('div');
      this.videoCore.className = 'fbs-smart-video-core';
      existingChildren.forEach((ch) => this.videoCore.appendChild(ch));
      this.stageEl.appendChild(this.videoCore);

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
        if (!this.cardDismissed && this.hudData && Array.isArray(this.hudData.smartCards) && this.hudData.smartCards.length > 1) {
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
      this.cardDismissed = false;
      saveActiveStreamForDock(this.streamMeta);

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
        this.loadStream(intel.stream_key, {
          name: (intel.scoreboard?.team1?.name || 'Team 1') + ' vs ' + (intel.scoreboard?.team2?.name || 'Team 2'),
          category: intel.sportAnalytics?.sportType || 'basketball',
        });
        return;
      }
      if (intel.basketballAnalytics) {
        const ba = intel.basketballAnalytics;
        this.hudData = {
          stream_key: intel.stream_key,
          sportType: 'basketball',
          surfaceType: 'basketball_halfcourt',
          gameState: ba.gameState || (ba.isLive ? 'in' : 'post'),
          isLive: ba.isLive,
          projectedPaceScore: ba.projectedPaceScore,
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
          sportAnalytics: intel.sportAnalytics,
        };
        this.renderAll();
      } else if (intel.sportAnalytics) {
        const sa = intel.sportAnalytics;
        this.hudData = {
          stream_key: intel.stream_key,
          sportType: sa.sportType,
          sportLabel: sa.sportLabel,
          surfaceType: sa.surfaceType,
          scoreboard: intel.scoreboard,
          winProbability: intel.winProbability,
          linescore: intel.linescore || sa.linescore,
          leverageIndex: sa.leverageIndex,
          leverageTier: sa.leverageTier,
          isClutchTime: sa.isHighLeverage,
          smartCards: sa.smartCards,
          shotChart: {
            surfaceType: sa.surfaceType,
            shots: (sa.spatialMap?.events || []).map((ev) => ({
              ...ev,
              made: ev.outcome === 'score',
              shotType: ev.eventType,
              value: ev.outcome === 'score' ? 1 : 0,
              xEfg: 50,
            })),
            team1Zones: [],
            team2Zones: [],
          },
          winProbTimeline: sa.winProbTimeline,
          stintTimeline: sa.stintTimeline,
          team1Analytics: {
            teamName: sa.team1Meta.name,
            abbreviation: sa.team1Meta.abbreviation,
            logo: sa.team1Meta.logo,
            score: sa.team1Meta.score,
          },
          team2Analytics: {
            teamName: sa.team2Meta.name,
            abbreviation: sa.team2Meta.abbreviation,
            logo: sa.team2Meta.logo,
            score: sa.team2Meta.score,
          },
          mvpPerformer: sa.mvpPerformer,
          inGameInsights: sa.inGameInsights,
          sportAnalytics: sa,
        };
        this.renderAll();
      } else if (this.streamKey && !this.hudData) {
        this.loadStream(this.streamKey, this.streamMeta || {});
      }
    }

    setMode(newMode) {
      this.mode = newMode;
      if (newMode === 'triggers') {
        this.cardDismissed = false;
      }
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
      const sa = this.hudData?.sportAnalytics;
      const t1 = this.hudData?.team1Analytics || sa?.team1Meta;
      const t2 = this.hudData?.team2Analytics || sa?.team2Meta;
      const li = this.hudData?.leverageIndex || sa?.leverageIndex || 1.85;
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
        : `<div class="fbs-mini-scorebug"><span>⚡ SMART SCREEN TELEMETRY</span></div>`;

      this.topBar.innerHTML = `
        ${scorebugHtml}
        <div class="fbs-smart-mode-controls">
          <button type="button" class="fbs-sm-btn ${this.mode === 'triggers' ? 'active' : ''}" data-sm-mode="triggers" title="Clean Broadcast + Auto-Triggered Context Cards">
            ⚡ Smart Cards
          </button>
          <button type="button" class="fbs-sm-btn ${this.mode === 'lbar' ? 'active' : ''}" data-sm-mode="lbar" title="Prime X-Ray / ESPN Squeeze-Back L-Bar Mode (Hotkey: L)">
            📐 L-Bar Squeeze-Back
          </button>
          <button type="button" class="fbs-sm-btn ${this.mode === 'hud' ? 'active' : ''}" data-sm-mode="hud" title="Translucent Glass HUD Overlay (Hotkey: H)">
            🥽 Glass HUD
          </button>
          <button type="button" class="fbs-sm-btn ${this.mode === 'off' ? 'active' : ''}" data-sm-mode="off" title="Hide All Overlays">
            Clean
          </button>
          <button type="button" class="fbs-sm-btn fbs-sm-action" data-sm-action="dock-lab" title="Keep Live Stream in Mini-Player & Open Sports Research Lab">
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
      if (
        this.mode === 'off' ||
        this.cardDismissed ||
        !this.hudData ||
        !Array.isArray(this.hudData.smartCards) ||
        this.hudData.smartCards.length === 0
      ) {
        this.smartCardEl.style.display = 'none';
        return;
      }

      const cards = this.hudData.smartCards;
      const card = cards[this.cardIndex % cards.length];
      const badgeTxt = card.badge || card.category || 'LIVE INSIGHT';
      const metricTxt = card.primaryMetric || card.metricHighlight || '';
      const titleTxt = card.title || card.headline || '';
      const subTxt = card.subtitle || card.detail || '';
      this.smartCardEl.style.display = 'flex';
      this.smartCardEl.innerHTML = `
        <div class="fbs-stc-inner accent-${esc(card.accentColor || 'purple')}">
          ${card.playerHeadshot ? `<img class="fbs-stc-avatar" src="${esc(card.playerHeadshot)}" alt="" onerror="this.style.display='none'">` : ''}
          <div class="fbs-stc-body">
            <div class="fbs-stc-header">
              <span class="fbs-stc-badge">${esc(badgeTxt)}</span>
              <span class="fbs-stc-metric">${esc(metricTxt)}</span>
            </div>
            <div class="fbs-stc-title">${esc(titleTxt)}</div>
            <div class="fbs-stc-sub">${esc(subTxt)}</div>
          </div>
          <div class="fbs-stc-actions">
            <button type="button" class="fbs-stc-next" title="Next Live Insight (${(this.cardIndex % cards.length) + 1}/${cards.length})">↻</button>
            <button type="button" class="fbs-stc-close" title="Hide Smart Card">&times;</button>
          </div>
        </div>
      `;

      this.smartCardEl.querySelector('.fbs-stc-next')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.cardIndex = (this.cardIndex + 1) % cards.length;
        this.renderSmartTriggerCard();
      });

      this.smartCardEl.querySelector('.fbs-stc-close')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.cardDismissed = true;
        this.smartCardEl.style.display = 'none';
      });
    }

    renderGlassHud() {
      if (!this.glassHudEl) return;
      if (this.mode !== 'hud' || !this.hudData) {
        this.glassHudEl.style.display = 'none';
        return;
      }
      this.glassHudEl.style.display = 'block';
      const sa = this.hudData.sportAnalytics;

      if (sa && Array.isArray(sa.fourPillars) && sa.fourPillars.length > 0 && sa.sportType !== 'basketball') {
        const t1Abbr = sa.team1Meta?.abbreviation || 'TM1';
        const t2Abbr = sa.team2Meta?.abbreviation || 'TM2';
        const au = sa.activeUnit || {};
        this.glassHudEl.innerHTML = `
          <div class="fbs-hud-corner top-right">
            <div class="fbs-hud-title">📐 ${esc(sa.sportBadge || sa.sportLabel || 'LIVE')} TELEMETRY</div>
            ${sa.fourPillars.map((p) => `
              <div class="fbs-hud-row"><span>${esc(p.label)}</span><strong>${esc(t1Abbr)} ${esc(p.team1Value)} • ${esc(t2Abbr)} ${esc(p.team2Value)}</strong></div>
            `).join('')}
            <div class="fbs-hud-row"><span>${esc(sa.paceAndProjection?.tempoLabel || 'Tempo')}</span><strong>${esc(sa.paceAndProjection?.tempoValue || '')}</strong></div>
          </div>

          <div class="fbs-hud-corner bottom-left">
            <div class="fbs-hud-title">👥 ${esc(au.unitTitle || 'ACTIVE ON-FIELD UNIT')}</div>
            <div style="font-size:10px;color:#00f2fe;margin-bottom:3px;">
              <strong>${esc(t1Abbr)}:</strong> ${(au.team1Players || []).slice(0, 5).map((p) => `${esc(p.name.split(' ').slice(-1)[0])} (${esc((p.keyMetric || p.primaryStat || '').split('•')[0].trim())})`).join(' • ')}
            </div>
            <div style="font-size:10px;color:#fb923c;">
              <strong>${esc(t2Abbr)}:</strong> ${(au.team2Players || []).slice(0, 5).map((p) => `${esc(p.name.split(' ').slice(-1)[0])} (${esc((p.keyMetric || p.primaryStat || '').split('•')[0].trim())})`).join(' • ')}
            </div>
          </div>
        `;
        return;
      }

      const t1 = this.hudData.team1Analytics || {};
      const t2 = this.hudData.team2Analytics || {};
      const oc = this.hudData.onCourtLineup || {};

      this.glassHudEl.innerHTML = `
        <div class="fbs-hud-corner top-right">
          <div class="fbs-hud-title">📐 FOUR FACTORS &amp; SHOT QUALITY</div>
          <div class="fbs-hud-row"><span>eFG% (Actual)</span><strong>${esc(t1.abbreviation)} ${t1.efgPct}% • ${esc(t2.abbreviation)} ${t2.efgPct}%</strong></div>
          <div class="fbs-hud-row"><span>xEFG% (Expected)</span><strong>${esc(t1.abbreviation)} ${t1.xEfgPct}% • ${esc(t2.abbreviation)} ${t2.xEfgPct}%</strong></div>
          <div class="fbs-hud-row"><span>Turnover %</span><strong>${esc(t1.abbreviation)} ${t1.fourFactors?.tovPct}% • ${esc(t2.abbreviation)} ${t2.fourFactors?.tovPct}%</strong></div>
          <div class="fbs-hud-row"><span>Off Reb %</span><strong>${esc(t1.abbreviation)} ${t1.fourFactors?.orbPct}% • ${esc(t2.abbreviation)} ${t2.fourFactors?.orbPct}%</strong></div>
          <div class="fbs-hud-row"><span>Pace / 48m</span><strong>${this.hudData.team1Analytics?.pace || 99.5} Poss</strong></div>
        </div>

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

      const sa = this.hudData.sportAnalytics;
      const surfaceType = getSportSurfaceType(this.hudData);
      const t1 = this.hudData.team1Analytics || sa?.team1Meta || {};
      const t2 = this.hudData.team2Analytics || sa?.team2Meta || {};
      const t1Abbr = t1.abbreviation || 'TM1';
      const t2Abbr = t2.abbreviation || 'TM2';

      // Dynamic sport-specific tab labels
      const mapTabLabel =
        surfaceType === 'soccer_pitch'
          ? '⚽ Pitch xG'
          : surfaceType === 'football_field'
          ? '🏈 Field Map'
          : surfaceType === 'hockey_rink'
          ? '🏒 Ice Slot'
          : '🎯 Shot Map';
      const unitTabLabel =
        surfaceType === 'soccer_pitch'
          ? '👥 XI & Shape'
          : surfaceType === 'football_field'
          ? '👥 Personnel'
          : surfaceType === 'hockey_rink'
          ? '👥 Ice Shift'
          : '👥 5v5 Floor';
      const pillarsTabLabel =
        surfaceType === 'soccer_pitch'
          ? '📐 Opta xG'
          : surfaceType === 'football_field'
          ? '📐 EPA & D&D'
          : surfaceType === 'hockey_rink'
          ? '📐 Corsi/xG'
          : '📐 4 Factors';

      let railBodyHtml = '';
      if (this.activeRailTab === 'shotchart') {
        railBodyHtml = renderSvgHalfCourtShotChart(this.hudData, { compact: true, filterSide: this.shotChartFilter });
      } else if (this.activeRailTab === 'lineup') {
        railBodyHtml = renderOnCourt5v5AndStints(this.hudData, { compact: true });
      } else if (this.activeRailTab === 'fourfactors') {
        if (sa && Array.isArray(sa.fourPillars) && sa.fourPillars.length > 0 && sa.sportType !== 'basketball') {
          railBodyHtml = `
            <div style="display:flex;flex-direction:column;gap:8px;font-size:11px;">
              <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:8px;">
                <div style="font-weight:800;color:#00f2fe;margin-bottom:6px;">${esc(sa.sportBadge || 'FOUR ANALYTICAL PILLARS')}</div>
                ${sa.fourPillars.map((p) => `
                  <div style="display:flex;justify-content:space-between;margin-bottom:5px;gap:6px;">
                    <span style="color:#cbd5e1;">${esc(p.label)} (${esc(p.weightLabel)})</span>
                    <strong>${esc(t1Abbr)} ${esc(p.team1Value)} vs ${esc(t2Abbr)} ${esc(p.team2Value)}</strong>
                  </div>
                `).join('')}
              </div>
              ${renderSynergyPlayTypes(this.hudData)}
            </div>
          `;
        } else {
          railBodyHtml = `
            <div style="display:flex;flex-direction:column;gap:8px;font-size:11px;">
              <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:8px;">
                <div style="font-weight:800;color:#00f2fe;margin-bottom:6px;">DEAN OLIVER FOUR FACTORS</div>
                <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>eFG% (40%)</span><strong>${esc(t1Abbr)} ${t1.efgPct}% vs ${esc(t2Abbr)} ${t2.efgPct}%</strong></div>
                <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>xEFG% (Shot Quality)</span><strong>${esc(t1Abbr)} ${t1.xEfgPct}% vs ${esc(t2Abbr)} ${t2.xEfgPct}%</strong></div>
                <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>TOV% (25%)</span><strong>${esc(t1Abbr)} ${t1.fourFactors?.tovPct}% vs ${esc(t2Abbr)} ${t2.fourFactors?.tovPct}%</strong></div>
                <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>ORB% (20%)</span><strong>${esc(t1Abbr)} ${t1.fourFactors?.orbPct}% vs ${esc(t2Abbr)} ${t2.fourFactors?.orbPct}%</strong></div>
                <div style="display:flex;justify-content:space-between;"><span>FT Rate (15%)</span><strong>${esc(t1Abbr)} ${t1.fourFactors?.ftRate}% vs ${esc(t2Abbr)} ${t2.fourFactors?.ftRate}%</strong></div>
              </div>
              ${renderSynergyPlayTypes({ team1Analytics: t1 })}
            </div>
          `;
        }
      } else if (this.activeRailTab === 'worm') {
        railBodyHtml = renderWinProbWormChart(this.hudData);
      }

      this.rightRail.innerHTML = `
        <div class="fbs-lbar-tabs">
          <button type="button" class="fbs-lbar-tab ${this.activeRailTab === 'shotchart' ? 'active' : ''}" data-rail-tab="shotchart">${mapTabLabel}</button>
          <button type="button" class="fbs-lbar-tab ${this.activeRailTab === 'lineup' ? 'active' : ''}" data-rail-tab="lineup">${unitTabLabel}</button>
          <button type="button" class="fbs-lbar-tab ${this.activeRailTab === 'fourfactors' ? 'active' : ''}" data-rail-tab="fourfactors">${pillarsTabLabel}</button>
          <button type="button" class="fbs-lbar-tab ${this.activeRailTab === 'worm' ? 'active' : ''}" data-rail-tab="worm">📈 WP Worm</button>
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

      // Bottom Rail: Live Period Linescore + MVP Performer + Active Momentum
      const mvp = this.hudData.mvpPerformer || sa?.mvpPerformer;
      const ls = this.hudData.linescore || sa?.linescore;
      const t1Periods = ls?.team1Quarters || ls?.team1?.quarters || [];
      const t2Periods = ls?.team2Quarters || ls?.team2?.quarters || [];
      const t1Total = ls?.team1Total ?? ls?.team1?.total ?? t1.score ?? 0;
      const t2Total = ls?.team2Total ?? ls?.team2?.total ?? t2.score ?? 0;

      if (sa && sa.sportType !== 'basketball') {
        this.bottomRail.innerHTML = `
          <div class="fbs-lbar-bottom-cell">
            <div style="font-size:10px;font-weight:800;color:#00f2fe;margin-bottom:3px;">📊 LIVE LINESCORE &amp; TEMPO</div>
            <div style="font-size:11px;color:#e2e8f0;font-family:monospace;">
              ${esc(t1Abbr)}: ${t1Periods.join(' | ')} = <strong>${t1Total}</strong><br>
              ${esc(t2Abbr)}: ${t2Periods.join(' | ')} = <strong>${t2Total}</strong>
            </div>
          </div>
          <div class="fbs-lbar-bottom-cell">
            <div style="font-size:10px;font-weight:800;color:#fbbf24;margin-bottom:3px;">🌟 MATCH IMPACT LEADER (${esc(mvp?.impactBadge || 'MVP')})</div>
            <div style="font-size:11px;color:#fff;font-weight:700;">
              ${mvp ? `${esc(mvp.name)} (${esc(mvp.teamAbbr)}): ${esc(mvp.primaryLine)}` : 'Calculating live player impact...'}
            </div>
            <div style="font-size:10px;color:#94a3b8;">
              ${esc(mvp?.efficiencyLine || sa.paceAndProjection?.projectedFinal || '')}
            </div>
          </div>
          <div class="fbs-lbar-bottom-cell">
            <div style="font-size:10px;font-weight:800;color:#a78bfa;margin-bottom:3px;">⚡ SITUATION &amp; MOMENTUM</div>
            <div style="font-size:11px;color:#e2e8f0;">
              ${esc(sa.situationBanner || sa.paceAndProjection?.activeMomentumRun || '')}
            </div>
            <div style="font-size:10px;color:#10b981;">
              ${esc(sa.spatialMap?.team1SummaryBadge || '')} | ${esc(sa.spatialMap?.team2SummaryBadge || '')}
            </div>
          </div>
        `;
      } else {
        const isPreGame =
          this.hudData.gameState === 'pre' ||
          (!this.hudData.isLive && Number(t1Total) === 0 && Number(t2Total) === 0);
        const proj = this.hudData.projectedPaceScore;
        this.bottomRail.innerHTML = `
          <div class="fbs-lbar-bottom-cell">
            <div style="font-size:10px;font-weight:800;color:#00f2fe;margin-bottom:3px;">${isPreGame ? '📋 PRE-GAME LINESCORE &amp; PROJECTION' : '📊 LIVE LINESCORE &amp; PACE'}</div>
            <div style="font-size:11px;color:#e2e8f0;font-family:monospace;">
              ${esc(t1Abbr)}: ${t1Periods.join(' | ')} = <strong>${t1Total}</strong><br>
              ${esc(t2Abbr)}: ${t2Periods.join(' | ')} = <strong>${t2Total}</strong>
              ${isPreGame && proj ? `<div style="font-size:9.5px;color:#94a3b8;margin-top:2px;">Proj Final: ${esc(t1Abbr)} ${proj.team1Projected} - ${esc(t2Abbr)} ${proj.team2Projected} (${proj.possessionsPer48} Pace)</div>` : ''}
            </div>
          </div>
          <div class="fbs-lbar-bottom-cell">
            <div style="font-size:10px;font-weight:800;color:#fbbf24;margin-bottom:3px;">${isPreGame ? '🌟 PRE-GAME STAR WATCH (SEASON AVG)' : '🌟 PEAK FLOOR IMPACT (GMSC / BPM / WPA)'}</div>
            <div style="font-size:11px;color:#fff;font-weight:700;">
              ${mvp ? `${esc(mvp.name)} (${esc(mvp.teamAbbr)}): ${mvp.pts} PTS, ${mvp.reb} REB, ${mvp.ast} AST • ${mvp.gameScore} GmSc • +${mvp.bpm} BPM` : 'Scouting active rotation...'}
            </div>
            <div style="font-size:10px;color:#94a3b8;">
              ${mvp?.projected48?.milestoneAlert ? `🚀 ${esc(mvp.projected48.milestoneAlert)}` : `48-Min Pace: ${t1.pace || 99.4} Possessions`}
            </div>
          </div>
          <div class="fbs-lbar-bottom-cell">
            <div style="font-size:10px;font-weight:800;color:#a78bfa;margin-bottom:3px;">${isPreGame ? '⚡ PRE-GAME SCOUTING &amp; SHOT QUALITY' : '⚡ ACTIVE STINT &amp; SHOT QUALITY'}</div>
            <div style="font-size:11px;color:#e2e8f0;">
              ${esc(this.hudData.onCourtLineup?.activeStintMargin || 'Balanced rotation stint')}
            </div>
            <div style="font-size:10px;color:#10b981;">
              ${esc(t1Abbr)} xEFG: ${t1.xEfgPct}% | ${esc(t2Abbr)} xEFG: ${t2.xEfgPct}%
            </div>
          </div>
        `;
      }
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
        <iframe src="/embed/${encodeURIComponent(streamCategory)}/${encodeURIComponent(activeStreamKey)}?hud=0" allow="autoplay; fullscreen" allowfullscreen style="width:100%;height:100%;border:0;"></iframe>
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

    const refreshDockHud = async () => {
      try {
        const res = await fetch(`/api/v1/basketball/smart-hud/${encodeURIComponent(activeStreamKey)}?t=${Date.now()}`);
        if (res.ok) {
          const hud = await res.json();
          const t1 = hud.team1Analytics || hud.sportAnalytics?.team1Meta || {};
          const t2 = hud.team2Analytics || hud.sportAnalytics?.team2Meta || {};
          const telEl = document.getElementById('fbs-rsd-telemetry');
          if (telEl) {
            const p1 = hud.sportAnalytics?.fourPillars?.[0];
            const midText = p1
              ? `${p1.shortLabel}: ${p1.team1Value} / ${p1.team2Value}`
              : `eFG: ${t1.efgPct || 55}%/${t2.efgPct || 52}%`;
            telEl.innerHTML = `
              <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
                <strong>${esc(t1.abbreviation || 'TM1')} ${t1.score ?? 0} - ${t2.score ?? 0} ${esc(t2.abbreviation || 'TM2')}</strong>
                <span style="color:#00f2fe;">${esc(midText)}</span>
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
    renderSvgSpatialMap: renderSvgHalfCourtShotChart,
    renderOnCourt5v5AndStints,
    renderWinProbWormChart,
    renderSynergyPlayTypes,
    saveActiveStreamForDock,
    mountResearchLabSmartDock,
  };
})();
