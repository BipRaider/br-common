import { Codec, MsgHdrs, NatsConnection, PublishOptions, RequestOptions, Subscription } from 'nats';
import { HeadersFn, NatsResponse, SubjectOpt } from './types';

export interface INatsService {
  serverName: string;
  subject: SubjectOpt[];

  /*** Writes to the console about `Error`. `Default: true` */
  isViewError: boolean;

  /**
   * Get connection property the nats.
   */
  get NC(): NatsConnection | undefined;
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
  set subs(subj: SubjectOpt | SubjectOpt[]);
  /*** Get subscription form queue. */
  getSub(subjName: string): Promise<Subscription | undefined>;
  /*** Delete subscription from queue. */
  delSub(subjName: string): Promise<boolean>;
  /*** Processing `data` from `natsServer.sub("some name") function`.
   *```ts
   * const natsServer = new NatsService({servers: 'http://localhost:4222'})
   * const sub: Subscription | null = natsServer.sub("some name")
   * natsServer.data(sub, (data:SubscriptionData<string>): Promise<void> => {
   *  console.log(data.payload)
   * })
   *```
   */
  data: (sub: Subscription, fn: Function) => Promise<void>;
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
  sub: ({ subject, options }: SubjectOpt) => Subscription | null;
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
  pub: (subject: string, data: unknown, options?: PublishOptions) => Promise<boolean>;
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
  req: <T>(subject: string, data: unknown, options?: RequestOptions) => Promise<T | null>;
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
  res: ({ fn, subject, reply, options }: NatsResponse) => Promise<void>;
  /*** The function for add some params to the headers to
   * {@link PublishOptions},
   * {@link SubscriptionOptions},
   * {@link RequestOptions}
   *```ts
   * const natsServer = new NatsService({servers: 'http://localhost:4222'})
   * const headers: MsgHdrs = natsService.headers()
   *```
   */
  headers: HeadersFn;
  /*** The function for add some params by using `Object` to the headers to
   * {@link PublishOptions},
   * {@link SubscriptionOptions},
   * {@link RequestOptions}
   *```ts
   * const natsServer = new NatsService({servers: 'http://localhost:4222'})
   * const headers: MsgHdrs = natsService.headerAddParams({name: "name",someCode: "As394dfhH"})
   *```
   */
  headerAddParams: (params: Record<string, string>, code?: number, description?: string) => MsgHdrs;
}

export abstract class INatsHelpers {
  /**Returns a {@link Codec} for encoding strings to a message payload and decoding message payloads into strings. */
  static uint8: Codec<string>;
  /*** `Decode` the data from `Msg`.
   *```ts
   * const natsServer = new NatsService({servers: 'http://localhost:4222'})
   * const encodeData: Uint8Array = natsServer.encode("some data")
   * const data: string = natsServer.decode(encodeDat)
   * console.log(data) // "some data"
   *```
   */
  static decode: <T>(code: Uint8Array) => T;
  /*** `Encode` data for `Msg`.
   * ```ts
   * const natsServer = new NatsService({servers: 'http://localhost:4222'})
   * const encodeData: Uint8Array = natsServer.encode("some data")
   * console.log(encodeData)
   * ```
   */
  static encode: (data: unknown) => Uint8Array;
  /*** Validate `string` on the JSON format. */
  static isJsonString: (str: string) => boolean;
}
