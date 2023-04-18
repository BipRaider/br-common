import { NextFunction, Request, Response } from 'express';

declare global {
  namespace Express {
    interface JwtUser {
      id: string;
      email: string;
    }

    interface Request {
      user?: JwtUser;
    }
  }
}

import { JwtService } from '../helpers';

export const authHandler = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  const { authorization } = req.headers;
  const sessionJwt = req?.session?.jwt;

  let token: string = '';
  if (authorization && typeof authorization === 'string') token = authorization.split(' ')[1];
  if (sessionJwt && sessionJwt?.accessToken) token = sessionJwt.accessToken;

  if (token) {
    const JWT = new JwtService();
    const payload = await JWT.valid(token);
    if (typeof payload !== 'string' && payload) req.user = { id: payload.id, email: payload.email, ...payload };
  }

  next();
};
