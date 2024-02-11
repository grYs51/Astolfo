import { Client, ClientOptions, Collection } from 'discord.js';
import BaseEvent from '../utils/structures/BaseEvent';
import BaseCommand from '../utils/structures/BaseCommand';
import BaseSlash from '../utils/structures/BaseSlash';
import { Logger } from 'pino';
import { guild_configs, user_configs, voice_stats } from '@prisma/client';
import { Db } from '../db';
import logger from '../utils/logger';

export default class DiscordClient extends Client {
  public readonly commands = new Collection<string, BaseCommand>();
  public readonly events = new Collection<string, BaseEvent>();
  public readonly interactions = new Collection<string, any>();
  public readonly slashs = new Collection<string, BaseSlash>();
  public readonly guildConfigs = new Collection<string, guild_configs>();
  public readonly userConfigs = new Collection<string, user_configs>();
  public readonly logger: Logger = logger;
  public voiceUsers: Array<Partial<voice_stats>> = [];
  public dataSource: Db;

  constructor(options: ClientOptions) {
    super(options);
  }

  get ownerId(): string {
    return process.env.OWNER!;
  }
}