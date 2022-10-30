import { RequestHandler } from 'express';
import { getDb } from '../db';

const dataSource: RequestHandler = (req, _res, next) => {
  req.db = getDb();

  next();
};

export default dataSource;
