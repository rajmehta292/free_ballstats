// StreamFree API Streamer - Frontend Application

let state = {
  categories: [],
  streams: [],
  liveTickers: {},
  selectedCategory: '',
  searchQuery: '',
  liveOnly: false,
  sortBy: 'viewers',
  activeStream: null,
  favorites: JSON.parse(localStorage.getItem('sf_favorites') || '[]'),
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadCategories();
  loadStreams();
  setupSSE();
  fetchMirrorStatus();
  setInterval(loadLiveTickers, 30000);
});

// Setup DOM Event Listeners
function setupEventListeners() {
  // Search
  const searchInput = document.getElementById('search-input');
  let debounceTimer;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      state.searchQuery = e.target.value.trim().toLowerCase();
      renderStreams();
    }, 250);
  });

  // Live only toggle
  document.getElementById('live-only-toggle').addEventListener('change', (e) => {
    state.liveOnly = e.target.checked;
    renderStreams();
  });

  // Sort select
  document.getElementById('sort-select').addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    renderStreams();
  });

  // Video Player Modal
  const playerModal = document.getElementById('player-modal');
  document.getElementById('modal-close-btn').addEventListener('click', closePlayerModal);
  playerModal.addEventListener('click', (e) => {
    if (e.target === playerModal) closePlayerModal();
  });

  // Athlete Profile Modal
  const profileModal = document.getElementById('player-profile-modal');
  const closeProfileBtn = document.getElementById('profile-modal-close-btn');
  if (closeProfileBtn) {
    closeProfileBtn.addEventListener('click', () => {
      if (profileModal) profileModal.classList.remove('show');
    });
  }
  if (profileModal) {
    profileModal.addEventListener('click', (e) => {
      if (e.target === profileModal) profileModal.classList.remove('show');
    });
  }

  // Modal actions
  document.getElementById('modal-popout-btn').addEventListener('click', () => {
    if (state.activeStream) {
      window.open(`/embed/${encodeURIComponent(state.activeStream.category)}/${encodeURIComponent(state.activeStream.stream_key)}`, '_blank');
    }
  });

  document.getElementById('modal-copy-embed').addEventListener('click', () => {
    if (state.activeStream) {
      copyStreamEmbed(state.activeStream);
    }
  });

  document.getElementById('modal-copy-m3u8').addEventListener('click', () => {
    if (state.activeStream) {
      copyProxyForStream(state.activeStream.stream_key, state.activeStream.category);
    }
  });

  // Gamecast Tabs Switching
  document.querySelectorAll('.gamecast-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.gamecast-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.gamecast-tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const tabId = btn.dataset.tab;
      const targetPanel = document.getElementById(`tab-${tabId}`);
      if (targetPanel) targetPanel.classList.add('active');
    });
  });

  // Modal Chat Form
  const modalChatForm = document.getElementById('modal-chat-form');
  if (modalChatForm) {
    modalChatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('modal-chat-input');
      const text = input.value.trim();
      if (!text || !state.activeStream) return;
      input.value = '';
      try {
        await fetch(`/api/v1/chat/${encodeURIComponent(state.activeStream.stream_key)}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'Fan_' + Math.floor(Math.random() * 900 + 100),
            message: text,
          }),
        });
      } catch (err) {}
    });
  }

  // Embed Generator Modal
  const embedModal = document.getElementById('embed-generator-modal');
  document.getElementById('open-embed-modal').addEventListener('click', () => {
    populateEmbedModal();
    embedModal.classList.add('show');
  });
  document.getElementById('embed-modal-close-btn').addEventListener('click', () => {
    embedModal.classList.remove('show');
  });

  // Custom Stream Modal
  const customModal = document.getElementById('custom-stream-modal');
  const openCustomBtn = document.getElementById('open-custom-stream-modal');
  const closeCustomBtn = document.getElementById('custom-stream-close-btn');
  const customForm = document.getElementById('custom-stream-form');

  if (openCustomBtn) {
    openCustomBtn.addEventListener('click', () => {
      customModal.classList.add('show');
    });
  }
  if (closeCustomBtn) {
    closeCustomBtn.addEventListener('click', () => {
      customModal.classList.remove('show');
    });
  }
  if (customModal) {
    customModal.addEventListener('click', (e) => {
      if (e.target === customModal) customModal.classList.remove('show');
    });
  }

  if (customForm) {
    customForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('cs-name').value.trim();
      const cat = document.getElementById('cs-category').value.trim();
      const league = document.getElementById('cs-league').value.trim();
      const key = document.getElementById('cs-key').value.trim();
      const sourceUrl = document.getElementById('cs-source-url').value.trim();
      const thumbnail = document.getElementById('cs-thumbnail').value.trim();

      const payload = {
        name,
        category: cat,
        league: league || 'Custom League',
        stream_key: key,
        thumbnail_url: thumbnail || undefined,
        sources: [
          { quality: 'FHD', url: sourceUrl, live: true },
          { quality: 'SD', url: sourceUrl, live: true },
        ],
      };

      try {
        const res = await fetch('/api/v1/custom-streams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const created = await res.json();
          customModal.classList.remove('show');
          customForm.reset();
          showToast(`Stream "${name}" published successfully!`, 'success');
          // Reload streams
          loadStreams();
          loadCategories();
        } else {
          const err = await res.json().catch(() => ({}));
          showToast(err.message || 'Failed to add stream', 'error');
        }
      } catch (err) {
        showToast('Network error while adding stream', 'error');
      }
    });
  }
  embedModal.addEventListener('click', (e) => {
    if (e.target === embedModal) embedModal.classList.remove('show');
  });

  // Embed generator inputs
  ['embed-stream-select', 'embed-width', 'embed-height'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateEmbedSnippet);
    document.getElementById(id)?.addEventListener('change', updateEmbedSnippet);
  });

  document.getElementById('copy-snippet-btn').addEventListener('click', () => {
    const text = document.getElementById('generated-snippet').textContent;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('copy-snippet-btn');
      const original = btn.textContent;
      btn.textContent = 'Copied to Clipboard!';
      setTimeout(() => { btn.textContent = original; }, 2000);
    });
  });

  // Close modals on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closePlayerModal();
      embedModal.classList.remove('show');
    }
  });
}

// Fetch Categories
async function loadCategories() {
  try {
    const res = await fetch('/api/v1/categories');
    if (res.ok) {
      const data = await res.json();
      state.categories = data.categories || [];
      renderCategoryPills();
    }
  } catch (err) {
    console.error('Failed to load categories:', err);
  }
}

// Render Category Navigation Pills
function renderCategoryPills() {
  const container = document.getElementById('category-pills');
  container.innerHTML = `
    <button class="category-pill ${state.selectedCategory === '' ? 'active' : ''}" data-category="">
      All Sports
    </button>
    <button class="category-pill ${state.selectedCategory === '__favorites__' ? 'active' : ''}" data-category="__favorites__" style="color: #facc15; border-color: rgba(250, 204, 21, 0.3);">
      ★ Watchlist (${state.favorites.length})
    </button>
  `;

  // Watchlist pill listener
  container.querySelector('.category-pill[data-category="__favorites__"]').addEventListener('click', (e) => {
    state.selectedCategory = '__favorites__';
    document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
    e.target.classList.add('active');
    renderStreams();
  });

  state.categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = `category-pill ${state.selectedCategory === cat ? 'active' : ''}`;
    btn.dataset.category = cat;
    btn.textContent = cat;
    btn.addEventListener('click', () => {
      state.selectedCategory = cat;
      document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      renderStreams();
    });
    container.appendChild(btn);
  });

  // All button listener
  container.querySelector('.category-pill[data-category=""]').addEventListener('click', (e) => {
    state.selectedCategory = '';
    document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
    e.target.classList.add('active');
    renderStreams();
  });
}

// Fetch Streams from API
async function loadStreams() {
  try {
    const res = await fetch('/api/v1/streams');
    if (res.ok) {
      const data = await res.json();
      state.streams = data.streams || [];
      renderStreams();
      loadLiveTickers();
    }
  } catch (err) {
    console.error('Failed to load streams:', err);
  }
}

// Fetch Cached Live Scores, F1 Standings, UFC Bouts & RedZone Radar for Catalog Cards
async function loadLiveTickers() {
  try {
    const res = await fetch('/api/v1/streams/live-context');
    if (!res.ok) return;
    const data = await res.json();
    state.liveTickers = data.tickers || {};
    applyLiveTickersToDom();
  } catch (err) {}
}

function buildTickerInnerHtml(t) {
  if (!t) return '';
  const accentColors = {
    red: '#ef4444',
    green: '#10b981',
    gold: '#fbbf24',
    cyan: '#00f2fe',
    purple: '#a855f7',
  };
  const col = accentColors[t.accent] || '#00f2fe';
  return `
    <div class="card-ticker-inner" style="border-left: 3px solid ${col};">
      <div class="card-ticker-top">
        <span class="card-ticker-headline" style="color:${col};">${escapeHtml(t.headline)}</span>
        <span class="card-ticker-badge" style="border-color:${col}55;color:${col};">${escapeHtml(t.statusBadge)}</span>
      </div>
      <div class="card-ticker-sub">${escapeHtml(t.subline)}</div>
      ${t.secondaryLine ? `<div class="card-ticker-sec">${escapeHtml(t.secondaryLine)}</div>` : ''}
    </div>
  `;
}

function applyLiveTickersToDom() {
  document.querySelectorAll('[data-ticker-key]').forEach((el) => {
    const key = el.getAttribute('data-ticker-key');
    const t = key ? state.liveTickers[key] : null;
    if (t) {
      el.innerHTML = buildTickerInnerHtml(t);
      el.style.display = 'block';
    }
  });
}

// Filter and Render Streams Grid
function renderStreams() {
  let filtered = [...state.streams];

  // Category filter
  if (state.selectedCategory === '__favorites__') {
    filtered = filtered.filter(s => state.favorites.includes(s.stream_key));
  } else if (state.selectedCategory) {
    filtered = filtered.filter(s => s.category.toLowerCase() === state.selectedCategory.toLowerCase());
  }

  // Search filter
  if (state.searchQuery) {
    filtered = filtered.filter(s =>
      s.name.toLowerCase().includes(state.searchQuery) ||
      (s.league && s.league.toLowerCase().includes(state.searchQuery)) ||
      (s.team1 && s.team1.name.toLowerCase().includes(state.searchQuery)) ||
      (s.team2 && s.team2.name.toLowerCase().includes(state.searchQuery)) ||
      s.stream_key.toLowerCase().includes(state.searchQuery)
    );
  }

  const isStreamActiveOrLive = (s) => {
    if ((s.sources || []).some(src => src.live)) return true;
    const nowSec = Date.now() / 1000;
    if (s.match_timestamp && nowSec >= (s.match_timestamp - 600) && nowSec <= (s.match_timestamp + 16200)) return true;
    return !s.match_timestamp;
  };

  // Live only filter
  if (state.liveOnly) {
    filtered = filtered.filter(isStreamActiveOrLive);
  }

  // Sort
  if (state.sortBy === 'viewers') {
    filtered.sort((a, b) => (b.viewers || 0) - (a.viewers || 0));
  } else if (state.sortBy === 'time') {
    filtered.sort((a, b) => a.match_timestamp - b.match_timestamp);
  } else if (state.sortBy === 'name') {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Update header count
  document.getElementById('streams-count').textContent = `(${filtered.length} available)`;

  const grid = document.getElementById('streams-grid');
  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 48px; text-align: center; color: var(--text-dim); background: var(--bg-secondary); border-radius: 12px; border: 1px solid var(--border-color);">
        <h3>No streams match your filter criteria</h3>
        <p style="margin-top: 8px; font-size: 13px;">Try switching categories or clearing search keywords.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(stream => {
    const isLive = isStreamActiveOrLive(stream);
    const highestQuality = (stream.sources || []).find(s => s.quality === 'FHD')?.quality || (stream.sources || [])[0]?.quality || 'HD';
    const matchTime = formatTimestamp(stream.match_timestamp);

    return `
      <div class="stream-card">
        <div class="card-preview">
          ${stream.thumbnail_url
            ? `<img class="thumbnail" src="${escapeHtml(stream.thumbnail_url)}" alt="${escapeHtml(stream.name)}" loading="lazy">`
            : ''
          }
          ${(!stream.thumbnail_url && stream.team1 && stream.team2) ? `
            <div class="teams-vs">
              <div class="team-box">
                <img class="team-logo" src="${escapeHtml(stream.team1.logo)}" alt="${escapeHtml(stream.team1.name)}">
                <span class="team-name">${escapeHtml(stream.team1.name)}</span>
              </div>
              <span class="vs-badge">VS</span>
              <div class="team-box">
                <img class="team-logo" src="${escapeHtml(stream.team2.logo)}" alt="${escapeHtml(stream.team2.name)}">
                <span class="team-name">${escapeHtml(stream.team2.name)}</span>
              </div>
            </div>
          ` : ''}

          <div class="card-badges">
            <span class="status-badge ${isLive ? 'is-live' : 'is-upcoming'}">
              <span class="dot" style="${isLive ? '' : 'background: #eab308; box-shadow: 0 0 6px #eab308;'}"></span>
              ${isLive ? 'LIVE' : 'UPCOMING'}
            </span>
            <span class="quality-tag">${highestQuality}</span>
          </div>
          <div class="viewer-badge-overlay" title="Current live viewers on this broadcast">
            <span>👥</span>
            <strong>${(stream.viewers || 0).toLocaleString()}</strong>
            <span>watching</span>
          </div>
        </div>

        <div class="card-content">
          <div class="card-title">${escapeHtml(stream.name)}</div>
          <div class="card-live-ticker" data-ticker-key="${escapeHtml(stream.stream_key)}" style="${state.liveTickers[stream.stream_key] ? 'display:block;' : 'display:none;'}">
            ${state.liveTickers[stream.stream_key] ? buildTickerInnerHtml(state.liveTickers[stream.stream_key]) : ''}
          </div>
          <div class="card-meta">
            <span class="league-info">
              <span>🏆</span>
              <span>${escapeHtml(stream.league || stream.category.toUpperCase())}</span>
            </span>
            <span>${matchTime}</span>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--text-dim); margin-top: 4px;">
            <span>Category: <strong style="color: #cbd5e1; text-transform: capitalize;">${escapeHtml(stream.category)}</strong></span>
            <span style="color:#e2e8f0;font-weight:700;">👥 ${(stream.viewers || 0).toLocaleString()} watching</span>
          </div>

          <div class="card-footer" style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button class="btn btn-primary" onclick="openPlayerModal('${escapeHtml(stream.stream_key)}')">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              Watch
            </button>
            <a href="/player.html?key=${encodeURIComponent(stream.stream_key)}&category=${encodeURIComponent(stream.category)}" class="btn btn-outline" style="font-size: 12px; padding: 7px 11px;">
              Pro Player
            </a>
            <button class="btn btn-outline" style="font-size: 12px; padding: 7px 11px;" onclick="openEmbedForStream('${escapeHtml(stream.stream_key)}')">
              Embed
            </button>
            <button class="btn btn-outline" style="font-size: 12px; padding: 7px 10px;" title="Copy M3U8 Proxy URL" onclick="copyProxyForStream('${escapeHtml(stream.stream_key)}', '${escapeHtml(stream.category)}')">
              M3U8
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

let modalChatEventSource = null;
let currentIntel = null;
let intelPollTimer = null;
let activeBoxScoreTeam = 'team1';
let activeBoxScoreCatIndex = 0;
let activeRosterTeam = 'team1';

function buildClientSvgCrest(teamName, bgHex = '#9146ff') {
  const initials = (teamName || 'TM')
    .split(/\s+/)
    .map(w => w[0] || '')
    .join('')
    .slice(0, 3)
    .toUpperCase() || 'TM';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><circle cx="40" cy="40" r="36" fill="${bgHex}" stroke="rgba(255,255,255,0.35)" stroke-width="3"/><text x="40" y="46" text-anchor="middle" fill="#fff" font-family="sans-serif" font-weight="900" font-size="22">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Open Watch Modal (Gamecast Hub)
window.openPlayerModal = async function(streamKey) {
  const stream = state.streams.find(s => s.stream_key === streamKey);
  if (!stream) return;

  if (intelPollTimer) {
    clearInterval(intelPollTimer);
    intelPollTimer = null;
  }

  state.activeStream = stream;
  const modal = document.getElementById('player-modal');
  const iframe = document.getElementById('modal-iframe');

  // Header Elements
  document.getElementById('player-title-text').textContent = stream.name;
  document.getElementById('player-league-badge').textContent = stream.league || stream.category.toUpperCase();

  const proPlayerLink = document.getElementById('modal-pro-player-link');
  if (proPlayerLink) {
    proPlayerLink.href = `/player.html?key=${encodeURIComponent(stream.stream_key)}&category=${encodeURIComponent(stream.category)}`;
  }

  // Set default iframe embed (with ?hud=0 so internal iframe HUD doesn't duplicate modal Smart Screen bar)
  const baseEmbedUrl = `/embed/${encodeURIComponent(stream.category)}/${encodeURIComponent(stream.stream_key)}?hud=0`;
  iframe.src = baseEmbedUrl;
  modal.classList.add('show');

  // Populate Stream Source Switcher Bar inside the Watch Modal (hydrating /api/v1/sources/:key if omitted)
  const srcPillsEl = document.getElementById('modal-source-pills');
  const renderModalSourceButtons = (sourcesList) => {
    if (!srcPillsEl) return;
    const sources = Array.isArray(sourcesList) && sourcesList.length > 0
      ? sourcesList
      : [{ quality: 'FHD', live: true, type: 'Primary' }];
    srcPillsEl.innerHTML = `
      <span style="font-size:11px;font-weight:800;color:#94a3b8;">📡 STREAM FEEDS:</span>
      ${sources.map((s, idx) => `
        <button type="button" class="modal-src-btn ${idx === 0 ? 'active' : ''}" data-modal-src-idx="${idx}">
          Source ${idx + 1} (${escapeHtml(s.quality || 'HD')}${s.live ? ' • LIVE' : ''})
        </button>
      `).join('')}
    `;
    srcPillsEl.querySelectorAll('[data-modal-src-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        srcPillsEl.querySelectorAll('[data-modal-src-idx]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const idx = btn.getAttribute('data-modal-src-idx');
        iframe.src = `${baseEmbedUrl}&src=${encodeURIComponent(idx)}&t=${Date.now()}`;
      });
    });
  };
  renderModalSourceButtons(stream.sources);
  if (!Array.isArray(stream.sources) || stream.sources.length === 0) {
    fetch(`/api/v1/sources/${encodeURIComponent(stream.stream_key)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((srcData) => {
        if (srcData && Array.isArray(srcData.sources) && srcData.sources.length > 0) {
          stream.sources = srcData.sources;
          renderModalSourceButtons(stream.sources);
        }
      })
      .catch(() => {});
  }

  const reloadBtn = document.getElementById('modal-reload-stream-btn');
  if (reloadBtn) {
    reloadBtn.onclick = () => {
      iframe.src = `${baseEmbedUrl}&t=${Date.now()}`;
    };
  }

  const lbarBtn = document.getElementById('modal-toggle-lbar-btn');
  if (lbarBtn) {
    lbarBtn.onclick = () => {
      if (window.modalSmartScreen) {
        const nextMode = window.modalSmartScreen.mode === 'lbar' ? 'triggers' : 'lbar';
        window.modalSmartScreen.setMode(nextMode);
        lbarBtn.classList.toggle('active', nextMode === 'lbar');
      }
    };
  }

  const cinemaBtn = document.getElementById('modal-cinema-width-btn');
  if (cinemaBtn) {
    cinemaBtn.onclick = () => {
      const mc = modal.querySelector('.modal-content');
      if (mc) {
        const isExpanded = mc.style.maxWidth === '96vw';
        mc.style.maxWidth = isExpanded ? '1180px' : '96vw';
        cinemaBtn.classList.toggle('active', !isExpanded);
      }
    };
  }

  // Mount or update Smart Screen Broadcast Canvas inside the Watch Modal
  if (window.FreeBallStatsSmartScreen) {
    const stageEl = document.getElementById('modal-smart-screen-stage');
    if (stageEl) {
      const isRzStream = /redzone|red-zone/i.test(stream.stream_key) || /redzone|red zone/i.test(stream.name || '');
      if (!window.modalSmartScreen) {
        window.modalSmartScreen = new window.FreeBallStatsSmartScreen.SmartScreenController(stageEl, {
          defaultMode: (stream.category === 'basketball' || isRzStream) ? 'lbar' : 'triggers',
        });
      } else {
        window.modalSmartScreen.setMode((stream.category === 'basketball' || isRzStream) ? 'lbar' : 'triggers');
      }
      window.fbsActiveSmartScreen = window.modalSmartScreen;
      window.onRedZonePinChange = () => fetchStreamIntel(stream.stream_key);
      window.modalSmartScreen.loadStream(stream.stream_key, {
        name: stream.name,
        category: stream.category,
      });
    }
  }

  // Initial Scoreboard state
  const t1Name = stream.team1?.name || stream.name.split('vs')[0]?.trim() || 'Home';
  const t2Name = stream.team2?.name || stream.name.split('vs')[1]?.trim() || 'Away';
  document.getElementById('sb-team1-name').textContent = t1Name;
  document.getElementById('sb-team2-name').textContent = t2Name;
  document.getElementById('sb-team1-logo').src = stream.team1?.logo || buildClientSvgCrest(t1Name, '#9146ff');
  document.getElementById('sb-team2-logo').src = stream.team2?.logo || buildClientSvgCrest(t2Name, '#0ea5e9');
  document.getElementById('sb-status-text').textContent = (stream.sources || []).some(s => s.live) ? 'LIVE' : 'UPCOMING';
  document.getElementById('sb-venue-text').textContent = `${stream.category.toUpperCase()} • ${(stream.viewers || 0).toLocaleString()} viewers`;

  // Start live chat connection
  setupModalChat(stream.stream_key);

  // Initial fetch of Sports Intelligence (ESPN / StatMuse Live Stats & News)
  await fetchStreamIntel(stream.stream_key);

  // Start 15-second live polling loop for continuous updates
  intelPollTimer = setInterval(() => {
    if (state.activeStream && state.activeStream.stream_key === streamKey) {
      fetchStreamIntel(streamKey);
    }
  }, 15000);
};

async function fetchStreamIntel(streamKey) {
  try {
    const ss = window.modalSmartScreen;
    const pinQs =
      (ss?.rzManualPinId ? `&pinnedEventId=${encodeURIComponent(ss.rzManualPinId)}` : '') +
      (ss?.rzSecondaryPinId ? `&pinnedB=${encodeURIComponent(ss.rzSecondaryPinId)}` : '');
    const res = await fetch(`/api/v1/intel/${encodeURIComponent(streamKey)}?t=${Date.now()}${pinQs}`);
    if (res.ok) {
      const intel = await res.json();
      currentIntel = intel;
      renderGamecastIntel(intel);
    }
  } catch (err) {
    console.error('Failed to load sports intelligence:', err);
  }
}

function renderGamecastIntel(intel) {
  if (!intel) return;

  if (window.FreeBallStatsSmartScreen?.renderRedZoneSlateRibbon) {
    window.FreeBallStatsSmartScreen.renderRedZoneSlateRibbon(
      document.getElementById('modal-redzone-ribbon'),
      intel
    );
  }

  // 1. Scoreboard Update
  if (intel.scoreboard) {
    document.getElementById('sb-team1-score').textContent = intel.scoreboard.team1.score || '0';
    document.getElementById('sb-team2-score').textContent = intel.scoreboard.team2.score || '0';
    if (intel.scoreboard.team1.name) document.getElementById('sb-team1-name').textContent = intel.scoreboard.team1.name;
    if (intel.scoreboard.team2.name) document.getElementById('sb-team2-name').textContent = intel.scoreboard.team2.name;
    if (intel.scoreboard.team1.logo) document.getElementById('sb-team1-logo').src = intel.scoreboard.team1.logo;
    if (intel.scoreboard.team2.logo) document.getElementById('sb-team2-logo').src = intel.scoreboard.team2.logo;

    if (intel.scoreboard.team1.record) document.getElementById('sb-team1-record').textContent = intel.scoreboard.team1.record;
    if (intel.scoreboard.team2.record) document.getElementById('sb-team2-record').textContent = intel.scoreboard.team2.record;
    if (intel.scoreboard.detail) document.getElementById('sb-status-text').textContent = intel.scoreboard.detail;

    const downDistEl = document.getElementById('sb-down-dist');
    if (intel.scoreboard.downDistance) {
      downDistEl.textContent = intel.scoreboard.downDistance;
      downDistEl.style.display = 'block';
    } else {
      downDistEl.style.display = 'none';
    }
  }

  // 2. Win Probability Bar
  const winProbWrap = document.getElementById('win-prob-wrapper');
  if (intel.winProbability && winProbWrap) {
    winProbWrap.style.display = 'flex';
    document.getElementById('win-prob-t1-label').textContent = `${intel.scoreboard.team1.name} Win: ${intel.winProbability.team1Percentage}%`;
    document.getElementById('win-prob-t2-label').textContent = `${intel.scoreboard.team2.name} Win: ${intel.winProbability.team2Percentage}%`;
    document.getElementById('win-prob-bar-home').style.width = `${intel.winProbability.team1Percentage}%`;
    document.getElementById('win-prob-bar-away').style.width = `${intel.winProbability.team2Percentage}%`;
  }

  // 3. Game Info
  if (intel.gameInfo) {
    if (intel.gameInfo.venue) document.getElementById('sb-venue-text').textContent = `📍 ${intel.gameInfo.venue}${intel.gameInfo.city ? ', ' + intel.gameInfo.city : ''}`;
    if (intel.gameInfo.odds) document.getElementById('sb-odds-text').textContent = `🎲 Odds: ${intel.gameInfo.odds}${intel.gameInfo.overUnder ? ' (' + intel.gameInfo.overUnder + ')' : ''}`;
    if (intel.gameInfo.broadcast) document.getElementById('sb-broadcast-text').textContent = `📺 ${intel.gameInfo.broadcast}`;
  }

  // 4. Tab 0: Box Score (Player by Player with Category Pills)
  renderBoxScore(intel.boxscore);

  // 4.5. Quarter-by-Quarter Linescore & In-Game Supporting Analytics (Four Factors, Unit Splits, Insights)
  renderInGameAnalytics(intel);
  if (window.modalSmartScreen) {
    window.modalSmartScreen.updateFromIntel(intel);
  }

  // 5. Tab 0.5: Team Rosters
  renderRosters(intel.rosters);

  // 6. Tab 1: Live Stats Comparison (ESPN / Yahoo style)
  const statsContainer = document.getElementById('gamecast-stats-container');
  if (intel.stats && intel.stats.length > 0) {
    statsContainer.innerHTML = intel.stats.map(s => `
      <div class="stat-row">
        <div class="stat-labels">
          <span class="stat-team1-val">${escapeHtml(s.team1Value)}</span>
          <span class="stat-name">${escapeHtml(s.label)}</span>
          <span class="stat-team2-val">${escapeHtml(s.team2Value)}</span>
        </div>
      </div>
    `).join('');
  } else {
    statsContainer.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 16px;">Live statistics will appear once play starts.</div>`;
  }

  // 7. Tab 2: Key Leaders (StatMuse / Reference style)
  const leadersContainer = document.getElementById('gamecast-leaders-container');
  if (intel.leaders && intel.leaders.length > 0) {
    leadersContainer.innerHTML = intel.leaders.map(l => `
      <div class="leader-card" style="cursor: pointer;" onclick="openAthleteProfile('${escapeHtml(l.athlete.id)}', '${escapeHtml(intel.sportPath || '')}', '${escapeHtml(l.athlete.name)}')">
        <img class="leader-avatar" src="${escapeHtml(l.athlete.headshot)}" alt="${escapeHtml(l.athlete.name)}" onerror="this.src='https://a.espncdn.com/combiner/i?img=/i/headshots/nophoto.png&w=120&h=90'">
        <div class="leader-info">
          <span class="leader-cat">${escapeHtml(l.category)}</span>
          <span class="leader-name">${escapeHtml(l.athlete.name)} ${l.athlete.jersey ? '#' + escapeHtml(l.athlete.jersey) : ''}</span>
          <span class="leader-stat">${escapeHtml(l.statline)}</span>
          <span style="font-size: 11px; color: var(--text-dim);">${escapeHtml(l.teamName || '')}</span>
        </div>
      </div>
    `).join('');
  } else {
    leadersContainer.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 16px;">Key leaders will be highlighted during game action.</div>`;
  }

  // 8. Tab 3: Scoring Timeline
  const scoringContainer = document.getElementById('gamecast-scoring-container');
  if (intel.scoringPlays && intel.scoringPlays.length > 0) {
    scoringContainer.innerHTML = intel.scoringPlays.map(p => `
      <div class="play-item">
        <div class="play-period">${escapeHtml(p.period)} ${p.clock ? '<br>' + escapeHtml(p.clock) : ''}</div>
        <div class="play-body">
          <div class="play-score">${p.teamName ? escapeHtml(p.teamName) + ' • ' : ''}Score: ${escapeHtml(p.score)}</div>
          <div class="play-desc">${escapeHtml(p.description)}</div>
        </div>
      </div>
    `).join('');
  } else {
    scoringContainer.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 16px;">No scoring plays yet.</div>`;
  }

  // 9. Tab 4: Rich Event-Specific & Industry Newsroom
  const newsContainer = document.getElementById('gamecast-news-container');
  renderNewsroomIntoContainer(newsContainer, intel.news || []);
}

let activeModalNewsFilter = 'all';
let activeModalNewsQuery = '';

function renderNewsroomIntoContainer(container, articles) {
  if (!container) return;
  if (!articles || articles.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 24px;">No recent editorial news found for this event.</div>`;
    return;
  }

  const fmtAge = (iso) => {
    if (!iso) return '';
    const diffMs = Date.now() - Date.parse(iso);
    if (Number.isNaN(diffMs) || diffMs < 0) return '';
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${Math.max(1, mins)}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 48) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const tagCounts = {
    all: articles.length,
    matchup: articles.filter((a) => a.categoryTag === 'matchup' || a.isEventSpecific).length,
    injuries: articles.filter((a) => a.categoryTag === 'injuries').length,
    analytics: articles.filter((a) => a.categoryTag === 'analytics').length,
    business: articles.filter((a) => a.categoryTag === 'business').length,
    headlines: articles.filter((a) => a.categoryTag === 'headlines').length,
  };

  const tabs = [
    { key: 'all', label: `All (${tagCounts.all})` },
    { key: 'matchup', label: `🎯 Event Focus (${tagCounts.matchup})` },
    { key: 'injuries', label: `🏥 Injuries & Lineups (${tagCounts.injuries})` },
    { key: 'analytics', label: `📊 Analytics & Film (${tagCounts.analytics})` },
    { key: 'business', label: `💼 Business & League (${tagCounts.business})` },
  ].filter((t) => t.key === 'all' || tagCounts[t.key] > 0);

  const q = activeModalNewsQuery.trim().toLowerCase();
  const visible = articles.filter((a) => {
    const tagOk =
      activeModalNewsFilter === 'all'
        ? true
        : activeModalNewsFilter === 'matchup'
        ? a.categoryTag === 'matchup' || a.isEventSpecific
        : a.categoryTag === activeModalNewsFilter;
    const textOk = !q || `${a.title} ${a.description} ${a.source || ''}`.toLowerCase().includes(q);
    return tagOk && textOk;
  });

  container.style.display = 'block';
  container.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;margin-bottom:12px;">
      <div style="display:flex;flex-wrap:wrap;gap:6px;" id="modal-news-filter-pills">
        ${tabs
          .map(
            (t) =>
              `<button type="button" class="btn ${activeModalNewsFilter === t.key ? 'btn-primary' : 'btn-outline'}" data-news-cat="${t.key}" style="font-size:11px;padding:4px 10px;">${escapeHtml(t.label)}</button>`
          )
          .join('')}
      </div>
      <input type="text" id="modal-news-search-input" value="${escapeHtml(activeModalNewsQuery)}" placeholder="Filter news headlines, players, topics..." style="background:rgba(255,255,255,0.05);border:1px solid var(--border-color);color:#fff;padding:6px 10px;border-radius:8px;font-size:12px;min-width:210px;outline:none;">
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:12px;max-height:540px;overflow-y:auto;padding-right:4px;">
      ${
        visible.length === 0
          ? `<div style="grid-column:1/-1;text-align:center;color:var(--text-dim);padding:24px;">No stories match this filter. Try switching categories or clearing the search box.</div>`
          : visible
              .map(
                (n) => `
          <div class="news-card" style="display:flex;flex-direction:column;justify-content:space-between;">
            ${n.image ? `<img src="${escapeHtml(n.image)}" alt="News image" loading="lazy" style="max-height:145px;object-fit:cover;width:100%;">` : ''}
            <div class="news-body" style="display:flex;flex-direction:column;flex:1;justify-content:space-between;gap:6px;">
              <div>
                <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap;">
                  <span style="font-size:10px;font-weight:800;padding:2px 7px;border-radius:999px;background:rgba(145,70,255,0.18);color:#c4b5fd;border:1px solid rgba(145,70,255,0.35);">${escapeHtml(n.categoryLabel || '📰 Headline')}</span>
                  <span style="font-size:10px;color:#94a3b8;">${escapeHtml(n.source || 'Wire')}${fmtAge(n.published) ? ' • ' + escapeHtml(fmtAge(n.published)) : ''}</span>
                </div>
                <div class="news-headline">${escapeHtml(n.title)}</div>
                <div class="news-summary" style="margin-top:4px;">${escapeHtml(n.description)}</div>
              </div>
              <a href="${escapeHtml(n.link)}" target="_blank" rel="noopener" class="news-link">Read Full Coverage &rarr;</a>
            </div>
          </div>
        `
              )
              .join('')
      }
    </div>
  `;

  container.querySelectorAll('[data-news-cat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeModalNewsFilter = btn.getAttribute('data-news-cat') || 'all';
      renderNewsroomIntoContainer(container, articles);
    });
  });

  const searchInp = document.getElementById('modal-news-search-input');
  if (searchInp) {
    searchInp.addEventListener('input', (e) => {
      activeModalNewsQuery = e.target.value || '';
      renderNewsroomIntoContainer(container, articles);
      const refocused = document.getElementById('modal-news-search-input');
      if (refocused) {
        refocused.focus();
        refocused.setSelectionRange(activeModalNewsQuery.length, activeModalNewsQuery.length);
      }
    });
  }
}

function renderInGameAnalytics(intel) {
  const lsStrip = document.getElementById('sb-linescore-strip');
  if (lsStrip && intel.linescore && intel.linescore.periodHeaders) {
    lsStrip.style.display = 'block';
    const headers = intel.linescore.periodHeaders.map(h => `<th style="padding:3px 8px;color:var(--text-dim);">${escapeHtml(h)}</th>`).join('');
    const t1Cells = (intel.linescore.team1Quarters || []).map(q => `<td style="padding:3px 8px;font-family:monospace;">${q}</td>`).join('');
    const t2Cells = (intel.linescore.team2Quarters || []).map(q => `<td style="padding:3px 8px;font-family:monospace;">${q}</td>`).join('');
    lsStrip.innerHTML = `
      <table style="width:100%;font-size:11px;text-align:center;border-collapse:collapse;">
        <thead><tr><th style="text-align:left;padding:3px 8px;color:var(--text-dim);">LINESCORE</th>${headers}<th style="padding:3px 8px;color:#00f2fe;">TOT</th></tr></thead>
        <tbody>
          <tr><td style="text-align:left;padding:3px 8px;font-weight:700;">${escapeHtml(intel.scoreboard?.team1?.name || 'Team 1')}</td>${t1Cells}<td style="padding:3px 8px;font-weight:800;color:#00f2fe;">${intel.linescore.team1Total}</td></tr>
          <tr><td style="text-align:left;padding:3px 8px;font-weight:700;">${escapeHtml(intel.scoreboard?.team2?.name || 'Team 2')}</td>${t2Cells}<td style="padding:3px 8px;font-weight:800;color:#00f2fe;">${intel.linescore.team2Total}</td></tr>
        </tbody>
      </table>
    `;
  } else if (lsStrip) {
    lsStrip.style.display = 'none';
  }

  const container = document.getElementById('modal-ingame-analytics-container');
  if (!container) return;
  const ba = intel.basketballAnalytics;
  const sa = intel.sportAnalytics;

  // Update tab label dynamically for the active sport (always check RedZone & NBA basketballAnalytics first!)
  const tabBtn = document.getElementById('tab-btn-ingame-analytics');
  if (tabBtn) {
    if (intel.redzoneIntel) tabBtn.innerHTML = '🚨 RedZone Hub';
    else if (ba) tabBtn.innerHTML = '🏀 CourtOptix &amp; 4 Factors';
    else if (sa && sa.sportType === 'soccer') tabBtn.innerHTML = '⚽ Pitch xG &amp; Opta';
    else if (sa && (sa.sportType === 'nfl' || sa.sportType === 'ncaaf')) tabBtn.innerHTML = '🏈 Field Map &amp; EPA';
    else if (sa && sa.sportType === 'hockey') tabBtn.innerHTML = '🏒 Ice Slot &amp; Corsi';
    else if (sa && sa.sportType === 'baseball') tabBtn.innerHTML = '⚾ Statcast &amp; Diamond';
    else if (sa && sa.sportType === 'combat') tabBtn.innerHTML = '🥊 Octagon &amp; Strikes';
    else if (sa && (sa.sportType === 'racing' || sa.sportType === 'motorsport')) tabBtn.innerHTML = '🏎️ Circuit &amp; Sectors';
    else if (sa && sa.sportType === 'tennis') tabBtn.innerHTML = '🎾 Hawk-Eye Court';
    else if (sa && sa.sportType === 'cricket') tabBtn.innerHTML = '🏏 Wagon Wheel &amp; Phases';
    else if (sa && sa.sportType === 'ncaab') tabBtn.innerHTML = '🎓 KenPom &amp; Shot Map';
    else tabBtn.innerHTML = '🏀 CourtOptix &amp; 4 Factors';
  }

  const ss = window.FreeBallStatsSmartScreen;

  // Multi-Sport Deep Analytics (Soccer, NFL, College Football, NHL Hockey, College Basketball, RedZone)
  if (!ba && sa) {
    const rzMultiHtml = (intel.redzoneIntel && ss?.renderRedZoneMultiGameSectionHtml)
      ? ss.renderRedZoneMultiGameSectionHtml(intel)
      : '';
    const hudCompat = {
      surfaceType: sa.surfaceType,
      sportAnalytics: sa,
      leverageIndex: sa.leverageIndex,
      leverageTier: sa.leverageTier,
      winProbTimeline: sa.winProbTimeline,
    };
    const spatialHtml = ss ? ss.renderSvgHalfCourtShotChart(hudCompat, { filterSide: window._modalScFilter || 'all' }) : '';
    const unitHtml = ss ? ss.renderOnCourt5v5AndStints(hudCompat) : '';
    const wormHtml = ss ? ss.renderWinProbWormChart(hudCompat) : '';
    const tacticalHtml = ss ? ss.renderSynergyPlayTypes(hudCompat) : '';

    const t1Abbr = sa.team1Meta?.abbreviation || 'TM1';
    const t2Abbr = sa.team2Meta?.abbreviation || 'TM2';

    container.innerHTML = `
      ${rzMultiHtml}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px;margin-bottom:14px;">
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-color);border-radius:10px;padding:12px;">
          ${spatialHtml}
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;">
          ${unitHtml}
          ${wormHtml}
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;">
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-color);border-radius:10px;padding:12px;">
          <div style="font-size:12px;font-weight:800;color:#00f2fe;margin-bottom:8px;">📐 ${escapeHtml(sa.sportBadge || 'FOUR ANALYTICAL PILLARS')}</div>
          <div style="font-size:12px;display:flex;flex-direction:column;gap:8px;">
            ${(sa.fourPillars || []).map(p => `
              <div>
                <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
                  <span>${escapeHtml(p.label)} <small style="color:var(--text-dim);">[${escapeHtml(p.weightLabel)}]</small></span>
                  <strong>${escapeHtml(t1Abbr)} ${escapeHtml(p.team1Value)} vs ${escapeHtml(t2Abbr)} ${escapeHtml(p.team2Value)}</strong>
                </div>
                <div style="font-size:10.5px;color:var(--text-dim);">${escapeHtml(p.description)}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-color);border-radius:10px;padding:12px;">
          <div style="font-size:12px;font-weight:800;color:#a78bfa;margin-bottom:8px;">⚡ TEMPO, PROJECTION &amp; MATCH MVP</div>
          <div style="font-size:12px;display:flex;flex-direction:column;gap:7px;">
            <div style="display:flex;justify-content:space-between;">
              <span>${escapeHtml(sa.paceAndProjection?.tempoLabel || 'Match Tempo')}</span>
              <strong>${escapeHtml(sa.paceAndProjection?.tempoValue || '')}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;">
              <span>Projected Model Outcome</span>
              <strong style="color:#00f2fe;">${escapeHtml(sa.paceAndProjection?.projectedFinal || '')}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;">
              <span>Active Momentum Swing</span>
              <strong style="color:#10b981;">${escapeHtml(sa.paceAndProjection?.activeMomentumRun || '')}</strong>
            </div>
            ${sa.mvpPerformer ? `
              <div style="margin-top:4px;padding:8px;border-radius:8px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.28);display:flex;align-items:center;gap:10px;">
                <img src="${escapeHtml(sa.mvpPerformer.headshot)}" alt="" style="width:38px;height:38px;border-radius:50%;object-fit:cover;">
                <div>
                  <div style="font-size:10px;font-weight:800;color:#fbbf24;">🌟 IMPACT LEADER • ${escapeHtml(sa.mvpPerformer.impactBadge)}</div>
                  <div style="font-weight:800;color:#fff;">${escapeHtml(sa.mvpPerformer.name)} (${escapeHtml(sa.mvpPerformer.teamAbbr)})</div>
                  <div style="font-size:11px;color:#cbd5e1;">${escapeHtml(sa.mvpPerformer.primaryLine)} • ${escapeHtml(sa.mvpPerformer.efficiencyLine)}</div>
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>

      ${tacticalHtml}

      <div style="margin-top:10px;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;">
        ${(sa.inGameInsights || []).map(ins => `
          <div style="background:rgba(145,70,255,0.07);border:1px solid rgba(145,70,255,0.25);border-radius:8px;padding:10px;font-size:12px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
              <span style="color:#c4b5fd;font-weight:700;font-size:10px;">${escapeHtml(ins.category)}</span>
              <span style="color:#00f2fe;font-weight:800;font-size:10px;">${escapeHtml(ins.metricBadge)}</span>
            </div>
            <div style="font-weight:700;margin-bottom:3px;">${escapeHtml(ins.title)}</div>
            <div style="color:var(--text-dim);font-size:11px;">${escapeHtml(ins.detail)}</div>
          </div>
        `).join('')}
      </div>
    `;

    container.querySelectorAll('[data-sc-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        window._modalScFilter = btn.getAttribute('data-sc-filter');
        renderInGameAnalytics(intel);
      });
    });
    container.querySelectorAll('[data-rz-card-pin]').forEach((el) => {
      el.addEventListener('click', () => {
        const eid = el.getAttribute('data-rz-card-pin');
        if (window.modalSmartScreen) window.modalSmartScreen.setRedZonePins(eid, undefined);
      });
    });
    return;
  }

  if (!ba) {
    container.innerHTML = `<div style="padding:16px;text-align:center;color:var(--text-dim);">Loading live telemetry &amp; spatial analytics...</div>`;
    return;
  }

  const t1 = ba.team1Analytics;
  const t2 = ba.team2Analytics;
  const shotChartHtml = ss ? ss.renderSvgHalfCourtShotChart(ba, { filterSide: window._modalScFilter || 'all' }) : '';
  const lineup5v5Html = ss ? ss.renderOnCourt5v5AndStints(ba) : '';
  const wormHtml = ss ? ss.renderWinProbWormChart(ba) : '';
  const synergyHtml = ss ? ss.renderSynergyPlayTypes(ba) : '';

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px;margin-bottom:14px;">
      <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-color);border-radius:10px;padding:12px;">
        ${shotChartHtml}
      </div>
      <div style="display:flex;flex-direction:column;gap:12px;">
        ${lineup5v5Html}
        ${wormHtml}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;">
      <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-color);border-radius:10px;padding:12px;">
        <div style="font-size:12px;font-weight:800;color:#00f2fe;margin-bottom:8px;">📐 DEAN OLIVER'S FOUR FACTORS &amp; SHOT QUALITY</div>
        <div style="font-size:12px;display:flex;flex-direction:column;gap:6px;">
          <div style="display:flex;justify-content:space-between;"><span>Effective FG% (eFG%) [40%]</span><strong>${t1.abbreviation} ${t1.fourFactors.efgPct}% vs ${t2.abbreviation} ${t2.fourFactors.efgPct}%</strong></div>
          <div style="display:flex;justify-content:space-between;"><span>Expected eFG% (CourtOptix xEFG%)</span><strong>${t1.abbreviation} ${t1.xEfgPct}% vs ${t2.abbreviation} ${t2.xEfgPct}%</strong></div>
          <div style="display:flex;justify-content:space-between;"><span>Turnover Rate (TOV%) [25%]</span><strong>${t1.abbreviation} ${t1.fourFactors.tovPct}% vs ${t2.abbreviation} ${t2.fourFactors.tovPct}%</strong></div>
          <div style="display:flex;justify-content:space-between;"><span>Offensive Reb % (ORB%) [20%]</span><strong>${t1.abbreviation} ${t1.fourFactors.orbPct}% vs ${t2.abbreviation} ${t2.fourFactors.orbPct}%</strong></div>
          <div style="display:flex;justify-content:space-between;"><span>Free Throw Rate (FTR) [15%]</span><strong>${t1.abbreviation} ${t1.fourFactors.ftRate}% vs ${t2.abbreviation} ${t2.fourFactors.ftRate}%</strong></div>
        </div>
      </div>
      <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-color);border-radius:10px;padding:12px;">
        <div style="font-size:12px;font-weight:800;color:#a78bfa;margin-bottom:8px;">🔄 STARTERS VS. BENCH ROTATION SPLITS</div>
        <div style="font-size:12px;display:flex;flex-direction:column;gap:6px;">
          <div style="display:flex;justify-content:space-between;"><span>Starters Scoring</span><strong>${t1.abbreviation} ${t1.unitSplits.startersPts} PTS | ${t2.abbreviation} ${t2.unitSplits.startersPts} PTS</strong></div>
          <div style="display:flex;justify-content:space-between;"><span>Bench Scoring (2nd Unit)</span><strong>${t1.abbreviation} ${t1.unitSplits.benchPts} PTS | ${t2.abbreviation} ${t2.unitSplits.benchPts} PTS</strong></div>
          <div style="display:flex;justify-content:space-between;"><span>Pace / 48-Min Projection</span><strong>${ba.projectedPaceScore.pace48} Poss (${ba.projectedPaceScore.team1Projected}-${ba.projectedPaceScore.team2Projected})</strong></div>
          <div style="display:flex;justify-content:space-between;"><span>Offensive Rating (ORTG)</span><strong>${t1.abbreviation} ${t1.ortg} | ${t2.abbreviation} ${t2.ortg}</strong></div>
        </div>
      </div>
    </div>
    ${synergyHtml}
    <div style="margin-top:10px;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;">
      ${(ba.inGameInsights || []).map(ins => `
        <div style="background:rgba(145,70,255,0.07);border:1px solid rgba(145,70,255,0.25);border-radius:8px;padding:10px;font-size:12px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="color:#c4b5fd;font-weight:700;font-size:10px;">${escapeHtml(ins.category)}</span><span style="color:#00f2fe;font-weight:800;font-size:10px;">${escapeHtml(ins.metricBadge)}</span></div>
          <div style="font-weight:700;margin-bottom:3px;">${escapeHtml(ins.title)}</div>
          <div style="color:var(--text-dim);font-size:11px;">${escapeHtml(ins.detail)}</div>
        </div>
      `).join('')}
    </div>
  `;

  container.querySelectorAll('[data-sc-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      window._modalScFilter = btn.getAttribute('data-sc-filter');
      renderInGameAnalytics(intel);
    });
  });
}

