import { Unauthorized } from "../utils/http-error";

export const isAuthenticated = (req, res, next) => req.user ? next() : new Unauthorized();