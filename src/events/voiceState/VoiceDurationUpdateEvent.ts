// https://discord.js.org/#/docs/main/stable/class/Client?scrollTo=e-voiceStateUpdate
import { VoiceState } from 'discord.js';
import BaseEvent from '../../utils/structures/BaseEvent';
import DiscordClient from '../../client/client';
import { Info } from '../../utils/types';
import { voice_stats } from '@prisma/client';

enum types {
  DEAF = 'selfDeaf',
  MUTE = 'selfMute',
  VIDEO = 'selfVideo',
  MEMBER_UPDATE_DEAF = 'serverDeaf',
  MEMBER_UPDATE_MUTE = 'serverMute',
  STREAMING = 'streaming',
}
export default class VoiceDurationUpdateEvent extends BaseEvent {
  voicestate: VoiceState;
  constructor() {
    super('voiceStateUpdate');
  }

  async run(client: DiscordClient, oldState: VoiceState, newState: VoiceState) {
    const voiceUsers = client.voiceUsers;
    const date = new Date();
    this.voicestate = newState;
    const userInfo: Info = {
      guild: newState.guild,
      member: newState.member!,
      channel: newState.channel!,
    };

    // User joined a voice channel
    if (oldState.channel === null && newState.channel !== null) {
      const GuildStatsLog: Partial<voice_stats> = {
        guild_id: newState.guild.id,
        member_id: newState.member!.id,
        channel_id: newState.channel!.id,
        type: 'VOICE',
        issued_on: date,
      };

      voiceUsers.push(GuildStatsLog);
      return;
    }

    // User left a voice channel
    if (oldState.channel !== null && newState.channel === null) {
      for (let i = voiceUsers.length - 1; i >= 0; i--) {
        const voiceUser = voiceUsers[i];
        if (voiceUser.member_id === userInfo.member.id) {
          voiceUser.ended_on = date;
          await client.dataSource.voiceStats.create({
            data: voiceUser as voice_stats,
          });
          voiceUsers.splice(i, 1);
        }
      }
      return;
    }

    // User changed voice channel
    if (oldState.channel !== null && newState.channel !== null) {
      if (oldState.channel.id !== newState.channel.id) {
        for (let i = voiceUsers.length - 1; i >= 0; i--) {
          const voiceUser = voiceUsers[i];
          if (voiceUser.member_id === userInfo.member.id) {
            voiceUser.ended_on = date;
            await client.dataSource.voiceStats.create({
              data: voiceUser as voice_stats,
            });
            voiceUsers.splice(i, 1);
          }
        }

        const GuildStatsLog: Partial<voice_stats> = {
          guild_id: newState.guild.id,
          member_id: newState.member!.id,
          channel_id: newState.channel!.id,
          type: 'VOICE',
          issued_on: date,
        };

        voiceUsers.push(GuildStatsLog);
        return;
      }
    }
  }
}
