import { Router } from "express";
import { getHealth } from "./handlers/get-health";

export default (router: Router) => {
  router.route('/health').get(getHealth);
}