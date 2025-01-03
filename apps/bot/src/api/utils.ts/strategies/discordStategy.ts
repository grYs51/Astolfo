import passport from 'passport';
import { Profile, Strategy } from 'passport-discord';
import { getDb } from '../../../db';
import { PrismaClient } from '@prisma/client';

export type User = {
  id: string;
  accessToken: string;
  refreshToken: string;
};

passport.serializeUser<PrismaClient['user_session']>((user, done) =>
  done(null, user.id as any)
);

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await getDb().userSession.findUnique({ where: { id } });
    return user ? done(null, user) : done(null, null);
  } catch (error) {
    return done(error, null);
  }
});

passport.use(
  new Strategy(
    {
      clientID: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      callbackURL: process.env.DISCORD_REDIRECT_URL,
      scope: ['identify'],
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
    }
  )
);
