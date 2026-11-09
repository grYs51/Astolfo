import { RequestHandler, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { setTimeout as sleep } from 'node:timers/promises';
import {
  AdminBroadcast,
  AdminBroadcastResult,
  AdminClosedSessions,
  AdminGuildAction,
  AppNotice,
} from '@nx-stolfo/api-interfaces';
import { client } from '../../../client/instance';
import { Logger } from '../../../utils/logger';
import { postDigest } from '../../../utils/schedulers/digest.scheduler';
import { closeLeftVoiceSessions } from '../../../utils/handlers/vc';

type Failure = { error: string };

const NOTICE_MAX = 300;
const BROADCAST_MAX = 1000;
const BROADCAST_PAUSE_MS = 500;

/** The guild the bot is in, or a 400/404 already sent */
const guildFrom = (body: Partial<AdminGuildAction> | undefined, res: Response) => {
  const guildId = body?.guildId;
  if (typeof guildId !== 'string' || !guildId) {
    res.status(400).send({ error: '`guildId` must be a string' });
    return undefined;
  }
  const guild = client.guilds.cache.get(guildId);
  if (!guild) res.status(404).send({ error: 'The bot is not in that server' });
  return guild;
};

/** POST /admin/actions/digest { guildId }: post the latest digest now, without stamping digest_last_sent_at */
export const postDigestNow: RequestHandler<unknown, { posted: true } | Failure, Partial<AdminGuildAction>> =
  asyncHandler(async (req, res) => {
    const guild = guildFrom(req.body, res);
    if (!guild) return;
    Logger.info(`Admin action: post digest for guild ${guild.id}`);

    const config = await req.db.guildConfigurations.findUnique({ where: { guild_id: guild.id } });
    if (!config?.digest_channel_id) {
      res.status(409).send({ error: 'That server has no digest channel' });
      return;
    }
    const result = await postDigest(client, config);
    if (result === 'silent') {
      res.status(409).send({ error: 'Last week was silent, so there is nothing to post' });
      return;
    }
    if (result === 'unsendable') {
      res.status(409).send({ error: 'The digest channel is missing or the bot cannot post in it' });
      return;
    }
    res.send({ posted: true });
  });

/** POST /admin/actions/leave { guildId }: the GuildDelete handler closes its sessions and records the leave */
export const leaveGuild: RequestHandler<unknown, { left: true } | Failure, Partial<AdminGuildAction>> =
  asyncHandler(async (req, res) => {
    const guild = guildFrom(req.body, res);
    if (!guild) return;
    Logger.info(`Admin action: leave guild ${guild.id} (${guild.name})`);
    await guild.leave();
    res.send({ left: true });
  });

/** POST /admin/actions/close-stuck-sessions: the missed-leave cleanup ShardReady runs, on demand */
export const closeStuckSessions: RequestHandler<unknown, AdminClosedSessions> = asyncHandler(
  async (req, res) => {
    const closed = await closeLeftVoiceSessions(new Date());
    Logger.info(`Admin action: close stuck sessions, closed ${closed}`);
    res.send({ closed });
  }
);

/** GET /notice: public, so the login page can show it too */
export const getNotice: RequestHandler<unknown, AppNotice> = asyncHandler(async (req, res) => {
  const notice = await req.db.appNotice.findUnique({ where: { id: 1 } });
  res.send({ text: notice?.text ?? null });
});

/** PUT /admin/notice { text }: set the notice, or clear it with null or blank text */
export const setNotice: RequestHandler<unknown, AppNotice | Failure, Partial<AppNotice>> = asyncHandler(
  async (req, res) => {
    const raw = req.body?.text;
    if (raw !== null && typeof raw !== 'string') {
      res.status(400).send({ error: '`text` must be a string or null' });
      return;
    }
    const text = raw?.trim() || null;
    if (text && text.length > NOTICE_MAX) {
      res.status(400).send({ error: `The notice is at most ${NOTICE_MAX} characters` });
      return;
    }
    Logger.info(`Admin action: set notice to ${JSON.stringify(text)}`);

    if (text) {
      await req.db.appNotice.upsert({ where: { id: 1 }, create: { id: 1, text }, update: { text } });
    } else {
      await req.db.appNotice.deleteMany({ where: { id: 1 } });
    }
    res.send({ text });
  }
);

/**
 * POST /admin/actions/broadcast { text }: post to every digest channel (servers that turned the digest
 * on agreed to posts), one at a time, never pinging anyone.
 */
export const broadcast: RequestHandler<unknown, AdminBroadcastResult | Failure, Partial<AdminBroadcast>> =
  asyncHandler(async (req, res) => {
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text || text.length > BROADCAST_MAX) {
      res.status(400).send({ error: `\`text\` must be 1 to ${BROADCAST_MAX} characters` });
      return;
    }
    Logger.info(`Admin action: broadcast ${JSON.stringify(text)}`);

    const configs = await req.db.guildConfigurations.findMany({
      where: { digest_channel_id: { not: null } },
      select: { guild_id: true, digest_channel_id: true },
    });
    let posted = 0;
    let failed = 0;
    // Servers the bot has left keep their config; they aren't counted on the page either
    for (const config of configs.filter((c) => client.guilds.cache.has(c.guild_id))) {
      if (posted + failed > 0) await sleep(BROADCAST_PAUSE_MS);
      try {
        const channel = await client.channels.fetch(config.digest_channel_id as string);
        if (!channel?.isSendable()) throw new Error('missing or not sendable');
        await channel.send({ content: text, allowedMentions: { parse: [] } });
        posted++;
      } catch (error) {
        failed++;
        Logger.warn(`Broadcast to guild ${config.guild_id} failed`, error);
      }
    }
    res.send({ posted, failed });
  });
