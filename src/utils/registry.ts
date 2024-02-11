import path from 'path';
import { promises as fs } from 'fs';
import DiscordClient from '../client/client';
import BaseCommand from '../utils/structures/BaseCommand';
import BaseEvent from './structures/BaseEvent';
import BaseSlash from './structures/BaseSlash';

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
  const filePath = path.join(__dirname, dir);
  const files = await fs.readdir(filePath);
  for (const file of files) {
    const stat = await fs.lstat(path.join(filePath, file));
    if (stat.isDirectory())
      await registerFiles(client, path.join(dir, file), fileType);
    if (file.endsWith('.js') || file.endsWith('.ts')) {
      const { default: instance } = await import(path.join(dir, file));      
      fileTypeHandlers[fileType](new instance(), client);
    }
  }
}
export const registerCommands = (client: DiscordClient, dir: string = '') =>
  registerFiles(client, dir, FileType.COMMANDS);

export const registerEvents = (client: DiscordClient, dir: string = '') =>
  registerFiles(client, dir, FileType.EVENTS);

export const registerSlash = (client: DiscordClient, dir: string = '') =>
  registerFiles(client, dir, FileType.SLASHS);
