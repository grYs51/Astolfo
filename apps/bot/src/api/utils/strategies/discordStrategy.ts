import passport from 'passport';
import { Profile, Strategy } from 'passport-discord';
import { getDb } from '../../../db';
import { PrismaClient } from '@prisma/client';

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

// Save the profile the dashboard shows, not the tokens: nothing calls
// Discord on the user's behalf after login
export const verifyDiscordLogin = async (
  _accessToken: string,
  _refreshToken: string,
  profile: Profile,
  done: (error: unknown, user?: Express.User) => void,
) => {
  const { id, username, global_name, avatar } = profile;
  const now = new Date();
  const fields = { username, global_name, avatar, last_login_at: now };
  try {
    const user = await getDb().userSession.upsert({
      where: { id },
      create: { id, ...fields, created_at: now },
      update: fields,
    });

    return done(null, user);
  } catch (error) {
    return done(error, undefined);
  }
};

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
        clientID: process.env.DISCORD_CLIENT_ID!, // validateEnv requires these outside mock mode
        clientSecret: process.env.DISCORD_CLIENT_SECRET!,
        callbackURL: process.env.REDIRECT_URI!,
        scope: ['identify'],
        // Random state stored in the session and checked on the callback, so
        // an attacker can't log a victim in with the attacker's auth code
        state: true,
      },
      verifyDiscordLogin,
    ),
  );
