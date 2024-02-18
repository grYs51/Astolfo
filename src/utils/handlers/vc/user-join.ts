import { VoiceState } from 'discord.js';
import { client } from '../../..';

export const handleUserJoinedVoiceChannel = (
  newState: VoiceState,
  date: Date,
) =>
  client.voiceUsers.push({
    guild_id: newState.guild.id,
    member_id: newState.member!.id,
    channel_id: newState.channel!.id,
    type: 'VOICE',
    issued_on: date,
  });
