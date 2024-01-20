import { Message } from 'discord.js';
import BaseCommand from '../../utils/structures/BaseCommand';
import DiscordClient from '../../client/client';

export default class getSummonerByName extends BaseCommand {
  constructor() {
    super('test', 'testing', []);
  }

  async run(client: DiscordClient, message: Message, args: Array<string>) {
    message.channel.sendTyping();

    const summoner = await client.leagueClient.getSummonerByName('Duck');

    // message.react('💩').catch(client.logger.error);
  }
}
