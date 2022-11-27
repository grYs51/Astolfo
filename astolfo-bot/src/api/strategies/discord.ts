import passport from 'passport';
import { Strategy } from 'passport-discord';
import { client } from '../..';
import { LoggedUser } from '../../db/models';

passport.serializeUser<LoggedUser>((user: any, done) => done(null, user.id));

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await client.dataSource.loggedUsers.findOneBy({ id });
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
      scope: ['identify', 'guilds', 'email', 'guilds.members.read'],
    },
    async (accessToken, refreshToken, profile, done) => {
      const { id } = profile;
      try {
        const user = await client.dataSource.loggedUsers.findOneBy({
          id,
        });

        if (user) {
          user.accessToken = accessToken;
          user.refreshToken = refreshToken;
          await client.dataSource.loggedUsers.save(user);
          return done(null, user);
        }

        const newUser = client.dataSource.loggedUsers.create({
          id,
          accessToken,
          refreshToken,
        });
        await client.dataSource.loggedUsers.save(newUser);
        return done(null, newUser);
      } catch (error: any) {
        return done(error, undefined);
      }
    },
  ),
);
