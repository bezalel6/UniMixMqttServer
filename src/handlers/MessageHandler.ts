import {
  UniMixMessage,
  MessageType,
  AudioStatusRequestMessage,
  AudioMixUpdateMessage,
  AudioMixUpdate,
} from "../protocols/MessageTypes";
import {
  MessageContext,
  MessagePublisher,
} from "../protocols/IMessagePublisher";
import { logger } from "../utils/logger";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface AudioStatus {
  name: string;
  volume: number;
}

class StatusPublisher {
  private static instance: StatusPublisher | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private messagePublisher: MessagePublisher;
  private statusTopic: string = "homeassistant/unimix/audio_status";

  private constructor() {
    this.messagePublisher = MessagePublisher.getInstance();
  }

  static getInstance(): StatusPublisher {
    if (!StatusPublisher.instance) {
      StatusPublisher.instance = new StatusPublisher();
    }
    return StatusPublisher.instance;
  }

  setStatusTopic(topic: string): void {
    this.statusTopic = topic;
  }

  async startPublishing(intervalMs: number = 60000): Promise<void> {
    if (!this.messagePublisher.isInitialized()) {
      throw new Error(
        "Message publisher not initialized. Call MessagePublisher.setPublisher first."
      );
    }

    // Publish initial status
    await this.publishStatus();

    // Set up periodic publishing
    this.startPeriodicPublishing(intervalMs);

    logger.info(
      `StatusPublisher started with initial publish and periodic publishing every ${intervalMs}ms`
    );
  }

  private startPeriodicPublishing(intervalMs: number): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    this.intervalId = setInterval(() => {
      this.publishStatus();
    }, intervalMs);
  }

  async publishStatus(): Promise<void> {
    if (!this.messagePublisher.isInitialized()) {
      logger.warn("Message publisher not available for status publishing");
      return;
    }

    try {
      const audioStatuses = await getAudio();
      await this.messagePublisher.publish(this.statusTopic, audioStatuses);
      logger.info("Audio status published successfully");
    } catch (error) {
      logger.error("Failed to publish audio status:", error);
    }
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    logger.info("StatusPublisher stopped");
  }
}

export abstract class BaseMessageHandler<T extends UniMixMessage> {
  private static statusPublisher = StatusPublisher.getInstance();
  protected messagePublisher = MessagePublisher.getInstance();

  static async initializeStatusPublisher(
    statusTopic: string,
    intervalMs: number
  ): Promise<void> {
    BaseMessageHandler.statusPublisher.setStatusTopic(statusTopic);
    await BaseMessageHandler.statusPublisher.startPublishing(intervalMs);
  }

  static async publishStatus(): Promise<void> {
    await BaseMessageHandler.statusPublisher.publishStatus();
  }

  static stopStatusPublisher(): void {
    BaseMessageHandler.statusPublisher.stop();
  }

  abstract handle(message: T, context: MessageContext): Promise<void>;

  protected generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  protected async sendResponse(
    message: UniMixMessage,
    responseTopic: string
  ): Promise<void> {
    await this.messagePublisher.publish(responseTopic, JSON.stringify(message));
  }
}

const RelevantProcesses = [
  /JellyfinMediaPlayer/i,
  /youtube/i,
  /chrome/i,
  /cod/i,
  /DefaultRenderDevice/i,
];

async function getAudio() {
  // Execute the PowerShell command to get audio status
  const { stdout, stderr } = await execAsync(
    `& "./svcl.exe" /Stdout /scomma '""' /Columns 'ProcessPath,Volume Percent' /GetPercent "DefaultRenderDevice"`,
    { shell: "powershell" }
  );

  if (stderr) {
    logger.error(`PowerShell stderr: ${stderr}`);
  }
  const audioStatuses = parseAudioProcessOutput(stdout);
  logger.info(`Audio status output:\n${audioStatuses}`);
  return audioStatuses;
}

/**
 * Parses the raw stdout from svcl.exe command and extracts clean process information
 * @param rawOutput - Raw stdout from the svcl.exe command
 * @returns Cleaned and formatted process information as a string
 */
