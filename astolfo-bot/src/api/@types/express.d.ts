import { ValidateFunction } from 'ajv';
import pino from 'pino';
import DiscordClient from '../client/client';

declare global {
  namespace Express {
    interface Request {
      /**
       * The request id.
       * In case request contains X-Request-Id header, uses its value instead. (e.g. heroku)
       */
      id: string;

      /**
       * The discordClient.
       */
      client: any;

      /**
       * The logger bound to the request.
       */
      log: pino.Logger;

      /**
       * Validate and return a request part.
       */
      // validate<T>(
      //   validate: ValidateFunction<T>,
      //   part?: 'body' | 'query' | 'params',
      // ): T;
    }
  }
}
