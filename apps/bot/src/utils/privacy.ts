import { Prisma } from '@prisma/client';
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

/** Member-id columns the privacy filter can be applied to */
export type MemberColumn =
  | 'member_id'
  | 'user_id'
  | 'other.member_id'
  | 'a.member_id'
  | 'b.member_id';

/**
 * SQL filter leaving out members who hide from other members — except the
 * viewer themselves. For output everyone sees (e.g. a channel post), pass an
 * empty viewerId so every hidden member is left out. Anonymous totals don't
 * need this filter.
 */
export const visibleMembersOnly = (column: MemberColumn, viewerId: string) =>
  Prisma.sql`AND ${Prisma.raw(column)} NOT IN (
    SELECT user_id FROM user_configs WHERE privacy_hidden AND user_id <> ${viewerId}
  )`;
