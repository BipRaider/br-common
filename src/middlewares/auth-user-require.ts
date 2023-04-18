import { NextFunction, Request, Response } from 'express';

import { ErrorEx } from '../helpers';

export const authUserRequire = (req: Request, _res: Response, next: NextFunction): void => {
  const user = req?.user;

  if (!user) throw new ErrorEx('Unauthorized', [], 401);

  next();
};
