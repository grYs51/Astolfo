import { RequestHandler, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { setTimeout as sleep } from 'node:timers/promises';
import {
  AdminBroadcast,
  AdminBroadcastQueued,
  AdminBroadcastResult,
  AdminClosedSessions,
  AdminGuildAction,
  AdminRecalculateQueued,
  AdminXpRules,
  AppNotice,
  XpRulesError,
} from '@nx-stolfo/api-interfaces';
import { Prisma } from '@prisma/client';
import { client } from '../../../client/instance';
import { Logger } from '../../../utils/logger';
import { postDigest } from '../../../utils/schedulers/digest.scheduler';
import { closeLeftVoiceSessions } from '../../../utils/handlers/vc';
import { setVc } from '../../../utils/functions/set-vc';
import { discordDirectory } from '../../utils/discord-directory';
import { currentRules, DEFAULT_RULES, parseXpRules, setRules } from '../../../xp/rules';
import { isXpBusy, recalculateXp } from '../../../xp/recalculate';

type Failure = { error: string };

const NOTICE_MAX = 300;
const BROADCAST_MAX = 1000;
const BROADCAST_PAUSE_MS = 500;

/**
 * A plain form POST from another subdomain (same site, so the lax cookie goes along) needs no preflight
 * and no body. A JSON body does need one, so refuse anything else.
 */
export const jsonOnly: RequestHandler = (req, res, next) => {
  if (req.is('application/json')) return next();
  res.status(415).send({ error: 'JSON only' });
};

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
    // A missed channel switch closed the old session: reopen it in the new channel, like ShardReady
    await setVc();
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
 * on agreed to posts), one at a time, never pinging anyone. Answers 202 at once and posts in the
 * background: the loop can outlast the proxy's timeout, and a "failed" retry would post everything twice.
 */
export const broadcast: RequestHandler<unknown, AdminBroadcastQueued | Failure, Partial<AdminBroadcast>> =
  asyncHandler(async (req, res) => {
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text || text.length > BROADCAST_MAX) {
      res.status(400).send({ error: `\`text\` must be 1 to ${BROADCAST_MAX} characters` });
      return;
    }
    const configs = await req.db.guildConfigurations.findMany({
      where: { digest_channel_id: { not: null } },
      select: { guild_id: true, digest_channel_id: true },
    });
    // Servers the bot has left keep their config; they aren't counted on the page either
    const channelIds = configs.filter((c) => client.guilds.cache.has(c.guild_id)).map((c) => c.digest_channel_id as string);
    Logger.info(`Admin action: broadcast to ${channelIds.length} servers ${JSON.stringify(text)}`);
    res.status(202).send({ queued: channelIds.length });

    sendBroadcast(text, channelIds)
      .then(({ posted, failed }) => Logger.info(`Broadcast done: posted ${posted}, failed ${failed}`))
      .catch((error) => Logger.error('Broadcast stopped', error));
  });

/** Posts `text` to each channel in turn with a pause between; a failed channel is logged and skipped */
export const sendBroadcast = async (text: string, channelIds: string[]): Promise<AdminBroadcastResult> => {
  let posted = 0;
  let failed = 0;
  for (const channelId of channelIds) {
    if (posted + failed > 0) await sleep(BROADCAST_PAUSE_MS);
    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel?.isSendable()) throw new Error('missing or not sendable');
      await channel.send({ content: text, allowedMentions: { parse: [] } });
      posted++;
    } catch (error) {
      failed++;
      Logger.warn(`Broadcast to channel ${channelId} failed`, error);
    }
  }
  return { posted, failed };
};

/** GET /admin/xp-rules: the rules in use, the defaults beside them, and when they were last saved */
export const getXpRules: RequestHandler<unknown, AdminXpRules> = asyncHandler(async (req, res) => {
  const row = await req.db.xpRules.findUnique({ where: { id: 1 } });
  res.send({ rules: currentRules(), defaults: DEFAULT_RULES, updatedAt: row?.updated_at ?? null });
});

/**
 * PUT /admin/xp-rules { rules }: a full rule set, or null for the defaults. Applies at once (one
 * process, so the in-memory set is all there is); new amounts only reach new XP until a recalculation.
 */
export const setXpRules: RequestHandler<unknown, AdminXpRules | XpRulesError, { rules?: unknown }> = asyncHandler(
  async (req, res) => {
    if (req.body?.rules === null) {
      Logger.info('Admin action: reset the XP rules to the defaults');
      await req.db.xpRules.deleteMany({ where: { id: 1 } });
      setRules(null);
      res.send({ rules: DEFAULT_RULES, defaults: DEFAULT_RULES, updatedAt: null });
      return;
    }
    const parsed = parseXpRules(req.body?.rules);
    if ('error' in parsed) {
      res.status(400).send(parsed);
      return;
    }
    Logger.info(`Admin action: set the XP rules to ${JSON.stringify(parsed.rules)}`);
    const json = parsed.rules as unknown as Prisma.InputJsonValue;
    const row = await req.db.xpRules.upsert({ where: { id: 1 }, create: { id: 1, rules: json }, update: { rules: json } });
    setRules(parsed.rules);
    res.send({ rules: parsed.rules, defaults: DEFAULT_RULES, updatedAt: row.updated_at });
  }
);

/**
 * POST /admin/actions/recalculate-xp { guildId }: rebuild the server's XP with the current rules, posting
 * nothing. Answers 202 at once and runs in the background, like the broadcast.
 */
export const recalculateXpNow: RequestHandler<unknown, AdminRecalculateQueued | Failure, Partial<AdminGuildAction>> =
  asyncHandler(async (req, res) => {
    const guildId = req.body?.guildId;
    if (typeof guildId !== 'string' || !guildId) {
      res.status(400).send({ error: '`guildId` must be a string' });
      return;
    }
    // The directory, not the gateway cache, so demo mode can recalculate its fixture servers
    if (!discordDirectory().guild(guildId)) {
      res.status(404).send({ error: 'The bot is not in that server' });
      return;
    }
    // A running sweep holds the guild too: both writing its ledger at once can deadlock
    if (isXpBusy(guildId)) {
      res.status(409).send({ error: 'That server’s XP is being recalculated or swept, try again in a minute' });
      return;
    }
    Logger.info(`Admin action: recalculate XP for guild ${guildId}`);
    // Takes the lock before its first await, so a second click after this answer gets the 409
    const run = recalculateXp(client, guildId);
    res.status(202).send({ queued: true });
    run
      .then(({ rows, xp, ms }) => Logger.info(`XP recalculated for guild ${guildId}: ${rows} rows, ${xp} XP in ${ms} ms`))
      .catch((error) => Logger.error(`XP recalculation failed for guild ${guildId}`, error));
  });
