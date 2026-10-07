import { getDb } from "../../../db";
import { RequestHandler } from "express";

const dataSource: RequestHandler = (req, res, next) => {
    req.db = getDb();
    next();
}

export default dataSource;