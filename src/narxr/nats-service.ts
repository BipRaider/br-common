import {
  connect,
  ConnectionOptions,
  Msg,
  NatsConnection,
  PublishOptions,
  RequestOptions,
  Subscription,
  headers,
  MsgHdrs,
  SubscriptionOptions,
} from 'nats';

import { NatsHelpers } from './nats-helper';
import { HeadersFn, NatsResponse, SubjectOpt } from './types';

export class NatsService extends NatsHelpers {
  #nats: NatsConnection | undefined = undefined;
  public serverName: string = '';
  public subject: SubjectOpt[] = [];
  private opt: ConnectionOptions = {
    servers: ['http://localhost:4222', 'nats://localhost:4222', 'nats://nats:4222'],
  };
  /** All Subscriptions.*/
  public subscriptions: Map<string, Subscription | undefined> = new Map();

  constructor(opt?: ConnectionOptions) {
    super();
    this.opt = { ...this.opt, ...opt };
    this.connect();
  }

  private connect = async (): Promise<void> => {
    try {
      this.#nats = await connect(this.opt);

      if (this.opt.name) this.serverName = this.opt.name;
      console.log(`Connected to listener ${this.#nats.getServer()}`);
      await this.init();
    } catch {
      console.log(`Error connection to server sub: ${this.opt.servers}`);
    }
  };

  private init = async (): Promise<void> => {
    for await (const { subject, options, fn } of this.subject) {
      if (typeof subject === 'string') {
        const sub = this.sub({ subject, options });
        if (sub && fn) this.data(sub, fn);
      }
    }
    this.subject = [];
    console.log(`Init list subscribers.`);
  };

  /**
   * Get connection property the nats.
   */
  public get NC(): NatsConnection | undefined {
    return this.#nats;
  }

  /*** Add subscribers for listing and they params
   *```ts
   * const natsServer = new NatsService({servers: 'http://localhost:4222'})
   * natsServer.subs = {
        subject: 'api.v3.hello',
        options: { queue: 'listener' },
        fn:(data:SubscriptionData<string>): Promise<void> => {
          console.log(data.payload)
        })
      };
   *```
   */
  public set subs(subj: SubjectOpt | SubjectOpt[]) {
    if (Array.isArray(subj)) {
      for (const s of subj) {
        if (s.subject && typeof s.subject === 'string') {
          this.subject.push(s);
        }
      }
      return;
    }

    if (subj.subject && typeof subj.subject === 'string') {
      this.subject.push(subj);
    }
  }
  /*** Processing `data` from `natsServer.sub("some name") function`.
   *```ts
   * const natsServer = new NatsService({servers: 'http://localhost:4222'})
   * const sub: Subscription | null = natsServer.sub("some name")
   * natsServer.data(sub, (data:SubscriptionData<string>): Promise<void> => {
   *  console.log(data.payload)
   * })
   *```
   */
  public data = async (sub: Subscription, fn: Function): Promise<void> => {
    if (!sub) return;
    for await (const m of sub) {
      const payload = NatsService.decode(m.data);
      if (payload && fn) {
        fn({
          sub_catcher: sub.getSubject(),
          sub_sender: m.subject,
          payload,
          headers: m.headers,
          reply: m.reply,
          res: (data: unknown, opts: PublishOptions = {}): true | false | null => {
            try {
              const payload = NatsService.encode(data);
              return m.respond(payload, opts && opts);
            } catch {
              return null;
            }
          },
        });
      }
    }
  };

