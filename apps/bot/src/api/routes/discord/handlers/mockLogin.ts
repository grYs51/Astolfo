import asyncHandler from 'express-async-handler';
import { RequestHandler } from 'express';
import { MOCK_USER } from '../../../../dev/mock-discord';

/**
 * MOCK_DISCORD only: replaces the Discord OAuth round trip by signing the
 * browser in as the fixture user, then redirecting back like the real
 * callback does. Only mounted when isMockDiscord() (never in production).
 */
export const mockLogin: RequestHandler = asyncHandler(async (req, res, next) => {
  const { id, username, global_name, avatar } = MOCK_USER;
  const profile = { username, global_name, avatar };
  const user = await req.db.userSession.upsert({
    where: { id },
    create: { id, ...profile },
    update: profile,
  });

  req.login(user, (error) => {
    if (error) {
      next(error);
      return;
    }
    res.redirect(process.env.CLIENT_URL);
  });
});
