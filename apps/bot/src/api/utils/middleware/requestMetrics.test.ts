import express, { NextFunction, Request, Response } from 'express';
import type { AddressInfo } from 'net';
import { register } from 'prom-client';
import { requestMetrics } from './requestMetrics';
import { Forbidden } from '../http-errors';

const app = express();
app.use(requestMetrics);
const api = express.Router();
const auth = express.Router();
auth.get('/status', (req, res) => res.send('ok'));
api.use('/auth', auth);
api.get('/features/:serverId/overview', (req, res) => res.send('ok'));
api.get('/admin/health', (req, res, next) => next(new Forbidden()));
app.use('/api', api);
app.use((req, res) => res.status(404).end());
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Forbidden, req: Request, res: Response, next: NextFunction) => res.status(err.statusCode).end());

const labels = async () => {
  const metric = await register.getSingleMetric('discord_api_requests_total')?.get();
  return metric?.values.map((v) => `${v.labels.method} ${v.labels.route} ${v.labels.status}`).sort();
};

describe('requestMetrics', () => {
  test('labels the route pattern, not the URL', async () => {
    const server = app.listen(0);
    const base = `http://localhost:${(server.address() as AddressInfo).port}`;
    try {
      for (const path of ['/api/features/123/overview', '/api/features/456/overview', '/api/auth/status', '/api/admin/health', '/api/nope/789']) {
        await fetch(base + path);
      }
    } finally {
      server.close();
    }

    expect(await labels()).toEqual([
      'GET /api/admin/health 403',
      'GET /api/auth/status 200',
      'GET /api/features/:serverId/overview 200',
      'GET unmatched 404',
    ]);
  });
});
