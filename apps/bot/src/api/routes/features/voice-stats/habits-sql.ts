import { Prisma } from '@prisma/client';
import { VoiceHabits } from '@nx-stolfo/api-interfaces';
import { VOICE_TYPE } from '../../../../utils/handlers/vc';

const sumOf = (...types: VOICE_TYPE[]) => Prisma.sql`
  COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(ended_on, NOW()) - issued_on)) * 1000)
    FILTER (WHERE type IN (${Prisma.join(types)})), 0)::bigint`;

const voice = sumOf(VOICE_TYPE.VOICE);

/**
 * Columns voice, muted, deafened, video, streaming (ms) over the selected
 * voice_stats rows, for use with or without GROUP BY. Deafening also mutes,
 * so muted includes deafened time.
 * shortcut: self + server mute (or deafen) at the same moment is counted
 * twice, only clamped to VOICE; merge the intervals with range_agg if the
 * numbers ever look off.
 */
export const HABIT_SUMS = Prisma.sql`
  ${voice} AS voice,
  LEAST(${sumOf(VOICE_TYPE.MUTED, VOICE_TYPE.SERVER_MUTED)}, ${voice}) AS muted,
  LEAST(${sumOf(VOICE_TYPE.DEAF, VOICE_TYPE.SERVER_DEAF)}, ${voice}) AS deafened,
  ${sumOf(VOICE_TYPE.VIDEO)} AS video,
  ${sumOf(VOICE_TYPE.STREAMING)} AS streaming`;

export type HabitRow = Record<keyof VoiceHabits, bigint>;

export const toHabits = (row: HabitRow | undefined): VoiceHabits => ({
  voice: Number(row?.voice ?? 0),
  muted: Number(row?.muted ?? 0),
  deafened: Number(row?.deafened ?? 0),
  video: Number(row?.video ?? 0),
  streaming: Number(row?.streaming ?? 0),
});
