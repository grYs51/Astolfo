import { Collection, MongoClient, OptionalId } from 'mongodb';
import { DbGenre, DbGuildConfiguration, DbGuildStats } from './models';

let currentClient: MongoClient | undefined;

export function createClient(uri?: string): MongoClient {
  if (!uri) throw new Error('No Mongo URI configured (MONGO_URI)');

  currentClient = new MongoClient(uri);

  return currentClient;
}

export function getCurrentClient(): MongoClient | null {
  return currentClient || null;
}

export async function connect(client: MongoClient): Promise<void> {
  await client.connect();
}

export interface Db {
  genres: Collection<OptionalId<DbGenre>>;
  guildConfigurations: Collection<OptionalId<DbGuildConfiguration>>;
  guildStats: Collection<OptionalId<DbGuildStats>>;
}

export function getDb(): Readonly<Db> {
  const client = currentClient;
  if (!client) throw new Error('No Db connected');

  const db = client.db();

  return {
    genres: db.collection('genres'),
    guildConfigurations: db.collection('guild_configurations'),
    guildStats: db.collection('guild_stats'),
  };
}

export async function disconnect(): Promise<void> {
  if (!currentClient) return;

  await currentClient.close();
}
