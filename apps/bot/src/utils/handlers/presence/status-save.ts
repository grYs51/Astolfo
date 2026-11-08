import { client } from '../../../client/instance';
import { Prisma, user_statuses } from '@prisma/client';
import { runSerialized } from '../vc/voice-utils';

/** Status changes shorter than this are noise (client reconnects, idle flaps). */
const MIN_DURATION_MS = 15_000;

/** Queue key: one user's status writes run in order (insert before close). */
export const statusKey = (userId: string) => `status:${userId}`;

/** Inserts the row for a status that just started (persist-on-open). */
export const openStatus = (status: Partial<user_statuses>) =>
  client.dataSource.userStatus.create({
    data: { ...status, ended_at: null } as user_statuses,
  });

/**
 * Closes one open status row, or deletes it when it lasted under
 * MIN_DURATION_MS. `ended_at: null` never overwrites an end that is already set.
 */
export const closeStatus = async (
  status: Partial<user_statuses>,
  date: Date
) => {
  if (!status.id || !status.created_at) return;
  const where = { id: status.id, ended_at: null };
  if (date.getTime() - status.created_at.getTime() < MIN_DURATION_MS) {
    await client.dataSource.userStatus.deleteMany({ where });
  } else {
    await client.dataSource.userStatus.updateMany({
      where,
      data: { ended_at: date },
    });
  }
};

/**
 * Opens a row for every cached status in one batch (startup, after the cache
 * is filled from the gateway).
 */
export const openAllStatuses = async (statuses: Partial<user_statuses>[]) => {
  if (statuses.length === 0) return;
  await client.dataSource.userStatus.createMany({
    data: statuses.map((status) => ({ ...status, ended_at: null }) as user_statuses),
  });
};

/**
 * Closes every cached open status on shutdown so deploys don't leave them
 * open (crash recovery would close them later, at a guessed time).
 */
export const saveAllStatuses = async (date: Date) => {
  const statuses = Array.from(client.userStatus.values());
  client.userStatus.clear();

  const short = (status: Partial<user_statuses>) =>
    !!status.created_at &&
    date.getTime() - status.created_at.getTime() < MIN_DURATION_MS;
  const ids = (list: Partial<user_statuses>[]) =>
    list.map((status) => status.id).filter((id): id is string => !!id);

  const shortIds = ids(statuses.filter(short));
  const closeIds = ids(statuses.filter((status) => !short(status)));
  if (shortIds.length > 0) {
    await client.dataSource.userStatus.deleteMany({
      where: { id: { in: shortIds }, ended_at: null },
    });
  }
  if (closeIds.length > 0) {
    await client.dataSource.userStatus.updateMany({
      where: { id: { in: closeIds }, ended_at: null },
      data: { ended_at: date },
    });
  }
};

/**
 * Crash recovery: close statuses left open by an unclean shutdown, at the
 * last metrics snapshot (same rule as closeDanglingVoiceSessions).
 */
export const closeDanglingStatuses = async () => {
  const lastAlive = await client.dataSource.metrics.findFirst({
    orderBy: { updated_at: 'desc' },
    select: { updated_at: true },
  });
  const cutoff = lastAlive?.updated_at ?? new Date();

  return client.dataSource.$executeRaw(Prisma.sql`
    UPDATE user_statuses
    SET ended_at = GREATEST(created_at, ${cutoff})
    WHERE ended_at IS NULL
  `);
};

