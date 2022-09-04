import { RequestHandler } from 'express';
import logger from '../utils/logger';

const logging: RequestHandler = (req, _res, next) => {
  req.log = logger.child({ req });
  next();
};

export default logging;
