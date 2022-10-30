import { DataSource, Repository } from 'typeorm';
import dataSource from './app-data-source';
import { GuildConfiguration, GuildStats } from './models';

let currentClient: DataSource | undefined;

export async function createClient(): Promise<DataSource> {
    return dataSource.initialize().then((client) => {
        currentClient = client;
        return client;
    });
}

export function getCurrentClient(): DataSource | null {
  return currentClient || null;
}

export interface Db {
  guildConfigurations: Repository<GuildConfiguration>;
  guildStats: Repository<GuildStats>;
}

export function getDb(): Readonly<Db> {
  const client = currentClient;
  if (!client) throw new Error('No Db connected');

  const db = dataSource;

  return {
    guildConfigurations: db.getRepository('guild_configurations'),
    guildStats: db.getRepository('guild_stats'),
  };
}

export async function disconnect(): Promise<void> {
  if (!currentClient) return;

  await currentClient.destroy();
}
