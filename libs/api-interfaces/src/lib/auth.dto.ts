/**
 * Wire type for GET /auth/status
 * (apps/bot/src/api/routes/discord/handlers/getStatus.ts): the Discord
 * profile saved in `user_session` at login, plus whether it is the bot owner.
 */
export interface AuthUser {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
  /** Logged-in user is `OWNER`: shows the admin page. The API checks it again. */
  isOwner: boolean;
}
