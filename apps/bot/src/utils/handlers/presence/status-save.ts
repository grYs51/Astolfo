import { client } from '../../..';
import { user_statuses } from '@prisma/client';

/** Status changes shorter than this are noise (client reconnects, idle flaps). */
const MIN_DURATION_MS = 15_000;

/**
 * Persists one closed status interval.
 *
 * Takes the cache entry itself rather than looking it up: the caller must
 * detach it from `client.userStatus` *synchronously*, before awaiting this —
 * see `handleStatusUpdate` for why.
 */
export const saveStatus = async (
  status: Partial<user_statuses>,
  date: Date
) => {
  if (!status.created_at) return;
  if (date.getTime() - status.created_at.getTime() < MIN_DURATION_MS) return;

  await client.dataSource.userStatus.create({
    data: { ...status, ended_at: date } as user_statuses,
  });
};

/**
 * Flushes every cached open status duration to the DB in one batch.
 * Called on shutdown so deploys don't silently drop them.
 */
export const saveAllStatuses = async (date: Date) => {
  const statuses = Array.from(client.userStatus.values())
    .filter(
      (status) =>
        status.created_at &&
        date.getTime() - status.created_at.getTime() >= MIN_DURATION_MS
    )
    .map((status) => ({ ...status, ended_at: date }) as user_statuses);

  client.userStatus.clear();

  if (statuses.length === 0) return;
  await client.dataSource.userStatus.createMany({ data: statuses });
};
