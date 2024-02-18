import { VoiceState } from 'discord.js';
import { handleUserChangeVoiceChannel, handleUserJoinedVoiceChannel, handleUserLeftVoiceChannel } from '.';

const userJoinedVoiceChannel = (oldState: VoiceState, newState: VoiceState) => {
  return !oldState.channel && newState.channel;
}

const userLeftVoiceChannel = (oldState: VoiceState, newState: VoiceState) => {
  return oldState.channel && !newState.channel;
}

const userChangedVoiceChannel = (oldState: VoiceState, newState: VoiceState) => {
  return oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id;
}

export const handleVoiceChannelStateChanges = (
  oldState: VoiceState,
  newState: VoiceState,
  date: Date,
) => {
  if (userJoinedVoiceChannel(oldState, newState)) {
    return handleUserJoinedVoiceChannel(newState, date);
  }

  if (userLeftVoiceChannel(oldState, newState)) {
    return handleUserLeftVoiceChannel(oldState, date);
  }

  if (userChangedVoiceChannel(oldState, newState)) {
    return handleUserChangeVoiceChannel(oldState, newState, date);
  }
};

