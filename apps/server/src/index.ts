import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { config } from './config.js';
import { initDb } from './db/index.js';
import { documentsRoutes } from './routes/documents.js';
import { translateRoutes } from './routes/translate.js';
import { chatRoutes } from './routes/chat.js';
import { slidevRoutes } from './routes/slidev.js';
import { settingsRoutes } from './routes/settings.js';
import { sessionsRoutes } from './routes/sessions.js';
import { overridesRoutes } from './routes/overrides.js';
import { skillsRoutes } from './routes/skills.js';
import { filesystemRoutes } from './routes/filesystem.js';
import { mcpRoutes } from './routes/mcp.js';
import { initMcpConnections } from './services/mcpClient.js';

async function main() {
  const app = Fastify({
    logger: { level: 'info' },
    bodyLimit: 16 * 1024 * 1024, // 16MB - JSON only, but the Slidev editor's
    // PUT /slidev/:id can carry inline base64 image data URLs from the
    // ByteMDEditor screenshot feature. 2MB was too tight for retina-sized
    // PNGs; bump generously since this isn't a public endpoint.
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  // Lesson 8 raises the multipart ceiling so users can upload large local
  // PDFs (default 200 MB). The skill import handler re-enforces its own 5 MB
  // cap inside the route to keep ZIP uploads tight.
  await app.register(multipart, {
    limits: {
      fileSize: config.MAX_LOCAL_PDF_MB * 1024 * 1024,
      files: 1,
    },
  });

  // Initialise NeDB datastores (lesson 4) before any route can read/write them.
  await initDb();

  // Connect to all enabled MCP servers (lesson 12).
  await initMcpConnections();

  app.get('/healthz', async () => ({ ok: true, ts: Date.now() }));

  await app.register(documentsRoutes);
  await app.register(translateRoutes);
  await app.register(chatRoutes);
  await app.register(slidevRoutes);
  await app.register(settingsRoutes);
  await app.register(sessionsRoutes);
  await app.register(overridesRoutes);
  await app.register(skillsRoutes);
  await app.register(filesystemRoutes);
  await app.register(mcpRoutes);

  try {
    await app.listen({ port: config.PORT, host: config.HOST });
    app.log.info(`Server listening on http://${config.HOST}:${config.PORT}`);
  } catch (e) {
    app.log.error(e);
    process.exit(1);
  }
}

main();
