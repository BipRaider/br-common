import cookieSession from 'cookie-session';

declare global {
  namespace Express {
    interface Session extends CookieSessionInterfaces.CookieSessionObject {
      jwt: {
        accessToken?: string;
        refreshToken?: string;
      };
    }

    interface Request {
      session: Session | null;
      sessionOptions: CookieSessionInterfaces.CookieSessionOptions;
    }
  }

  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
    }
  }
}

export type SessionHandler = ReturnType<typeof cookieSession>;

export const sessionHandler = (opts?: CookieSessionInterfaces.CookieSessionOptions): SessionHandler => {
  const optsDefault: CookieSessionInterfaces.CookieSessionOptions = {
    name: 'session',
    keys: ['secretKeys'],
    signed: false,
    secure: process.env.NODE_ENV !== 'test', //if https request
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  };

  return cookieSession({ ...optsDefault, ...opts });
};
