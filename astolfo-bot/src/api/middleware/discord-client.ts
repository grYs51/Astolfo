import { RequestHandler } from "express";
import {client as discordClient} from "../..";

const client: RequestHandler = (req, res, next) => {
  req.discordClient = discordClient;
  next();
};

export default client;