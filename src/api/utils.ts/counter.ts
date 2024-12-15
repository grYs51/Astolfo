import { Counter } from 'prom-client';
import {
  deleteUndefined,
  stringifyArgs,
} from '../../utils/object/ObjectHelpers';
import logger from '../../utils/logger';

// Define a Prometheus counter metric

export const commandsCounter = new Counter({
  name: 'discord_bot_commands_total',
  help: 'Total number of commands executed',
  labelNames: ['commandName', 'guildId', 'userId'],
});

export const eventsCounter = new Counter({
  name: 'discord_bot_events_total',
  help: 'Total number of events received',
  labelNames: ['eventName', 'guildId', 'userId'],
});

export const slashCounter = new Counter({
  name: 'discord_bot_slash_total',
  help: 'Total number of slash commands executed',
  labelNames: ['slashName', 'guildId', 'userId'],
});

const commandsCount = (
  commandName: string,
  guildId?: string,
  userId?: string
) => {
  commandsCounter.inc(deleteUndefined({ commandName, guildId, userId }));
};

const eventsCount = (eventName: string, guildId?: string, userId?: string) => {
  eventsCounter.inc(deleteUndefined({ eventName, guildId, userId }));
};

const slashCount = (slashName: string, guildId?: string, userId?: string) => {
  slashCounter.inc(deleteUndefined({ slashName, guildId, userId }));
};

export type CommandCounterArgs = {
  commandName: string;
  guildId?: string;
  userId?: string;
};
export type EventCounterArgs = {
  eventName: string;
  guildId?: string;
  userId?: string;
};
export type SlashCounterArgs = {
  slashName: string;
  guildId?: string;
  userId?: string;
};

const commandsCountSet = (args: CommandCounterArgs, count: number) => {
  logger.info('commandsCountSet', stringifyArgs(args), count);

  commandsCounter.inc(deleteUndefined(args), count);
};

const eventsCountSet = (args: EventCounterArgs, count: number) => {
  logger.info('eventsCountSet', stringifyArgs(args), count);

  eventsCounter.inc(deleteUndefined(args), count);
};

const slashsCountSet = (args: SlashCounterArgs, count: number) => {
  logger.info('slashsCountSet', stringifyArgs(args), count);

  slashCounter.inc(deleteUndefined(args), count);
};

export {
  commandsCount,
  eventsCount,
  slashCount,
  commandsCountSet,
  eventsCountSet,
  slashsCountSet,
};
