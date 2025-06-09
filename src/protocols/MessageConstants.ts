// Centralized constants for UniMix messaging system
// Transport-agnostic constants used across MQTT and Serial

// Topic Constants
export const TOPICS = {
  AUDIO_REQUESTS: "homeassistant/unimix/audio/requests",
  AUDIO_STATUS: "homeassistant/unimix/audio_status",
  AUDIO_CONTROL: "homeassistant/unimix/audio/control",
  SYSTEM_STATUS: "homeassistant/smartdisplay/status",
  SERVER_STATUS: "homeassistant/unimix/server/status",
} as const;

// Message Type Constants
export const MESSAGE_TYPES = {
  AUDIO_STATUS_REQUEST: "audio.status.request",
  AUDIO_MIX_UPDATE: "audio.mix.update",
  SYSTEM_SERVER_STATUS: "system.server.status",
} as const;

// Audio Action Constants
export const AUDIO_ACTIONS = {
  SET_VOLUME: "SetVolume",
  MUTE: "Mute",
  UNMUTE: "Unmute",
} as const;

// Type exports for strong typing
export type TopicKey = keyof typeof TOPICS;
export type MessageTypeKey = keyof typeof MESSAGE_TYPES;
export type AudioActionKey = keyof typeof AUDIO_ACTIONS;

// Helper functions
export function getTopic(key: TopicKey): string {
  return TOPICS[key];
}

export function getMessageType(key: MessageTypeKey): string {
  return MESSAGE_TYPES[key];
}

export function getAudioAction(key: AudioActionKey): string {
  return AUDIO_ACTIONS[key];
}
