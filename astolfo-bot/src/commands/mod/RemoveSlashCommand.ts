import { Message } from 'discord.js';
import BaseCommand from '../../utils/structures/BaseCommand';
import DiscordClient from '../../client/client';
import DiscordInteractions from 'slash-commands';

export default class RemoveSlashCommand extends BaseCommand {
  constructor() {
    super('removeSlash', 'mod', []);
  }

  async run(client: DiscordClient, message: Message, args: Array<string>) {
    const interaction = new DiscordInteractions({
      applicationId: process.env.APPLICATION_ID!,
      authToken: process.env.BOT_TOKEN!,
      publicKey: process.env.PUBLIC_KEY!,
    });

    interaction.getApplicationCommands().then((commands) => {
      commands.forEach((command) => {
        interaction
          .deleteApplicationCommand(command.id)
          .then((res) => {
            console.log(res);
          })
          .catch(console.error);
      });
    });
    message.react('✅');
  }
}
