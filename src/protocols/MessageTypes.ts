// Message type definitions for UniMix MQTT Server
export enum MessageType {
  // Audio control messages
  AUDIO_STATUS_REQUEST = "audio.status.request",
  AUDIO_MIX_UPDATE = "audio.mix.update",
}

// Base message interface
export interface BaseMessage {
  messageType: MessageType;
  timestamp: string;
  messageId: string;
  clientId: string;
}

// Audio message schemas
export interface AudioStatusRequestMessage extends BaseMessage {
  messageType: MessageType.AUDIO_STATUS_REQUEST;
}

export interface AudioMixUpdateMessage extends BaseMessage {
  messageType: MessageType.AUDIO_MIX_UPDATE;
  processName: string;
  volumePercent: number;
  action?: "set_volume" | "mute" | "unmute";
}

// Union type for all messages
export type UniMixMessage = AudioStatusRequestMessage | AudioMixUpdateMessage;
