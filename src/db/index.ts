import { PrismaClient } from '@prisma/client';

let currentClient: PrismaClient | undefined;

export async function createClient() {
  currentClient = new PrismaClient();
  return currentClient;
}

export function getCurrentClient() {
  return currentClient || null;
}

export interface Db {
  guildConfigurations: PrismaClient['guild_configurations'];
  guildStats: PrismaClient['guild_stats'];
}

export function getDb(): Db {
  const db = currentClient;

  if (!db) {
    throw new Error('Database client is not initialized');
  }

  return {
    guildConfigurations: db!.guild_configurations,
    guildStats: db!.guild_stats,
  };
}

export async function disconnect(): Promise<void> {
  if (!currentClient) return;
  await currentClient.$disconnect();
}
