import dotenv from "dotenv";
import { MqttServer } from "./mqtt/MqttServer";
import { logger } from "./utils/logger";

// Load environment variables
dotenv.config();

async function main(): Promise<void> {
  try {
    logger.info("Starting UniMix MQTT Server...");

    // Initialize MQTT server with structured message handling
    const mqttServer = new MqttServer({
      brokerUrl: process.env.MQTT_BROKER_URL || "mqtt://localhost:1883",
      clientId: process.env.MQTT_CLIENT_ID || "unimix-server",
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      serverName: "UniMixMqttServer",
      subscribedTopics: [
        "unimix/audio/requests", // Audio status requests
        "unimix/audio/control", // Audio mix updates
      ],
    });

    // Start the server
    await mqttServer.start();

    // Log supported message types
    const status = mqttServer.getStatus();
    logger.info("Supported message types:", status.supportedMessageTypes);

    // Handle graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      try {
        await mqttServer.stop();
        process.exit(0);
      } catch (error) {
        logger.error("Error during shutdown:", error);
        process.exit(1);
      }
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));

    // Keep the process running
    logger.info("UniMix MQTT Server is running. Press Ctrl+C to stop.");
  } catch (error) {
    logger.error("Failed to start UniMix MQTT Server:", error);
    process.exit(1);
  }
}

main();
