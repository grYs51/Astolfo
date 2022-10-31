import { Router } from "express";
import passport from "passport";
import { discordAuth } from "./handlers/discord";
import { redirect } from "./handlers/redirect";

export default (router: Router) => {  
  router
    .route('/auth/discord')
    .get(passport.authenticate('discord'), discordAuth );

  router
    .route('/auth/discord/redirect')
    .get(passport.authenticate('discord'), redirect);
}
