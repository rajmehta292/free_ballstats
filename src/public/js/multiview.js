// StreamFree Multi-View Engine

let allStreams = [];
let currentLayout = 4;
let tileStreams = [];
let tileTelemetry = {};

document.addEventListener('DOMContentLoaded', async () => {
  setupLayoutButtons();
  await loadStreams();
  renderGrid();
  refreshAllTilesTelemetry();
  setInterval(refreshAllTilesTelemetry, 20000);
});

function setupLayoutButtons() {
  document.querySelectorAll('.layout-btn[data-layout]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.layout-btn[data-layout]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentLayout = parseInt(btn.dataset.layout, 10);
      renderGrid();
      refreshAllTilesTelemetry();
    });
  });

  const crunchBtn = document.getElementById('focus-crunch-btn');
  if (crunchBtn) {
    crunchBtn.addEventListener('click', () => {
      // Find stream with highest Leverage Index and promote to Screen 1 in 1-Screen or 2-Split view
      let bestKey = null;
      let bestLi = -1;
      for (const [k, hud] of Object.entries(tileTelemetry)) {
        if ((hud?.leverageIndex || 0) > bestLi) {
          bestLi = hud.leverageIndex || 0;
          bestKey = k;
        }
      }
      if (bestKey) {
        const found = allStreams.find(s => s.stream_key === bestKey);
        if (found) {
          tileStreams[0] = found;
          currentLayout = 1;
          document.querySelectorAll('.layout-btn[data-layout]').forEach(b => {
            b.classList.toggle('active', b.dataset.layout === '1');
          });
          renderGrid();
          refreshAllTilesTelemetry();
        }
      }
    });
  }
}

async function loadStreams() {
  try {
    const res = await fetch('/api/v1/streams');
    if (res.ok) {
      const data = await res.json();
      allStreams = data.streams || [];
      // Pick initial streams for tiles
      tileStreams = allStreams.slice(0, 4);
    }
  } catch (err) {
    console.error('Failed to load streams for multi-view:', err);
  }
}

function renderGrid() {
  const container = document.getElementById('multiview-container');
  container.className = `multiview-grid grid-${currentLayout}`;
  container.innerHTML = '';

  for (let i = 0; i < currentLayout; i++) {
    const selectedStream = tileStreams[i] || allStreams[i % allStreams.length];
    const tile = createTileElement(i, selectedStream);
    container.appendChild(tile);
  }
}

function createTileElement(index, stream) {
  const tile = document.createElement('div');
  tile.className = 'multiview-tile';

  const selectOptions = allStreams.map(s => `
    <option value="${s.stream_key}" ${stream && s.stream_key === stream.stream_key ? 'selected' : ''}>
      ${s.name} (${s.category})
    </option>
  `).join('');

  tile.innerHTML = `
    <div class="tile-header">
      <div style="font-weight: 700; font-size: 12px; color: var(--accent); flex-shrink: 0;">Screen ${index + 1}</div>
      <select id="tile-select-${index}">
        ${selectOptions}
      </select>
      <span class="tile-telemetry-badge" id="tile-hud-${index}">LI 1.0x</span>
      <button class="btn btn-outline" style="padding: 4px 8px; font-size: 11px;" onclick="fullscreenTile(${index})">
        Fullscreen
      </button>
    </div>
    <div class="tile-body" id="tile-body-${index}">
      ${stream ? `
        <iframe
          src="/embed/${encodeURIComponent(stream.category)}/${encodeURIComponent(stream.stream_key)}?muted=${index === 0 ? '0' : '1'}&hud=0"
          allow="fullscreen; picture-in-picture; autoplay"
          allowfullscreen
        ></iframe>
      ` : '<div style="padding: 40px; text-align: center; color: var(--text-dim);">No stream selected</div>'}
    </div>
  `;

  const selectEl = tile.querySelector(`#tile-select-${index}`);
  selectEl.addEventListener('change', (e) => {
    const chosenKey = e.target.value;
    const newStream = allStreams.find(s => s.stream_key === chosenKey);
    tileStreams[index] = newStream;
    const body = tile.querySelector(`#tile-body-${index}`);
    if (newStream) {
      body.innerHTML = `
        <iframe
          src="/embed/${encodeURIComponent(newStream.category)}/${encodeURIComponent(newStream.stream_key)}?muted=${index === 0 ? '0' : '1'}&hud=0"
          allow="fullscreen; picture-in-picture; autoplay"
          allowfullscreen
        ></iframe>
      `;
      refreshAllTilesTelemetry();
    }
  });

  return tile;
}

async function refreshAllTilesTelemetry() {
  if (document.hidden) return;
  let maxLi = -1;
  let maxTileIdx = -1;

  // Deduplicate active tile streams and fetch concurrently instead of sequentially
  const uniqueStreams = [];
  const seenKeys = new Set();
  for (let i = 0; i < currentLayout; i++) {
    const stream = tileStreams[i] || allStreams[i % Math.max(1, allStreams.length)];
    if (stream && !seenKeys.has(stream.stream_key)) {
      seenKeys.add(stream.stream_key);
      uniqueStreams.push(stream);
    }
  }

  await Promise.allSettled(
    uniqueStreams.map(async (stream) => {
      try {
        const res = await fetch(`/api/v1/basketball/smart-hud/${encodeURIComponent(stream.stream_key)}`);
        if (!res.ok) return;
        tileTelemetry[stream.stream_key] = await res.json();
      } catch {}
    })
  );

  for (let i = 0; i < currentLayout; i++) {
    const stream = tileStreams[i] || allStreams[i % Math.max(1, allStreams.length)];
    if (!stream) continue;
    const hud = tileTelemetry[stream.stream_key];
    const badge = document.getElementById(`tile-hud-${i}`);
    if (badge && hud && hud.team1 && hud.team2) {
      const li = hud.leverageIndex || 1.0;
      const stDetail = hud.detail ? ` • ${hud.detail}` : '';
      badge.textContent = `${hud.team1.abbreviation} ${hud.team1.score}-${hud.team2.score} ${hud.team2.abbreviation}${stDetail} • LI ${li}x`;
      badge.classList.toggle('crunch', li >= 1.8 || Boolean(hud.isClutchTime));
      if (li > maxLi) {
        maxLi = li;
        maxTileIdx = i;
      }
    }
  }

  document.querySelectorAll('.multiview-tile').forEach((tileEl, idx) => {
    tileEl.classList.toggle('crunch-time-tile', idx === maxTileIdx && maxLi >= 1.3);
  });
}

window.fullscreenTile = function(index) {
  const body = document.getElementById(`tile-body-${index}`);
  if (body) {
    if (body.requestFullscreen) {
      body.requestFullscreen();
    } else if (body.webkitRequestFullscreen) {
      body.webkitRequestFullscreen();
    }
  }
};