// Render Box Score Component
function renderBoxScore(boxscore) {
  const teamNav = document.getElementById('boxscore-team-nav');
  const catPills = document.getElementById('boxscore-cat-pills');
  const tableContainer = document.getElementById('boxscore-table-container');
  if (!teamNav || !catPills || !tableContainer) return;

  if (!boxscore || (!boxscore.team1 && !boxscore.team2)) {
    tableContainer.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 24px;">Box score statistics will be populated during live play.</div>`;
    return;
  }

  const team1 = boxscore.team1 || { teamName: 'Team 1', categories: [] };
  const team2 = boxscore.team2 || { teamName: 'Team 2', categories: [] };

  // Render Team Selector buttons
  teamNav.innerHTML = `
    <button class="btn ${activeBoxScoreTeam === 'team1' ? 'btn-primary' : 'btn-outline'}" id="bs-btn-t1" style="font-size: 13px; padding: 6px 14px;">
      ${escapeHtml(team1.teamName)}
    </button>
    <button class="btn ${activeBoxScoreTeam === 'team2' ? 'btn-primary' : 'btn-outline'}" id="bs-btn-t2" style="font-size: 13px; padding: 6px 14px;">
      ${escapeHtml(team2.teamName)}
    </button>
  `;

  document.getElementById('bs-btn-t1').addEventListener('click', () => {
    activeBoxScoreTeam = 'team1';
    activeBoxScoreCatIndex = 0;
    renderBoxScore(boxscore);
  });
  document.getElementById('bs-btn-t2').addEventListener('click', () => {
    activeBoxScoreTeam = 'team2';
    activeBoxScoreCatIndex = 0;
    renderBoxScore(boxscore);
  });

  const curTeam = activeBoxScoreTeam === 'team1' ? team1 : team2;
  const categories = curTeam.categories || [];

  if (categories.length === 0) {
    catPills.innerHTML = '';
    tableContainer.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 24px;">No box score category data available for ${escapeHtml(curTeam.teamName)}.</div>`;
    return;
  }

  if (activeBoxScoreCatIndex >= categories.length) {
    activeBoxScoreCatIndex = 0;
  }

  // Render Category Filter Pills
  catPills.innerHTML = categories.map((cat, idx) => `
    <button class="boxscore-cat-btn ${idx === activeBoxScoreCatIndex ? 'active' : ''}" data-idx="${idx}">
      ${escapeHtml(cat.displayName || cat.name)}
    </button>
  `).join('');

  catPills.querySelectorAll('.boxscore-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeBoxScoreCatIndex = parseInt(btn.dataset.idx, 10) || 0;
      renderBoxScore(boxscore);
    });
  });

  // Render Category Table
  const currentCat = categories[activeBoxScoreCatIndex];
  if (!currentCat || !currentCat.athletes || currentCat.athletes.length === 0) {
    tableContainer.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 24px;">No player statistics recorded for ${escapeHtml(currentCat?.displayName || 'this category')}.</div>`;
    return;
  }

  const headers = ['ATHLETE', ...(currentCat.labels || [])];
  const sportPath = currentIntel?.sportPath || '';

  const tableHtml = `
    <table class="boxscore-table">
      <thead>
        <tr>
          ${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${currentCat.athletes.map(ath => `
          <tr>
            <td>
              <div class="boxscore-athlete-cell" onclick="openAthleteProfile('${escapeHtml(ath.id)}', '${escapeHtml(sportPath)}', '${escapeHtml(ath.name)}')">
                <img class="boxscore-athlete-avatar" src="${escapeHtml(ath.headshot)}" alt="${escapeHtml(ath.name)}" onerror="this.src='https://a.espncdn.com/combiner/i?img=/i/headshots/nophoto.png&w=120&h=90'">
                <span>
                  ${escapeHtml(ath.name)}
                  ${ath.jersey ? `<span style="color: #a78bfa; font-weight: 700;">#${escapeHtml(ath.jersey)}</span>` : ''}
                  ${ath.position ? `<span style="font-size: 11px; color: var(--text-dim); font-weight: 600;">${escapeHtml(ath.position)}</span>` : ''}
                </span>
              </div>
            </td>
            ${(ath.stats || []).map(val => `<td>${escapeHtml(val)}</td>`).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  tableContainer.innerHTML = tableHtml;
}

