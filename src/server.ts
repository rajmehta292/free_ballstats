import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { config } from './config.js';
import { apiRoutes } from './routes/api.js';
import { embedRoutes } from './routes/embed.js';
import { healthRoutes } from './routes/health.js';
import { proxyRoutes } from './routes/proxy.js';
import { chatRoutes } from './routes/chat.js';
import { exportRoutes } from './routes/export.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function buildServer() {
  const server = Fastify({
    logger: {
      level: config.logLevel,
    },
  });

  // Enable CORS
  await server.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // Register OpenAPI / Swagger documentation
  await server.register(swagger, {
    openapi: {
      info: {
        title: 'Free_BallStats — Basketball Research & Live Sports Intelligence API',
        description: 'Advanced Basketball Analytics Engine (Dean Oliver Four Factors, Hollinger Game Score, True Shooting, Pace/ORTG/DRTG, Shot Diet, Rotation Splits) + High-Performance Live Sports Streaming Platform.',
        version: '2.0.0',
      },
      servers: [
        {
          url: `http://localhost:${config.port}`,
          description: 'Local development server',
        },
      ],
      tags: [
        { name: 'Open Sports Data API', description: 'Zero-DB Federated Sports Data Gateway (JSON, CSV, Sparse Fields, Provenance, Capabilities, H2H)' },
        { name: 'Basketball Research', description: 'Advanced NBA/Basketball analytics, Four Factors, Player Comparison Lab, and Natural Language Query Engine' },
        { name: 'Sports Intelligence', description: 'Live Gamecast scoreboard, boxscore, rosters, and athlete explorers' },
        { name: 'Media Proxy', description: 'SSRF-hardened HLS manifest and segment proxy endpoints' },
        { name: 'Export', description: 'IPTV M3U playlist and XMLTV EPG exporters' },
        { name: 'Streams', description: 'Stream discovery, querying, and sources' },
        { name: 'Catalog', description: 'Categories and sports leagues' },
        { name: 'Custom Streams', description: 'Manage local and custom streams' },
        { name: 'Real-Time', description: 'Server-Sent Events (SSE) scoreboard & live update streams' },
        { name: 'Diagnostics', description: 'Health, provider circuit breakers, and mirror diagnostics' },
      ],
    },
  });

  await server.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
    staticCSP: true,
  });

  // Serve static UI assets (support both src/public and dist/public)
  const distPublic = path.join(__dirname, 'public');
  const srcPublic = path.join(__dirname, '../src/public');
  const publicDir = fs.existsSync(distPublic) ? distPublic : srcPublic;
  await server.register(fastifyStatic, {
    root: publicDir,
    prefix: '/',
  });

  // Register routes
  await server.register(healthRoutes);
  await server.register(apiRoutes, { prefix: '/api/v1' });
  await server.register(proxyRoutes, { prefix: '/api/v1' });
  await server.register(chatRoutes, { prefix: '/api/v1' });
  await server.register(exportRoutes, { prefix: '/api/v1' });
  await server.register(embedRoutes);

  // Top-level Basketball Research Lab clean route alias
  server.get('/basketball', async (_request, reply) => {
    return reply.sendFile('basketball.html');
  });

  // Top-level feedback route to match StreamFree spec (/api/feedback)
  server.post('/api/feedback', async (request, reply) => {
    return server.inject({
      method: 'POST',
      url: '/api/v1/feedback',
      payload: request.body as any,
    }).then(res => reply.status(res.statusCode).send(res.json()));
  });

  return server;
}

async function start() {
  const server = await buildServer();

  try {
    const address = await server.listen({
      port: config.port,
      host: config.host,
    });

    console.log(`
============================================================
🏀 Free_BallStats (v2.0) is RUNNING
============================================================
📡 Server URL:             ${address}
🏀 Basketball Research:    ${address}/basketball.html
🎮 Live Sports Hub:        ${address}/
📺 Multi-View Matrix:      ${address}/multiview.html
📚 Swagger API Docs:       ${address}/docs
❤️ Health Check:           ${address}/health
============================================================
    `);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

// Auto-start if run directly (supports junctions and symlinks)
const isMain = (() => {
  try {
    return process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return process.argv[1] === fileURLToPath(import.meta.url);
  }
})();

if (isMain) {
  start();
}
