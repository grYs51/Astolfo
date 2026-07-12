import { VoiceState } from 'discord.js';
import { client } from '../../..';
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

export const handleUserLeftVoiceChannel = async (
  oldState: VoiceState,
  date: Date
) => {
  await saveAllUserVoiceStatsToDb(oldState.member!.id, oldState.guild.id, date);
  cancelJob(oldState.guild.id, oldState.member!.id);
};

export const handleUserJoinedVoiceChannel = async (
  newState: VoiceState,
  date: Date
) => {
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

  const joinKey = voiceKey(newState.guild.id, newState.member!.id);
  const existing = client.voiceUsers.get(joinKey) ?? [];
  client.voiceUsers.set(joinKey, [...existing, ...newStats]);
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
  const statesToAdd = Object.entries(statesChanged)
    .filter(([, state]) => newState[state])
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
    const stateKey = voiceKey(newState.guild.id, newState.member!.id);
    const existingStats = client.voiceUsers.get(stateKey) ?? [];
    client.voiceUsers.set(stateKey, [...existingStats, ...newVoiceStats]);
  }

  const statesToSave = Object.entries(statesChanged)
    .filter(([, state]) => !newState[state])
    .map(([key]) => key as VOICE_TYPE);

  if (statesToSave.length > 0) {
    const voiceStatSavePromises = statesToSave.map((type) =>
      saveTypeUserVoiceStats(oldState.member!.id, oldState.guild.id, date, type)
    );
    await Promise.all(voiceStatSavePromises);
  }
};
