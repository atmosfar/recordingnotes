import { buildApp } from '../app';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

describe('Session and Note CRUD', () => {
  let app: FastifyInstance;
  let prisma: PrismaClient; // Declare prisma here

  beforeAll(async () => {
    require('dotenv').config(); // Load dotenv explicitly here
    prisma = new PrismaClient(); // Initialize prisma here
    app = buildApp();
    await app.ready();
    // Clean up database
    await prisma.note.deleteMany();
    await prisma.session.deleteMany();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('POST /sessions should create a new session', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/sessions',
      payload: {
        name: 'Test Podcast Session',
        timestampMode: 'timer',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().name).toBe('Test Podcast Session');
    expect(response.json().timestampMode).toBe('timer');
    expect(response.json().id).toBeDefined();
  });

  it('GET /sessions should list all sessions', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/sessions',
    });

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.json())).toBe(true);
    expect(response.json().length).toBeGreaterThan(0);
  });

  it('POST /sessions/:id/notes should create a note in the session', async () => {
    // First get a session
    const sessions = await prisma.session.findMany();
    const sessionId = sessions[0].id;

    const response = await app.inject({
      method: 'POST',
      url: `/sessions/${sessionId}/notes`,
      payload: {
        content: 'This is a test note',
        timestamp: '00:01:23',
        color: 'red',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().content).toBe('This is a test note');
    expect(response.json().sessionId).toBe(sessionId);
    expect(response.json().timestamp).toBe('00:01:23');
  });

  it('GET /sessions/:id/notes should return all notes for a session', async () => {
    const sessions = await prisma.session.findMany();
    const sessionId = sessions[0].id;

    const response = await app.inject({
      method: 'GET',
      url: `/sessions/${sessionId}/notes`,
    });

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.json())).toBe(true);
    expect(response.json().length).toBeGreaterThan(0);
    expect(response.json()[0].content).toBe('This is a test note');
  });
});