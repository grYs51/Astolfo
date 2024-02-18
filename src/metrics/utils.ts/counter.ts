import { Counter } from 'prom-client';

// Define a Prometheus counter metric
const commandsCounter = new Counter({
  name: 'discord_bot_commands_total',
  help: 'Total number of commands executed',
  labelNames: ['commandName'],
});

const eventsCounter = new Counter({
  name: 'discord_bot_events_total',
  help: 'Total number of events received',
  labelNames: ['eventName'],
});

const slashCounter = new Counter({
  name: 'discord_bot_slash_total',
  help: 'Total number of slash commands executed',
  labelNames: ['slashName'],
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

const commandsCountSet = (commandName: string, count: number) => {
  commandsCounter.inc({ commandName }, count);
};

const eventsCountSet = (eventName: string, count: number) => {
  eventsCounter.inc({ eventName }, count);
};

const slashsCountSet = (slashName: string, count: number) => {
  slashCounter.inc({ slashName }, count);
};

export {
  commandsCount,
  eventsCount,
  slashCount,
  commandsCountSet,
  eventsCountSet,
  slashsCountSet,
};
