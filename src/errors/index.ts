import { AppError, ErrorCode } from "./AppError";
import config from "../config";

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId?: string;
  };
}

export class ErrorHandler {
  static handle(error: Error, requestId?: string): ErrorResponse {
    const timestamp = new Date().toISOString();

    // Log error
    if (config.server.logLevel === "debug" || !config.server.isProduction) {
      console.error("Error occurred:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
        requestId,
        timestamp,
      });
    }

    // Handle known application errors
    if (error instanceof AppError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: config.server.isProduction ? undefined : error.details,
          timestamp,
          requestId,
        },
      };
    }

    // Handle database constraint errors
    if (this.isDatabaseConstraintError(error)) {
      return this.handleDatabaseConstraintError(error, requestId, timestamp);
    }

    // Handle generic errors
    return {
      success: false,
      error: {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message: config.server.isProduction
          ? "An unexpected error occurred"
          : error.message,
        timestamp,
        requestId,
      },
    };
  }

  private static isDatabaseConstraintError(error: Error): boolean {
    return (
      error.message.includes("duplicate key") ||
      error.message.includes("violates") ||
      error.message.includes("constraint")
    );
  }

  private static handleDatabaseConstraintError(
    error: Error,
    requestId: string | undefined,
    timestamp: string
  ): ErrorResponse {
    let message = "Database constraint violation";
    let code = ErrorCode.DATABASE_CONSTRAINT_ERROR;

    if (error.message.includes("duplicate key")) {
      message = "Resource already exists";
      code = ErrorCode.DUPLICATE_RESOURCE;
    } else if (error.message.includes("foreign key")) {
      message = "Referenced resource does not exist";
      code = ErrorCode.RESOURCE_NOT_FOUND;
    }

    return {
      success: false,
      error: {
        code,
        message,
        details: config.server.isProduction
          ? undefined
          : { originalMessage: error.message },
        timestamp,
        requestId,
      },
    };
  }
}

export * from "./AppError";
