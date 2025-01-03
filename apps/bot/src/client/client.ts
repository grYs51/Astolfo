import { Client, ClientOptions, Collection } from 'discord.js';
import BaseEvent from '../utils/structures/base-event';
import BaseCommand from '../utils/structures/base-command';
import { BaseSlash } from '../utils/structures/base-slash';
import {
  guild_configs,
  user_configs,
  user_statuses,
  voice_stats,
} from '@prisma/client';
import { Db } from '../db';
import BaseInteraction from '../utils/structures/base-interaction';

export default class DiscordClient extends Client {
  public readonly commands = new Collection<string, BaseCommand>();
  public readonly events = new Collection<string, BaseEvent>();
  public readonly interactions = new Collection<string, BaseInteraction>();
  public readonly slashs = new Collection<string, BaseSlash>();
  public readonly guildConfigs = new Collection<string, guild_configs>();
  public readonly userConfigs = new Collection<string, user_configs>();
  public readonly userStatus = new Collection<string, Partial<user_statuses>>();
  public voiceUsers: Array<Partial<voice_stats>> = [];
  public dataSource: Db;

  constructor(options: ClientOptions) {
    super(options);
  }

  get ownerId(): string {
    return process.env.OWNER!;
  }
}
