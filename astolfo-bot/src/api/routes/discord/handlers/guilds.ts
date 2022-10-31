import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';

export const guilds: RequestHandler<unknown, any> = asyncHandler(
  async (req, res) => {
  }
  
);
