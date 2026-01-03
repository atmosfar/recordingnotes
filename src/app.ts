import fastify, { FastifyInstance } from 'fastify';
import authPlugin from './plugins/auth';

export function buildApp(): FastifyInstance {
  const app = fastify();

  app.register(authPlugin);

  app.get('/health', async (request, reply) => {
    return { status: 'ok' };
  });

  return app;
}
