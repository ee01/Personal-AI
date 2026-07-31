import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { getDb } from './storage/Database.js';
import { registerRoutes } from './routes/api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  getDb();

  const app = Fastify({
    logger: true,
    trustProxy: true,
  });

  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'X-Actor-Name',
      'X-Client-Id',
      'X-Actor-Source',
      'X-Share-Token',
    ],
  });

  await registerRoutes(app);

  const webDist = path.resolve(__dirname, '../web/dist');
  if (fs.existsSync(webDist)) {
    await app.register(fastifyStatic, {
      root: webDist,
      prefix: '/',
    });
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/')) {
        return reply.code(404).send({ error: 'not_found' });
      }
      return reply.sendFile('index.html');
    });
  } else {
    app.get('/', async () => ({
      service: 'roadmap-service',
      hint: 'Web UI not built yet. Run npm run build:web',
    }));
  }

  await app.listen({ port: config.port, host: config.host });
  console.log(`Roadmap service listening on http://${config.host}:${config.port}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
