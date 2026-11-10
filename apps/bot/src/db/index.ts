import { PrismaClient } from '@prisma/client';
import { Logger } from '../utils/logger';

export interface Db {
  $queryRaw: PrismaClient['$queryRaw'];
  $executeRaw: PrismaClient['$executeRaw'];
  $transaction: PrismaClient['$transaction'];
  guildConfigurations: PrismaClient['guild_configs'];
  voiceStats: PrismaClient['voice_stats'];
  messageStats: PrismaClient['message_stats'];
  userConfigs: PrismaClient['user_configs'];
  userStatus: PrismaClient['user_statuses'];
  metrics: PrismaClient['metrics'];
  gameTypes: PrismaClient['game_type'];
  gameResults: PrismaClient['game_result'];
  gamePlayers : PrismaClient['game_player'];
  userSession: PrismaClient['user_session'];
  session: PrismaClient['session'];
  metricDaily: PrismaClient['metric_daily'];
  guildEvents: PrismaClient['guild_events'];
  pageViews: PrismaClient['page_views'];
  appNotice: PrismaClient['app_notice'];
  settingsChanges: PrismaClient['guild_settings_changes'];
  xpEvents: PrismaClient['xp_events'];
  xpRules: PrismaClient['xp_rules'];
}

export let currentClient: PrismaClient;

export async function createPrismaClient() {
  currentClient = new PrismaClient();

  Logger.info('Initializing database');

  await currentClient.$connect();
  Logger.info('Database client initialized');

  return currentClient;
}

/**
 * Timestamps are stored as UTC without a zone and compared with NOW(), which
 * follows the session time zone. The migration pins the database to UTC, but
 * that setting isn't in a pg_dump: restoring into a new database loses it.
 */
export async function assertUtcTimeZone(db: Pick<Db, '$queryRaw'>): Promise<void> {
  const [{ timezone }] = await db.$queryRaw<{ timezone: string }[]>`SELECT current_setting('TimeZone') AS timezone`;
  if (timezone !== 'UTC' && timezone !== 'Etc/UTC') {
    throw new Error(
      `Database time zone is ${timezone}, not UTC, so live durations would be off. ` +
        `Run: ALTER DATABASE <name> SET timezone TO 'UTC'; then restart.`
    );
  }
}

export function getDb(): Db {
  if (!currentClient) {
    throw new Error('Database client is not initialized');
  }

  return {
    $queryRaw: currentClient.$queryRaw.bind(currentClient),
    $executeRaw: currentClient.$executeRaw.bind(currentClient),
    $transaction: currentClient.$transaction.bind(currentClient),
    guildConfigurations: currentClient.guild_configs,
    voiceStats: currentClient.voice_stats,
    messageStats: currentClient.message_stats,
    userConfigs: currentClient.user_configs,
    userStatus: currentClient.user_statuses,
    metrics: currentClient.metrics,
    gameTypes: currentClient.game_type,
    gameResults: currentClient.game_result,
    gamePlayers: currentClient.game_player,
    userSession: currentClient.user_session,
    session: currentClient.session,
    metricDaily: currentClient.metric_daily,
    guildEvents: currentClient.guild_events,
    pageViews: currentClient.page_views,
    appNotice: currentClient.app_notice,
    settingsChanges: currentClient.guild_settings_changes,
    xpEvents: currentClient.xp_events,
    xpRules: currentClient.xp_rules,
  };
}

export async function disconnect(): Promise<void> {
  if (!currentClient) return;
  await currentClient.$disconnect();
}
