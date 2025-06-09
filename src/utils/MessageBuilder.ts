import {
  MessageType,
  UniMixMessage,
  AudioStatusRequestMessage,
  AudioMixUpdateMessage,
  AudioMixUpdate,
} from "../protocols/MessageTypes";
import { AUDIO_ACTIONS } from "../protocols/MessageConstants";

/**
 * Utility class to build valid audio messages according to defined protocols
 */
export class MessageBuilder {
  /**
   * Generate a unique message ID
   */
  private static generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current ISO timestamp
   */
  private static getTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Build an audio status request message
   */
  static buildAudioStatusRequest(): AudioStatusRequestMessage {
    return {
      messageType: MessageType.AUDIO_STATUS_REQUEST,
      timestamp: this.getTimestamp(),
      messageId: this.generateMessageId(),
    };
  }

  /**
   * Build an audio mix update message
   */
  static buildAudioMixUpdate(updates: AudioMixUpdate[]): AudioMixUpdateMessage {
    return {
      messageType: MessageType.AUDIO_MIX_UPDATE,
      timestamp: this.getTimestamp(),
      messageId: this.generateMessageId(),
      updates,
    };
  }

  /**
   * Build a volume control update
   */
  static buildVolumeUpdate(
    processName: string,
    volume: number
  ): AudioMixUpdate {
    return {
      processName,
      action: AUDIO_ACTIONS.SET_VOLUME,
      volume,
    };
  }

  /**
   * Build a mute update
   */
  static buildMuteUpdate(processName: string): AudioMixUpdate {
    return {
      processName,
      action: AUDIO_ACTIONS.MUTE,
    };
  }

  /**
   * Build an unmute update
   */
  static buildUnmuteUpdate(processName: string): AudioMixUpdate {
    return {
      processName,
      action: AUDIO_ACTIONS.UNMUTE,
    };
  }

  /**
   * Helper to create a single volume control message
   */
  static buildSingleVolumeControl(
    processName: string,
    volume: number
  ): AudioMixUpdateMessage {
    const update = this.buildVolumeUpdate(processName, volume);
    return this.buildAudioMixUpdate([update]);
  }

  /**
   * Helper to create a single mute control message
   */
  static buildSingleMuteControl(processName: string): AudioMixUpdateMessage {
    const update = this.buildMuteUpdate(processName);
    return this.buildAudioMixUpdate([update]);
  }

  /**
   * Helper to create a single unmute control message
   */
  static buildSingleUnmuteControl(processName: string): AudioMixUpdateMessage {
    const update = this.buildUnmuteUpdate(processName);
    return this.buildAudioMixUpdate([update]);
  }

  /**
   * Convert message to JSON string
   */
  static toJson(message: UniMixMessage): string {
    return JSON.stringify(message, null, 2);
  }

  /**
   * Convert message to compact JSON string
   */
  static toCompactJson(message: UniMixMessage): string {
    return JSON.stringify(message);
  }

  /**
   * Build batch volume updates for multiple processes
   */
  static buildBatchVolumeUpdates(
    processes: Array<{ processName: string; volume: number }>
  ): AudioMixUpdateMessage {
    const updates = processes.map((p) =>
      this.buildVolumeUpdate(p.processName, p.volume)
    );
    return this.buildAudioMixUpdate(updates);
  }

  /**
   * Build batch mute updates for multiple processes
   */
  static buildBatchMuteUpdates(processNames: string[]): AudioMixUpdateMessage {
    const updates = processNames.map((name) => this.buildMuteUpdate(name));
    return this.buildAudioMixUpdate(updates);
  }

  /**
   * Build batch unmute updates for multiple processes
   */
  static buildBatchUnmuteUpdates(
    processNames: string[]
  ): AudioMixUpdateMessage {
    const updates = processNames.map((name) => this.buildUnmuteUpdate(name));
    return this.buildAudioMixUpdate(updates);
  }
}
