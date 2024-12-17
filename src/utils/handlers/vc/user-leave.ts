import { VoiceState } from 'discord.js';
import { handleVoiceUserLog } from './user-save';
import { cancelJob } from '../../schedulers/voice-channel.scheduler';

export const handleUserLeftVoiceChannel = async (
  oldState: VoiceState,
  date: Date
) => {
  await handleVoiceUserLog(oldState, date);
  cancelJob(oldState.member!.id);
};
