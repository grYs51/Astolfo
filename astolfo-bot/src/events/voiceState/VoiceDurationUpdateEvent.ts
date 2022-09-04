// https://discord.js.org/#/docs/main/stable/class/Client?scrollTo=e-voiceStateUpdate
import {
  TextChannel,
  VoiceBasedChannel,
  VoiceChannel,
  VoiceState,
} from 'discord.js';
import BaseEvent from '../../utils/structures/BaseEvent';
import DiscordClient from '../../client/client';
import { GuildStatsLog } from '../../typeOrm/entities/GuildsStatsLog';
import { VoiceStateHandler } from '../../utils/handlers/voiceStateHandler/services/voiceStateHandler.service';
import { Info, VoiceType } from '../../utils/types';

enum types {
  DEAF = 'selfDeaf',
  MUTE = 'selfMute',
  VIDEO = 'selfVideo',
  MEMBER_UPDATE_DEAF = 'serverDeaf',
  MEMBER_UPDATE_MUTE = 'serverMute',
  STREAMING = 'streaming',
}
export default class VoiceDurationUpdateEvent extends BaseEvent {
  voiceStateHandler = new VoiceStateHandler();
  voicestate: VoiceState;
  constructor() {
    super('voiceStateUpdate');
  }

  async run(client: DiscordClient, oldState: VoiceState, newState: VoiceState) {
    const date = new Date();
    this.voicestate = newState;
    const userInfo: Info = {
      guild: newState.guild,
      member: newState.member!,
      channel: newState.channel!,
    };

    // User joins a voice channel
    if (oldState.channel === null) {
      this.setParametersOnConnect(newState, client.voiceUsers, userInfo, date);
      this.setVoiceUser(client.voiceUsers, userInfo, 'VOICE', date);
    }

    // User leaves a voice channel
    if (newState.channel === null) {
      this.voiceStateHandler.memberAbused(
        oldState,
        newState,
        'MEMBER_DISCONNECT',
        date,
      );
      this.endVoiceUser(client.voiceUsers, oldState, date);
    }

    // users stays in a voicechannel
    if (oldState.channel !== null && newState.channel !== null) {
      if (oldState.channelId !== newState.channelId) {
        this.voiceStateHandler.memberAbused(
          oldState,
          newState,
          'MEMBER_MOVE',
          date,
        );
        await this.endVoiceUser(client.voiceUsers, oldState, date);
        this.setVoiceUser(client.voiceUsers, userInfo, 'VOICE', date);
        return;
      }

      this.setParametersOnChange(
        oldState,
        newState,
        client.voiceUsers,
        userInfo,
        date,
      );
    }
  }
  private async endVoiceUser(
    voiceUsers: GuildStatsLog[],
    oldState: VoiceState,
    endDate: Date,
  ) {
    for (let i = voiceUsers.length - 1; i >= 0; i--) {
      const voiceUser = voiceUsers[i];
      if (voiceUser.id === oldState.member!.id + oldState.guild.id) {
        voiceUser.endedOn = endDate;
        await this.voiceStateHandler.saveRepository1(voiceUser);
        voiceUsers.splice(i, 1);
      }
    }
  }

  private async setVoiceUser(
    voiceUsers: Array<GuildStatsLog>,
    userInfo: Info,
    type: VoiceType,
    date: Date,
  ) {
    let audit:
      | null
      | undefined
      | {
          issuedBy: string | undefined | null;
          newChannel: VoiceBasedChannel | undefined;
          type: VoiceType;
        } = null;
    if (type.includes('MEMBER_')) {
      audit = await this.voiceStateHandler.getAudit(
        userInfo,
        type,
        this.voicestate,
      );
    }

    let guildStat: GuildStatsLog = {
      type,
      id: userInfo.member.id + userInfo.guild.id,
      issuedOn: date,
      memberId: userInfo.member.id,
      guildId: userInfo.guild.id,
      channelId: userInfo.channel.id,
    };
    if (audit) {
      guildStat = {
        issuedById: audit.issuedBy || undefined,
        issuedOn: date,
        memberId: userInfo.member.id,
        guildId: userInfo.guild.id,
        channelId: userInfo.channel.id,
        type: audit.type,
        newChannelId: audit.newChannel?.id,
      };
    }
    voiceUsers.push(guildStat);
  }

  // Eris Code
  private functor(
    oldState: boolean,
    newState: boolean,
    type: VoiceType,
    voiceUsers: Array<GuildStatsLog>,
    userInfo: Info,
    date: Date,
  ) {
    if (oldState !== newState) {
      return newState
        ? this.setVoiceUser(voiceUsers, userInfo, type, date)
        : this.endState(voiceUsers, userInfo, type);
    } else {
      return null;
    }
  }

  private async endState(
    voiceUsers: GuildStatsLog[],
    userInfo: Info,
    type: VoiceType,
  ) {
    const endDate = new Date();
    for (let i = voiceUsers.length - 1; i >= 0; i--) {
      const voiceUser = voiceUsers[i];
      if (
        voiceUser.memberId === userInfo.member.id &&
        voiceUser.type === type
      ) {
        voiceUser.endedOn = endDate;
        await this.voiceStateHandler.saveRepository1(voiceUser);
        voiceUsers.splice(i, 1);
      }
    }
  }
  private setParametersOnConnect(
    voicestate: VoiceState,
    voiceUsers: Array<GuildStatsLog>,
    userInfo: Info,
    date: Date,
  ) {
    for (let value of enumKeys(types)) {
      (voicestate as any)[types[value]]
        ? this.setVoiceUser(voiceUsers, userInfo, value, date)
        : null;
    }
  }

  private setParametersOnChange(
    oldState: VoiceState,
    newState: VoiceState,
    voiceUsers: Array<GuildStatsLog>,
    userInfo: Info,
    date: Date,
  ) {
    for (let value of enumKeys(types)) {
      this.functor(
        (oldState as any)[types[value]],
        (newState as any)[types[value]],
        value,
        voiceUsers,
        userInfo,
        date,
      );
    }
  }
}

function enumKeys<O extends object, K extends keyof O = keyof O>(obj: O): K[] {
  return Object.keys(obj).filter((k) => Number.isNaN(+k)) as K[];
}
