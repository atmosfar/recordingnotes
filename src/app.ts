import fastify, { FastifyInstance } from 'fastify';

export function buildApp(): FastifyInstance {
  const app = fastify();

  app.get('/health', async (request, reply) => {
    return { status: 'ok' };
  });

  return app;
}
