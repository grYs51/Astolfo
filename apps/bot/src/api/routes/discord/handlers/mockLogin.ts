import asyncHandler from 'express-async-handler';
import { RequestHandler } from 'express';
import { MOCK_USER } from '../../../../dev/mock-discord';

/**
 * MOCK_DISCORD only: replaces the Discord OAuth round trip by signing the
 * browser in as the fixture user, then redirecting back like the real
 * callback does. Only mounted when isMockDiscord() (never in production).
 */
export const mockLogin: RequestHandler = asyncHandler(async (req, res, next) => {
  const user = await req.db.userSession.upsert({
    where: { id: MOCK_USER.id },
    create: { id: MOCK_USER.id, access_token: 'mock', refresh_token: 'mock' },
    update: {},
  });

  req.login(user, (error) => {
    if (error) {
      next(error);
      return;
    }
    res.redirect(process.env.CLIENT_URL);
  });
});
