import { Events } from 'discord.js';
import DiscordClient from '../../client/client';
import { eventsCount } from '../../api/utils.ts/counter';

export default interface BaseEvent {
  getUserId?(client: DiscordClient, ...args: any): string | undefined;
  getGuildId?(client: DiscordClient, ...args: any): string | undefined;
}

export default abstract class BaseEvent {
  constructor(private readonly _name: Events) {}

  get name(): Events | string {
    return this._name;
  }

  run(client: DiscordClient, ...args: any): void {
    eventsCount(
      this._name,
      this.getGuildId?.(client, ...args),
      this.getUserId?.(client, ...args)
    );
    this.event(client, ...args);
  }

  protected abstract event(client: DiscordClient, ...args: any): void;
}
