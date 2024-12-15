import { RequestHandler } from 'express';
import { getDb } from '../../../../db';
import logger from '../../../../utils/logger';

//users endpoint for Grafana listing
export const getUsers: RequestHandler = async (req, res) => {
  const { userStatus } = getDb();
  res.set('Content-Type', 'application/json');
  const usersData = await userStatus.findMany({ distinct: ['user_id'] });
  logger.info(`Fetched ${usersData.length} Users on /users`);
  res.end(
    JSON.stringify(
      usersData.map(({ user_name, user_id }) => ({ user_id, user_name }))
    )
  );
};
