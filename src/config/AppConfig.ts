export interface TransportConfig {
  name: string;
  type: "mqtt" | "serial";
  enabled: boolean;
  mqtt?: {
    brokerUrl: string;
    clientId: string;
    username?: string;
    password?: string;
  };
  serial?: {
    port: string;
    baudRate: number;
    dataBits: number;
    stopBits: number;
    parity: "none" | "even" | "odd";
  };
}

export interface AppConfig {
  serverName: string;
  transports: TransportConfig[];
  topics: {
    subscriptions: string[];
  };
  messageBus: {
    name: string;
    primaryTransport: string;
    fallbackEnabled: boolean;
  };
  statusPublishing: {
    enabled: boolean;
    interval: number; // in milliseconds
    topic: string;
  };
}

export class ConfigManager {
  private static instance: ConfigManager;
  private config: AppConfig;

  private constructor() {
    this.config = this.loadDefaultConfig();
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private loadDefaultConfig(): AppConfig {
    return {
      serverName: process.env.SERVER_NAME || "UniMixMqttServer",
      transports: [
        {
          name: "serial-primary",
          type: "serial",
          enabled: true,
          serial: {
            port: process.env.SERIAL_PORT || "COM8",
            baudRate: parseInt(process.env.SERIAL_BAUDRATE || "115200"),
            dataBits: parseInt(process.env.SERIAL_DATABITS || "8"),
            stopBits: parseInt(process.env.SERIAL_STOPBITS || "1"),
            parity:
              (process.env.SERIAL_PARITY as "none" | "even" | "odd") || "none",
          },
        },
        {
          name: "mqtt-primary",
          type: "mqtt",
          enabled: process.env.MQTT_ENABLED === "true",
          mqtt: {
            brokerUrl: process.env.MQTT_BROKER_URL || "mqtt://localhost:1883",
            clientId: process.env.MQTT_CLIENT_ID || "unimix-server",
            username: process.env.MQTT_USERNAME,
            password: process.env.MQTT_PASSWORD,
          },
        },
        {
          name: "mqtt-msgbus",
          type: "mqtt",
          enabled: process.env.MQTT_ENABLED === "true",
          mqtt: {
            brokerUrl: process.env.MQTT_BROKER_URL || "mqtt://localhost:1883",
            clientId:
              (process.env.MQTT_CLIENT_ID || "unimix-server") + "-msgbus",
            username: process.env.MQTT_USERNAME,
            password: process.env.MQTT_PASSWORD,
          },
        },
      ],
      topics: {
        subscriptions: [
          process.env.AUDIO_REQUESTS_TOPIC ||
            "homeassistant/unimix/audio/requests",
          process.env.AUDIO_CONTROL_TOPIC ||
            "homeassistant/unimix/audio/control",
          process.env.AUDIO_STATUS_TOPIC || "homeassistant/unimix/audio_status",
        ],
      },
      messageBus: {
        name: "UniMixTransportBus",
        primaryTransport: process.env.PRIMARY_TRANSPORT || "serial-primary",
        fallbackEnabled: process.env.FALLBACK_ENABLED !== "false",
      },
      statusPublishing: {
        enabled: process.env.STATUS_PUBLISHING_ENABLED !== "false",
        interval: parseInt(process.env.STATUS_PUBLISHING_INTERVAL || "60000"),
        topic: process.env.STATUS_TOPIC || "homeassistant/unimix/audio_status",
      },
    };
  }

  getConfig(): AppConfig {
    return this.config;
  }

  updateConfig(newConfig: Partial<AppConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
