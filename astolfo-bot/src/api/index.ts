import express, { Express } from 'express';
import path from 'node:path';
import cors from 'cors';
import apiRouter from './routes/api-router';
import session from 'express-session';
import passport from 'passport';
import pg from 'pg';
import expressSession from 'express-session';
const pgSession = require('connect-pg-simple')(expressSession);
require('./strategies/discord')


const pgPool = new pg.Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASS,
    port: process.env.DB_PORT,
    
});

export default function createApp(): Express {
  const app = express();

  // enable cors
  app.use(
    cors({
      origin: '*',
      credentials: true,
    }),
  );

  // enable session
  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
      },
      store: new pgSession({
        pool: pgPool, // Connection pool
        tableName: 'user_sessions', // Use another table-name than the default "session" one
        createTableIfMissing: true,
        // Insert connect-pg-simple options here
      }),
    }),
  );

  // Initialize passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Register our api routes
  app.use('/api', apiRouter);

  // Static files
  app.use(express.static(path.join(__dirname, 'public')));

  // Host app, redirect all routes to index.html, because we have a SPA
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  return app;
}