  /*** Subscribe to listen.
   **  For processing the data. Need to provided the data to function from NatsServer.data()
   *```ts
   * const natsServer = new NatsService({servers: 'http://localhost:4222'})
   * const sub: Subscription | null = natsServer.sub("some name")
   * natsServer.data(sub, (data:SubscriptionData<string>): Promise<void> => {
   *  console.log(data.payload)
   * })
   *```
   */
  public sub = ({ subject, options }: SubjectOpt): Subscription | null => {
    if (typeof subject !== 'string') return null;
    if (!this.#nats) return null;

    const sub = this.#nats.subscribe(subject, options || {});
    if (sub) this.subscriptions.set(subject, sub);

    return sub;
  };

  /*** Push data to network.
   * ```ts
   * const natsService = new NatsService({
        servers: 'http://localhost:4222',
        name: 'publish',
      });
   *
   * const fn = () => {
   *   natsService.pub('api.v3.hello', 'PONG 1', { reply: 'listener-v2' });
    }
    fn();
   * ```
   */
  public pub = async (
    /*** Who should listen into network. */
    subject: string,
    /*** The data for sent into network*/
    data: unknown,
    /*** The PublishOptions */
    options: PublishOptions = {},
  ): Promise<void> => {
    try {
      if (!this.#nats) throw new Error('Nats is not connect');

      const encodeData = NatsService.encode(data);
      this.#nats.publish(subject, encodeData, options);
      await this.#nats.flush();
    } catch {
      setTimeout(() => {
        this.pub(subject, data, options);
      }, 200);
    }
  };

  /*** Catch all subscribes into network with the same name.
   ** Answer send only one a subscriber from all subscribers!
   * ```ts
   * const natsService = new NatsService({
        servers: 'http://localhost:4222',
        name: 'publish',
      });
   *
   * const fn = () => {
   *   const data = await natsService.req(
            'api.v2.hello',
            {
              sender: 'V2',
              message: 'Hello listener V1',
              time: new Date().toUTCString(),
            },
            {
              reply: 'listener-v2',
              timeout: 3000,
              noMux: true,
              headers: natsService.headers(),
            },
          );
      return data
    }

    fn();
   * ```
   */
  public req = async <T>(
    /*** Who should listen into network. */
    subject: string,
    /*** The data for sent into network*/
    data: unknown,
    /*** The RequestOptions */
    options: RequestOptions = { noMux: true, timeout: 0 },
  ): Promise<T | null> => {
    if (typeof subject !== 'string') return null;

    return new Promise(async res => {
      try {
        if (!this.#nats) throw new Error('Nats is not connect');

        const encodeDat = NatsService.encode(data);
        const msg: Msg = await this.#nats.request(subject, encodeDat, options);
        const payload = NatsService.decode<T>(msg.data);
        await this.#nats.flush();
        res(payload);
      } catch {
        res(null);
      }
    });
  };

  /*** Catch Req and processes the data.
   ** Where the `subject` should be with the same name that in `Msg`
   ** Where the `reply` should be with the same data that in `Msg`
   * ```ts
   *const natsService = new NatsService({
        servers: 'http://localhost:4222',
        name: 'publish',
      });
   *
    natsService.res({
        subject: 'api.v1.hello',
        reply: 'listener-v1',
        options: { queue: 'publish' },
        fn: async (data: SubscriptionData<string>): Promise<void> => {
          data.res({
            sender: 'V2',
            message: 'My answer to you. [V1]',
            time: new Date().toUTCString(),
          });

          console.log(`Publish:`, data.payload);
        },
    });
   * ```
   */
  public res = async ({ fn, subject, reply, options }: NatsResponse): Promise<void> => {
    try {
      if (!this.#nats) throw new Error('Nats is not connect');

      const sub = this.#nats.subscribe(subject, options);
      if (sub) this.subscriptions.set(subject, sub);

      for await (const msg of sub) {
        if (!fn) return;
        if (subject !== msg.subject) return;
        if (reply !== msg.reply) return;

        const payload = NatsService.decode(msg.data);

        const res = (data: unknown = null, opts: PublishOptions = {}): true | false | null => {
          try {
            const payload = NatsService.encode(data);
            return msg.respond(payload, { reply, ...opts });
          } catch {
            return null;
          }
        };

        await fn({
          sub_catcher: sub.getSubject(),
          sub_sender: msg.subject,
          headers: msg.headers,
          reply: msg.reply,
          payload,
          res,
        });
      }
    } catch {
      setTimeout(() => {
        this.res({ fn, subject, reply, options });
      }, 200);
    }
  };
  /*** The function for add some params to the headers to
   * {@link PublishOptions},
   * {@link SubscriptionOptions},
   * {@link RequestOptions}
   *```ts
   * const natsServer = new NatsService({servers: 'http://localhost:4222'})
   * const headers: MsgHdrs = natsService.headers()
   *```
   */
  public headers: HeadersFn = (code?: number, description?: string): MsgHdrs => {
    const head = headers(code, description);
    head.append('serverName', this.serverName);
    return head;
  };
  /*** The function for add some params by using `Object` to the headers to
   * {@link PublishOptions},
   * {@link SubscriptionOptions},
   * {@link RequestOptions}
   *```ts
   * const natsServer = new NatsService({servers: 'http://localhost:4222'})
   * const headers: MsgHdrs = natsService.headerAddParams({name: "name",someCode: "As394dfhH"})
   *```
   */
  public headerAddParams = (params: Record<string, string>, code?: number, description?: string): MsgHdrs => {
    const head = this.headers(code, description);
    for (const key in params) {
      head.append(key, params[key]);
    }
    return head;
  };
}
