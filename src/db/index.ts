import { PrismaClient } from '@prisma/client';
import { Logger } from '../utils/logger';

export interface Db {
  guildConfigurations: PrismaClient['guild_configs'];
  voiceStats: PrismaClient['voice_stats'];
  messageStats: PrismaClient['message_stats'];
  userConfigs: PrismaClient['user_configs'];
  userStatus: PrismaClient['user_statuses'];
  metrics: PrismaClient['metrics'];
}

let currentClient: PrismaClient;

export async function createPrismaClient() {
  currentClient = new PrismaClient();

  Logger.info('Initializing database');
  await currentClient.$connect();
  Logger.info('Database client initialized');

  return currentClient;
}

export function getDb(): Db {
  if (!currentClient) {
    throw new Error('Database client is not initialized');
  }

  return {
    guildConfigurations: currentClient.guild_configs,
    voiceStats: currentClient.voice_stats,
    messageStats: currentClient.message_stats,
    userConfigs: currentClient.user_configs,
    userStatus: currentClient.user_statuses,
    metrics: currentClient.metrics,
  };
}

export async function disconnect(): Promise<void> {
  if (!currentClient) return;
  await currentClient.$disconnect();
}
