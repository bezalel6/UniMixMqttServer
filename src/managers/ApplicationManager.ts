import { AppConfig, ConfigManager } from "../config/AppConfig";
import { MessageBus } from "../protocols/MessageBus";
import { MqttTransport } from "../protocols/MqttTransport";
import { SerialTransport } from "../protocols/SerialTransport";
import { MessageRouter } from "../protocols/MessageRouter";
import { MessagePublisher } from "../protocols/IMessagePublisher";
import { BaseMessageHandler } from "../handlers/MessageHandler";
import { logger } from "../utils/logger";

export class ApplicationManager {
  private static instance: ApplicationManager;
  private config: AppConfig;
  private messageBus: MessageBus;
  private messageRouter: MessageRouter;
  private isRunning: boolean = false;

  private constructor() {
    this.config = ConfigManager.getInstance().getConfig();
    this.messageBus = new MessageBus({
      name: this.config.messageBus.name,
      fallbackEnabled: this.config.messageBus.fallbackEnabled,
    });
    this.messageRouter = new MessageRouter();
  }

  static getInstance(): ApplicationManager {
    if (!ApplicationManager.instance) {
      ApplicationManager.instance = new ApplicationManager();
    }
    return ApplicationManager.instance;
  }

  async initialize(): Promise<void> {
    try {
      logger.info(`Initializing ${this.config.serverName}...`);

      // Initialize transports based on configuration
      await this.initializeTransports();

      // Set the primary transport after all transports are added
      if (this.config.messageBus.primaryTransport) {
        try {
          this.messageBus.setTransport(this.config.messageBus.primaryTransport);
        } catch (error) {
          logger.warn(
            `Failed to set primary transport to ${this.config.messageBus.primaryTransport}:`,
            error
          );
        }
      }

      // Set up message routing
      this.setupMessageRouting();

      // Initialize transport-agnostic message publisher
      this.initializeMessagePublisher();

      logger.info(`${this.config.serverName} initialized successfully`);
    } catch (error) {
      logger.error("Failed to initialize application:", error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("Application is already running");
      return;
    }

    try {
      logger.info("Starting application...");

      // Connect all transports
      await this.connectTransports();

      // Subscribe to configured topics
      await this.subscribeToTopics();

      // Initialize status publishing if enabled (after transports are connected)
      if (this.config.statusPublishing.enabled) {
        await this.initializeStatusPublishing();
      }

      this.isRunning = true;
      logger.info(`${this.config.serverName} is running successfully`);
    } catch (error) {
      logger.error("Failed to start application:", error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn("Application is not running");
      return;
    }

    try {
      logger.info("Stopping application...");

      // Stop status publishing
      BaseMessageHandler.stopStatusPublisher();

      // Disconnect all transports
      await this.messageBus.disconnectAll();

      this.isRunning = false;
      logger.info(`${this.config.serverName} stopped successfully`);
    } catch (error) {
      logger.error("Failed to stop application:", error);
      throw error;
    }
  }

  getStatus(): any {
    return {
      serverName: this.config.serverName,
      isRunning: this.isRunning,
      messageBusStatus: this.messageBus.getStatus(),
      supportedMessageTypes: this.messageRouter.getSupportedMessageTypes(),
    };
  }

  private async initializeTransports(): Promise<void> {
    for (const transportConfig of this.config.transports) {
      if (!transportConfig.enabled) {
        logger.info(`Skipping disabled transport: ${transportConfig.name}`);
        continue;
      }

      try {
        if (transportConfig.type === "mqtt" && transportConfig.mqtt) {
          const mqttTransport = new MqttTransport({
            name: transportConfig.name,
            brokerUrl: transportConfig.mqtt.brokerUrl,
            clientId: transportConfig.mqtt.clientId,
            username: transportConfig.mqtt.username,
            password: transportConfig.mqtt.password,
          });

          this.messageBus.addTransport(transportConfig.name, mqttTransport);
          logger.info(`MQTT transport initialized: ${transportConfig.name}`);
        } else if (
          transportConfig.type === "serial" &&
          transportConfig.serial
        ) {
          const serialTransport = new SerialTransport({
            name: transportConfig.name,
            port: transportConfig.serial.port,
            baudRate: transportConfig.serial.baudRate,
            dataBits: transportConfig.serial.dataBits,
            stopBits: transportConfig.serial.stopBits,
            parity: transportConfig.serial.parity,
          });

          this.messageBus.addTransport(transportConfig.name, serialTransport);
          logger.info(`Serial transport initialized: ${transportConfig.name}`);
        }
      } catch (error) {
        logger.error(
          `Failed to initialize transport ${transportConfig.name}:`,
          error
        );
        if (transportConfig.name === this.config.messageBus.primaryTransport) {
          // Primary transport is critical, re-throw the error
          throw error;
        } else {
          // Secondary transports are optional, just warn
          logger.warn(`Continuing without ${transportConfig.name} transport`);
        }
      }
    }
  }

  private setupMessageRouting(): void {
    // Register the message router with the message bus
    this.messageBus.registerHandler((topic: string, payload: string) => {
      logger.debug(`[MessageBus] Received message on ${topic}`);
      this.messageRouter.routeMessage(payload, topic);
    });

    logger.info("Message routing configured");
  }

  private initializeMessagePublisher(): void {
    // Set the message bus as the publisher for transport-agnostic messaging
    MessagePublisher.getInstance().setPublisher(this.messageBus);
    logger.info("Transport-agnostic message publisher initialized");
  }

  private async initializeStatusPublishing(): Promise<void> {
    try {
      await BaseMessageHandler.initializeStatusPublisher(
        this.config.statusPublishing.topic,
        this.config.statusPublishing.interval
      );
      logger.info("Status publishing initialized");
    } catch (error) {
      logger.error("Failed to initialize status publishing:", error);
      throw error;
    }
  }

  private async connectTransports(): Promise<void> {
    const transportNames = this.messageBus.getTransportNames();
    const connectionPromises = [];

    for (const transportName of transportNames) {
      const transport = this.messageBus.getTransport(transportName);
      if (transport) {
        connectionPromises.push(
          transport.connect().catch((error) => {
            logger.error(
              `Failed to connect transport ${transportName}:`,
              error
            );
            if (transportName === this.config.messageBus.primaryTransport) {
              // Primary transport connection failures are critical
              throw error;
            } else {
              // Secondary transport connection failures are non-critical
              logger.warn(`Continuing without ${transportName} transport`);
            }
          })
        );
      }
    }

    await Promise.allSettled(connectionPromises);
    logger.info("Transport connections established");
  }

  private async subscribeToTopics(): Promise<void> {
    if (this.config.topics.subscriptions.length === 0) {
      logger.warn("No subscription topics configured");
      return;
    }

    try {
      await this.messageBus.subscribe(this.config.topics.subscriptions);
      logger.info(
        `Subscribed to ${this.config.topics.subscriptions.length} topics`
      );
    } catch (error) {
      logger.error("Failed to subscribe to topics:", error);
      throw error;
    }
  }

  // Graceful shutdown handler
  setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      try {
        await this.stop();
        process.exit(0);
      } catch (error) {
        logger.error("Error during shutdown:", error);
        process.exit(1);
      }
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  }
}
