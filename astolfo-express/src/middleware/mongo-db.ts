import { RequestHandler } from 'express';
import { getDb } from '../db';

const mongoDb: RequestHandler = (req, _res, next) => {
  req.db = getDb();

  next();
};

export default mongoDb;
