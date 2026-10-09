import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { MemberPrivacy } from '@nx-stolfo/api-interfaces';
import { client } from '../../../../client/instance';

/** GET /features/me/privacy — the viewer's own privacy setting */
export const getPrivacy: RequestHandler<unknown, MemberPrivacy> = asyncHandler(
  async (req, res) => {
    const config = await req.db.userConfigs.findUnique({
      where: { user_id: req.user.id },
      select: { privacy_hidden: true },
    });
    res.send({ hidden: config?.privacy_hidden ?? false });
  }
);

/**
 * PUT /features/me/privacy { hidden } — hide the viewer from other members'
 * views (leaderboards, "hangs out with", in-voice list, profile page).
 */
export const setPrivacy: RequestHandler<unknown, MemberPrivacy | { error: string }, Partial<MemberPrivacy>> =
  asyncHandler(async (req, res) => {
    const { hidden } = req.body ?? {};
    if (typeof hidden !== 'boolean') {
      res.status(400).send({ error: '`hidden` must be a boolean' });
      return;
    }

    const config = await req.db.userConfigs.upsert({
      where: { user_id: req.user.id },
      create: { user_id: req.user.id, privacy_hidden: hidden },
      update: { privacy_hidden: hidden },
    });
    // Keep the bot's in-memory copy in sync
    client.userConfigs.set(config.user_id, config);

    res.send({ hidden: config.privacy_hidden });
  });
