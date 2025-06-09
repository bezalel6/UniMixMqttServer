export interface IMessagePublisher {
  publish(topic: string, payload: string | object): Promise<void>;
}

export interface MessageContext {
  originalTopic: string;
  messageId?: string;
  timestamp?: Date;
}

export class MessagePublisher implements IMessagePublisher {
  private static instance: MessagePublisher;
  private publisher: IMessagePublisher | null = null;

  private constructor() {}

  static getInstance(): MessagePublisher {
    if (!MessagePublisher.instance) {
      MessagePublisher.instance = new MessagePublisher();
    }
    return MessagePublisher.instance;
  }

  setPublisher(publisher: IMessagePublisher): void {
    this.publisher = publisher;
  }

  async publish(topic: string, payload: string | object): Promise<void> {
    if (!this.publisher) {
      throw new Error("Message publisher not initialized");
    }
    await this.publisher.publish(topic, payload);
  }

  isInitialized(): boolean {
    return this.publisher !== null;
  }
}
