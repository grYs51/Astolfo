import { Router } from 'express';
import { isAuthenticated } from '../../utils/middleware/isAuthenticated';
import { isOwner } from '../../utils/middleware/isOwner';
import { getAdminHealth } from './getAdminHealth';
import { getAdminServers } from './getAdminServers';
import { getAdminUsage } from './getAdminUsage';
import { getAdminPeople } from './getAdminPeople';
import { getAdminWeb } from './getAdminWeb';
import {
  broadcast,
  closeStuckSessions,
  getNotice,
  getXpRules,
  jsonOnly,
  leaveGuild,
  postDigestNow,
  recalculateXpNow,
  setNotice,
  setXpRules,
} from './actions';

// Owner only: isOwner is the lock, the web guard only hides the page
export default (router: Router) => {
  router.get('/admin/health', isAuthenticated, isOwner, getAdminHealth);
  router.get('/admin/servers', isAuthenticated, isOwner, getAdminServers);
  router.get('/admin/usage', isAuthenticated, isOwner, getAdminUsage);
  router.get('/admin/people', isAuthenticated, isOwner, getAdminPeople);
  router.get('/admin/web', isAuthenticated, isOwner, getAdminWeb);

  // Actions write, so POST/PUT: the session cookie is SameSite=lax, a cross-site page can trigger a GET
  router.use('/admin/actions', jsonOnly);
  router.post('/admin/actions/digest', isAuthenticated, isOwner, postDigestNow);
  router.post('/admin/actions/leave', isAuthenticated, isOwner, leaveGuild);
  router.post('/admin/actions/close-stuck-sessions', isAuthenticated, isOwner, closeStuckSessions);
  router.post('/admin/actions/broadcast', isAuthenticated, isOwner, broadcast);
  router.post('/admin/actions/recalculate-xp', isAuthenticated, isOwner, recalculateXpNow);
  router.put('/admin/notice', isAuthenticated, isOwner, setNotice);
  router.get('/admin/xp-rules', isAuthenticated, isOwner, getXpRules);
  router.put('/admin/xp-rules', isAuthenticated, isOwner, jsonOnly, setXpRules);

  // The only public route here: the notice banner shows on the login page too
  router.get('/notice', getNotice);
};
