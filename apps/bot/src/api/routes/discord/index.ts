import { Router } from 'express';
import { discordAuth, getStatus, redirect, signOut } from './handlers';
import { isAuthenticated } from '../../utils.ts/middleware/isAuthenticated';
import passport from 'passport';

export default (router: Router) => {
  router.use('/auth', router);
  router
    .route('/status')
    .get(isAuthenticated, getStatus);
  router
    .route('/login')
    .get(passport.authenticate('discord'), discordAuth);
  router
    .route('/redirect')
    .get(passport.authenticate('discord'), redirect);
  router
    .route('/logout')
    .get(signOut);
};
