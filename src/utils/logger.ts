import config from "../config";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  context?: Record<string, any>;
  requestId?: string;
}

class Logger {
  private currentLevel: LogLevel;

  constructor() {
    this.currentLevel = this.parseLogLevel(config.server.logLevel);
  }

  private parseLogLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case "debug":
        return LogLevel.DEBUG;
      case "info":
        return LogLevel.INFO;
      case "warn":
        return LogLevel.WARN;
      case "error":
        return LogLevel.ERROR;
      default:
        return LogLevel.INFO;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.currentLevel;
  }

  private formatMessage(
    level: string,
    message: string,
    context?: Record<string, any>
  ): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
    };
  }

  private output(entry: LogEntry): void {
    const output = config.server.isProduction
      ? JSON.stringify(entry)
      : `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}${
          entry.context ? `\n${JSON.stringify(entry.context, null, 2)}` : ""
        }`;

    switch (entry.level) {
      case "error":
        console.error(output);
        break;
      case "warn":
        console.warn(output);
        break;
      case "debug":
        console.debug(output);
        break;
      default:
        console.log(output);
    }
  }

  debug(message: string, context?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.output(this.formatMessage("debug", message, context));
    }
  }

  info(message: string, context?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.output(this.formatMessage("info", message, context));
    }
  }

  warn(message: string, context?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.output(this.formatMessage("warn", message, context));
    }
  }

  error(message: string, context?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.output(this.formatMessage("error", message, context));
    }
  }

  // Request-specific logging
  request(
    method: string,
    path: string,
    statusCode: number,
    duration?: number,
    requestId?: string
  ): void {
    const message = `${method} ${path} - ${statusCode}${
      duration ? ` (${duration}ms)` : ""
    }`;
    const context = { method, path, statusCode, duration, requestId };

    if (statusCode >= 500) {
      this.error(message, context);
    } else if (statusCode >= 400) {
      this.warn(message, context);
    } else {
      this.info(message, context);
    }
  }
}

export const logger = new Logger();
export default logger;
