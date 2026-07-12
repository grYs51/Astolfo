import { Events } from 'discord.js';
import DiscordClient from '../../client/client';
import { eventsCount } from '../../api/utils.ts/counter';
import { Logger } from '../logger';

export default abstract class BaseEvent {
  constructor(private readonly _name: Events) {}

  get name(): Events | string {
    return this._name;
  }

  run(client: DiscordClient, ...args: any): void {
    eventsCount(this._name);
    try {
      // Async handler rejections would otherwise become context-free
      // global unhandledRejections
      Promise.resolve(this.event(client, ...args)).catch((error) =>
        Logger.error(`Error in "${this._name}" event handler`, error)
      );
    } catch (error) {
      Logger.error(`Error in "${this._name}" event handler`, error);
    }
  }

  protected abstract event(client: DiscordClient, ...args: any): void | Promise<void>;
}
