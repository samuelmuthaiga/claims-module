declare module '@autochek-africa/pubsub' {
  interface PubSubConfig {
    projectId: string;
    topicName: string;
    subscriptionName: string;
  }

  interface PubSubMessage {
    data: Buffer;
    attributes: Record<string, string>;
    messageId: string;
    publishTime: string;
  }

  class PubSubClient {
    constructor(config: PubSubConfig);
    publish(topic: string, data: any, attributes?: Record<string, string>): Promise<string>;
    subscribe(subscription: string, handler: (message: PubSubMessage) => Promise<void>): void;
  }

  export { PubSubClient, PubSubConfig, PubSubMessage };
}
