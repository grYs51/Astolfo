import { Counter, Histogram } from 'prom-client';

// Define a Prometheus counter metric
export const commandsCounter = new Counter({
  name: 'discord_bot_commands_total',
  help: 'Total number of commands executed',
  labelNames: ['commandName'],
});

export const eventsCounter = new Counter({
  name: 'discord_bot_events_total',
  help: 'Total number of events received',
  labelNames: ['eventName'],
});

export const slashCounter = new Counter({
  name: 'discord_bot_slash_total',
  help: 'Total number of slash commands executed',
  labelNames: ['slashName'],
});

export const commandErrorsCounter = new Counter({
  name: 'discord_bot_command_errors_total',
  help: 'Prefix and slash commands that threw',
  labelNames: ['name'],
});

// `route` is the route pattern, never the URL, so ids don't explode the labels
export const apiRequestsCounter = new Counter({
  name: 'discord_api_requests_total',
  help: 'API requests by route pattern and status',
  labelNames: ['method', 'route', 'status'],
});

// No `discord_` prefix: not persisted, so it covers the time since the last restart
export const apiRequestDuration = new Histogram({
  name: 'api_request_duration_seconds',
  help: 'API request duration by route pattern',
  labelNames: ['method', 'route'],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

const commandsCount = (commandName: string) => {
  commandsCounter.inc({ commandName });
};

const eventsCount = (eventName: string) => {
  eventsCounter.inc({ eventName });
};

const slashCount = (slashName: string) => {
  slashCounter.inc({ slashName });
};

const commandErrorsCount = (name: string) => {
  commandErrorsCounter.inc({ name });
};

export {
  commandsCount,
  eventsCount,
  slashCount,
  commandErrorsCount,
};
