import { Router } from "express";
import { status } from "./handlers/status";

export default (router: Router) => {


  router.route('/discord/@me').get(status);
}