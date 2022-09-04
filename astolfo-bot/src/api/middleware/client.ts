import { RequestHandler } from 'express';
import { client } from '../..';

const dc: RequestHandler = (req, _res, next) => {
  //TODO get client here
  req.client = client;

  next();
};

export default dc;
