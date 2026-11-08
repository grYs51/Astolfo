/**
 * Wire type for GET /auth/status
 * (apps/bot/src/api/routes/discord/handlers/getStatus.ts): the Discord
 * profile saved in `user_session` at login.
 */
export interface AuthUser {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
}
