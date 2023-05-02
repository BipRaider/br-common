import { Msg, PublishOptions, headers, SubscriptionOptions } from 'nats';

export interface SubscriptionData<T = unknown> extends Pick<Msg, 'headers' | 'reply'> {
  /** Who caught the message. */
  sub_catcher: string;
  /** Who sent the message. */
  sub_sender: string;
  /*** Return response. */
  res: (data: unknown, opts?: PublishOptions) => boolean | null;
  /*** The data which got the subscriber.*/
  payload: T;
}

export type HeadersFn = typeof headers;
export type NatsSubjectFn<T = any> = (
  subjData: SubscriptionData<T>,
) => SubscriptionData | Promise<SubscriptionData> | Promise<void>;
export type NatsResponseFn<T = any> = (subjData: SubscriptionData<T>) => Promise<void>;

export type SubjectOpt = {
  /*** Who should listen into network. */
  subject: string;
  options?: SubscriptionOptions;
  /*** The function works with data. {@link SubjectFn } */
  fn?: NatsSubjectFn;
};

export interface NatsResponse {
  /*** Who should listen into network.
   ** The name  should be the same `Res` and `Req`.*/
  subject: string;
  /*** The name to which the response should be returned. */
  reply: string;
  options?: SubscriptionOptions;
  /*** The function works with data. {@link NatsResponseFn } */
  fn?: NatsResponseFn;
}
