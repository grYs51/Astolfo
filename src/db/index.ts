import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

let currentClient: PrismaClient | undefined;

export async function createClient() {
  currentClient = new PrismaClient();
  logger.info('Database client initialized');
  return currentClient;
}

export function getCurrentClient() {
  return currentClient || null;
}

export interface Db {
  guildConfigurations: PrismaClient['guild_configs'];
  voiceStats: PrismaClient['voice_stats'];
  messageStats: PrismaClient['message_stats'];
  userConfigs: PrismaClient['user_configs'];
}

export function getDb(): Db {
  const db = currentClient;

  if (!db) {
    throw new Error('Database client is not initialized');
  }

  return {
    guildConfigurations: db!.guild_configs,
    voiceStats: db!.voice_stats,
    messageStats: db!.message_stats,
    userConfigs: db!.user_configs,
  };
}

export async function disconnect(): Promise<void> {
  if (!currentClient) return;
  await currentClient.$disconnect();
}
