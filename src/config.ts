import "dotenv/config";

interface DatabaseConfig {
  url: string;
  maxConnections: number;
  idleTimeoutMs: number;
}

interface ServerConfig {
  port: number;
  host: string;
  corsOrigin: string | string[];
  isProduction: boolean;
  logLevel: "debug" | "info" | "warn" | "error";
}

interface AppConfig {
  server: ServerConfig;
  database: DatabaseConfig;
  features: {
    autoInitPlayers: boolean;
    defaultPlayers: string[];
  };
}

const validateEnvironment = (): void => {
  const required = ["DATABASE_URL"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
};

const parsePort = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid port number: ${value}`);
  }
  return parsed;
};

const parseCorsOrigin = (value: string | undefined): string | string[] => {
  if (!value || value === "*") return "*";
  return value.split(",").map((origin) => origin.trim());
};

// Validate environment on module load
if (process.env.NODE_ENV !== "test") {
  validateEnvironment();
}

export const config: AppConfig = {
  server: {
    port: parsePort(process.env.PORT, 3000),
    host: process.env.HOST || "0.0.0.0",
    corsOrigin: parseCorsOrigin(process.env.CORS_ORIGIN),
    isProduction: process.env.NODE_ENV === "production",
    logLevel:
      (process.env.LOG_LEVEL as any) ||
      (process.env.NODE_ENV === "production" ? "info" : "debug"),
  },
  database: {
    url: process.env.DATABASE_URL!,
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || "10", 10),
    idleTimeoutMs: parseInt(process.env.DB_IDLE_TIMEOUT || "30000", 10),
  },
  features: {
    autoInitPlayers: process.env.AUTO_INIT_PLAYERS !== "false",
    defaultPlayers: process.env.DEFAULT_PLAYERS?.split(",") || [
      "Minh",
      "Toàn",
      "Hải",
    ],
  },
};

export default config;
