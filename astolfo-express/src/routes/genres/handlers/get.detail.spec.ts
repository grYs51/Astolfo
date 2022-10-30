import { ObjectId } from 'mongodb';
import { buildAction } from '../../../../test/factories/genre';
import { badRequest, notFound } from '../../../../test/http-error-response';
import testApi from '../../../../test/test-api';
import testDb from '../../../../test/test-db';

const URI = '/api/v1/genres/:id';

describe(`GET ${URI}`, () => {
  const action = buildAction();

  beforeAll(() => testDb.dropCollections('genres'));
  beforeAll(() => testDb.collection('genres').insertMany([action]));

  describe('Ok (200)', () => {
    it('returns the genre', async () => {
      const { status, body } = await testApi.get(URI.replace(':id', action._id.toString()));

      expect(status).toBe(200);
      expect(body).toStrictEqual({
        id: action._id.toString(),
        slug: action.slug,
        name: action.name,
      });
    });
  });

  describe('Bad Request (400)', () => {
    it('returns the status if id is not an objectId', async () => {
      const { status, body } = await testApi.get(URI.replace(':id', 'not-an-object-id'));

      expect(status).toBe(400);
      expect(body).toStrictEqual(badRequest('params/id must match format "object-id"'));
    });
  });

  describe('Not Found (404)', () => {
    it('returns the status if no genre exists with id', async () => {
      const id = new ObjectId();
      const { status, body } = await testApi.get(URI.replace(':id', id.toString()));

      expect(status).toBe(404);
      expect(body).toStrictEqual(notFound(`No genre found with id:'${id}'`));
    });
  });
});
