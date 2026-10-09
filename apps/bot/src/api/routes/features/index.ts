import { Router } from 'express';
import { isAuthenticated } from '../../utils/middleware/isAuthenticated';
import { isServerMember } from '../../utils/middleware/isServerMember';
import { getActiveServers } from './active-servers';
import { getPrivacy, setPrivacy } from './privacy';
import {
  getVoiceStats,
  getVoiceStatsOverview,
  getVoiceStatsLeaderboard,
  getVoiceStatsChannels,
  getVoiceStatsUser,
  getVoiceStatsTimeline,
  getVoiceStatsHeatmap,
  getVoiceStatsUserHeatmap,
  getServerMessages,
} from './voice-stats';

export default (router: Router) => {
  // Features
  router.get('/features/active-servers', isAuthenticated, getActiveServers);

  // The viewer's own privacy setting
  router.get('/features/me/privacy', isAuthenticated, getPrivacy);
  router.put('/features/me/privacy', isAuthenticated, setPrivacy);

  // Voice Stats endpoints — all require real guild membership
  router.get(
    '/features/voice-stats/:serverId',
    isAuthenticated,
    isServerMember,
    getVoiceStats,
  );
  router.get(
    '/features/voice-stats/:serverId/overview',
    isAuthenticated,
    isServerMember,
    getVoiceStatsOverview,
  );
  router.get(
    '/features/voice-stats/:serverId/leaderboard',
    isAuthenticated,
    isServerMember,
    getVoiceStatsLeaderboard,
  );
  router.get(
    '/features/voice-stats/:serverId/channels',
    isAuthenticated,
    isServerMember,
    getVoiceStatsChannels,
  );
  router.get(
    '/features/voice-stats/:serverId/users/:userId',
    isAuthenticated,
    isServerMember,
    getVoiceStatsUser,
  );
  router.get(
    '/features/voice-stats/:serverId/users/:userId/heatmap',
    isAuthenticated,
    isServerMember,
    getVoiceStatsUserHeatmap,
  );
  router.get(
    '/features/voice-stats/:serverId/timeline',
    isAuthenticated,
    isServerMember,
    getVoiceStatsTimeline,
  );
  router.get(
    '/features/voice-stats/:serverId/heatmap',
    isAuthenticated,
    isServerMember,
    getVoiceStatsHeatmap,
  );
  router.get(
    '/features/voice-stats/:serverId/messages',
    isAuthenticated,
    isServerMember,
    getServerMessages,
  );
};
