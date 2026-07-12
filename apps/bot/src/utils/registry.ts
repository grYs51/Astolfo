import path from 'path';
import { promises as fs } from 'fs';
import DiscordClient from '../client/client';
import BaseCommand from './structures/base-command';
import BaseEvent from './structures/base-event';
import { BaseSlash } from './structures/base-slash';
import { client } from '..';
import BaseInteraction from './structures/base-interaction';
import { Logger } from './logger';
import { pathToFileURL } from 'url';

enum FileType {
  COMMANDS = 'commands',
  EVENTS = 'events',
  SLASHS = 'slashs',
  INTERACTIONS = 'interactions',
}

type HandlerFunction = (instance: any, client: DiscordClient) => void;

const handleCommand: HandlerFunction = (instance: BaseCommand, client) => {
  client.commands.set(instance.name, instance);
  instance.aliases.forEach((alias: string) => {
    client.commands.set(alias, instance);
  });
};

const handleEvent: HandlerFunction = (instance: BaseEvent, client) => {
  client.events.set(instance.name, instance);
  client.on(instance.name, instance.run.bind(instance, client));
};

const handleSlash: HandlerFunction = (instance: BaseSlash, client) => {
  client.slashs.set(instance.name, instance);
  client.on(instance.name, instance.run.bind(instance, client));
};

const handleInteraction: HandlerFunction = (
  instance: BaseInteraction,
  client
) => {
  client.interactions.set(instance.name, instance);
  client.on(instance.name, instance.run.bind(instance, client));
};

const fileTypeHandlers: Record<FileType, HandlerFunction> = {
  [FileType.COMMANDS]: handleCommand,
  [FileType.EVENTS]: handleEvent,
  [FileType.SLASHS]: handleSlash,
  [FileType.INTERACTIONS]: handleInteraction,
};

// Source modules only — no declaration files, no tests
const isRegistrableFile = (name: string) =>
  (name.endsWith('.js') || name.endsWith('.ts')) &&
  !name.endsWith('.d.ts') &&
  !name.includes('.test.') &&
  !name.includes('.spec.');

async function registerFiles(
  client: DiscordClient,
  dir: string,
  fileType: FileType
) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await registerFiles(client, fullPath, fileType);
      continue;
    }
    if (!isRegistrableFile(entry.name)) continue;

    const filePath = pathToFileURL(fullPath).pathname;
    try {
      const mod = await import(filePath);
      // Depending on the transpilation target the class sits on
      // `default` or on `default.default`
      const Ctor = mod.default?.default ?? mod.default;
      try {
        fileTypeHandlers[fileType](new Ctor(), client);
      } catch (error) {
        Logger.error(`Failed to register file: ${filePath}`, error);
      }
    } catch (error) {
      Logger.error(`Failed to import file: ${filePath}`, error);
    }
  }
}

export const registerCommands = (dir = path.join(__dirname, '../commands')) =>
  registerFiles(client, dir, FileType.COMMANDS);

export const registerEvents = (
  dir: string = path.join(__dirname, '../events')
) => registerFiles(client, dir, FileType.EVENTS);

export const registerSlash = (
  dir: string = path.join(__dirname, '../slashs')
) => registerFiles(client, dir, FileType.SLASHS);

export const registerInteractions = (
  dir: string = path.join(__dirname, '../interactions')
) => registerFiles(client, dir, FileType.INTERACTIONS);
