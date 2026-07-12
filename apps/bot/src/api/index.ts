import express, { Request, Response } from 'express';
import { Logger } from '../utils/logger';
import apiRouter from './routes/api-router';
import { collectDefaultMetrics } from 'prom-client';
import cors from 'cors';
import expressSession from 'express-session';
import rateLimit from 'express-rate-limit';
import { PrismaSessionStore } from '@quixo3/prisma-session-store';
import { currentClient } from '../db';
import passport from 'passport';
import { errorHandler } from './utils.ts/middleware/error-handler';
import './utils.ts/strategies/discordStrategy';
collectDefaultMetrics();

const DEFAULT_CORS_ORIGINS = [
  'http://localhost:4200',
  'https://astolfo.grys.dev',
];

function corsOrigins(): string[] {
  return (
    process.env.CORS_ORIGINS?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? DEFAULT_CORS_ORIGINS
  );
}

function createExpress() {
  const app = express();
  const PORT = process.env.PORT || 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    // Required for secure cookies behind an HTTPS-terminating proxy
    app.set('trust proxy', 1);
  }

  app.use(
    cors({
      origin: corsOrigins(),
      credentials: true,
    })
  );

  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: 300, // per IP per minute — the stats endpoints run multi-aggregate SQL
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  app.use(
    expressSession({
      cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: 'lax',
        secure: isProduction,
      },
      secret: process.env.COOKIE_SECRET,
      resave: false,
      saveUninitialized: false,
      store: new PrismaSessionStore(currentClient, {
        checkPeriod: 2 * 60 * 1000, // 2 minutes
        dbRecordIdIsSessionId: true,
        dbRecordIdFunction: undefined,
      }),
    })
  );

  // Initialize passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Initialize routes
  app.use('/api', apiRouter);

  // Catch-all 404 for every method, not just GET
  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found' });
  });

  // JSON error handler must be the last middleware
  app.use(errorHandler);

  const server = app.listen(PORT, () => {
    Logger.info(`Server is running at ${PORT}`);
  });

  return server;
}

export default createExpress;
