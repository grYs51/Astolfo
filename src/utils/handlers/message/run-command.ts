import { Message } from "discord.js";
import DiscordClient from "../../../client/client";

export const runCommand = async (client: DiscordClient, message: Message) => {
  const config = client.guildConfigs.get(message.guildId!);
  if (!config) return;

  if (message.content.startsWith(config.prefix)) {
    const [cmdName, ...cmdArgs] = message.content
      .slice(config.prefix.length)
      .trim()
      .split(/\s+/);
    const command = client.commands.get(cmdName);
    if (command) {
      return command.run(client, message, cmdArgs);
    }
  }
}