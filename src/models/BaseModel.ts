import sql from "../db";
import { DatabaseError, NotFoundError } from "../errors";
import { logger } from "../utils/logger";

export abstract class BaseModel {
  protected static tableName: string;

  static async createTable(): Promise<void> {
    throw new Error("createTable method must be implemented by subclass");
  }

  static async dropTable(): Promise<void> {
    try {
      await sql`DROP TABLE IF EXISTS ${sql(this.tableName)} CASCADE`;
      logger.info(`Table ${this.tableName} dropped successfully`);
    } catch (error) {
      logger.error(`Failed to drop table ${this.tableName}`, { error });
      throw new DatabaseError(
        `Failed to drop table ${this.tableName}`,
        error as Error
      );
    }
  }

  static async tableExists(): Promise<boolean> {
    try {
      const result = await sql`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = ${this.tableName}
                );
            `;
      return result[0]?.exists || false;
    } catch (error) {
      logger.error(`Failed to check table existence for ${this.tableName}`, {
        error,
      });
      throw new DatabaseError(
        `Failed to check table existence for ${this.tableName}`,
        error as Error
      );
    }
  }

  protected static handleDatabaseError(error: any, operation: string): never {
    logger.error(`Database error during ${operation}`, {
      error: error.message,
      table: this.tableName,
      operation,
    });

    if (error.code === "23505") {
      // Unique violation
      throw new DatabaseError(`Duplicate entry in ${this.tableName}`, error);
    }

    if (error.code === "23503") {
      // Foreign key violation
      throw new DatabaseError(
        `Foreign key constraint violation in ${this.tableName}`,
        error
      );
    }

    throw new DatabaseError(`Database operation failed: ${operation}`, error);
  }
}
