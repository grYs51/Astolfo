// https://discord.js.org/#/docs/main/stable/class/Client?scrollTo=e-error
import BaseEvent from '../../utils/structures/BaseEvent';
import DiscordClient from '../../client/client';

export default class ErrorEvent extends BaseEvent {
  constructor() {
    super('error');
  }
  
  async run(client: DiscordClient, error: Error) {
    client.logger.child({ event: 'error' }).error(error);
  }
}
