import * as mqtt from "mqtt";
import { logger } from "../utils/logger";

export interface MqttClientConfig {
  brokerUrl: string;
  clientId: string;
  username?: string;
  password?: string;
  keepalive?: number;
  reconnectPeriod?: number;
}

export class MqttClient {
  private client: mqtt.MqttClient | null = null;
  private config: MqttClientConfig;

  constructor(config: MqttClientConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const options: mqtt.IClientOptions = {
        clientId: this.config.clientId,
        username: this.config.username,
        password: this.config.password,
        keepalive: this.config.keepalive || 60,
        reconnectPeriod: this.config.reconnectPeriod || 1000,
        clean: true,
      };

      this.client = mqtt.connect(this.config.brokerUrl, options);

      this.client.on("connect", () => {
        logger.info(`Connected to MQTT broker: ${this.config.brokerUrl}`);
        resolve();
      });

      this.client.on("error", (error) => {
        logger.error("MQTT connection error:", error);
        reject(error);
      });

      this.client.on("disconnect", () => {
        logger.warn("Disconnected from MQTT broker");
      });

      this.client.on("reconnect", () => {
        logger.info("Reconnecting to MQTT broker...");
      });

      this.client.on("offline", () => {
        logger.warn("MQTT client is offline");
      });
    });
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.client) {
        this.client.end(false, {}, () => {
          logger.info("Disconnected from MQTT broker");
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  async publish(
    topic: string,
    payload: string | Buffer,
    options?: mqtt.IClientPublishOptions
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.client.connected) {
        reject(new Error("MQTT client is not connected"));
        return;
      }

      this.client.publish(topic, payload, options || {}, (error) => {
        if (error) {
          logger.error(`Failed to publish to topic ${topic}:`, error);
          reject(error);
        } else {
          logger.debug(`Published to topic: ${topic}`);
          resolve();
        }
      });
    });
  }

  async subscribe(topic: string | string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.client.connected) {
        reject(new Error("MQTT client is not connected"));
        return;
      }

      this.client.subscribe(topic, (error) => {
        if (error) {
          logger.error(`Failed to subscribe to topic ${topic}:`, error);
          reject(error);
        } else {
          logger.info(`Subscribed to topic: ${topic}`);
          resolve();
        }
      });
    });
  }

  isConnected(): boolean {
    return this.client?.connected || false;
  }

  onMessage(callback: (topic: string, payload: Buffer) => void): void {
    if (this.client) {
      this.client.on("message", callback);
    }
  }
}
