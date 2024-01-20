import { Client, ClientOptions, Collection } from 'discord.js';
import BaseEvent from '../utils/structures/BaseEvent';
import BaseCommand from '../utils/structures/BaseCommand';
import BaseSlash from '../utils/structures/BaseSlash';
import { GuildConfiguration, GuildStats } from '../db/models';
import { Db } from '../db';
import { Logger } from 'pino';

export default class DiscordClient extends Client {
  private _commands = new Collection<string, BaseCommand>();
  private _events = new Collection<string, BaseEvent>();
  private _interactions = new Collection<string, any>();
  private _slashs = new Collection<string, BaseSlash>();
  private _configs = new Collection<string, GuildConfiguration>();
  private _voiceUsers = new Array<GuildStats>();
  private _dataSource: Db;
  private _logger: Logger;

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

  get configs(): Collection<string, GuildConfiguration> {
    return this._configs;
  }

  get voiceUsers(): Array<GuildStats> {
    return this._voiceUsers;
  }

  get dataSource(): Db {
    return this._dataSource;
  }

  get logger(): Logger {
    return this._logger;
  }

  set configs(guildConfigs: Collection<string, GuildConfiguration>) {
    this._configs = guildConfigs;
  }

  set voiceUsers(GuildStatsLogs: Array<GuildStats>) {
    this._voiceUsers = GuildStatsLogs;
  }

  set dataSource(dataSource: Db) {
    this._dataSource = dataSource;
  }

  set logger(logger: Logger) {
    this._logger = logger;
  }
}
