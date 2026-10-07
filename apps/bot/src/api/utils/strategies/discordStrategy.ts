import passport from 'passport';
import { Profile, Strategy } from 'passport-discord';
import { getDb } from '../../../db';
import { PrismaClient } from '@prisma/client';

export type User = {
  id: string;
  accessToken: string;
  refreshToken: string;
};

passport.serializeUser<PrismaClient['user_session']>((user, done) => {
  // @ts-expect-error - we are not using the full user object
  return done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await getDb().userSession.findUnique({ where: { id } });
    return user ? done(null, user) : done(null, null);
  } catch (error) {
    return done(error, null);
  }
});

/**
 * Called from createExpress() rather than at import time: constructing the
 * strategy reads DISCORD_CLIENT_ID etc., and importing the API happens before
 * validateEnv() runs — a missing var would surface as passport's
 * "OAuth2Strategy requires a clientID option" instead of the clear message.
 */
export const registerDiscordStrategy = () =>
  passport.use(
    new Strategy(
      {
        clientID: process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
        callbackURL: process.env.REDIRECT_URI,
        scope: ['identify'],
        // Random state stored in the session and checked on the callback, so
        // an attacker can't log a victim in with the attacker's auth code
        state: true,
      },
      async (accessToken, refreshToken, profile: Profile, done) => {
        const { id } = profile;
        try {
          const db = getDb();

          const user = await db.userSession.upsert({
            where: {
              id,
            },
            create: {
              id,
              access_token: accessToken,
              refresh_token: refreshToken,
            },
            update: {
              access_token: accessToken,
              refresh_token: refreshToken,
            },
          });

          return done(null, user);
        } catch (error) {
          return done(error, undefined);
        }
      },
    ),
  );
