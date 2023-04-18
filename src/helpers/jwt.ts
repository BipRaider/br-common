import { Request } from 'express';
import jwt from 'jsonwebtoken';

export interface JwtServiceOptions {
  /** salt to encoding */
  salt?: string;
  /** Options for access token */
  accessOpt?: jwt.SignOptions;
  /** Options for refresh token */
  refreshOpt?: jwt.SignOptions;
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly JWT_SALT: string;
      readonly JWT_ACCESS_EXP: string;
      readonly JWT_REFRESH_EXP: string;
    }
  }
}

export class JwtService {
  /*** Getting default salt from `process.env['JWT_SALT']`*/
  private salt: string = process.env['JWT_SALT'] || 'jwt';
  /*** Getting default `expiresIn` from `process.env['JWT_ACCESS_EXP']`*/
  private accessOpt: jwt.SignOptions = {
    algorithm: 'HS256',
    expiresIn: process.env['JWT_ACCESS_EXP'] || '1d',
  };
  /*** Getting default `expiresIn` from `process.env['JWT_REFRESH_EXP']`*/
  private refreshOpt: jwt.SignOptions = {
    algorithm: 'HS256',
    expiresIn: process.env['JWT_REFRESH_EXP'] || '7d',
  };
  #_access: string = '';
  #_refresh: string = '';

  constructor({ salt, accessOpt, refreshOpt }: JwtServiceOptions = {}) {
    if (salt) this.salt = salt;
    if (accessOpt) this.accessOpt = accessOpt;
    if (refreshOpt) this.refreshOpt = refreshOpt;
  }

  get access(): string {
    return this.#_access;
  }

  get refresh(): string {
    return this.#_refresh;
  }

  /*** To generate an `accessToken`.*/
  public accessToken = async (payload: Record<string, unknown>): Promise<string> => {
    const iat = Math.floor(Date.now() / 1000);
    const accessToken = jwt.sign({ ...payload, iat }, this.salt, this.accessOpt);
    this.#_access = accessToken;
    return accessToken;
  };

  /*** To generate a `refreshToken`.*/
  public refreshToken = async (payload: Record<string, unknown>): Promise<string> => {
    const iat = Math.floor(Date.now() / 1000);
    const refreshToken = jwt.sign({ ...payload, iat }, this.salt, this.refreshOpt);
    this.#_refresh = refreshToken;
    return refreshToken;
  };

  /*** Adding of the `refreshToken` and the `accessToken` that were created earlier to the session.*/
  public addToSession = (req: Request<unknown>): void => {
    req.session = {
      jwt: {
        refreshToken: this.#_refresh,
        accessToken: this.#_access,
      },
    };
  };

  /*** Validation of a `refreshToken` or an `accessToken`. */
  public valid = async (token: string): Promise<string | jwt.JwtPayload | null> => {
    return await new Promise((res): void => {
      jwt.verify(token, this.salt, (err, decoded): void => {
        if (decoded) res(decoded);
        if (err) res(null);
        else res(null);
      });
    });
  };
}
