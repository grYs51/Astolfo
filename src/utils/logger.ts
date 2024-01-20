import pino, { stdSerializers } from 'pino';

const logger = pino({
  // ProcessEnv LOG_LEVEL can be used to filter out any unwanted logs
  level: process.env.LOG_LEVEL || 'info',

  // Use standard serializers for err, req, res
  serializers: stdSerializers,
});

export default logger;
