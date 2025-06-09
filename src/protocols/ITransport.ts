// Transport interface for UniMix messaging system
// Supports both MQTT and Serial transports with identical message formats

export interface ITransport {
  /**
   * Publish a message to a topic
   * @param topic The topic to publish to
   * @param payload The JSON payload as string or object
   */
  publish(topic: string, payload: string | object): Promise<void>;

  /**
   * Subscribe to a topic or topics
   * @param topic Topic or array of topics to subscribe to
   */
  subscribe(topic: string | string[]): Promise<void>;

  /**
   * Check if transport is connected
   */
  isConnected(): boolean;

  /**
   * Connect the transport
   */
  connect(): Promise<void>;

  /**
   * Disconnect the transport
   */
  disconnect(): Promise<void>;

  /**
   * Register a message handler for incoming messages
   * @param handler Function to handle incoming messages
   */
  onMessage(handler: MessageHandler): void;
}

export type MessageHandler = (
  topic: string,
  payload: string
) => void | Promise<void>;

// Transport configuration interfaces
export interface TransportConfig {
  name: string;
}

export interface MqttTransportConfig extends TransportConfig {
  brokerUrl: string;
  clientId: string;
  username?: string;
  password?: string;
  keepalive?: number;
  reconnectPeriod?: number;
}

export interface SerialTransportConfig extends TransportConfig {
  port: string;
  baudRate?: number;
  dataBits?: number;
  stopBits?: number;
  parity?: "none" | "even" | "odd" | "mark" | "space";
  // Reconnection settings
  autoReconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  reconnectBackoffMultiplier?: number;
  maxReconnectDelay?: number;
}

// Transport types
export type TransportType = "mqtt" | "serial";

export interface TransportStatus {
  name: string;
  type: TransportType;
  isConnected: boolean;
  lastActivity?: Date;
  config: TransportConfig;
  // Optional reconnection status fields
  reconnectAttempts?: number;
  isReconnecting?: boolean;
  nextReconnectDelay?: number;
}
