// MessageBus - Transport-agnostic messaging system
// Provides unified interface for both MQTT and Serial transports

import {
  ITransport,
  MessageHandler,
  TransportType,
  TransportStatus,
} from "./ITransport";
import { MqttTransport } from "./MqttTransport";
import { logger } from "../utils/logger";

export interface MessageBusConfig {
  name?: string;
  primaryTransport?: TransportType;
  fallbackEnabled?: boolean;
}

export interface MessageBusStatus {
  name: string;
  activeTransports: TransportStatus[];
  primaryTransport?: TransportType;
  totalMessagesSent: number;
  totalMessagesReceived: number;
  lastActivity?: Date;
}

export class MessageBus {
  private transports: Map<string, ITransport> = new Map();
  private messageHandlers: Set<MessageHandler> = new Set();
  private config: MessageBusConfig;
  private primaryTransportName?: string;
  private messagesSent: number = 0;
  private messagesReceived: number = 0;
  private lastActivity?: Date;

  constructor(config: MessageBusConfig = {}) {
    this.config = {
      name: "UniMixMessageBus",
      fallbackEnabled: true,
      ...config,
    };
  }

  /**
   * Add a transport to the message bus
   */
  addTransport(name: string, transport: ITransport): void {
    // Register message handler to forward messages from transport to bus handlers
    transport.onMessage((topic: string, payload: string) => {
      this.handleIncomingMessage(topic, payload);
    });

    this.transports.set(name, transport);

    // Set as primary if none is set or if configured
    if (
      !this.primaryTransportName ||
      (transport instanceof MqttTransport &&
        this.config.primaryTransport === "mqtt")
    ) {
      this.primaryTransportName = name;
    }

    logger.info(`[MessageBus] Transport added: ${name}`);
  }

  /**
   * Remove a transport from the message bus
   */
  async removeTransport(name: string): Promise<void> {
    const transport = this.transports.get(name);
    if (transport) {
      if (transport.isConnected()) {
        await transport.disconnect();
      }
      this.transports.delete(name);

      // Update primary if removed
      if (this.primaryTransportName === name) {
        this.primaryTransportName = this.transports.keys().next().value;
      }

      logger.info(`[MessageBus] Transport removed: ${name}`);
    }
  }

  /**
   * Set the active transport by name
   */
  setTransport(name: string): void {
    if (this.transports.has(name)) {
      this.primaryTransportName = name;
      logger.info(`[MessageBus] Primary transport set to: ${name}`);
    } else {
      throw new Error(`Transport '${name}' not found`);
    }
  }

  /**
   * Publish a message to a topic (transport-agnostic)
   */
  async publish(topic: string, payload: string | object): Promise<void> {
    const connectedTransports = this.getConnectedTransports();

    if (connectedTransports.length === 0) {
      throw new Error("No connected transports available");
    }

    let primaryTransport: ITransport | undefined;

    // Try primary transport first
    if (this.primaryTransportName) {
      primaryTransport = this.transports.get(this.primaryTransportName);
      if (primaryTransport?.isConnected()) {
        try {
          await primaryTransport.publish(topic, payload);
          this.messagesSent++;
          this.lastActivity = new Date();
          logger.debug(
            `[MessageBus] Published via primary transport: ${this.primaryTransportName}`
          );
          return;
        } catch (error) {
          logger.warn(`[MessageBus] Primary transport publish failed:`, error);
        }
      }
    }

    // Fallback to any connected transport
    if (this.config.fallbackEnabled) {
      for (const transport of connectedTransports) {
        if (transport !== primaryTransport) {
          try {
            await transport.publish(topic, payload);
            this.messagesSent++;
            this.lastActivity = new Date();
            logger.debug(`[MessageBus] Published via fallback transport`);
            return;
          } catch (error) {
            logger.warn(
              `[MessageBus] Fallback transport publish failed:`,
              error
            );
          }
        }
      }
    }

    throw new Error("Failed to publish message via any transport");
  }

  /**
   * Subscribe to topics on all transports
   */
  async subscribe(topic: string | string[]): Promise<void> {
    const connectedTransports = this.getConnectedTransports();

    if (connectedTransports.length === 0) {
      logger.warn("[MessageBus] No connected transports for subscription");
      return;
    }

    const promises: Promise<void>[] = [];

    for (const transport of connectedTransports) {
      promises.push(
        transport.subscribe(topic).catch((error) => {
          logger.error(`[MessageBus] Subscription failed on transport:`, error);
        })
      );
    }

    await Promise.allSettled(promises);
    logger.info(
      `[MessageBus] Subscribed to topics on ${connectedTransports.length} transports`
    );
  }

  /**
   * Check if any transport is connected
   */
  isConnected(): boolean {
    return this.getConnectedTransports().length > 0;
  }

  /**
   * Register a message handler
   */
  registerHandler(handler: MessageHandler): void {
    this.messageHandlers.add(handler);
    logger.debug(`[MessageBus] Message handler registered`);
  }

  /**
   * Remove a message handler
   */
  removeHandler(handler: MessageHandler): void {
    this.messageHandlers.delete(handler);
    logger.debug(`[MessageBus] Message handler removed`);
  }

  /**
   * Connect all transports
   */
  async connectAll(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const [name, transport] of this.transports) {
      if (!transport.isConnected()) {
        promises.push(
          transport.connect().catch((error) => {
            logger.error(
              `[MessageBus] Failed to connect transport ${name}:`,
              error
            );
          })
        );
      }
    }

    await Promise.allSettled(promises);
    logger.info(
      `[MessageBus] Connected ${
        this.getConnectedTransports().length
      } transports`
    );
  }

  /**
   * Disconnect all transports
   */
  async disconnectAll(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const [name, transport] of this.transports) {
      if (transport.isConnected()) {
        promises.push(
          transport.disconnect().catch((error) => {
            logger.error(
              `[MessageBus] Failed to disconnect transport ${name}:`,
              error
            );
          })
        );
      }
    }

    await Promise.allSettled(promises);
    logger.info(`[MessageBus] Disconnected all transports`);
  }

  /**
   * Get status of the message bus
   */
  getStatus(): MessageBusStatus {
    return {
      name: this.config.name!,
      activeTransports: Array.from(this.transports.values()).map((t) =>
        "getStatus" in t
          ? (t as any).getStatus()
          : {
              name: "unknown",
              type: "mqtt" as TransportType,
              isConnected: t.isConnected(),
              config: { name: "unknown" },
            }
      ),
      primaryTransport: this.config.primaryTransport,
      totalMessagesSent: this.messagesSent,
      totalMessagesReceived: this.messagesReceived,
      lastActivity: this.lastActivity,
    };
  }

  /**
   * Get a specific transport by name
   */
  getTransport(name: string): ITransport | undefined {
    return this.transports.get(name);
  }

  /**
   * Get all transport names
   */
  getTransportNames(): string[] {
    return Array.from(this.transports.keys());
  }

  private getConnectedTransports(): ITransport[] {
    return Array.from(this.transports.values()).filter((t) => t.isConnected());
  }

  private handleIncomingMessage(topic: string, payload: string): void {
    try {
      this.messagesReceived++;
      this.lastActivity = new Date();

      // Forward to all registered handlers
      this.messageHandlers.forEach((handler) => {
        try {
          handler(topic, payload);
        } catch (error) {
          logger.error(`[MessageBus] Error in message handler:`, error);
        }
      });

      logger.debug(`[MessageBus] Forwarded message from topic: ${topic}`);
    } catch (error) {
      logger.error(`[MessageBus] Error handling incoming message:`, error);
    }
  }
}