let activeRosterUnit = 'ALL';

// Render Team Rosters Component
function renderRosters(rosters) {
  const rosterNav = document.getElementById('roster-team-nav');
  const gridContainer = document.getElementById('roster-grid-container');
  if (!rosterNav || !gridContainer) return;

  if (!rosters || (!rosters.team1 && !rosters.team2)) {
    gridContainer.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 24px;">Roster information will be available once confirmed.</div>`;
    return;
  }

  const t1Name = currentIntel?.scoreboard?.team1?.name || 'Team 1';
  const t2Name = currentIntel?.scoreboard?.team2?.name || 'Team 2';
  const t1List = rosters.team1 || [];
  const t2List = rosters.team2 || [];

  const athletes = activeRosterTeam === 'team1' ? t1List : t2List;
  const units = Array.from(new Set(athletes.map(a => a.unit).filter(Boolean)));
  if (activeRosterUnit !== 'ALL' && !units.includes(activeRosterUnit)) {
    activeRosterUnit = 'ALL';
  }

  const filteredAthletes = activeRosterUnit === 'ALL'
    ? athletes
    : athletes.filter(a => a.unit === activeRosterUnit);

  rosterNav.style.flexWrap = 'wrap';
  rosterNav.style.alignItems = 'center';
  rosterNav.innerHTML = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;width:100%;">
      <button class="btn ${activeRosterTeam === 'team1' ? 'btn-primary' : 'btn-outline'}" id="ros-btn-t1" style="font-size: 13px; padding: 6px 14px;">
        ${escapeHtml(t1Name)} (${t1List.length})
      </button>
      <button class="btn ${activeRosterTeam === 'team2' ? 'btn-primary' : 'btn-outline'}" id="ros-btn-t2" style="font-size: 13px; padding: 6px 14px;">
        ${escapeHtml(t2Name)} (${t2List.length})
      </button>
      ${units.length > 1 ? `
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-left:auto;">
          <button class="btn ${activeRosterUnit === 'ALL' ? 'btn-primary' : 'btn-outline'}" data-ros-unit="ALL" style="font-size:11px;padding:4px 10px;">
            All (${athletes.length})
          </button>
          ${units.map(u => {
            const cnt = athletes.filter(a => a.unit === u).length;
            return `<button class="btn ${activeRosterUnit === u ? 'btn-primary' : 'btn-outline'}" data-ros-unit="${escapeHtml(u)}" style="font-size:11px;padding:4px 10px;">${escapeHtml(u)} (${cnt})</button>`;
          }).join('')}
        </div>
      ` : ''}
    </div>
  `;

  document.getElementById('ros-btn-t1').addEventListener('click', () => {
    activeRosterTeam = 'team1';
    activeRosterUnit = 'ALL';
    renderRosters(rosters);
  });
  document.getElementById('ros-btn-t2').addEventListener('click', () => {
    activeRosterTeam = 'team2';
    activeRosterUnit = 'ALL';
    renderRosters(rosters);
  });
  rosterNav.querySelectorAll('[data-ros-unit]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeRosterUnit = btn.getAttribute('data-ros-unit') || 'ALL';
      renderRosters(rosters);
    });
  });

  const sportPath = currentIntel?.sportPath || '';

  if (filteredAthletes.length === 0) {
    gridContainer.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 24px;">No roster members found for this selection.</div>`;
    return;
  }

  gridContainer.innerHTML = filteredAthletes.map(ath => {
    const posLabel = ath.position || ath.unit || 'Active';
    const subParts = [ath.unit, ath.height && ath.weight ? `${ath.height} • ${ath.weight}` : '', ath.experience].filter(Boolean);
    return `
      <div class="roster-card" onclick="openAthleteProfile('${escapeHtml(ath.id)}', '${escapeHtml(sportPath)}', '${escapeHtml(ath.name)}')">
        <img class="roster-avatar" src="${escapeHtml(ath.headshot)}" alt="${escapeHtml(ath.name)}" onerror="this.src='https://a.espncdn.com/combiner/i?img=/i/headshots/nophoto.png&w=120&h=90'">
        <div style="overflow: hidden; flex: 1;">
          <div style="display:flex;align-items:center;gap:6px;justify-content:space-between;">
            <div style="font-weight: 800; color: #fff; font-size: 13px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
              ${escapeHtml(ath.name)}
            </div>
            ${ath.starter ? `<span style="font-size:9px;font-weight:900;background:rgba(16,185,129,0.18);color:#34d399;border:1px solid rgba(16,185,129,0.35);padding:1px 5px;border-radius:4px;flex-shrink:0;">STR</span>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:5px;margin-top:3px;font-size:11px;font-weight:700;">
            ${ath.jersey ? `<span style="color:#cbd5e1;">#${escapeHtml(ath.jersey)}</span>` : ''}
            <span style="background:rgba(145,70,255,0.2);color:#c4b5fd;border:1px solid rgba(145,70,255,0.4);padding:1px 6px;border-radius:4px;font-size:10px;font-weight:800;">${escapeHtml(posLabel)}</span>
          </div>
          <div style="font-size: 10px; color: var(--text-dim); white-space: nowrap; text-overflow: ellipsis; overflow: hidden; margin-top: 3px;">
            ${escapeHtml(subParts.join(' • ') || ath.teamName || '')}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Open Live On-Demand Interactive Athlete Stats Explorer
window.openAthleteProfile = async function(athleteId, sportPath, fallbackName) {
  const modal = document.getElementById('player-profile-modal');
  const mount = document.getElementById('prof-explorer-mount');
  if (!modal || !mount) return;

  if (window.FreeBallStatsAthleteExplorer) {
    window.FreeBallStatsAthleteExplorer.resetState();
  }
  mount.innerHTML = `<div style="padding: 48px 24px; text-align: center; color: var(--text-dim);">Pulling live career stats, game logs &amp; splits for <strong>${escapeHtml(fallbackName || 'Athlete')}</strong> directly from ESPN...</div>`;
  modal.classList.add('show');

  let sport = 'basketball';
  let league = 'nba';
  if (sportPath && sportPath.includes('/')) {
    const parts = sportPath.split('/');
    sport = parts[0];
    league = parts[1];
  } else if (state.activeStream?.category) {
    sport = state.activeStream.category;
    league = state.activeStream.league || (sport === 'football' ? 'nfl' : sport === 'hockey' ? 'nhl' : sport === 'baseball' ? 'mlb' : 'nba');
  }

  const fetchAndRender = async (seasonYear) => {
    try {
      const qs = seasonYear ? `?season=${encodeURIComponent(seasonYear)}&t=${Date.now()}` : `?t=${Date.now()}`;
      const res = await fetch(`/api/v1/athlete/${encodeURIComponent(sport)}/${encodeURIComponent(league)}/${encodeURIComponent(athleteId)}${qs}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      if (window.FreeBallStatsAthleteExplorer) {
        window.FreeBallStatsAthleteExplorer.renderInto(mount, data, fetchAndRender);
      }
    } catch (err) {
      mount.innerHTML = `<div style="padding: 32px; text-align: center; color: #f87171;">Unable to load live stats for ${escapeHtml(fallbackName || 'Athlete')} right now.</div>`;
    }
  };

  await fetchAndRender();
};

// Modal Live Chat
function setupModalChat(streamKey) {
  if (modalChatEventSource) {
    modalChatEventSource.close();
    modalChatEventSource = null;
  }

  const container = document.getElementById('modal-chat-messages');
  if (!container) return;
  container.innerHTML = '<div style="color: var(--text-dim); font-size: 12px; padding: 10px; text-align: center;">Connecting to live stream chat...</div>';

  try {
    modalChatEventSource = new EventSource(`/api/v1/chat/${encodeURIComponent(streamKey)}/events`);

    modalChatEventSource.addEventListener('history', (e) => {
      const msgs = JSON.parse(e.data);
      container.innerHTML = '';
      msgs.forEach(appendModalChatMessage);
      container.scrollTop = container.scrollHeight;
    });

    modalChatEventSource.addEventListener('chat_message', (e) => {
      const msg = JSON.parse(e.data);
      appendModalChatMessage(msg);
      container.scrollTop = container.scrollHeight;
    });
  } catch (e) {}

  function appendModalChatMessage(msg) {
    const div = document.createElement('div');
    div.className = 'chat-bubble';
    div.style.margin = '4px 8px';
    div.innerHTML = `
      <span class="chat-badge">${escapeHtml(msg.badge || 'Fan')}</span>
      <span class="chat-user">${escapeHtml(msg.username)}:</span>
      <span>${escapeHtml(msg.message)}</span>
    `;
    container.appendChild(div);
  }
}

function closePlayerModal() {
  const modal = document.getElementById('player-modal');
  const iframe = document.getElementById('modal-iframe');
  iframe.src = '';
  modal.classList.remove('show');
  state.activeStream = null;

  if (intelPollTimer) {
    clearInterval(intelPollTimer);
    intelPollTimer = null;
  }

  if (modalChatEventSource) {
    modalChatEventSource.close();
    modalChatEventSource = null;
  }
}

// Embed Helpers
function copyStreamEmbed(stream) {
  const code = `<iframe src="${window.location.origin}/embed/${encodeURIComponent(stream.category)}/${encodeURIComponent(stream.stream_key)}" width="100%" height="480" allow="fullscreen; picture-in-picture" allowfullscreen frameborder="0"></iframe>`;
  navigator.clipboard.writeText(code).then(() => {
    showToast('Embed code copied to clipboard!', 'success');
  });
}

window.copyProxyForStream = function(streamKey, category) {
  const stream = state.streams.find(s => s.stream_key === streamKey);
  const liveSource = stream && stream.sources ? (stream.sources.find(s => s.live) || stream.sources[0]) : null;
  const targetUrl = liveSource ? liveSource.url : `${window.location.origin}/embed/${encodeURIComponent(category)}/${encodeURIComponent(streamKey)}`;
  const proxyUrl = `${window.location.origin}/api/v1/proxy/m3u8?url=${encodeURIComponent(targetUrl)}`;

  navigator.clipboard.writeText(proxyUrl).then(() => {
    showToast('Direct M3U8 proxy URL copied for VLC / IPTV players!', 'success');
  });
};

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bg = type === 'success' ? '#10b981' : (type === 'error' ? '#ef4444' : '#9146ff');
  toast.style.cssText = `
    background: #181b26;
    border-left: 4px solid ${bg};
    color: #fff;
    padding: 12px 18px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    box-shadow: 0 8px 30px rgba(0,0,0,0.6);
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 10px;
    opacity: 0;
    transform: translateY(10px);
    transition: all 0.25s ease;
  `;

  toast.innerHTML = `<span>⚡</span> <span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  // Remove after 3.5s
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

window.openEmbedForStream = function(streamKey) {
  populateEmbedModal(streamKey);
  document.getElementById('embed-generator-modal').classList.add('show');
};

function populateEmbedModal(selectedKey) {
  const select = document.getElementById('embed-stream-select');
  select.innerHTML = state.streams.map(s => `
    <option value="${s.stream_key}" data-category="${s.category}" ${s.stream_key === selectedKey ? 'selected' : ''}>
      ${escapeHtml(s.name)} (${s.category})
    </option>
  `).join('');

  updateEmbedSnippet();
}

function updateEmbedSnippet() {
  const select = document.getElementById('embed-stream-select');
  const width = document.getElementById('embed-width').value || '100%';
  const height = document.getElementById('embed-height').value || '480';
  const selectedOption = select.options[select.selectedIndex];

  if (!selectedOption) return;
  const key = selectedOption.value;
  const category = selectedOption.dataset.category || 'sports';

  const embedUrl = `${window.location.origin}/embed/${encodeURIComponent(category)}/${encodeURIComponent(key)}`;
  const code = `<iframe src="${embedUrl}" width="${escapeHtml(width)}" height="${escapeHtml(height)}" allow="fullscreen; picture-in-picture" allowfullscreen frameborder="0"></iframe>`;

  document.getElementById('generated-snippet').textContent = code;
}

// Real-Time Server-Sent Events (SSE)
function setupSSE() {
  const statusPill = document.getElementById('connection-status');
  const statusText = document.getElementById('connection-text');

  try {
    const es = new EventSource('/api/v1/events/live-updates');

    es.addEventListener('connected', () => {
      statusText.textContent = 'Real-Time Sync Active';
    });

    es.addEventListener('snapshot', (e) => {
      const data = JSON.parse(e.data);
      if (data && data.streams) {
        state.streams = data.streams;
        renderStreams();
      }
    });

    es.addEventListener('streams_update', (e) => {
      const data = JSON.parse(e.data);
      if (data && data.streams) {
        state.streams = data.streams;
        renderStreams();
      }
    });

    es.onerror = () => {
      statusText.textContent = 'Reconnecting...';
    };
  } catch (err) {
    console.error('SSE initialization error:', err);
  }
}

// Fetch Active Mirror Diagnostics
async function fetchMirrorStatus() {
  try {
    const res = await fetch('/api/v1/mirrors');
    if (res.ok) {
      const data = await res.json();
      const statusEl = document.getElementById('mirror-status');
      if (statusEl) {
        statusEl.innerHTML = `Connected to Upstream: <strong style="color: #a78bfa;">${data.activeMirror}</strong>`;
      }
    }
  } catch (err) {}
}

// Utilities
function formatTimestamp(ts) {
  if (!ts) return 'Live Now';
  const d = new Date(ts * 1000);
  const now = new Date();
  const diffHours = (d.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (diffHours < 0 && diffHours > -4) {
    return 'In Progress';
  }
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

