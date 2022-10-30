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
    }
  }
}
