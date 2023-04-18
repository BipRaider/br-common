import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

export class PasswordService {
  /** default: `64` */
  public static length_crypt: number = 64;
  /** default: `8` */
  public static length_bytes: number = 8;

  /*** Password hashing with a random salt. */
  static async toHash(password: string): Promise<string> {
    const salt = randomBytes(PasswordService.length_bytes).toString('hex');
    const buf = (await scryptAsync(password, salt, PasswordService.length_crypt)) as Buffer;
    return `${buf.toString('hex')}.${salt}`;
  }
  /*** Compare password with existing password. */
  static async compare(storedPassword: string, suppliedPassword: string): Promise<boolean> {
    const [hashedPassword, salt] = storedPassword.split('.');
    const buf: Buffer = (await scryptAsync(suppliedPassword, salt, PasswordService.length_crypt)) as Buffer;
    return buf.toString('hex') === hashedPassword;
  }
}
