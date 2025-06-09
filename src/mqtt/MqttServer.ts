import { MqttClient, MqttClientConfig } from "./MqttClient";
import { MessageRouter } from "../protocols/MessageRouter";
import { MessageHandlerContext } from "../handlers/MessageHandler";
import { logger } from "../utils/logger";

export interface MqttServerConfig extends MqttClientConfig {
  subscribedTopics?: string[];
  serverName?: string;
}

export class MqttServer {
  private mqttClient: MqttClient;
  private messageRouter: MessageRouter;
  private config: MqttServerConfig;
  private isRunning: boolean = false;

  constructor(config: MqttServerConfig) {
    this.config = {
      subscribedTopics: [
        "homeassistant/unimix/+/messages",
        "homeassistant/unimix/commands/+",
      ],
      serverName: "UniMixMqttServer",
      ...config,
    };

    this.mqttClient = new MqttClient(config);
    this.messageRouter = new MessageRouter();
  }

  /**
   * Start the MQTT server
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("MQTT Server is already running");
      return;
    }

    try {
      logger.info(`Starting ${this.config.serverName}...`);

      // Connect to MQTT broker
      await this.mqttClient.connect();

      // Subscribe to configured topics
      for (const topic of this.config.subscribedTopics!) {
        await this.mqttClient.subscribe(topic);
        logger.info(`Subscribed to topic: ${topic}`);
      }

      // Set up message handler
      this.mqttClient.onMessage(async (topic, payload) => {
        await this.handleIncomingMessage(topic, payload);
      });

      this.isRunning = true;
      logger.info(`${this.config.serverName} started successfully`);

      // Publish server status
      await this.publishServerStatus("online");
    } catch (error) {
      logger.error("Failed to start MQTT server:", error);
      throw error;
    }
  }

  /**
   * Stop the MQTT server
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      logger.info(`Stopping ${this.config.serverName}...`);

      // Publish server status before disconnecting
      await this.publishServerStatus("offline");

      // Disconnect from MQTT broker
      await this.mqttClient.disconnect();

      this.isRunning = false;
      logger.info(`${this.config.serverName} stopped successfully`);
    } catch (error) {
      logger.error("Error stopping MQTT server:", error);
      throw error;
    }
  }

  /**
   * Handle incoming MQTT messages
   */
  private async handleIncomingMessage(
    topic: string,
    payload: Buffer
  ): Promise<void> {
    try {
      const messageString = payload.toString();
      logger.debug(`Received message on topic: ${topic}`);

      // Create message handler context
      const context: MessageHandlerContext = {
        mqttClient: this.mqttClient,
        clientId: this.config.clientId,
        originalTopic: topic,
      };

      // Route the message to appropriate handler
      await this.messageRouter.routeMessage(messageString, topic);
    } catch (error) {
      logger.error(`Error handling message on topic ${topic}:`, error);
    }
  }

  /**
   * Publish server status
   */
  private async publishServerStatus(
    status: "online" | "offline" | "error"
  ): Promise<void> {
    try {
      const statusMessage = {
        messageType: "system.server.status",
        timestamp: new Date().toISOString(),
        messageId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        clientId: this.config.clientId,
        serverName: this.config.serverName,
        status,
        uptime: process.uptime(),
        supportedMessageTypes: this.messageRouter.getSupportedMessageTypes(),
      };

      await this.mqttClient.publish(
        "homeassistant/unimix/server/status",
        JSON.stringify(statusMessage)
      );
    } catch (error) {
      logger.error("Failed to publish server status:", error);
    }
  }

  /**
   * Subscribe to additional topics
   */
  async subscribeToTopic(topic: string): Promise<void> {
    if (!this.isRunning) {
      throw new Error("Server must be running to subscribe to topics");
    }

    await this.mqttClient.subscribe(topic);
    logger.info(`Subscribed to additional topic: ${topic}`);
  }

  /**
   * Publish a message to a topic
   */
  async publishMessage(topic: string, message: any): Promise<void> {
    if (!this.isRunning) {
      throw new Error("Server must be running to publish messages");
    }

    const messageString =
      typeof message === "string" ? message : JSON.stringify(message);
    await this.mqttClient.publish(topic, messageString);
  }

  /**
   * Get the message router (for extending functionality)
   */
  getMessageRouter(): MessageRouter {
    return this.messageRouter;
  }

  /**
   * Get the MQTT client instance
   */
  getMqttClient(): MqttClient {
    return this.mqttClient;
  }

  /**
   * Get server status
   */
  getStatus(): {
    isRunning: boolean;
    isConnected: boolean;
    config: MqttServerConfig;
    supportedMessageTypes: string[];
  } {
    return {
      isRunning: this.isRunning,
      isConnected: this.mqttClient.isConnected(),
      config: this.config,
      supportedMessageTypes: this.messageRouter.getSupportedMessageTypes(),
    };
  }

  /**
   * Check if server is running
   */
  isServerRunning(): boolean {
    return this.isRunning;
  }
}
