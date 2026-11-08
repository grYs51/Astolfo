import { Prisma } from '@prisma/client';
import { VoiceHabits } from '@nx-stolfo/api-interfaces';
import { VOICE_TYPE } from '../../../../utils/handlers/vc';

const sumOf = (type: VOICE_TYPE) => Prisma.sql`
  COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(ended_on, NOW()) - issued_on)) * 1000)
    FILTER (WHERE type = ${type}), 0)::bigint`;

const voice = sumOf(VOICE_TYPE.VOICE);
/** A state's time, never more than the voice time */
const capped = (type: VOICE_TYPE) => Prisma.sql`LEAST(${sumOf(type)}, ${voice})`;

/**
 * Columns voice, muted, deafened, video, streaming (ms) over the selected
 * voice_stats rows, for use with or without GROUP BY. MUTED and DEAF rows
 * already include server mute/deafen (discord.js `mute` = serverMute ||
 * selfMute), so the SERVER_* rows aren't added; self-deafening also mutes,
 * so muted includes deafened time.
 * shortcut: rows are picked by issued_on, so a state that started in the
 * period inside a session that started before it counts without that voice
 * time; the cap to VOICE bounds it. Clip intervals to the period if it matters.
 */
export const HABIT_SUMS = Prisma.sql`
  ${voice} AS voice,
  ${capped(VOICE_TYPE.MUTED)} AS muted,
  ${capped(VOICE_TYPE.DEAF)} AS deafened,
  ${capped(VOICE_TYPE.VIDEO)} AS video,
  ${capped(VOICE_TYPE.STREAMING)} AS streaming`;

export type HabitRow = Record<keyof VoiceHabits, bigint>;

export const toHabits = (row: HabitRow | undefined): VoiceHabits => ({
  voice: Number(row?.voice ?? 0),
  muted: Number(row?.muted ?? 0),
  deafened: Number(row?.deafened ?? 0),
  video: Number(row?.video ?? 0),
  streaming: Number(row?.streaming ?? 0),
});
