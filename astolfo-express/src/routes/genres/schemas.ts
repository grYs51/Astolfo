import ajv from '../../utils/ajv';
import { GenrePayload } from './resources';

export const validateGenrePayLoad = ajv.compile<GenrePayload>({
  type: 'object',
  properties: {
    name: {
      type: 'string',
      maxLength: 40,
    },
    slug: { type: 'string', minLength: 2, maxLength: 40, pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
  },
  required: ['name', 'slug'],
});
