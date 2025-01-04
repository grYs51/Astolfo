import express, { Request, Response } from 'express';
import { Logger } from '../utils/logger';
import apiRouter from './routes/api-router';
import './utils.ts/save-on-exit';
import { collectDefaultMetrics } from 'prom-client';
import cors from 'cors';
import expressSession from 'express-session';
import { PrismaSessionStore } from '@quixo3/prisma-session-store';
import { currentClient } from '../db';
import passport from 'passport';
import './utils.ts/strategies/discordStategy';
collectDefaultMetrics();
function createExpress() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(
    cors({
        origin: [
            'http://localhost:4200',
        ],
        credentials: true,
    })
);
  app.use(
    expressSession({
      cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        secure: true,
        httpOnly: true,
      },
      secret: process.env.COOKIE_SECRET,
      resave: true,
      saveUninitialized: true,
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

  // Error handling
  app.get('*', (req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found' });
  });

  const server = app.listen(PORT, () => {
    Logger.info(`Server is running at ${PORT}`);
  });

  return server;
}

export default createExpress;
