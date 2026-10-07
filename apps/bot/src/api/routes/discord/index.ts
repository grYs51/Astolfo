import { Router } from 'express';
import { discordAuth, getStatus, redirect, signOut } from './handlers';
import { isAuthenticated } from '../../utils.ts/middleware/isAuthenticated';
import passport from 'passport';

export default (router: Router) => {
  const authRouter = Router();

  authRouter
    .route('/status')
    .get(isAuthenticated, getStatus);
  authRouter
    .route('/login')
    .get(passport.authenticate('discord'), discordAuth);
  authRouter
    .route('/redirect')
    .get(passport.authenticate('discord'), redirect);
  // POST, not GET: with SameSite=lax a cross-site page can trigger a GET
  // navigation with the cookie attached and log the user out
  authRouter
    .route('/logout')
    .post(signOut);

  router.use('/auth', authRouter);
};
