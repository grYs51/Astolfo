import { LevelWithSilent } from 'pino';

declare global {
  namespace NodeJS {
    export interface ProcessEnv {
      LOG_LEVEL?: LevelWithSilent;
      PORT?: string;
      RUNTIME_ENV?: 'local' | 'tst' | 'pro';
      DB_HOST?: string;
      DB_PORT?: number;
      DB_USER?: string;
      DB_PASS?: string;
      DB_NAME?: string;
      PUBLIC_KEY?: string;
      OWNER: string;
      SESSION_SECRET: string;
      DISCORD_CLIENT_ID: string;
      DISCORD_CLIENT_SECRET: string;
      DISCORD_REDIRECT_URl: string;
      BOT_TOKEN?: string;
    }
  }
}
