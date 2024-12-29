// shows info about the bot

import {
  CommandInteraction,
  CacheType,
  InteractionResponse,
  EmbedBuilder,
} from 'discord.js';
import DiscordClient from '../../client/client';
import { BaseSlash } from '../../utils/structures/base-slash';
import humanizeDuration from 'humanize-duration';
import os from 'os';

export default class InfoSlash extends BaseSlash {
  constructor() {
    super('info', 'Shows info about the bot');
  }

  protected slash(
    client: DiscordClient,
    interaction: CommandInteraction<CacheType>
  ): Promise<InteractionResponse<boolean>> | Promise<void> {
    const nodeVersion = process.version;
    const discordVersion = require('discord.js').version;
    const botVersion = require('../../../package.json').version;
    const uptime = client.uptime ?? 0;

    // cpu
    const cpu = os.cpus()[0];
    const cpuModel = cpu.model;
    const cpuUsage = process.cpuUsage().system / 1000000;

    const embed = new EmbedBuilder()
      .setColor('#FF69B4')
      .setAuthor({
        name: interaction.user.username,
        iconURL: interaction.user.displayAvatarURL({
          size: 64,
        }),
      })
      .setTitle('Information')
      .setDescription('Info about the bot')
      .addFields([
        {
          name: 'Bot Version',
          value: botVersion,
          inline: true,
        },
        {
          name: 'Node Version',
          value: nodeVersion,
          inline: true,
        },
        {
          name: 'Discord.js Version',
          value: discordVersion,
          inline: true,
        },
        {
          name: ' ',
          value: ` `,
          inline: true,
        },
        {
          name: 'Uptime',
          value: humanizeDuration(uptime, {
            round: true,
          }),
          inline: true,
        },
        {
          name: 'Process Uptime',
          value: humanizeDuration(process.uptime() * 1000, {
            round: true,
          }),

          inline: true,
        },
        {
          name: 'CPU Model',
          value: cpuModel.replace(/\(R\)/g, '®').replace(/\(TM\)/g, '™'),
          inline: true,
        },
        {
          name: 'CPU Usage',
          value: `${cpuUsage.toFixed(2)}%`,
          inline: true,
        },
        {
          name: 'Memory Usage',
          value: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB / ${(
            process.memoryUsage().heapTotal /
            1024 /
            1024
          ).toFixed(2)} MB`,
          inline: true,
        },
      ]);

    return interaction.reply({
      embeds: [embed],
    });
  }
}
