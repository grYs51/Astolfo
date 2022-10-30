/* eslint-disable jest/no-disabled-tests */
import testApi from '../../../../test/test-api';
import testDb from '../../../../test/test-db';
import { genres } from '../../../../test/factories';
import { badRequest, conflict } from '../../../../test/http-error-response';

import { GenrePayload } from '../resources';

const URI = '/api/v1/genres';

const buildValidBody = (): GenrePayload => ({
  name: 'Action',
  slug: 'action',
});

describe.skip(`POST ${URI}`, () => {
  beforeEach(() => testDb.dropCollections('genres'));

  describe('Created (201)', () => {
    it('creates a new genre', async () => {
      const payload = buildValidBody();

      const { status, body } = await testApi.post(URI).setBearerToken().send(payload);
      expect(status).toBe(201);

      const storedGenre = await testDb.collection('genres').findOne({ slug: payload.slug });
      expect(storedGenre).toEqual(expect.objectContaining(payload));

      expect(body).toStrictEqual({
        id: storedGenre?._id.toString(),
        ...payload,
      });
    });
  });

  describe('Bad Request (400)', () => {
    describe('name', () => {
      it('returns the status if name is missing', async () => {
        const { name, ...rest } = buildValidBody();

        const { status, body } = await testApi.post(URI).setBearerToken().send(rest);

        expect(status).toBe(400);
        expect(body).toStrictEqual(badRequest("body must have required property 'name'"));
      });

      it('returns the status if name is longer than 40 chars', async () => {
        const { status, body } = await testApi
          .post(URI)
          .setBearerToken()
          .send({ ...buildValidBody(), name: 'b'.repeat(41) });

        expect(status).toBe(400);
        expect(body).toStrictEqual(badRequest('body/name must NOT have more than 40 characters'));
      });
    });

    describe('slug', () => {
      it('returns the status if slug is missing', async () => {
        const { slug, ...rest } = buildValidBody();

        const { status, body } = await testApi.post(URI).setBearerToken().send(rest);

        expect(status).toBe(400);
        expect(body).toStrictEqual(badRequest("body must have required property 'slug'"));
      });

      it('returns the status if slug is shorter than 2 chars', async () => {
        const { status, body } = await testApi
          .post(URI)
          .setBearerToken()
          .send({ ...buildValidBody(), slug: 'b' });

        expect(status).toBe(400);
        expect(body).toStrictEqual(badRequest('body/slug must NOT have fewer than 2 characters'));
      });

      it('returns the status if slug is is above 40 chars', async () => {
        const { status, body } = await testApi
          .post(URI)
          .setBearerToken()
          .send({ ...buildValidBody(), slug: 'a'.repeat(41) });

        expect(status).toBe(400);
        expect(body).toStrictEqual(badRequest('body/slug must NOT have more than 40 characters'));
      });

      it('returns the status if slug is not a valid slug', async () => {
        const { status, body } = await testApi
          .post(URI)
          .setBearerToken()
          .send({ ...buildValidBody(), slug: 'this-is-not-!-valid' });

        expect(status).toBe(400);
        expect(body).toStrictEqual(badRequest('body/slug must match pattern "^[a-z0-9]+(?:-[a-z0-9]+)*$"'));
      });
    });
  });

  describe('Unauthorized (401)', () => {
    test('it returns the status if anonymous', async () => {
      const { body } = await testApi.post(URI).send(buildValidBody()).expect(401);

      expect(body).toStrictEqual({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'No authorization token was found',
      });
    });
  });

  describe('Conflict (409)', () => {
    beforeEach(async () => {
      await testDb.collection('genres').insertOne(genres.buildAction());
    });

    it('returns status if slug is not unique', async () => {
      // This test depends on your migrations to have run against the test db to create the unique index
      const { status, body } = await testApi.post(URI).setBearerToken().send(buildValidBody());

      expect(status).toBe(409);
      expect(body).toStrictEqual(conflict("A genre with slug 'action' already exists"));
    });
  });
});
