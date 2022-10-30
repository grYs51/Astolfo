import { RequestHandler, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { ObjectId } from 'mongodb';
import { NotFound } from '../../../utils/http-error';
import { validateIdParam } from '../../schemas';
import { mapToResource } from '../mappers';
import { GenreReply } from '../resources';

export const getDetail: RequestHandler<unknown, GenreReply> = asyncHandler(async (req, res) => {
  const { id } = req.validate(validateIdParam, 'params');

  const genre = await req.db.genres.findOne({ _id: new ObjectId(id) });
  if (!genre) throw new NotFound(`No genre found with id:'${id}'`);

  const reply = mapToResource(genre);

  res.send(reply);
});
