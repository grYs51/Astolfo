import { createHttpTerminator } from 'http-terminator';
import createApp from './app';
import { connect, createClient, disconnect } from './db';
import logger from './utils/logger';

const PORT = process.env.PORT || 3000;

// Good practice to stop processing when an unhandledRejection occurs
process.on('unhandledRejection', (err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

async function main() {
  // create mongo db client
  const client = createClient(process.env.MONGO_URI);
  await connect(client);

  // create express app
  const app = createApp();
  const server = app.listen(PORT, () => {
    logger.info(`Server listening on http://localhost:${PORT}`);
  });

  // handle correct shutdown
  const httpTerminator = createHttpTerminator({ server });
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

  for (const signal of signals) {
    // Use once() so that double signals exits the app
    process.once(signal, () => {
      logger.info(`Received ${signal}, closing gracefully`);
      httpTerminator //
        .terminate()
        .then(disconnect)
        .catch((err) => {
          logger.error({ err }, 'Error occurred while terminating server');
          process.exit(1);
        });
    });
  }
}

main().catch((err) => {
  logger.error({ err }, 'Server failed to start');
});
