import { Response } from 'express';

export type StatusCodes = 404 | 401 | 500 | 400 | 403;

export class ErrorEx extends Error {
  constructor(message: string, public payload: unknown = null, public statusCode: StatusCodes = 404) {
    super(message);

    if (statusCode) this.statusCode = statusCode;

    Object.setPrototypeOf(this, ErrorEx.prototype);
  }
  /** Serialize error method.*/
  public send = (res: Response): Response<any, Record<string, any>> => {
    return res.status(this.statusCode).send({
      error: { message: this.message, data: this.payload },
    });
  };
}
