import { LevelWithSilent } from 'pino';

declare global {
  namespace NodeJS {
    export interface ProcessEnv {
      LOG_LEVEL?: LevelWithSilent;
      MONGO_URI?: string;
      PORT?: string;
      RUNTIME_ENV?: 'local' | 'tst' | 'pro';
    }
  }
}
