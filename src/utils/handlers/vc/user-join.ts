import { VoiceState } from 'discord.js';
import { client } from '../../..';
import { schedule5hrVoiceChannelJob } from '../../schedulers/voice-channel.scheduler';

export const handleUserJoinedVoiceChannel = (
  newState: VoiceState,
  date: Date
) => {
  client.voiceUsers.push({
    guild_id: newState.guild.id,
    member_id: newState.member!.id,
    channel_id: newState.channel!.id,
    type: 'VOICE',
    issued_on: date,
  });

  schedule5hrVoiceChannelJob(newState.member!, newState.channel!.id, date);
};
