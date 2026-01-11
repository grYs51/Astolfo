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
} from './voice-stats';

export default (router: Router) => {
  router.use('/features', router);

  // Features
  router.get('/active-servers', isAuthenticated, getActiveServers);

  // Voice Stats endpoints
  router.get('/voice-stats/:serverId', isAuthenticated, getVoiceStats);
  router.get('/voice-stats/:serverId/overview', isAuthenticated, getVoiceStatsOverview);
  router.get('/voice-stats/:serverId/leaderboard', isAuthenticated, getVoiceStatsLeaderboard);
  router.get('/voice-stats/:serverId/channels', isAuthenticated, getVoiceStatsChannels);
  router.get('/voice-stats/:serverId/users/:userId', isAuthenticated, getVoiceStatsUser);
  router.get('/voice-stats/:serverId/timeline', isAuthenticated, getVoiceStatsTimeline);
  router.get('/voice-stats/:serverId/heatmap', isAuthenticated, getVoiceStatsHeatmap);
};

