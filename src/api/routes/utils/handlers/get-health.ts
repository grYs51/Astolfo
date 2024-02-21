import { RequestHandler } from 'express';

export const getHealth: RequestHandler = async (req, res) => {
  res.status(200).json({ status: 'UP' });
};
