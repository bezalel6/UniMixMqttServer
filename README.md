# UniMix MQTT Client

A TypeScript-based MQTT client that publishes data to other clients via an MQTT broker.

## Features

- **MQTT Client**: Robust MQTT client with auto-reconnection
- **Data Publishing**: Publishes various types of data at configurable intervals
- **Environment Configuration**: Easy configuration via environment variables
- **TypeScript**: Full TypeScript support with type safety
- **Logging**: Comprehensive logging system
- **Graceful Shutdown**: Handles SIGINT and SIGTERM signals properly

## Installation

1. Install dependencies:

```bash
npm install
```

2. Install development dependencies (if not already installed):

```bash
npm install --save-dev
```

## Configuration

Create a `.env` file in the root directory with the following variables:

```env
# MQTT Broker Configuration
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_CLIENT_ID=unimix-client
MQTT_USERNAME=your_username
MQTT_PASSWORD=your_password

# Application Configuration
NODE_ENV=development
DEBUG=true
```

## Usage

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
# Build the project
npm run build

# Start the application
npm start
```

## Data Published

The client publishes data to the following MQTT topics:

### System Status

- **Topic**: `unimix/system/status`
- **Data**: System status, uptime, and memory usage
- **Interval**: Every 10 seconds (configurable)

### Sensor Data

- **Topic**: `unimix/sensors/environment`
- **Data**: Temperature, humidity, and pressure readings
- **Interval**: Every 10 seconds (configurable)

### Device Metrics

- **Topic**: `unimix/device/metrics`
- **Data**: CPU usage, network RX/TX statistics
- **Interval**: Every 10 seconds (configurable)

## API

### DataPublisher

The `DataPublisher` class allows you to publish custom data:

```typescript
import { DataPublisher } from "./src/publishers/DataPublisher";

// Publish custom message
await dataPublisher.publishMessage("custom/topic", {
  value: 42,
  description: "Custom data",
});
```

### MqttClient

The `MqttClient` class provides MQTT functionality:

```typescript
import { MqttClient } from "./src/mqtt/MqttClient";

const client = new MqttClient({
  brokerUrl: "mqtt://localhost:1883",
  clientId: "my-client",
});

await client.connect();
await client.publish("my/topic", "Hello, MQTT!");
```

## Scripts

- `npm run build` - Build the TypeScript project
- `npm run dev` - Run in development mode with auto-reload
- `npm start` - Run the built application
- `npm test` - Run tests
- `npm run lint` - Lint the code
- `npm run lint:fix` - Fix linting issues
- `npm run clean` - Clean the build directory

## Architecture

```
src/
├── index.ts              # Main entry point
├── mqtt/
│   └── MqttClient.ts     # MQTT client wrapper
├── publishers/
│   └── DataPublisher.ts  # Data publishing logic
└── utils/
    └── logger.ts         # Logging utility
```

## Dependencies

### Runtime Dependencies

- `mqtt` - MQTT client library
- `dotenv` - Environment variable loader

### Development Dependencies

- `typescript` - TypeScript compiler
- `ts-node-dev` - Development server with auto-reload
- `@types/node` - Node.js type definitions
- `eslint` - Code linting
- `jest` - Testing framework

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

This project is licensed under the MIT License.
