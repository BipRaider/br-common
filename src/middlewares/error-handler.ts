import { NextFunction, Request, Response } from 'express';

import { ErrorEx } from '../helpers';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): Response<any, Record<string, any>> => {
  if (err instanceof ErrorEx) return err.send(res);
  return res.status(500).send({ message: 'Something went wrong', data: null });
};

export const errorMiddleware = (_req: Request, _res: Response, next: NextFunction): void => {
  const err: ErrorEx = new ErrorEx('Requested page not found.');
  next(err);
};
