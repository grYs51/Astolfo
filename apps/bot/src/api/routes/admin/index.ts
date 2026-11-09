import { Router } from 'express';
import { isAuthenticated } from '../../utils/middleware/isAuthenticated';
import { isOwner } from '../../utils/middleware/isOwner';
import { getAdminHealth } from './getAdminHealth';
import { getAdminServers } from './getAdminServers';
import { getAdminUsage } from './getAdminUsage';
import { getAdminPeople } from './getAdminPeople';
import { getAdminWeb } from './getAdminWeb';

// Owner only: isOwner is the lock, the web guard only hides the page
export default (router: Router) => {
  router.get('/admin/health', isAuthenticated, isOwner, getAdminHealth);
  router.get('/admin/servers', isAuthenticated, isOwner, getAdminServers);
  router.get('/admin/usage', isAuthenticated, isOwner, getAdminUsage);
  router.get('/admin/people', isAuthenticated, isOwner, getAdminPeople);
  router.get('/admin/web', isAuthenticated, isOwner, getAdminWeb);
};
