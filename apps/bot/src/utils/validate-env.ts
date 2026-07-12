const REQUIRED_ENV_VARS = [
  'DISCORD_BOT_TOKEN',
  'DISCORD_CLIENT_ID',
  'DISCORD_CLIENT_SECRET',
  'REDIRECT_URI',
  'COOKIE_SECRET',
  'OWNER',
  'DATABASE_URL',
] as const;

/**
 * Fails fast with one clear message instead of erroring at various depths
 * (passport strategy, session setup, prisma connect, …) later on.
 */
export function validateEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
}
