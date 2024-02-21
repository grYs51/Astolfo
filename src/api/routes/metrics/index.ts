import { Router } from "express"
import { getMetrics } from "./handlers/get-metrics"

export default (router: Router) => {
  router.route('/metrics').get(getMetrics)
}