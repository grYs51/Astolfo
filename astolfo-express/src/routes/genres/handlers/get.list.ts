import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { mapToResource } from '../mappers';
import { GenreReply } from '../resources';

export const getList: RequestHandler<unknown, GenreReply[]> = asyncHandler(async (req, res) => {
  const genres = await req.db.genres.find().sort({ slug: 1 }).toArray();

  const reply = genres.map(mapToResource);

  res.send(reply);
});
