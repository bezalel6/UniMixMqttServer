// Serial Transport implementing ITransport interface
// Parses incoming messages in format "topic:payload\n" and formats outgoing the same way

import {
  ITransport,
  MessageHandler,
  SerialTransportConfig,
  TransportStatus,
} from "./ITransport";
import { logger } from "../utils/logger";
import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";

export class SerialTransport implements ITransport {
  private serialPort: SerialPort | null = null;
  private parser: ReadlineParser | null = null;
  private config: SerialTransportConfig;
  private messageHandlers: Set<MessageHandler> = new Set();
  private lastActivity?: Date;
  private isConnectedState: boolean = false;
  private subscribedTopics: Set<string> = new Set();

  constructor(config: SerialTransportConfig) {
    this.config = {
      baudRate: 9600,
      dataBits: 8,
      stopBits: 1,
      parity: "none",
      ...config,
    };
  }

  async publish(topic: string, payload: string | object): Promise<void> {
    if (!this.isConnected()) {
      throw new Error("Serial transport is not connected");
    }

    const payloadString =
      typeof payload === "string" ? payload : JSON.stringify(payload);
    const message = `${topic}:${payloadString}\n`;

    return new Promise((resolve, reject) => {
      this.serialPort!.write(message, (error: Error | null | undefined) => {
        if (error) {
          logger.error(`[Serial Transport] Failed to write message:`, error);
          reject(error);
        } else {
          this.lastActivity = new Date();
          logger.debug(`[Serial Transport] Published to topic: ${topic}`);
          resolve();
        }
      });
    });
  }

  async subscribe(topic: string | string[]): Promise<void> {
    // For serial transport, subscription is conceptual since we receive all messages
    // We track subscribed topics for filtering if needed
    const topics = Array.isArray(topic) ? topic : [topic];

    topics.forEach((t) => {
      this.subscribedTopics.add(t);
      logger.info(`[Serial Transport] Subscribed to: ${t}`);
    });
  }

  isConnected(): boolean {
    return this.isConnectedState && this.serialPort?.isOpen === true;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.serialPort = new SerialPort({
          path: this.config.port,
          baudRate: this.config.baudRate!,
          dataBits: this.config.dataBits! as 5 | 6 | 7 | 8,
          stopBits: this.config.stopBits! as 1 | 1.5 | 2,
          parity: this.config.parity!,
        });

        this.parser = this.serialPort.pipe(
          new ReadlineParser({ delimiter: "\n" })
        );

        this.serialPort.on("open", () => {
          this.isConnectedState = true;
          this.lastActivity = new Date();

          // Disable DTR and RTS signals
          this.serialPort!.set({ dtr: false, rts: false }, (error) => {
            if (error) {
              logger.warn(
                `[Serial Transport] Failed to set DTR/RTS signals:`,
                error
              );
            } else {
              logger.debug(`[Serial Transport] DTR and RTS signals disabled`);
            }
          });

          logger.info(
            `[Serial Transport] Connected to port: ${this.config.port}`
          );
          resolve();
        });

        this.serialPort.on("error", (error: Error) => {
          this.isConnectedState = false;
          logger.error(`[Serial Transport] Serial port error:`, error);
          reject(error);
        });

        this.serialPort.on("close", () => {
          this.isConnectedState = false;
          logger.info(`[Serial Transport] Serial port closed`);
        });

        // Set up message parsing
        this.parser!.on("data", (data: string) => {
          this.handleIncomingMessage(data.trim());
        });
      } catch (error) {
        logger.error(`[Serial Transport] Failed to connect:`, error);
        reject(error);
      }
    });
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.serialPort && this.serialPort.isOpen) {
        this.serialPort.close((error) => {
          if (error) {
            logger.error(
              `[Serial Transport] Error closing serial port:`,
              error
            );
          } else {
            logger.info(`[Serial Transport] Disconnected from port`);
          }
          this.isConnectedState = false;
          resolve();
        });
      } else {
        this.isConnectedState = false;
        resolve();
      }
    });
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandlers.add(handler);
    logger.debug(`[Serial Transport] Message handler registered`);
  }

  removeMessageHandler(handler: MessageHandler): void {
    this.messageHandlers.delete(handler);
    logger.debug(`[Serial Transport] Message handler removed`);
  }

  getStatus(): TransportStatus {
    return {
      name: this.config.name,
      type: "serial",
      isConnected: this.isConnected(),
      lastActivity: this.lastActivity,
      config: this.config,
    };
  }

  private handleIncomingMessage(data: string): void {
    try {
      // Parse format: "topic:payload"
      const colonIndex = data.indexOf(":");
      if (colonIndex === -1) {
        logger.warn(
          `[Serial Transport] Invalid message format (no colon): ${data}`
        );
        return;
      }

      const topic = data.substring(0, colonIndex);
      const payload = data.substring(colonIndex + 1);

      this.lastActivity = new Date();

      // Check if we're subscribed to this topic (wildcard support could be added here)
      const isSubscribed =
        this.subscribedTopics.size === 0 ||
        this.subscribedTopics.has(topic) ||
        this.isTopicMatched(topic);

      if (isSubscribed) {
        // Forward to all registered handlers
        this.messageHandlers.forEach((handler) => {
          try {
            handler(topic, payload);
          } catch (error) {
            logger.error(`[Serial Transport] Error in message handler:`, error);
          }
        });
      }
    } catch (error) {
      logger.error(`[Serial Transport] Error parsing incoming message:`, error);
    }
  }

  private isTopicMatched(incomingTopic: string): boolean {
    // Simple wildcard matching for subscribed topics
    for (const subscribedTopic of this.subscribedTopics) {
      if (subscribedTopic.includes("+")) {
        // Convert MQTT-style wildcards to regex
        const pattern = subscribedTopic
          .replace(/\+/g, "[^/]+")
          .replace(/#/g, ".*");
        const regex = new RegExp(`^${pattern}$`);
        if (regex.test(incomingTopic)) {
          return true;
        }
      } else if (subscribedTopic === incomingTopic) {
        return true;
      }
    }
    return false;
  }

  // Additional Serial-specific methods
  getSerialPort(): SerialPort | null {
    return this.serialPort;
  }

  getSubscribedTopics(): Set<string> {
    return new Set(this.subscribedTopics);
  }
}
