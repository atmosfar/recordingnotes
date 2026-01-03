import Fastify, { type FastifyInstance } from 'fastify';
import authPlugin from './plugins/auth.js';

export function buildApp(): FastifyInstance {
  const app = Fastify();

  app.register(authPlugin);

  app.get('/health', async (request, reply) => {
    return { status: 'ok' };
  });

  return app;
}
