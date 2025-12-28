export enum ErrorCode {
  // Validation Errors
  VALIDATION_ERROR = "VALIDATION_ERROR",
  REQUIRED_FIELD_MISSING = "REQUIRED_FIELD_MISSING",
  INVALID_FORMAT = "INVALID_FORMAT",

  // Business Logic Errors
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
  DUPLICATE_RESOURCE = "DUPLICATE_RESOURCE",
  BUSINESS_RULE_VIOLATION = "BUSINESS_RULE_VIOLATION",

  // Database Errors
  DATABASE_CONNECTION_ERROR = "DATABASE_CONNECTION_ERROR",
  DATABASE_QUERY_ERROR = "DATABASE_QUERY_ERROR",
  DATABASE_CONSTRAINT_ERROR = "DATABASE_CONSTRAINT_ERROR",

  // System Errors
  INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
}

export interface ErrorDetails {
  field?: string;
  value?: any;
  constraint?: string;
  [key: string]: any;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: ErrorDetails;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: ErrorCode,
    statusCode: number = 500,
    details?: ErrorDetails,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

// Specific Error Classes
export class ValidationError extends AppError {
  constructor(message: string, field?: string, value?: any) {
    super(message, ErrorCode.VALIDATION_ERROR, 400, { field, value });
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string | number) {
    super(
      `${resource} not found${
        identifier ? ` with identifier: ${identifier}` : ""
      }`,
      ErrorCode.RESOURCE_NOT_FOUND,
      404,
      { resource, identifier }
    );
  }
}

export class DuplicateError extends AppError {
  constructor(resource: string, field: string, value: any) {
    super(
      `${resource} with ${field} '${value}' already exists`,
      ErrorCode.DUPLICATE_RESOURCE,
      409,
      { resource, field, value }
    );
  }
}

export class BusinessRuleError extends AppError {
  constructor(message: string, rule?: string) {
    super(message, ErrorCode.BUSINESS_RULE_VIOLATION, 422, { rule });
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, originalError?: Error) {
    super(message, ErrorCode.DATABASE_QUERY_ERROR, 500, {
      originalError: originalError?.message,
    });
  }
}
