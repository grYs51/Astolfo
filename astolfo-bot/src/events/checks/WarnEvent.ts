// https://discord.js.org/#/docs/main/stable/class/Client?scrollTo=e-error
import BaseEvent from '../../utils/structures/BaseEvent';
import DiscordClient from '../../client/client';

export default class WarnEvent extends BaseEvent {
  constructor() {
    super('warn');
  }
  
  async run(client: DiscordClient, error: Error) {
    client.logger.child({ event: 'warn' }).error(error);
  }
}
