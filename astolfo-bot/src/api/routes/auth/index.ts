import { Router } from 'express';
import passport from 'passport';
import { discordAuth, redirect, signOut, status } from './handlers';

export default (router: Router) => {
  router.route('/auth/status').get(status);
  router.route('/auth/sign-out').get(signOut);

  router
    .route('/auth/discord')
    .get(passport.authenticate('discord'), discordAuth);

  router
    .route('/auth/discord/redirect')
    .get(passport.authenticate('discord'), redirect);
};
