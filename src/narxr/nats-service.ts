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
  NatsError,
} from 'nats';

import { NatsHelpers } from './nats-helper';
import { HeadersFn, NatsResponse, SubjectOpt } from './types';
import { INatsService } from './interface';

export class NatsService implements INatsService {
  #nats: NatsConnection | undefined = undefined;
  /** All Subscriptions.*/
  #subscriptions: Map<string, Subscription | undefined> = new Map();

  private opt: ConnectionOptions = {
    servers: ['http://localhost:4222', 'nats://localhost:4222', 'nats://nats:4222'],
    maxReconnectAttempts: -1,
    waitOnFirstConnect: true,
  };

  public serverName: string = '';
  public subject: SubjectOpt[] = [];
  public isViewError: boolean = true;

  constructor(opt?: ConnectionOptions) {
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
      console.error(`Error connection to server sub: ${this.opt.servers}`);
    }
  };

  private init = async (): Promise<void> => {
    if (!this.#nats) return;
    if (this.subject.length === 0) return;
    for await (const { subject, options, fn } of this.subject) {
      if (typeof subject === 'string') {
        console.log(`Listen: ${subject}`);
        const sub = this.sub({ subject, options });
        if (sub && fn) this.data(sub, fn);
      }
    }
    this.subject = [];
  };

  private errorHandler = (err: unknown, subject: string, view: boolean = true): void => {
    if (view && this.isViewError) {
      if (err instanceof NatsError) console.error(`[${subject}] Nats is ${err.message.toLowerCase()}`);
      else if (err instanceof Error) console.error(err.message);
    }
  };

  public get NC(): NatsConnection | undefined {
    return this.#nats;
  }

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

  public async getSub(subjName: string): Promise<Subscription | undefined> {
    let subj = this.#subscriptions.get(subjName);

    if (!subj) {
      await this.init();
      subj = this.#subscriptions.get(subjName);
    }

    return subj;
  }

  public async delSub(subjName: string): Promise<boolean> {
    let subj: Subscription | undefined = this.#subscriptions.get(subjName);
    let subjClose = false;
    if (subj) {
      await subj.drain();
      subjClose = subj.isClosed();
    }
    this.#subscriptions.delete(subjName);

    return subjClose as boolean;
  }

  public data = async (sub: Subscription, fn: Function): Promise<void> => {
    if (!sub) return;
    for await (const m of sub) {
      const payload = NatsHelpers.decode(m.data);
      if (payload && fn) {
        fn({
          sub_catcher: sub.getSubject(),
          sub_sender: m.subject,
          payload,
          headers: m.headers,
          reply: m.reply,
          res: (data: unknown, opts: PublishOptions = {}): boolean | null => {
            try {
              const payload = NatsHelpers.encode(data);
              return m.respond(payload, opts && opts);
            } catch (e) {
              this.errorHandler(e, m.subject);
              return null;
            }
          },
        });
      }
    }
  };

  public sub = ({ subject, options }: SubjectOpt): Subscription | null => {
    if (typeof subject !== 'string') return null;
    if (!this.#nats) return null;

    const sub = this.#nats.subscribe(subject, options || {});
    if (sub) this.#subscriptions.set(subject, sub);

    return sub;
  };

  public pub = async (
    /*** Who should listen into network. */
    subject: string,
    /*** The data for sent into network*/
    data: unknown,
    /*** The PublishOptions */
    options: PublishOptions = {},
  ): Promise<boolean> => {
    try {
      if (!this.#nats) throw new Error('Nats is not connect');

      await this.#nats.flush();
      const encodeData = NatsHelpers.encode(data);
      this.#nats.publish(subject, encodeData, options);
      return true;
    } catch (e) {
      this.errorHandler(e, subject);
      return false;
    }
  };

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
        await this.#nats.flush();
        const encodeDat = NatsHelpers.encode(data);
        const msg: Msg = await this.#nats.request(subject, encodeDat, options);
        const payload = NatsHelpers.decode<T>(msg.data);
        res(payload);
      } catch (e) {
        this.errorHandler(e, subject);

        res(null);
      }
    });
  };

  public res = async ({ fn, subject, reply, options }: NatsResponse): Promise<void> => {
    try {
      let sub = this.sub({ subject, options });
      if (sub) this.#subscriptions.set(subject, sub);
      if (!sub) {
        this.subs = { subject, options, fn };
        throw new Error('Subscription not found.');
      }

      for await (const msg of sub) {
        if (!fn) return;
        if (subject !== msg.subject) return;
        if (reply !== msg.reply) return;

        const payload = NatsHelpers.decode(msg.data);

        const res = (data: unknown = null, opts: PublishOptions = {}): boolean | null => {
          try {
            const payload = NatsHelpers.encode(data);
            return msg.respond(payload, { reply, ...opts });
          } catch (e) {
            this.errorHandler(e, subject);
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
    } catch (e) {
      this.errorHandler(e, subject);
    }
  };

  public headers: HeadersFn = (code?: number, description?: string): MsgHdrs => {
    const head = headers(code, description);
    head.append('serverName', this.serverName);
    return head;
  };

  public headerAddParams = (params: Record<string, string>, code?: number, description?: string): MsgHdrs => {
    const head = this.headers(code, description);
    for (const key in params) {
      head.append(key, params[key]);
    }
    return head;
  };
}
