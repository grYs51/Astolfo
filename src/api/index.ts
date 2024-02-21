import express, { Request, Response } from 'express';
import logger from '../utils/logger';
import apiRouter from './routes/api-router';
import './utils.ts/save-on-exit';
import { collectDefaultMetrics } from 'prom-client';
collectDefaultMetrics()
const app = express();
const PORT = 3000;

app.use(apiRouter);

app.get('*', (req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

const server = app.listen(PORT, () => {
  logger.info(`Server is running at ${PORT}`);
});

export default server;
