import { MessageType, MessageTypeValue, UniMixMessage } from "./MessageTypes";
import {
  BaseMessageHandler,
  AudioStatusRequestHandler,
  AudioMixUpdateHandler,
} from "../handlers/MessageHandler";
import { MessageContext } from "./IMessagePublisher";
import { logger } from "../utils/logger";

export class MessageRouter {
  private handlers: Map<MessageTypeValue, BaseMessageHandler<any>>;

  constructor() {
    this.handlers = new Map();
    this.initializeHandlers();
  }

  private initializeHandlers(): void {
    // Initialize audio message handlers
    this.handlers.set(
      MessageType.AUDIO_STATUS_REQUEST,
      new AudioStatusRequestHandler()
    );
    this.handlers.set(
      MessageType.AUDIO_MIX_UPDATE,
      new AudioMixUpdateHandler()
    );
  }

  /**
   * Route a message to the appropriate handler
   */
  async routeMessage(messagePayload: string, topic: string): Promise<void> {
    try {
      // Parse the JSON message
      const message = JSON.parse(messagePayload);

      // Check if message has messageType
      if (!message.messageType) {
        logger.warn(`Message on topic ${topic} missing messageType field`);
        return;
      }

      // Get the appropriate handler
      const handler = this.handlers.get(message.messageType);
      if (!handler) {
        logger.warn(
          `No handler found for message type: ${message.messageType}`
        );
        return;
      }

      // Create transport-agnostic context
      const context: MessageContext = {
        originalTopic: topic,
        messageId:
          message.messageId ||
          `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
      };

      // Route to handler
      logger.debug(`Routing ${message.messageType} message to handler`);
      await handler.handle(message, context);
    } catch (error) {
      logger.error(`Error routing message on topic ${topic}:`, error);
    }
  }

  /**
   * Register a custom handler for a message type
   */
  registerHandler<T extends UniMixMessage>(
    messageType: MessageTypeValue,
    handler: BaseMessageHandler<T>
  ): void {
    logger.info(`Registering custom handler for message type: ${messageType}`);
    this.handlers.set(messageType, handler);
  }

  /**
   * Get all supported message types
   */
  getSupportedMessageTypes(): MessageTypeValue[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Check if a message type is supported
   */
  isMessageTypeSupported(messageType: MessageTypeValue): boolean {
    return this.handlers.has(messageType);
  }
}
