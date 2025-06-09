// MQTT Transport wrapper implementing ITransport interface
// Provides transport-agnostic access to MQTT functionality

import {
  ITransport,
  MessageHandler,
  MqttTransportConfig,
  TransportStatus,
} from "./ITransport";
import { MqttClient } from "../mqtt/MqttClient";
import { logger } from "../utils/logger";

export class MqttTransport implements ITransport {
  private mqttClient: MqttClient;
  private config: MqttTransportConfig;
  private messageHandlers: Set<MessageHandler> = new Set();
  private lastActivity?: Date;

  constructor(config: MqttTransportConfig) {
    this.config = config;
    this.mqttClient = new MqttClient({
      brokerUrl: config.brokerUrl,
      clientId: config.clientId,
      username: config.username,
      password: config.password,
      keepalive: config.keepalive,
      reconnectPeriod: config.reconnectPeriod,
    });

    // Set up message forwarding from MQTT client to registered handlers
    this.mqttClient.onMessage((topic: string, payload: Buffer) => {
      const payloadString = payload.toString();
      this.lastActivity = new Date();

      // Forward to all registered handlers
      this.messageHandlers.forEach((handler) => {
        try {
          handler(topic, payloadString);
        } catch (error) {
          logger.error(`Error in MQTT message handler:`, error);
        }
      });
    });
  }

  async publish(topic: string, payload: string | object): Promise<void> {
    const payloadString =
      typeof payload === "string" ? payload : JSON.stringify(payload);
    await this.mqttClient.publish(topic, payloadString);
    this.lastActivity = new Date();
    logger.debug(`[MQTT Transport] Published to topic: ${topic}`);
  }

  async subscribe(topic: string | string[]): Promise<void> {
    await this.mqttClient.subscribe(topic);
    this.lastActivity = new Date();
    logger.info(
      `[MQTT Transport] Subscribed to: ${
        Array.isArray(topic) ? topic.join(", ") : topic
      }`
    );
  }

  isConnected(): boolean {
    return this.mqttClient.isConnected();
  }

  async connect(): Promise<void> {
    await this.mqttClient.connect();
    this.lastActivity = new Date();
    logger.info(
      `[MQTT Transport] Connected to broker: ${this.config.brokerUrl}`
    );
  }

  async disconnect(): Promise<void> {
    await this.mqttClient.disconnect();
    logger.info(`[MQTT Transport] Disconnected from broker`);
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandlers.add(handler);
    logger.debug(`[MQTT Transport] Message handler registered`);
  }

  removeMessageHandler(handler: MessageHandler): void {
    this.messageHandlers.delete(handler);
    logger.debug(`[MQTT Transport] Message handler removed`);
  }

  getStatus(): TransportStatus {
    return {
      name: this.config.name,
      type: "mqtt",
      isConnected: this.isConnected(),
      lastActivity: this.lastActivity,
      config: this.config,
    };
  }

  // Additional MQTT-specific methods for compatibility
  getMqttClient(): MqttClient {
    return this.mqttClient;
  }
}
