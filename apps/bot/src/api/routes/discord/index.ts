import { Router } from 'express';
import { discordAuth, getStatus, redirect, signOut } from './handlers';
import { isAuthenticated } from '../../utils/middleware/isAuthenticated';
import passport from 'passport';
import { mockLogin } from './handlers/mockLogin';
import { isMockDiscord } from '../../../dev/mock-discord';

export default (router: Router) => {
  const authRouter = Router();

  authRouter
    .route('/status')
    .get(isAuthenticated, getStatus);
  if (isMockDiscord()) {
    // Local demo mode: no Discord OAuth app, sign in as the fixture user
    authRouter.route('/login').get(mockLogin);
    authRouter.route('/redirect').get(mockLogin);
  } else {
    authRouter
      .route('/login')
      .get(passport.authenticate('discord'), discordAuth);
    authRouter
      .route('/redirect')
      .get(passport.authenticate('discord'), redirect);
  }
  // POST, not GET: with SameSite=lax a cross-site page can trigger a GET
  // navigation with the cookie attached and log the user out
  authRouter
    .route('/logout')
    .post(signOut);

  router.use('/auth', authRouter);
};
