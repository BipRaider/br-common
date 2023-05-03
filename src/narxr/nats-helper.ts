import { Codec, StringCodec } from 'nats';
import { INatsHelpers } from './interface';

export class NatsHelpers implements INatsHelpers {
  public static uint8: Codec<string> = StringCodec();

  public static decode = <T>(
    /*** Getting data from Msg as the `Uint8Array` forma and decode it.*/
    code: Uint8Array,
  ): T => {
    const payload = NatsHelpers.uint8.decode(code);
    if (!NatsHelpers.isJsonString(payload)) {
      return payload as T;
    }

    return JSON.parse(payload);
  };

  public static encode = (
    /*** Getting data and encoding it into `Uint8Array` format.*/
    data: unknown,
  ): Uint8Array => {
    if (typeof data !== 'string') {
      const payload = JSON.stringify(data);
      return NatsHelpers.uint8.encode(payload);
    }
    return NatsHelpers.uint8.encode(data);
  };

  public static isJsonString = (str: string): boolean => {
    try {
      JSON.parse(str);
    } catch {
      return false;
    }
    return true;
  };
}
