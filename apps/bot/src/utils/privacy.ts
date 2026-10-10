import type { Db } from '../db';

/**
 * Member privacy (user_configs.privacy_hidden): members can hide from other
 * members' views. Shared by the dashboard API and the slash commands.
 */

/** Whether `memberId` hides their stats from `viewerId` (never from themselves). */
export const isHiddenFrom = async (
  db: Pick<Db, 'userConfigs'>,
  memberId: string,
  viewerId: string
) =>
  memberId !== viewerId &&
  !!(await db.userConfigs.findFirst({
    where: { user_id: memberId, privacy_hidden: true },
    select: { user_id: true },
  }));

/** Everyone who hides from other members (for public, in-channel output). */
export const hiddenMemberIds = async (db: Pick<Db, 'userConfigs'>) =>
  new Set(
    (
      await db.userConfigs.findMany({
        where: { privacy_hidden: true },
        select: { user_id: true },
      })
    ).map((config) => config.user_id)
  );
