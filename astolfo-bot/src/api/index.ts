import express, { Express } from 'express';
import path from 'path';
import DiscordClient from '../client/client';
import apiRouter from './routes/api-router';

export default function createApp(client: DiscordClient): Express {
  const app = express();
  // app.use(cors());

  // Register our api routes
  app.use('/api', apiRouter);

  app.use(express.static(path.join(__dirname, 'public')));

  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  return app;
}
