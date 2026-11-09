// DTOs live in the shared lib (also imported by the Express handlers);
// re-exported here so UI consumers keep importing from data-access
export type {
  AdminHealth,
  AdminServer,
  AdminServers,
  AdminCommandUsage,
  AdminRouteStats,
  AdminUsage,
  AdminPeople,
  AdminWeb,
  AdminClosedSessions,
  AdminBroadcastResult,
  AppNotice,
} from '@nx-stolfo/api-interfaces';
export * from './lib/admin.api';
