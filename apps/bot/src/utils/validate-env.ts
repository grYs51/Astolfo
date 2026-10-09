const REQUIRED_ENV_VARS = [
  'DISCORD_BOT_TOKEN',
  'DISCORD_CLIENT_ID',
  'DISCORD_CLIENT_SECRET',
  'REDIRECT_URI',
  'CLIENT_URL', // login/logout redirect back to the dashboard
  'COOKIE_SECRET',
  'OWNER',
  'DATABASE_URL',
] as const;

// MOCK_DISCORD needs no Discord app or bot token
const REQUIRED_ENV_VARS_MOCK = ['CLIENT_URL', 'COOKIE_SECRET', 'DATABASE_URL'] as const;

/**
 * Fails fast with one clear message instead of erroring at various depths
 * (passport strategy, session setup, prisma connect, …) later on.
 */
export function validateEnv(): void {
  const mockRequested = process.env.MOCK_DISCORD === 'true';
  if (mockRequested && process.env.NODE_ENV === 'production') {
    // Mock mode signs anyone in as the fixture user — never in production
    throw new Error('MOCK_DISCORD=true is not allowed when NODE_ENV=production');
  }

  const required = mockRequested ? REQUIRED_ENV_VARS_MOCK : REQUIRED_ENV_VARS;
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
}
