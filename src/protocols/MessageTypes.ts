// Message type definitions for UniMix MQTT Server
import { MESSAGE_TYPES, AUDIO_ACTIONS } from "./MessageConstants";

export const MessageType = {
  // Audio control messages
  AUDIO_STATUS_REQUEST: MESSAGE_TYPES.AUDIO_STATUS_REQUEST,
  AUDIO_MIX_UPDATE: MESSAGE_TYPES.AUDIO_MIX_UPDATE,
} as const;

export type MessageTypeValue = (typeof MessageType)[keyof typeof MessageType];

// Base message interface
export interface BaseMessage {
  messageType: MessageTypeValue;
  timestamp: string;
  messageId: string;
}

// Audio message schemas
export interface AudioStatusRequestMessage extends BaseMessage {
  messageType: typeof MessageType.AUDIO_STATUS_REQUEST;
}

export interface AudioMixUpdateMessage extends BaseMessage {
  messageType: typeof MessageType.AUDIO_MIX_UPDATE;
  updates: AudioMixUpdate[];
}
export type AudioMixUpdate = { processName: string } & (
  | {
      action: typeof AUDIO_ACTIONS.SET_VOLUME;
      volume: number;
    }
  | {
      action: typeof AUDIO_ACTIONS.MUTE;
    }
  | {
      action: typeof AUDIO_ACTIONS.UNMUTE;
    }
);

// Union type for all messages
export type UniMixMessage = AudioStatusRequestMessage | AudioMixUpdateMessage;
