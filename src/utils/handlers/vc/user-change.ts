import { VoiceState } from 'discord.js';
import { handleUserJoinedVoiceChannel } from './user-join';
import { handleUserLeftVoiceChannel } from './user-leave';

export const handleUserChangeVoiceChannel = async (
  oldState: VoiceState,
  newState: VoiceState,
  date: Date
) => {
  await handleUserLeftVoiceChannel(oldState, date);
  handleUserJoinedVoiceChannel(newState, date);
};
