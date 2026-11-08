import { Prisma } from '@prisma/client';
import { VOICE_TYPE } from '../../../../utils/handlers/vc';
import { localIssuedOn } from '../helpers';
import { NOW_UTC } from './presence-sql';

/**
 * Voice time per local (weekday, hour) cell for the server's VOICE sessions
 * started since `start` (undefined = all time). Each session is cut into the
 * hours it covers, so 8PM–1AM counts in 8PM, 9PM … 12AM instead of all in 8PM.
 * `session_count` / `unique_users` are the sessions / members in voice in that
 * hour. Only VOICE rows count (MUTED/DEAF/... overlap them); open sessions
 * count live. Cut in the viewer's wall-clock time so half-hour zones bucket right.
 * `memberFilter` must start with AND (unlike `onlinePieces`).
 * shortcut: on a DST change night that hour is off by the shift, and a session
 * that ends before it starts in wall-clock time (fall-back) is dropped; fine for a heatmap.
 */
export const voiceHeatmapCells = (
  serverId: string,
  tz: string,
  start: Date | undefined,
  memberFilter: Prisma.Sql = Prisma.empty
) => Prisma.sql`
  SELECT
    EXTRACT(HOUR FROM h)::int AS hour,
    EXTRACT(DOW  FROM h)::int AS day_of_week,
    (SUM(EXTRACT(EPOCH FROM LEAST(e, h + INTERVAL '1 hour') - GREATEST(s, h))) / 60)::int AS total_minutes,
    COUNT(*)::bigint AS session_count,
    COUNT(DISTINCT member_id)::bigint AS unique_users
  FROM (
    SELECT member_id,
           ${localIssuedOn(tz)} AS s,
           ((COALESCE(ended_on, ${NOW_UTC}) AT TIME ZONE 'UTC') AT TIME ZONE ${tz}) AS e
    FROM voice_stats
    WHERE guild_id = ${serverId}
      AND type = ${VOICE_TYPE.VOICE}
      ${start ? Prisma.sql`AND issued_on >= ${start}` : Prisma.empty}
      ${memberFilter}
  ) spans,
  LATERAL generate_series(date_trunc('hour', s), e, INTERVAL '1 hour') AS h
  WHERE h < e AND s < e
  GROUP BY 1, 2
`;
