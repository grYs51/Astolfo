import {
  Channel,
  Guild,
  GuildAuditLogsResolvable,
  GuildMember,
  VoiceBasedChannel,
  VoiceState,
} from 'discord.js';

import { Repository } from 'typeorm';
import AppdataSource from '../../../..';
import { GuildStatsLog } from '../../../../typeOrm/entities/GuildsStatsLog';

import { Info, VoiceType } from '../../../types';
import { IVoiceStateHandler } from '../interfaces/voiceStateHandler';

export class VoiceStateHandler implements IVoiceStateHandler {
  constructor(
    private readonly guildStatRepository: Repository<GuildStatsLog> = AppdataSource.getRepository(
      GuildStatsLog,
    ),
  ) {}

  async memberAbused(
    oldState: VoiceState,
    newState: VoiceState,
    type: VoiceType,
    date: Date,
  ) {
    const guild = oldState.guild;
    const member = oldState.member;
    try {
      const fetchedLogs = await newState.guild.fetchAuditLogs({
        limit: 1,
        type: type as unknown as GuildAuditLogsResolvable,
      });

      const disconnectLog = fetchedLogs.entries.first();

      if (disconnectLog?.changes[0]) {
        type += `_${disconnectLog.changes[0].key.toString().toUpperCase()}`;
      }

      if (!disconnectLog) return;

      const { executor, createdAt } = disconnectLog!;

      if (executor!.id === oldState.member?.id) {
        return;
      }
      let newChannel: VoiceBasedChannel | undefined = undefined;
      if (type === 'MEMBER_MOVE') {
        newChannel = newState.channel!;
      }

      if (Math.abs(date.valueOf() - createdAt.valueOf()) / 1000 < 1) {
        console.log(
          `${executor!.username} ${type} ${oldState!.member?.user.username}`,
        );

        const issuedBy = executor?.id;

        await this.saveRepository(
          guild,
          member!,
          issuedBy,
          oldState.channel!,
          newChannel,
          type,
        );
        return;
      }
      return;
    } catch (error: any) {
      console.log(error.message);
    }
  }

  async memberHimself(
    oldState: VoiceState,
    newState: VoiceState,
    type: VoiceType,
    date: Date,
  ) {
    try {
      await this.saveRepository(
        oldState.guild,
        oldState.member!,
        undefined,
        oldState.channel!,
        undefined,
        type,
        date,
      );
    } catch (e: any) {
      console.log(e.message);
    }
  }

  async saveRepository1(guildLog: GuildStatsLog) {
    try {
      guildLog.id = undefined;
      await this.guildStatRepository.save(guildLog);
    } catch (e) {
      console.log(e);
    }
  }

  async saveRepository(
    guild: Guild,
    member: GuildMember,
    issuedBy: string | undefined,
    channel: Channel,
    newChannel: Channel | undefined,
    type: VoiceType,
    issuedOn = new Date(),
  ) {
    await this.guildStatRepository.save({
      guildId: guild.id,
      member: member.id,
      issuedBy: issuedBy,
      channel: channel.id,
      newChannel: newChannel,
      issuedOn,
      type,
    });
  }
  async getAudit(userInfo: Info, type: VoiceType, voiceState: VoiceState) {
    try {
      const fetchedLogs = await voiceState.guild.fetchAuditLogs({
        limit: 1,
        type: type as unknown as GuildAuditLogsResolvable,
      });
      type = type.slice(0, -5) as VoiceType;

      const disconnectLog = fetchedLogs.entries.first();
      if (disconnectLog?.changes) {
        type += `_${disconnectLog.changes[0].key.toString().toUpperCase()}`;
      }
      const { executor, createdAt } = disconnectLog!;

      if (executor!.id === voiceState.member?.id) {
        return;
      }
      let newChannel: VoiceBasedChannel | undefined = undefined;
      if (type === 'MEMBER_MOVE') {
        newChannel = voiceState.channel
          ? (voiceState.channel as VoiceBasedChannel)
          : undefined;
      }

      if (Math.abs(new Date().valueOf() - createdAt.valueOf()) / 1000 < 1) {
        console.log(
          `${executor!.username} ${type} ${voiceState!.member?.user.username}`,
        );

        const issuedBy = executor?.id;

        return { issuedBy, newChannel, type };
      } else {
        return null;
      }
    } catch (error) {
      console.log(error);
    }
  }
}
