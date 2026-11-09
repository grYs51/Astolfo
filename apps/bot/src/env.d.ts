// validateEnv() refuses to start without these (in mock mode too)
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      CLIENT_URL: string;
      COOKIE_SECRET: string;
      DATABASE_URL: string;
    }
  }
}

export {};
