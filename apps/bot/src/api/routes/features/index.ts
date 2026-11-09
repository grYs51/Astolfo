import { Router } from 'express';
import { isAuthenticated } from '../../utils/middleware/isAuthenticated';
import { isServerMember } from '../../utils/middleware/isServerMember';
import { isServerManager } from '../../utils/middleware/isServerManager';
import {
  getGuildSettings,
  getGuildSettingsHistory,
  getServerAccess,
  setGuildSettings,
} from './guild-settings';
import { getActiveServers } from './active-servers';
import { getPrivacy, setPrivacy } from './privacy';
import { trackPageView } from './track';
import {
  getVoiceStatsOverview,
  getVoiceStatsLeaderboard,
  getVoiceStatsChannels,
  getVoiceStatsUser,
  getVoiceStatsTimeline,
  getVoiceStatsHeatmap,
  getVoiceStatsUserHeatmap,
  getServerMessages,
  getServerPresence,
  getUserPresence,
  getServerGames,
  getUserGames,
  getActivityCalendar,
  getVoiceHabits,
  getStatsCard,
} from './voice-stats';

export default (router: Router) => {
  // Features
  router.get('/features/active-servers', isAuthenticated, getActiveServers);

  // The viewer's own privacy setting
  router.get('/features/me/privacy', isAuthenticated, getPrivacy);
  router.put('/features/me/privacy', isAuthenticated, setPrivacy);

  // Dashboard page views (route patterns) for the admin page
  router.post('/features/track', isAuthenticated, trackPageView);

  // Whether the viewer may open the settings page (any member may ask)
  router.get('/features/servers/:serverId/access', isAuthenticated, isServerMember, getServerAccess);

  // Server settings: members with Manage Server only
  router.get(
    '/features/servers/:serverId/settings',
    isAuthenticated,
    isServerMember,
    isServerManager,
    getGuildSettings,
  );
  router.put(
    '/features/servers/:serverId/settings',
    isAuthenticated,
    isServerMember,
    isServerManager,
    setGuildSettings,
  );
  router.get(
    '/features/servers/:serverId/settings/history',
    isAuthenticated,
    isServerMember,
    isServerManager,
    getGuildSettingsHistory,
  );

  // Voice Stats endpoints — all require real guild membership
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
    '/features/voice-stats/:serverId/users/:userId/stats.png',
    isAuthenticated,
    isServerMember,
    getStatsCard,
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
  router.get(
    '/features/voice-stats/:serverId/presence',
    isAuthenticated,
    isServerMember,
    getServerPresence,
  );
  router.get(
    '/features/voice-stats/:serverId/users/:userId/presence',
    isAuthenticated,
    isServerMember,
    getUserPresence,
  );
  router.get(
    '/features/voice-stats/:serverId/games',
    isAuthenticated,
    isServerMember,
    getServerGames,
  );
  router.get(
    '/features/voice-stats/:serverId/users/:userId/games',
    isAuthenticated,
    isServerMember,
    getUserGames,
  );
  router.get(
    '/features/voice-stats/:serverId/calendar',
    isAuthenticated,
    isServerMember,
    getActivityCalendar,
  );
  router.get(
    '/features/voice-stats/:serverId/users/:userId/calendar',
    isAuthenticated,
    isServerMember,
    getActivityCalendar,
  );
  router.get(
    '/features/voice-stats/:serverId/voice-habits',
    isAuthenticated,
    isServerMember,
    getVoiceHabits,
  );
};
