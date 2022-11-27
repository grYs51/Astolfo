import { RequestHandler } from 'express';
import ajv from '../utils/ajv';
import { BadRequest } from '../utils/http-error';

const validate: RequestHandler = (req, res, next) => {
  req.validate = (fn, part = 'body') => {
    const data = req[part];
    if (!fn(data))
      throw new BadRequest(ajv.errorsText(fn.errors, { dataVar: part }));
    return data;
  };
  next();
};

export default validate;
