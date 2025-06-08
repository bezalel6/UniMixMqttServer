import {
  MessageType,
  UniMixMessage,
  HeartbeatMessage,
  StatusRequestMessage,
  DeviceCommandMessage,
  DeviceStatusMessage,
  DeviceConfigMessage,
  SensorDataMessage,
  TelemetryMessage,
  UserRequestMessage,
  ShutdownMessage,
} from "../protocols/MessageTypes";

/**
 * Utility class to build valid messages according to defined protocols
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
   * Build a heartbeat message
   */
  static buildHeartbeat(clientId: string, uptime: number): HeartbeatMessage {
    return {
      messageType: MessageType.HEARTBEAT,
      timestamp: this.getTimestamp(),
      messageId: this.generateMessageId(),
      clientId,
      uptime,
    };
  }

  /**
   * Build a status request message
   */
  static buildStatusRequest(
    clientId: string,
    requestedComponents?: string[]
  ): StatusRequestMessage {
    return {
      messageType: MessageType.STATUS_REQUEST,
      timestamp: this.getTimestamp(),
      messageId: this.generateMessageId(),
      clientId,
      requestedComponents,
    };
  }

  /**
   * Build a device command message
   */
  static buildDeviceCommand(
    clientId: string,
    deviceId: string,
    command: string,
    parameters?: Record<string, any>
  ): DeviceCommandMessage {
    return {
      messageType: MessageType.DEVICE_COMMAND,
      timestamp: this.getTimestamp(),
      messageId: this.generateMessageId(),
      clientId,
      deviceId,
      command,
      parameters,
    };
  }

  /**
   * Build a device status message
   */
  static buildDeviceStatus(
    clientId: string,
    deviceId: string,
    status: "active" | "inactive" | "error" | "unknown",
    data?: Record<string, any>
  ): DeviceStatusMessage {
    return {
      messageType: MessageType.DEVICE_STATUS,
      timestamp: this.getTimestamp(),
      messageId: this.generateMessageId(),
      clientId,
      deviceId,
      status,
      data,
    };
  }

  /**
   * Build a device configuration message
   */
  static buildDeviceConfig(
    clientId: string,
    deviceId: string,
    configuration: Record<string, any>
  ): DeviceConfigMessage {
    return {
      messageType: MessageType.DEVICE_CONFIG,
      timestamp: this.getTimestamp(),
      messageId: this.generateMessageId(),
      clientId,
      deviceId,
      configuration,
    };
  }

  /**
   * Build a sensor data message
   */
  static buildSensorData(
    clientId: string,
    sensorId: string,
    sensorType: string,
    value: number | string | boolean,
    unit?: string,
    metadata?: Record<string, any>
  ): SensorDataMessage {
    return {
      messageType: MessageType.SENSOR_DATA,
      timestamp: this.getTimestamp(),
      messageId: this.generateMessageId(),
      clientId,
      sensorId,
      sensorType,
      value,
      unit,
      metadata,
    };
  }

  /**
   * Build a telemetry message
   */
  static buildTelemetry(
    clientId: string,
    source: string,
    data: Record<string, any>
  ): TelemetryMessage {
    return {
      messageType: MessageType.TELEMETRY,
      timestamp: this.getTimestamp(),
      messageId: this.generateMessageId(),
      clientId,
      source,
      data,
    };
  }

  /**
   * Build a user request message
   */
  static buildUserRequest(
    clientId: string,
    userId: string,
    action: string,
    payload?: Record<string, any>
  ): UserRequestMessage {
    return {
      messageType: MessageType.USER_REQUEST,
      timestamp: this.getTimestamp(),
      messageId: this.generateMessageId(),
      clientId,
      userId,
      action,
      payload,
    };
  }

  /**
   * Build a shutdown message
   */
  static buildShutdown(
    clientId: string,
    reason?: string,
    gracefulTimeout?: number
  ): ShutdownMessage {
    return {
      messageType: MessageType.SHUTDOWN,
      timestamp: this.getTimestamp(),
      messageId: this.generateMessageId(),
      clientId,
      reason,
      gracefulTimeout,
    };
  }

  /**
   * Convert any message to JSON string
   */
  static toJson(message: UniMixMessage): string {
    return JSON.stringify(message, null, 2);
  }

  /**
   * Convert any message to compact JSON string (for MQTT transmission)
   */
  static toCompactJson(message: UniMixMessage): string {
    return JSON.stringify(message);
  }

  /**
   * Build a batch of sensor data messages
   */
  static buildSensorDataBatch(
    clientId: string,
    sensors: Array<{
      sensorId: string;
      sensorType: string;
      value: number | string | boolean;
      unit?: string;
      metadata?: Record<string, any>;
    }>
  ): SensorDataMessage[] {
    return sensors.map((sensor) =>
      this.buildSensorData(
        clientId,
        sensor.sensorId,
        sensor.sensorType,
        sensor.value,
        sensor.unit,
        sensor.metadata
      )
    );
  }

  /**
   * Build a batch of device commands
   */
  static buildDeviceCommandBatch(
    clientId: string,
    commands: Array<{
      deviceId: string;
      command: string;
      parameters?: Record<string, any>;
    }>
  ): DeviceCommandMessage[] {
    return commands.map((cmd) =>
      this.buildDeviceCommand(
        clientId,
        cmd.deviceId,
        cmd.command,
        cmd.parameters
      )
    );
  }
}
