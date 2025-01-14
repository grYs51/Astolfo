import { Router } from 'express';
import { discordAuth, getStatus, redirect, signOut } from './handlers';
import { isAuthenticated } from '../../utils.ts/middleware/isAuthenticated';
import passport from 'passport';

export default (router: Router) => {
  router.route('/auth/status').get(isAuthenticated, getStatus);
  router
    .route('/auth/login')
    .get(passport.authenticate('discord'), discordAuth);
  router
    .route('/auth/redirect')
    .get(passport.authenticate('discord'), redirect);
  router.route('/auth/logout').get(signOut);
};
