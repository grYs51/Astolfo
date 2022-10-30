import testApi from '../../../../test/test-api';
import testDb from '../../../../test/test-db';
import { buildAction, buildComedy, buildScienceFiction } from '../../../../test/factories/genre';

const URI = '/api/v1/genres';

describe(`GET ${URI}`, () => {
  const action = buildAction();
  const comedy = buildComedy();
  const scienceFiction = buildScienceFiction();

  beforeAll(() => testDb.dropCollections('genres'));
  beforeAll(() => testDb.collection('genres').insertMany([scienceFiction, comedy, action]));

  describe('Ok (200)', () => {
    it('returns the genres', async () => {
      const { status, body } = await testApi.get(URI).setBearerToken();

      expect(status).toBe(200);

      // We map strictly here too avoid unwanted props to end up in our replies
      const expectedBody = [action, comedy, scienceFiction].map(({ _id, slug, name }) => ({
        id: _id.toString(),
        slug,
        name,
      }));

      expect(body).toStrictEqual(expectedBody);
    });
  });
});
