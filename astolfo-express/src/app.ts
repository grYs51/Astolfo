import express, { Express } from 'express';
import path from 'node:path';
import cors from 'cors';
import proxy from 'express-http-proxy';
import apiRouter from './routes/api-router';
import logger from './utils/logger';

export default function createApp(): Express {
  const app = express();

  app.use(cors());

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
