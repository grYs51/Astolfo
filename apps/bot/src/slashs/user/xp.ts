import {
  CacheType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  InteractionContextType,
  SlashCommandBuilder,
} from 'discord.js';
import type { XpLevel } from '@nx-stolfo/api-interfaces';
import DiscordClient from '../../client/client';
import { InterActionUtils } from '../../utils/interaction-utils';
import { BaseSlash, SlashDeferTypes } from '../../utils/structures/base-slash';
import { totalXp } from '../../xp/grant';
import { currentRules, levelProgress } from '../../xp/rules';

const BAR = 12;
const n = (v: number) => v.toLocaleString('en-GB');

/** Level, a bar to the next one, the total and the last ledger rows */
export const xpEmbed = (
  name: string,
  level: XpLevel,
  recent: { amount: number; note: string; created_at: Date }[]
) => {
  const span = level.nextLevelXp - level.levelXp;
  const filled = span > 0 ? Math.round(((level.xp - level.levelXp) / span) * BAR) : 0;
  return new EmbedBuilder()
    .setTitle(`${name} · level ${level.level}`)
    .setDescription(
      [
        `${'▰'.repeat(filled)}${'▱'.repeat(BAR - filled)} ${n(level.xp - level.levelXp)} / ${n(span)} XP`,
        `**${n(level.xp)} XP** in total, ${n(level.nextLevelXp - level.xp)} to level ${level.level + 1}`,
        '',
        ...(recent.length
          ? recent.map((r) => `\`+${r.amount}\` ${r.note} · <t:${Math.floor(r.created_at.getTime() / 1000)}:R>`)
          : ['No XP yet: join a voice channel or say hi.']),
      ].join('\n')
    );
};

/** /xp [user] — level and recent XP on this server. Only you see the reply. */
export default class XpSlash extends BaseSlash {
  constructor() {
    super('xp', 'Level and XP on this server', SlashDeferTypes.HIDDEN);
  }

  override createInteraction() {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .addUserOption((option) => option.setName('user').setDescription('Someone else (optional)').setRequired(false))
      .setContexts(InteractionContextType.Guild);
  }

  async slash(client: DiscordClient, interaction: ChatInputCommandInteraction<CacheType>) {
    const guildId = interaction.guildId;
    if (!guildId) {
      await InterActionUtils.send(interaction, 'Use /xp in a server.', true);
      return;
    }
    const user = interaction.options.getUser('user') ?? interaction.user;
    if (user.bot) {
      await InterActionUtils.send(interaction, 'Bots don’t earn XP.', true);
      return;
    }
    const [total, recent] = await Promise.all([
      totalXp(client.dataSource, guildId, user.id),
      client.dataSource.xpEvents.findMany({
        where: { guild_id: guildId, member_id: user.id },
        orderBy: { created_at: 'desc' },
        take: 10,
        select: { amount: true, note: true, created_at: true },
      }),
    ]);
    await InterActionUtils.send(interaction, { embeds: [xpEmbed(user.displayName, levelProgress(total, currentRules()), recent)] }, true);
  }
}
