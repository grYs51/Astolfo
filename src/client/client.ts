import { Client, ClientOptions, Collection } from 'discord.js';
import BaseEvent from '../utils/structures/BaseEvent';
import BaseCommand from '../utils/structures/BaseCommand';
import BaseSlash from '../utils/structures/BaseSlash';
import { Logger } from 'pino';
import { guild_configs, user_configs, voice_stats } from '@prisma/client';
import { Db } from '../db';
import logger from '../utils/logger';

export default class DiscordClient extends Client {
  private _commands = new Collection<string, BaseCommand>();
  private _events = new Collection<string, BaseEvent>();
  private _interactions = new Collection<string, any>();
  private _slashs = new Collection<string, BaseSlash>();
  private _guildConfigs = new Collection<string, guild_configs>();
  private _userConfigs = new Collection<string, user_configs>();
  private _voiceUsers = new Array<Partial<voice_stats>>();
  private _dataSource: Db;
  private _logger: Logger = logger;

  constructor(options: ClientOptions) {
    super(options);
  }

  get ownerId(): string {
    return process.env.OWNER!;
  }

  get commands(): Collection<string, BaseCommand> {
    return this._commands;
  }

  get events(): Collection<string, BaseEvent> {
    return this._events;
  }

  get interactions(): Collection<string, any> {
    return this._interactions;
  }

  get slashs(): Collection<string, BaseSlash> {
    return this._slashs;
  }

  get guildConfigs(): Collection<string, guild_configs> {
    return this._guildConfigs;
  }

  get userConfigs(): Collection<string, user_configs> {
    return this._userConfigs;
  }

  get voiceUsers(): Array<Partial<voice_stats>> {
    return this._voiceUsers;
  }

  get dataSource(): Db {
    return this._dataSource;
  }

  get logger(): Logger {
    return this._logger;
  }

  set guildConfigs(guildConfigs: Collection<string, guild_configs>) {
    this._guildConfigs = guildConfigs;
  }

  set userConfigs(userConfigs: Collection<string, user_configs>) {
    this._userConfigs = userConfigs;
  }

  set voiceUsers(GuildStatsLogs: Array<Partial<voice_stats>>) {
    this._voiceUsers = GuildStatsLogs;
  }

  set dataSource(dataSource: Db) {
    this._dataSource = dataSource;
  }

  set logger(logger: Logger) {
    this._logger = logger;
  }
}
