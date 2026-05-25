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
  authRouter
    .route('/logout')
    .get(signOut);

  router.use('/auth', authRouter);
};
