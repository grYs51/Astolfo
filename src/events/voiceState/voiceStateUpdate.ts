import { Events, VoiceState } from 'discord.js';
import BaseEvent from '../../utils/structures/BaseEvent';
import DiscordClient from '../../client/client';
import { voice_stats } from '@prisma/client';

export default class VoiceDurationUpdateEvent extends BaseEvent {
  constructor() {
    super(Events.VoiceStateUpdate);
  }

  async handleVoiceUserLog(
    memberId: string,
    voiceUsers: Partial<voice_stats>[],
    client: DiscordClient,
    date: Date,
  ) {
    const voiceUser = voiceUsers.find(
      (voiceUser) => voiceUser.member_id === memberId,
    );

    if (voiceUser) {
      voiceUser.ended_on = date;
      await client.dataSource.voiceStats.create({
        data: voiceUser as voice_stats,
      });
      voiceUsers = voiceUsers.filter((voiceUser) => voiceUser.member_id !== memberId);
    }
  }

  async handleUserJoinedVoiceChannel(
    newState: VoiceState,
    voiceUsers: Partial<voice_stats>[],
    date: Date,
  ) {
    voiceUsers.push({
      guild_id: newState.guild.id,
      member_id: newState.member!.id,
      channel_id: newState.channel!.id,
      type: 'VOICE',
      issued_on: date,
    });
  }

  async handleUserLeftVoiceChannel(
    oldState: VoiceState,
    newState: VoiceState,
    voiceUsers: any[],
    client: any,
    date: Date,
  ) {
    if (oldState.channel && !newState.channel) {
      await this.handleVoiceUserLog(
        oldState.member!.id,
        voiceUsers,
        client,
        date,
      );
    }
  }

  private async handleUserChangedVoiceChannel(
    oldState: VoiceState,
    newState: VoiceState,
    voiceUsers: Partial<voice_stats>[],
    client: any,
    date: Date,
  ) {
    if (
      oldState.channel &&
      newState.channel &&
      oldState.channel.id !== newState.channel.id
    ) {
      await this.handleVoiceUserLog(
        newState.member!.id,
        voiceUsers,
        client,
        date,
      );
      await this.handleUserJoinedVoiceChannel(newState, voiceUsers, date);
    }
  }

  async run(client: DiscordClient, oldState: VoiceState, newState: VoiceState) {
    const date = new Date();
    const voiceUsers = client.voiceUsers;

    // User joined a voice channel
    if (!oldState.channel && newState.channel) {
      await this.handleUserJoinedVoiceChannel(newState, voiceUsers, date);
      return;
    }

    // User left a voice channel
    await this.handleUserLeftVoiceChannel(
      oldState,
      newState,
      voiceUsers,
      client,
      date,
    );

    // User changed voice channel
    await this.handleUserChangedVoiceChannel(
      oldState,
      newState,
      voiceUsers,
      client,
      date,
    );
  }
}