function parseAudioProcessOutput(rawOutput: string): string {
  const audioStatuses = rawOutput
    .split("\n")
    .map(mapLineToAudioStatus)
    .filter((status): status is AudioStatus => status !== null)
    .filter((status) => isRelevantProcess(status.name));

  const audioStatusObject: Record<string, number> = {};
  audioStatuses.forEach((status) => {
    audioStatusObject[status.name] = status.volume;
  });

  return JSON.stringify(audioStatusObject);
}

/**
 * Checks if a process name matches any of the relevant processes
 * @param processName - The name of the process to check
 * @returns true if the process matches any relevant process pattern
 */
function isRelevantProcess(processName: string): boolean {
  return RelevantProcesses.some((pattern) => pattern.test(processName));
}

/**
 * Maps a raw line from svcl.exe output to an AudioStatus object
 * @param line - Raw line containing process path and volume information
 * @returns AudioStatus object or null if the line cannot be parsed
 */
function mapLineToAudioStatus(line: string): AudioStatus | null {
  const [processPath, volumePercent] = line.split(",").map((s) => s.trim());

  if (!processPath || !volumePercent) {
    if (processPath.includes(".")) {
      return { name: "DefaultRenderDevice", volume: Number(line) };
    }
    return null;
  }

  const processName = extractProcessNameFromPath(processPath);
  const volume = parseFloat(volumePercent);

  if (!processName || isNaN(volume)) {
    return null;
  }

  return {
    name: processName,
    volume,
  };
}

/**
 * Extracts the process name (executable filename) from a full file path
 * @param line - Line containing the full process path
 * @returns The process name (filename) without the full path
 */
function extractProcessNameFromPath(line: string): string {
  const trimmedLine = line.trim();
  const lastBackslashIndex = trimmedLine.lastIndexOf("\\");

  if (lastBackslashIndex === -1) {
    return trimmedLine;
  }

  return trimmedLine.substring(lastBackslashIndex + 1).trim();
}

export class AudioStatusRequestHandler extends BaseMessageHandler<AudioStatusRequestMessage> {
  async handle(
    message: AudioStatusRequestMessage,
    context: MessageContext
  ): Promise<void> {
    logger.info(`Handling audio status request: ${message.messageId}`);

    try {
      const audioStatuses = await getAudio();

      // Publish status directly to the status topic
      await this.messagePublisher.publish(
        process.env.AUDIO_STATUS_TOPIC || "homeassistant/unimix/audio_status",
        audioStatuses
      );

      logger.info(`Audio status published for request: ${message.messageId}`);
    } catch (error) {
      logger.error(
        `Failed to handle audio status request: ${message.messageId}`,
        error
      );
    }
  }
}

export class AudioMixUpdateHandler extends BaseMessageHandler<AudioMixUpdateMessage> {
  async handle(
    message: AudioMixUpdateMessage,
    context: MessageContext
  ): Promise<void> {
    logger.info(`Handling audio mix update: ${message.messageId}`);

    try {
      for (const update of message.updates) {
        const command = updateToCmd(update);
        logger.info(`Executing command: ${command}`);

        const { stdout, stderr } = await execAsync(command, {
          shell: "powershell",
        });

        if (stderr) {
          logger.error(`Command stderr: ${stderr}`);
        } else {
          logger.info(`Command executed successfully: ${stdout}`);
        }
      }

      logger.info(`Audio mix update completed: ${message.messageId}`);
    } catch (error) {
      logger.error(
        `Failed to handle audio mix update: ${message.messageId}`,
        error
      );
    }
  }
}

function updateToCmd(update: AudioMixUpdate): string {
  switch (update.action) {
    case "SetVolume":
      return `& "./svcl.exe" /SetVolume "${update.processName}" ${update.volume}`;
    case "Mute":
      return `& "./svcl.exe" /Mute "${update.processName}"`;
    case "Unmute":
      return `& "./svcl.exe" /Unmute "${update.processName}"`;
  }
}
