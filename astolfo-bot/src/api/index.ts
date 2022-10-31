import express, { Express } from 'express';
import path from 'node:path';
import cors from 'cors';
import apiRouter from './routes/api-router';
import session from 'express-session';
import passport from 'passport';

require('./strategies/discord')

export default function createApp(): Express {
  const app = express();

  // enable cors
  app.use(
    cors({
      origin: '*',
      credentials: true,
    }),
  );

  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
      },
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
