import { Router } from 'express';
import { isAuthenticated } from '../../utils.ts/middleware/isAuthenticated';
import { getActiveServers } from './active-servers';
import {
  getVoiceStats,
  getVoiceStatsOverview,
  getVoiceStatsLeaderboard,
  getVoiceStatsChannels,
  getVoiceStatsUser,
  getVoiceStatsTimeline,
  getVoiceStatsHeatmap,
  getVoiceStatsUserHeatmap,
} from './voice-stats';

export default (router: Router) => {
  // Features
  router.get('/features/active-servers', isAuthenticated, getActiveServers);

  // Voice Stats endpoints
  router.get('/features/voice-stats/:serverId', isAuthenticated, getVoiceStats);
  router.get(
    '/features/voice-stats/:serverId/overview',
    isAuthenticated,
    getVoiceStatsOverview,
  );
  router.get(
    '/features/voice-stats/:serverId/leaderboard',
    isAuthenticated,
    getVoiceStatsLeaderboard,
  );
  router.get(
    '/features/voice-stats/:serverId/channels',
    isAuthenticated,
    getVoiceStatsChannels,
  );
  router.get(
    '/features/voice-stats/:serverId/users/:userId',
    isAuthenticated,
    getVoiceStatsUser,
  );
  router.get(
    '/features/voice-stats/:serverId/users/:userId/heatmap',
    isAuthenticated,
    getVoiceStatsUserHeatmap,
  );
  router.get(
    '/features/voice-stats/:serverId/timeline',
    isAuthenticated,
    getVoiceStatsTimeline,
  );
  router.get(
    '/features/voice-stats/:serverId/heatmap',
    isAuthenticated,
    getVoiceStatsHeatmap,
  );
};

