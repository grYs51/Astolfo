// https://discord.js.org/#/docs/main/stable/class/Client?scrollTo=e-voiceStateUpdate
import { Events, VoiceState } from 'discord.js';
import BaseEvent from '../../utils/structures/BaseEvent';
import DiscordClient from '../../client/client';
import { Info } from '../../utils/types';
import { voice_stats } from '@prisma/client';

export default class VoiceDurationUpdateEvent extends BaseEvent {
  constructor() {
    super(Events.VoiceStateUpdate);
  }

  async run(client: DiscordClient, oldState: VoiceState, newState: VoiceState) {
    const date = new Date();
    const voiceUsers = client.voiceUsers;

    const userInfo: Info = {
      guild: newState.guild,
      member: newState.member!,
      channel: newState.channel!,
    };

    // Function to handle voice user logging
    const handleVoiceUserLog = async (memberId: string) => {
      const index = voiceUsers.findIndex(voiceUser => voiceUser.member_id === memberId);
      if (index !== -1) {
        const voiceUser = voiceUsers[index];
        voiceUser.ended_on = date;
        await client.dataSource.voiceStats.create({
          data: voiceUser as voice_stats,
        });
        voiceUsers.splice(index, 1);
      }
    };

    // User joined a voice channel
    if (!oldState.channel && newState.channel) {
      voiceUsers.push({
        guild_id: newState.guild.id,
        member_id: newState.member!.id,
        channel_id: newState.channel!.id,
        type: 'VOICE',
        issued_on: date,
      });
      return;
    }

    // User left a voice channel
    if (oldState.channel && !newState.channel) {
      await handleVoiceUserLog(userInfo.member.id);
      return;
    }

    // User changed voice channel
    if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
      await handleVoiceUserLog(userInfo.member.id);
      voiceUsers.push({
        guild_id: newState.guild.id,
        member_id: newState.member!.id,
        channel_id: newState.channel!.id,
        type: 'VOICE',
        issued_on: date,
      });
    }
  }
}