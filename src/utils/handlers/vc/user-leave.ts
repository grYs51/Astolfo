import { VoiceState } from 'discord.js';
import { handleVoiceUserLog } from './user-save';

export const handleUserLeftVoiceChannel = (oldstate: VoiceState, date: Date) =>
  handleVoiceUserLog(oldstate, date);
