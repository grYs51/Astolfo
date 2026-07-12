import { DiscordAPIError } from 'discord.js';
import pino from 'pino';

const logger = pino(
  {
    formatters: {
      level: (label) => {
        return { level: label };
      },
    },
  },
  pino.transport({
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname',
      translateTime: 'yyyy-mm-dd HH:MM:ss.l',
    },
  })
);
export class Logger {

  public static info(message: string, obj?: any): void {
    if (obj) {
      logger.info(obj, message);
    } else {
      logger.info(message);
    }
  }

  public static warn(message: string, obj?: any): void {
    if (obj) {
      logger.warn(obj, message);
    } else {
      logger.warn(message);
    }
  }

  // Synchronous on purpose: no caller awaits error(), and fatal paths
  // (uncaughtException → process.exit) must not depend on a pending promise.
  public static error(message: string, obj?: any): void {
    // Log just a message if no error object
    if (!obj) {
      logger.error(message);
      return;
    }

    // Otherwise log details about the error
    if (typeof obj === 'string') {
      logger
        .child({
          message: obj,
        })
        .error(message);
    } else if (obj instanceof Response) {
      // Body is intentionally not read — that would make this async
      logger
        .child({
          path: obj.url,
          statusCode: obj.status,
          statusName: obj.statusText,
          headers: JSON.stringify(obj.headers),
        })
        .error(message);
    } else if (obj instanceof DiscordAPIError) {
      logger
        .child({
          message: obj.message,
          code: obj.code,
          statusCode: obj.status,
          method: obj.method,
          url: obj.url,
          stack: obj.stack,
        })
        .error(message);
    } else {
      logger.error(obj, message);
    }
  }
}
