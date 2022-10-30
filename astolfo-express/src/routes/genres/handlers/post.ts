import { RequestHandler, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { MongoServerError } from 'mongodb';
import { Conflict } from '../../../utils/http-error';
import { mapToResource } from '../mappers';
import { GenreReply } from '../resources';
import { validateGenrePayLoad } from '../schemas';

export const post: RequestHandler<unknown, GenreReply> = asyncHandler(async (req, res) => {
  try {
    const body = req.validate(validateGenrePayLoad);

    const { insertedId } = await req.db.genres.insertOne({ ...body });

    const reply = mapToResource({ ...body, _id: insertedId });

    res.status(201).send(reply);
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      throw new Conflict(`A genre with slug '${req.body.slug}' already exists`);
    }
    throw error;
  }
});
