import { PlayerModel } from "./PlayerModel";
import sql from "../db";
import { MatchModel } from "./MatchModel";
import { PayerRotationModel } from "./PayerRotationModel";
import { MatchStatsModel } from "./MatchStatsModel";

export class Migration {
  static async runMigrations(): Promise<void> {
    // console.log("🚀 Starting database migrations...");

    try {
      // Create tables in the correct order (respecting foreign key dependencies)
      await PlayerModel.createTable();
      await MatchModel.createTable();
      await MatchStatsModel.createTable();
      await PayerRotationModel.createTable();

      // Backfill stats
      await MatchStatsModel.backfillFromMatches();

      // Initialize payer rotation if players exist
      const players = await PlayerModel.findAll();
      if (players.length > 0) {
        await PayerRotationModel.initializeWithFirstPlayer();
        // console.log("✅ Payer rotation initialized");
      }

      // console.log("✅ All migrations completed successfully!");
    } catch (error) {
      console.error("❌ Migration failed:", error);
      throw error;
    }
  }

  static async dropAllTables(): Promise<void> {
    console.log("⚠️ Dropping all tables...");

    try {
      // Drop tables in reverse order (to handle foreign key constraints)
      await PayerRotationModel.dropTable();
      await sql`DROP TABLE IF EXISTS match_stats CASCADE`; // MatchStatsModel doesn't have dropTable method yet, using sql directly or add method
      await MatchModel.dropTable();
      await PlayerModel.dropTable();

      console.log("✅ All tables dropped successfully!");
    } catch (error) {
      console.error("❌ Failed to drop tables:", error);
      throw error;
    }
  }

  static async resetDatabase(): Promise<void> {
    await this.dropAllTables();
    await this.runMigrations();
  }
}

export * from "./PlayerModel";
export * from "./MatchModel";
export * from "./PayerRotationModel";
export * from "./MatchStatsModel";
export * from "./BaseModel";
