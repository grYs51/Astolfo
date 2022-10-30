import { DbGenre } from '../../db/models';
import { GenreReply } from './resources';

export const mapToResource = (genre: DbGenre): GenreReply => ({
  id: genre._id.toString(),
  name: genre.name,
  slug: genre.slug,
});
