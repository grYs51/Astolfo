import express from 'express';
import { AddressInfo } from 'net';
import { Server } from 'http';
import { cardRateLimit } from './cardRateLimit';

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use((req, _res, next) => {
    req.user = { id: String(req.query.user) } as Express.User;
    next();
  });
  app.get('/card', cardRateLimit, (_req, res) => {
    res.send('ok');
  });
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

test('10 cards a minute per user, counted per user and not per IP', async () => {
  const statuses = [];
  for (let i = 0; i < 11; i++) statuses.push((await fetch(`${base}/card?user=a`)).status);
  expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
  expect(statuses[10]).toBe(429);
  // same IP, another user: their own budget
  expect((await fetch(`${base}/card?user=b`)).status).toBe(200);
});
