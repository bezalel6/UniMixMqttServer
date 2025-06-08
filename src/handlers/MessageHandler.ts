import { MqttClient } from "../mqtt/MqttClient";
import {
  UniMixMessage,
  MessageType,
  AudioStatusRequestMessage,
  AudioMixUpdateMessage,
  AudioMixUpdate,
} from "../protocols/MessageTypes";
import { logger } from "../utils/logger";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface AudioStatus {
  name: string;
  volume: number;
}

export interface MessageHandlerContext {
  mqttClient: MqttClient;
  clientId: string;
  originalTopic: string;
}

export abstract class BaseMessageHandler<T extends UniMixMessage> {
  abstract handle(message: T, context: MessageHandlerContext): Promise<void>;

  protected generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  protected async sendResponse(
    message: UniMixMessage,
    responseTopic: string,
    context: MessageHandlerContext
  ): Promise<void> {
    await context.mqttClient.publish(responseTopic, JSON.stringify(message));
  }
}

async function getAudio() {
  // Execute the PowerShell command to get audio status
  const { stdout, stderr } = await execAsync(
    `& "./svcl.exe" /Stdout /scomma '""' /Columns 'ProcessPath,Volume Percent' | Select-String '[^\\/]+\\.exe[^\\/]*'`,
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
    .filter((status): status is AudioStatus => status !== null);

  return audioStatuses.map((status) => JSON.stringify(status)).join("\n");
}

/**
 * Maps a raw line from svcl.exe output to an AudioStatus object
 * @param line - Raw line containing process path and volume information
 * @returns AudioStatus object or null if the line cannot be parsed
 */
function mapLineToAudioStatus(line: string): AudioStatus | null {
  const [processPath, volumePercent] = line.split(",").map((s) => s.trim());

  if (!processPath || !volumePercent) {
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

getAudio();

export class AudioStatusRequestHandler extends BaseMessageHandler<AudioStatusRequestMessage> {
  async handle(
    message: AudioStatusRequestMessage,
    context: MessageHandlerContext
  ): Promise<void> {
    logger.info(`[AUDIO_STATUS_REQUEST] Received from ${context.clientId}`);

    try {
      const audioStatuses = await getAudio();
      // Publish the result to the general audio status topic
      await context.mqttClient.publish("unimix/audio_status", audioStatuses);
    } catch (error) {
      logger.error(`Failed to get audio status:`, error);
    }
  }
}

export class AudioMixUpdateHandler extends BaseMessageHandler<AudioMixUpdateMessage> {
  async handle(
    message: AudioMixUpdateMessage,
    context: MessageHandlerContext
  ): Promise<void> {
    logger.info(
      `[AUDIO_MIX_UPDATE] Received from ${context.clientId} with ${message.updates.length} updates`
    );

    try {
      // Generate all commands and concatenate them
      const commands = message.updates.map((update) => updateToCmd(update));
      const concatenatedCmd = commands.map((cmd) => `/${cmd}`).join(" ");

      logger.info(`Executing concatenated commands: ${concatenatedCmd}`);

      // Execute all commands in a single svcl.exe call
      await execAsync(`& "./svcl.exe" ${concatenatedCmd}`, {
        shell: "powershell",
      });

      logger.info(`Successfully executed ${commands.length} commands`);
    } catch (error) {
      logger.error(`Failed to update audio mix:`, error);
    }
  }
}
function updateToCmd(update: AudioMixUpdate): string {
  switch (update.action) {
    case "SetVolume":
      return `${update.action} "${update.processName}" ${update.volume}`;
    case "Mute":
      return `${update.action} "${update.processName}"`;
    case "Unmute":
      return `${update.action} "${update.processName}"`;
  }
}
