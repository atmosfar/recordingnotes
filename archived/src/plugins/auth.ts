import fp from 'fastify-plugin';
import fastifyPassport from '@fastify/passport';
import fastifySecureSession from '@fastify/secure-session';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as LocalStrategy } from 'passport-local';

export default fp(async (fastify) => {
  fastify.register(fastifySecureSession, {
    secret: process.env.SESSION_SECRET || 'a_very_long_secret_key_that_is_at_least_32_chars_long',
    salt: 'mq9hDxBVDbspDR6n',
  });

  fastify.register(fastifyPassport.initialize());
  fastify.register(fastifyPassport.secureSession());

  fastifyPassport.use(
    'google',
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID || 'mock',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'mock',
        callbackURL: 'http://localhost:3000/auth/google/callback',
      },
      async (accessToken, refreshToken, profile, cb) => {
        return cb(null, { id: 1, name: 'Test User', email: 'test@example.com' });
      }
    )
  );

  fastifyPassport.use(
    'local',
    new LocalStrategy(
      {
        usernameField: 'email',
        passwordField: 'password',
      },
      async (email, password, cb) => {
        if (email === 'test@example.com' && password === 'password') {
          return cb(null, { id: 1, name: 'Test User', email });
        }
        return cb(null, false);
      }
    )
  );

  fastifyPassport.registerUserSerializer(async (user: any, req) => {
    return user.id;
  });

  fastifyPassport.registerUserDeserializer(async (id: any, req) => {
    return { id, name: 'Test User' };
  });

  fastify.get(
    '/auth/google',
    fastifyPassport.authenticate('google', { scope: ['profile', 'email'] })
  );

  fastify.get(
    '/auth/google/callback',
    {
      preValidation: fastifyPassport.authenticate('google', { failureRedirect: '/login' }),
    },
    (req, reply) => {
      reply.redirect('/');
    }
  );

  fastify.post(
    '/auth/login',
    {
      preValidation: fastifyPassport.authenticate('local', {
        failureRedirect: '/login',
        successRedirect: '/',
      }),
    },
    async (req, reply) => {
      reply.redirect('/');
    }
  );
});
