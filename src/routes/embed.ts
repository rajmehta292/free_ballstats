import type { FastifyPluginAsync } from 'fastify';
import { streamFreeClient } from '../services/streamfree-client.js';

export const embedRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /embed/:category/:stream_key
   * Responsive stream embed matching the StreamFree API spec
   */
  fastify.get<{
    Params: { category: string; stream_key: string };
    Querystring: { autoplay?: string; muted?: string; quality?: string };
  }>('/embed/:category/:stream_key', async (request, reply) => {
    const { category, stream_key } = request.params;
    const { autoplay, muted, quality } = request.query;

    const stream = await streamFreeClient.getStreamByKey(stream_key);
    const activeMirror = streamFreeClient.getActiveMirror();

    // Determine default video source URL
    let defaultSourceUrl = '';
    let isLive = false;
    let availableSources: any[] = [];

    if (stream && stream.sources && stream.sources.length > 0) {
      availableSources = stream.sources;
      const liveSource = stream.sources.find(s => s.live) || stream.sources[0];
      defaultSourceUrl = liveSource.url;
      isLive = stream.sources.some(s => s.live);
    } else {
      defaultSourceUrl = `${activeMirror}/embed/${encodeURIComponent(category)}/${encodeURIComponent(stream_key)}`;
    }

    const title = stream ? `${stream.name} | StreamFree Player` : 'Live Stream';
    const autoPlayBool = autoplay !== '0' && autoplay !== 'false';
    const mutedBool = muted === '1' || muted === 'true';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.7/dist/hls.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      background: #090a0f;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      overflow: hidden;
    }
    .player-container {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #000;
    }
    video {
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #000;
    }
    iframe.fallback-frame {
      width: 100%;
      height: 100%;
      border: 0;
    }
    .stream-overlay {
      position: absolute;
      top: 14px;
      left: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(0, 0, 0, 0.65);
      backdrop-filter: blur(8px);
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
      pointer-events: none;
      z-index: 10;
    }
    .smart-hud-pill {
      position: absolute;
      top: 14px;
      right: 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgba(9, 10, 15, 0.82);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(145, 70, 255, 0.4);
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      z-index: 15;
      color: #f8fafc;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.5);
    }
    .smart-hud-pill .li-tag {
      background: rgba(245, 158, 11, 0.2);
      color: #fcd34d;
      padding: 2px 7px;
      border-radius: 999px;
      font-size: 10px;
      font-family: monospace;
    }
    .smart-hud-toggle {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #cbd5e1;
      border-radius: 999px;
      padding: 2px 8px;
      font-size: 10px;
      cursor: pointer;
      font-weight: 700;
    }
    .smart-hud-toggle:hover {
      background: #9146ff;
      color: #fff;
    }
    .smart-hud-drawer {
      position: absolute;
      bottom: 14px;
      right: 14px;
      width: 280px;
      background: rgba(9, 10, 15, 0.88);
      backdrop-filter: blur(14px);
      border: 1px solid rgba(145, 70, 255, 0.45);
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 11px;
      z-index: 15;
      display: none;
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.65);
    }
    .smart-hud-drawer.open {
      display: block;
    }
    .live-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #ef4444;
      box-shadow: 0 0 10px #ef4444;
      animation: pulse 1.5s infinite;
    }
    .waiting-box {
      display: ${isLive ? 'none' : 'flex'};
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: absolute;
      inset: 0;
      background: rgba(10, 12, 18, 0.95);
      z-index: 20;
      gap: 16px;
      text-align: center;
      padding: 24px;
    }
    .waiting-box h2 { font-size: 20px; font-weight: 700; color: #fff; }
    .waiting-box p { font-size: 14px; color: #94a3b8; max-width: 440px; }
    .btn-action {
      background: #9146ff;
      color: #fff;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-action:hover { background: #7c2cf5; }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }
  </style>
</head>
<body>
  <div class="player-container">
    <div class="stream-overlay">
      <span class="live-dot" style="${isLive ? '' : 'background: #eab308; box-shadow: 0 0 8px #eab308;'}"></span>
      <span>${isLive ? 'LIVE' : 'WAITING FOR BROADCAST'}</span>
      <span style="opacity: 0.6;">•</span>
      <span>${category.toUpperCase()}</span>
    </div>

    <div class="smart-hud-pill" id="embed-smart-hud">
      <span id="embed-hud-score">Loading Telemetry...</span>
      <span class="li-tag" id="embed-hud-li">LI 1.0x</span>
      <button type="button" class="smart-hud-toggle" id="embed-hud-btn">📊 HUD</button>
    </div>

    <div class="smart-hud-drawer" id="embed-hud-drawer">
      <div style="font-size:10px;color:#a78bfa;font-weight:800;text-transform:uppercase;margin-bottom:4px;" id="embed-hud-card-cat">SMART BROADCAST TELEMETRY</div>
      <div style="font-weight:800;color:#fff;margin-bottom:3px;" id="embed-hud-card-title">Synchronizing CourtOptix & Four Factors...</div>
      <div style="color:#cbd5e1;line-height:1.35;" id="embed-hud-card-sub">Click HUD to toggle live analytical overlay.</div>
    </div>

    <div class="waiting-box" id="waiting-banner">
      <h2>Stream Starting Soon</h2>
      <p>${stream ? stream.name : stream_key} will be broadcasted once the event commences.</p>
      <button class="btn-action" onclick="checkLiveStatus()">Check Live Status</button>
    </div>

    <!-- Direct or Upstream Player -->
    <div id="player-mount" style="width: 100%; height: 100%;">
      ${
        defaultSourceUrl.endsWith('.m3u8')
          ? `<video id="video-el" controls ${mutedBool ? 'muted' : ''} ${autoPlayBool ? 'autoplay' : ''} playsinline></video>`
          : `<iframe id="stream-frame" class="fallback-frame" src="${defaultSourceUrl}" allow="fullscreen; picture-in-picture; autoplay" allowfullscreen></iframe>`
      }
    </div>
  </div>

  <script>
    const streamKey = ${JSON.stringify(stream_key)};
    const directUrl = ${JSON.stringify(defaultSourceUrl)};
    const isM3U8 = directUrl.endsWith('.m3u8');

    if (isM3U8) {
      const video = document.getElementById('video-el');
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
        hls.loadSource(directUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          ${autoPlayBool ? 'video.play().catch(() => {});' : ''}
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = directUrl;
        ${autoPlayBool ? 'video.play().catch(() => {});' : ''}
      }
    }

    async function checkLiveStatus() {
      try {
        const res = await fetch('/api/v1/sources/' + encodeURIComponent(streamKey));
        if (res.ok) {
          const data = await res.json();
          const hasLive = (data.sources || []).some(s => s.live);
          if (hasLive) {
            document.getElementById('waiting-banner').style.display = 'none';
            location.reload();
          } else {
            alert('Event broadcast has not started yet. Polling will resume automatically.');
          }
        }
      } catch (err) {}
    }

    // Auto-poll if waiting
    if (!${isLive}) {
      setInterval(async () => {
        try {
          const res = await fetch('/api/v1/sources/' + encodeURIComponent(streamKey));
          if (res.ok) {
            const data = await res.json();
            if ((data.sources || []).some(s => s.live)) {
              location.reload();
            }
          }
        } catch (e) {}
      }, 15000);
    }

    // Smart HUD Live Telemetry Polling
    const hudBtn = document.getElementById('embed-hud-btn');
    const hudDrawer = document.getElementById('embed-hud-drawer');
    if (hudBtn && hudDrawer) {
      hudBtn.addEventListener('click', () => {
        hudDrawer.classList.toggle('open');
      });
    }

    async function refreshEmbedSmartHud() {
      try {
        const res = await fetch('/api/v1/basketball/smart-hud/' + encodeURIComponent(streamKey));
        if (!res.ok) return;
        const hud = await res.json();
        const scoreEl = document.getElementById('embed-hud-score');
        const liEl = document.getElementById('embed-hud-li');
        if (scoreEl && hud.team1 && hud.team2) {
          scoreEl.textContent = hud.team1.abbreviation + ' ' + hud.team1.score + ' - ' + hud.team2.score + ' ' + hud.team2.abbreviation + ' (' + hud.statusDetail + ')';
        }
        if (liEl) {
          liEl.textContent = 'LI ' + (hud.leverageIndex || 1.0) + 'x';
        }
        const card = (hud.smartCards || [])[0];
        if (card) {
          document.getElementById('embed-hud-card-cat').textContent = card.category + ' • ' + card.badge;
          document.getElementById('embed-hud-card-title').textContent = card.headline;
          document.getElementById('embed-hud-card-sub').textContent = card.detail;
        }
      } catch (e) {}
    }
    refreshEmbedSmartHud();
    setInterval(refreshEmbedSmartHud, 20000);
  </script>
</body>
</html>`;

    reply.type('text/html');
    return reply.send(html);
  });
};

