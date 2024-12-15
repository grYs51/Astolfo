import { RequestHandler } from 'express';
import { client } from '../../../..';

//users endpoint for Grafana listing
export const getUsers: RequestHandler = async (req, res) => {
  res.set('Content-Type', 'application/json');

  const cachedUsers = client.users.cache.map(({ id, username }) => ({
    id,
    username,
  }));

  res.end(JSON.stringify(cachedUsers));
};
