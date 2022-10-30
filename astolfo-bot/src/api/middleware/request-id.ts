import { randomUUID } from 'crypto';
import { RequestHandler } from 'express';
import { REQ_ID_HEADER_NAME } from '../known-headers';

const requestId: RequestHandler = (req, _res, next) => {
  const id = req.get(REQ_ID_HEADER_NAME) || randomUUID();
  req.id = id;
  next();
};

export default requestId;
