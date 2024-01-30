import { Message, EmbedBuilder } from 'discord.js';
import BaseCommand from '../../utils/structures/BaseCommand';
import DiscordClient from '../../client/client';
// import * as mc from 'minecraft-server-util';

const options = {
  timeout: 1000 * 5, // timeout in milliseconds
  enableSRV: true, // SRV record lookup
};

export default class McCommand extends BaseCommand {
  constructor() {
    super('mc', 'test', []);
  }

  async run(client: DiscordClient, message: Message, args: Array<string>) {
    message.channel.sendTyping();

    const embed = new EmbedBuilder()
      .setColor('#FF69B4')
      .setAuthor({
        name: message.author.username,
        iconURL: message.author.displayAvatarURL({
          size: 64,
        }),
      })
      .setTitle('Status');

      return message.react('✅');

    // mc.status('40.68.145.3', 25565, options)
    //   .then((result) => {
    //     embed.addFields(
    //       {
    //         name: 'Maxime Server Status',
    //         value: 'Server is **Online!**',
    //       },
    //       {
    //         name: 'Players',
    //         value: `${result.players.online} / ${result.players.max}`,
    //       },
    //     );
    //     if (result.players.online > 0)
    //       embed.addFields({
    //         name: 'Who',
    //         value: result.players
    //           .sample!.map((player) => player.name)
    //           .reduce((agg, curr) => `${agg}${curr}\n `, ''),
    //       });
    //     message.channel.send({ embeds: [embed] });
    //   })
    //   .catch((error) => {
    //     client.logger.error('test', error.message);
    //     message.channel.send('It seems like the server is down, kinda sad...');
    //   });
  }
}
