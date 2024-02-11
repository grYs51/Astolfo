import { Events, Interaction } from 'discord.js';
import DiscordClient from '../../client/client';

export default abstract class BaseEvent {
  constructor(private _name: Events) {}

  get name(): Events | string {
    return this._name;
  }
  abstract run(client: DiscordClient, ...args: any): void;
}
