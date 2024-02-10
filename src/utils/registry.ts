import path from 'path';
import { promises as fs } from 'fs';
import DiscordClient from '../client/client';
import BaseCommand from '../utils/structures/BaseCommand';
import BaseEvent from './structures/BaseEvent';
import BaseSlash from './structures/BaseSlash';

export async function registerCommands(
  client: DiscordClient,
  dir: string = '',
) {
  const filePath = path.join(__dirname, dir);
  const files = await fs.readdir(filePath);
  for (const file of files) {
    const stat = await fs.lstat(path.join(filePath, file));
    if (stat.isDirectory()) registerCommands(client, path.join(dir, file));
    if (file.endsWith('.js') || file.endsWith('.ts')) {
      const { default: Command } = await import(path.join(dir, file));      
      const command = new Command() as BaseCommand;
      client.commands.set(command.name, command);
      command.aliases.forEach((alias: string) => {
        client.commands.set(alias, command);
      });
    }
  }
}

export async function registerEvents(client: DiscordClient, dir: string = '') {
  const filePath = path.join(__dirname, dir);
  const files = await fs.readdir(filePath);
  for (const file of files) {
    const stat = await fs.lstat(path.join(filePath, file));
    if (stat.isDirectory()) registerEvents(client, path.join(dir, file));
    if (file.endsWith('.js') || file.endsWith('.ts')) {
      const { default: Event } = await import(path.join(dir, file));
      const event = new Event() as BaseEvent;
      client.events.set(event.name, event);
      client.on(event.name, event.run.bind(event, client));
    }
  }
}

export async function registerSlash(client: DiscordClient, dir: string = '') {
  const filePath = path.join(__dirname, dir);
  const files = await fs.readdir(filePath);
  for (const file of files) {
    const stat = await fs.lstat(path.join(filePath, file));
    if (stat.isDirectory()) await registerSlash(client, path.join(dir, file));
    if (file.endsWith('.js') || file.endsWith('.ts')) {
      const { default: Slash } = await import(path.join(dir, file));
      const slash = new Slash() as BaseSlash;
      client.slashs.set(slash.name, slash);
      client.on(slash.name, slash.run.bind(slash, client));
    }
  }
}
