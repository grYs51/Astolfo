import {
  ChatInputCommandInteraction,
  CacheType,
  SlashCommandBuilder,
  PermissionFlagsBits,
  InteractionContextType,
} from 'discord.js';
import { BaseSlash } from '../../utils/structures/base-slash';
import client from '../../client/client';
import {
  disableFeature,
  enableFeature,
  isEnabled,
  SETTING_FLAGS,
  Settings,
  SETTINGS_LABELS,
  toggleArray,
} from '../../utils/handlers/settings-handler';
import { syncGuildLevelRoles } from '../../xp/level-roles';

export default class SettingsEvent extends BaseSlash {
  constructor() {
    super('settings', 'Update guild settings');
  }

  override createInteraction(client: client) {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .addStringOption((option) =>
        option
          .setName('flag')
          .setDescription('The category to update')
          .setRequired(true)
          .setChoices(
            ...toggleArray.map((toggle) => ({
              name: toggle.label,
              value: toggle.key,
            }))
          )
      )
      .addBooleanOption((option) =>
        option
          .setName('value')
          .setDescription('The value to set')
          .setRequired(true)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .setContexts(InteractionContextType.Guild);
  }

  async slash(client: client, interaction: ChatInputCommandInteraction<CacheType>) {
    const config = client.guildConfigs.get(interaction.guildId!);
    const settings = config?.toggles;

    if (settings === undefined || !config) {
      return interaction.reply({
        content: 'Settings not found!',
        ephemeral: true,
      });
    }

    const flag = interaction.options.get('flag')?.value as Settings;
    const value = interaction.options.get('value')?.value as boolean;

    const newSettings = value
      ? enableFeature(settings, SETTING_FLAGS[flag])
      : disableFeature(settings, SETTING_FLAGS[flag]);

    const dbConfig = await client.dataSource.guildConfigurations.update({
      where: {
        guild_id: interaction.guildId!,
      },
      data: {
        toggles: newSettings,
      },
    });
    client.guildConfigs.set(interaction.guildId!, dbConfig);
    // Opting in to level roles hands them out right away, like the settings page
    if (flag === 'LEVEL_ROLES' && value && !isEnabled(settings, SETTING_FLAGS.LEVEL_ROLES)) {
      void syncGuildLevelRoles(client, dbConfig.guild_id);
    }

    const content = toggleArray
      .map((toggle) => {
        const enabled = isEnabled(newSettings, SETTING_FLAGS[toggle.key]);
        return `${enabled ? '✅' : '❌'} ${SETTINGS_LABELS[toggle.key]}`;
      })
      .join('\n');

    return interaction.reply({
      content,
      ephemeral: true,
    });
  }
}
