import { randomUUID } from 'crypto';
import { GuildMember, VoiceBasedChannel, VoiceState } from 'discord.js';

/** Canonical key for the in-memory voice cache and voice-related job maps. */
export const voiceKey = (guildId: string, memberId: string) =>
  `${guildId}:${memberId}`;

export enum VOICE_TYPE {
  VOICE = 'VOICE',
  MUTED = 'MUTED',
  SERVER_MUTED = 'SERVER_MUTED',
  DEAF = 'DEAF',
  SERVER_DEAF = 'SERVER_DEAF',
  VIDEO = 'VIDEO',
  STREAMING = 'STREAMING',
}
export type VoiceTypeToVoiceStats = Record<
  Exclude<VOICE_TYPE, VOICE_TYPE.VOICE>,
  keyof VoiceState
>;
export const voiceTypesToCheck: VoiceTypeToVoiceStats = {
  [VOICE_TYPE.DEAF]: 'deaf',
  [VOICE_TYPE.MUTED]: 'mute',
  [VOICE_TYPE.SERVER_MUTED]: 'serverMute',
  [VOICE_TYPE.SERVER_DEAF]: 'serverDeaf',
  [VOICE_TYPE.VIDEO]: 'selfVideo',
  [VOICE_TYPE.STREAMING]: 'streaming',
};

export const userJoinedVoiceChannel = (
  oldState: VoiceState,
  newState: VoiceState
) => {
  return !oldState.channel && newState.channel;
};

export const userLeftVoiceChannel = (
  oldState: VoiceState,
  newState: VoiceState
) => {
  return oldState.channel && !newState.channel;
};

export const getActiveVoiceStates = (state: VoiceState) =>
  Object.entries(voiceTypesToCheck)
    .filter(([, voiceTypeKey]) => state[voiceTypeKey])
    .map(([voiceTypeKey]) => voiceTypeKey as VOICE_TYPE);

export const getChangedUserVoiceStates = (
  oldState: VoiceState,
  newState: VoiceState
) => {
  return Object.fromEntries(
    Object.entries(voiceTypesToCheck).filter(
      ([, voiceTypeKey]) => oldState[voiceTypeKey] !== newState[voiceTypeKey]
    )
  ) as VoiceTypeToVoiceStats;
};

export const userChangedVoiceChannel = (
  oldState: VoiceState,
  newState: VoiceState
) => {
  return (
    oldState.channel &&
    newState.channel &&
    oldState.channel.id !== newState.channel.id
  );
};

export const createVoiceStats = (
  channel: VoiceBasedChannel,
  member: GuildMember,
  date: Date
) => {
  return Object.entries(voiceTypesToCheck)
    .filter(([, voiceTypeKey]) => member.voice[voiceTypeKey])
    .map(([enumTypekey]) =>
      createVoiceStat(
        channel.guild.id,
        channel.id,
        member.id,
        date,
        enumTypekey as VOICE_TYPE
      )
    );
};

export const createVoiceStat = (
  guildId: string,
  channelId: string,
  memberId: string,
  date: Date,
  type: VOICE_TYPE = VOICE_TYPE.VOICE
) => {
  // id is generated client-side so the open row (ended_on = null) can be
  // inserted immediately and closed later by id
  return {
    id: randomUUID(),
    guild_id: guildId,
    channel_id: channelId,
    member_id: memberId,
    issued_on: date,
    ended_on: null,
    type,
  };
};
