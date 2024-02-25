import path from 'path';
import { promises as fs } from 'fs';
import DiscordClient from '../client/client';
import BaseCommand from './structures/base-command';
import BaseEvent from './structures/base-event';
import BaseSlash from './structures/base-slash';
import { client } from '..';

enum FileType {
  COMMANDS = 'commands',
  EVENTS = 'events',
  SLASHS = 'slashs',
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

const fileTypeHandlers: Record<FileType, HandlerFunction> = {
  [FileType.COMMANDS]: handleCommand,
  [FileType.EVENTS]: handleEvent,
  [FileType.SLASHS]: handleSlash,
};

async function registerFiles(
  client: DiscordClient,
  dir: string,
  fileType: FileType,
) {
  const files = await fs.readdir(dir);
  for (const file of files) {
    const stat = await fs.lstat(path.join(dir, file));
    if (stat.isDirectory())
      await registerFiles(client, path.join(dir, file), fileType);
    if (file.endsWith('.js') || file.endsWith('.ts')) {
      const { default: instance } = await import(path.join(dir, file));
      fileTypeHandlers[fileType](new instance(), client);
    }
  }
}

export const registerCommands = (
  dir: string = path.join(__dirname, '../commands'),
) => registerFiles(client, dir, FileType.COMMANDS);

export const registerEvents = (
  dir: string = path.join(__dirname, '../events'),
) => registerFiles(client, dir, FileType.EVENTS);

export const registerSlash = (
  dir: string = path.join(__dirname, '../slashs'),
) => registerFiles(client, dir, FileType.SLASHS);
