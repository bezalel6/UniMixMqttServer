import dotenv from "dotenv";
import { ApplicationManager } from "./managers/ApplicationManager";
import { logger } from "./utils/logger";

// Load environment variables
dotenv.config();

async function main(): Promise<void> {
  try {
    logger.info("Starting UniMix MQTT Server...");

    // Get the application manager instance
    const appManager = ApplicationManager.getInstance();

    // Initialize the application
    await appManager.initialize();

    // Start the application
    await appManager.start();

    // Set up graceful shutdown
    appManager.setupGracefulShutdown();

    // Log the application status
    const status = appManager.getStatus();
    logger.info("Application Status:", status);

    // Keep the process running
    logger.info("UniMix MQTT Server is running. Press Ctrl+C to stop.");
  } catch (error) {
    logger.error("Failed to start UniMix MQTT Server:", error);
    process.exit(1);
  }
}

main();
