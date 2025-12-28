import postgres from "postgres";
import config from "./config";

export interface DatabaseClient {
  query: postgres.Sql;
  healthCheck: () => Promise<boolean>;
  close: () => Promise<void>;
}

class Database implements DatabaseClient {
  public readonly query: postgres.Sql;
  private static instance: Database;

  private constructor() {
    this.query = postgres(config.database.url, {
      max: config.database.maxConnections,
      idle_timeout: config.database.idleTimeoutMs,
      connect_timeout: 10,
      prepare: false,
      onnotice: config.server.isProduction ? undefined : console.log,
      debug: config.server.logLevel === "debug",
    });
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.query`SELECT 1 as health`;
      return true;
    } catch (error) {
      console.error("Database health check failed:", error);
      return false;
    }
  }

  async close(): Promise<void> {
    await this.query.end();
  }
}

const database = Database.getInstance();
export const sql = database.query;
export default sql;
