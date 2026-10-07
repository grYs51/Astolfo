import { VoiceState } from 'discord.js';
import { client } from '../../../client/instance';
import {
  VOICE_TYPE,
  VoiceTypeToVoiceStats,
  createVoiceStat,
  getActiveVoiceStates,
  voiceKey,
} from './voice-utils';
import {
  cancelJob,
  schedule5hrVoiceChannelJob,
} from '../../schedulers/voice-channel.scheduler';
import { saveAllUserVoiceStatsToDb, saveTypeUserVoiceStats } from './voice-db';
import { Logger } from '../../logger';

export const handleUserLeftVoiceChannel = async (
  oldState: VoiceState,
  date: Date
) => {
  try {
    await saveAllUserVoiceStatsToDb(oldState.member!.id, oldState.guild.id, date);
  } finally {
    cancelJob(oldState.guild.id, oldState.member!.id);
  }
};

export const handleUserJoinedVoiceChannel = async (
  newState: VoiceState,
  date: Date
) => {
  const joinKey = voiceKey(newState.guild.id, newState.member!.id);

  // Anything still cached on join belongs to a session whose leave was never
  // seen (e.g. missed gateway event) — close it rather than append to it
  if (client.voiceUsers.has(joinKey)) {
    Logger.warn(`Closing stale voice session for ${joinKey} on join`);
    await saveAllUserVoiceStatsToDb(newState.member!.id, newState.guild.id, date);
  }

  const voiceVoiceStat = createVoiceStat(
    newState.guild.id,
    newState.channelId!,
    newState.member!.id,
    date
  );

  const otherVoiceStats = getActiveVoiceStates(newState).map((type) =>
    createVoiceStat(
      newState.guild.id,
      newState.channelId!,
      newState.member!.id,
      date,
      type
    )
  );

  // Persist on open: rows go to the DB immediately with ended_on = null, so
  // a crash can't lose the session (recovered by closeDanglingVoiceSessions)
  const newStats = [voiceVoiceStat, ...otherVoiceStats];
  await client.dataSource.voiceStats.createMany({ data: newStats });

  client.voiceUsers.set(joinKey, newStats);
  schedule5hrVoiceChannelJob(newState.member!, newState.channel!.id, date);
};

export const handleUserChangeVoiceChannel = async (
  oldState: VoiceState,
  newState: VoiceState,
  date: Date
) => {
  await handleUserLeftVoiceChannel(oldState, date);
  await handleUserJoinedVoiceChannel(newState, date);
};

export const handleUserChangeVoiceStates = async (
  oldState: VoiceState,
  newState: VoiceState,
  date: Date,
  statesChanged: VoiceTypeToVoiceStats
) => {
  const stateKey = voiceKey(newState.guild.id, newState.member!.id);
  const openTypes = new Set(
    (client.voiceUsers.get(stateKey) ?? []).map((stat) => stat.type)
  );

  // Skip types that already have an open row (e.g. captured by setVc at startup)
  const statesToAdd = Object.entries(statesChanged)
    .filter(([key, state]) => newState[state] && !openTypes.has(key))
    .map(([key]) => key as VOICE_TYPE);

  if (statesToAdd.length > 0) {
    const newVoiceStats = statesToAdd.map((type) =>
      createVoiceStat(
        newState.guild.id,
        newState.channelId!,
        newState.member!.id,
        date,
        type
      )
    );
    await client.dataSource.voiceStats.createMany({ data: newVoiceStats });
    const existingStats = client.voiceUsers.get(stateKey) ?? [];
    client.voiceUsers.set(stateKey, [...existingStats, ...newVoiceStats]);
  }

  const statesToSave = Object.entries(statesChanged)
    .filter(([, state]) => !newState[state])
    .map(([key]) => key as VOICE_TYPE);

  if (statesToSave.length > 0) {
    await saveTypeUserVoiceStats(
      oldState.member!.id,
      oldState.guild.id,
      date,
      statesToSave
    );
  }
};
