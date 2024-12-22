import { NewsChannel, VoiceState } from 'discord.js';
import { client } from '../../..';
import {
  VOICE_TYPE,
  VoiceTypeToVoiceStats,
  createVoiceStat,
  getActiveVoiceStates,
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
  await saveAllUserVoiceStatsToDb(oldState.member!.id, date);
  cancelJob(oldState.member!.id);
};

export const handleUserJoinedVoiceChannel = (
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

  client.voiceUsers.push(voiceVoiceStat, ...otherVoiceStats);
  schedule5hrVoiceChannelJob(newState.member!, newState.channel!.id, date);
};

export const handleUserChangeVoiceChannel = async (
  oldState: VoiceState,
  newState: VoiceState,
  date: Date
) => {
  await handleUserLeftVoiceChannel(oldState, date);
  handleUserJoinedVoiceChannel(newState, date);
};

export const handleUserChangeVoiceStates = async (
  oldState: VoiceState,
  newState: VoiceState,
  date: Date,
  statesChanged: VoiceTypeToVoiceStats
) => {
  //states changed to True, add to VoiceStats
  const statesToAdd = Object.entries(statesChanged)
    .filter(([, state]) => newState[state])
    .map(([key]) => key);

  if (statesToAdd.length) {
    const newVoiceStats = statesToAdd.map((type) =>
      createVoiceStat(
        newState.guild.id,
        newState.channelId!,
        newState.member!.id,
        date,
        type as VOICE_TYPE
      )
    );
    client.voiceUsers.push(...newVoiceStats);
  }

  //states changed to False, save VoiceStat to Db
  const statesToSave = Object.entries(statesChanged)
    .filter(([, state]) => !newState[state])
    .map(([key]) => key);

  if (statesToSave.length) {
    const voiceStatSavePromises = statesToSave.map((type) =>
      saveTypeUserVoiceStats(oldState.member!.id, date, type as VOICE_TYPE)
    );
    await Promise.all(voiceStatSavePromises);
  }
};
