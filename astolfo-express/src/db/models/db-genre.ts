import { ObjectId } from 'mongodb';

export interface DbGenre {
  _id: ObjectId;
  slug: string;
  name: string;
}
