export interface Logger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}

class ConsoleLogger implements Logger {
  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] ${message}`;
  }

  info(message: string, ...args: unknown[]): void {
    console.log(this.formatMessage("INFO", message), ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(this.formatMessage("WARN", message), ...args);
  }

  error(message: string, ...args: unknown[]): void {
    console.error(this.formatMessage("ERROR", message), ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    if (process.env.NODE_ENV === "development" || process.env.DEBUG) {
      console.debug(this.formatMessage("DEBUG", message), ...args);
    }
  }
}

export const logger: Logger = new ConsoleLogger();
