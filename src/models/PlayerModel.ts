import sql from "../db";
import { BaseModel } from "./BaseModel";
import { NotFoundError, ValidationError, DuplicateError } from "../errors";
import { logger } from "../utils/logger";
import type { Player, CreatePlayerDTO } from "../types";

export class PlayerModel extends BaseModel {
  protected static override tableName = "players";

  static override async createTable(): Promise<void> {
    try {
      await sql`
                CREATE TABLE IF NOT EXISTS players (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(100) NOT NULL UNIQUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `;

      await sql`
                CREATE OR REPLACE FUNCTION update_updated_at_column()
                RETURNS TRIGGER AS $$
                BEGIN
                    NEW.updated_at = CURRENT_TIMESTAMP;
                    RETURN NEW;
                END;
                $$ language 'plpgsql'
            `;

      await sql`DROP TRIGGER IF EXISTS update_players_updated_at ON players`;
      await sql`
                CREATE TRIGGER update_players_updated_at 
                BEFORE UPDATE ON players
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
            `;

      // logger.info("Players table created successfully");
    } catch (error) {
      this.handleDatabaseError(error, "create table");
    }
  }

  static async findAll(): Promise<Player[]> {
    try {
      return await sql<
        Player[]
      >`SELECT * FROM players ORDER BY created_at DESC`;
    } catch (error) {
      return this.handleDatabaseError(error, "find all players");
    }
  }

  static async findById(id: number): Promise<Player | null> {
    try {
      const [player] = await sql<
        Player[]
      >`SELECT * FROM players WHERE id = ${id}`;
      return player || null;
    } catch (error) {
      return this.handleDatabaseError(error, "find player by id");
    }
  }

  static async findByName(name: string): Promise<Player | null> {
    try {
      const [player] = await sql<
        Player[]
      >`SELECT * FROM players WHERE name = ${name}`;
      return player || null;
    } catch (error) {
      return this.handleDatabaseError(error, "find player by name");
    }
  }

  static async create(data: CreatePlayerDTO): Promise<Player> {
    try {
      // Check if player already exists
      const existing = await this.findByName(data.name);
      if (existing) {
        throw new DuplicateError("Player", "name", data.name);
      }

      const [player] = await sql<Player[]>`
                INSERT INTO players (name) VALUES (${data.name}) RETURNING *
            `;

      if (!player) {
        throw new Error("Failed to create player");
      }

      logger.info("Player created successfully", {
        id: player.id,
        name: player.name,
      });
      return player;
    } catch (error) {
      if (error instanceof DuplicateError) throw error;
      return this.handleDatabaseError(error, "create player");
    }
  }

  static async update(
    id: number,
    data: Partial<CreatePlayerDTO>
  ): Promise<Player> {
    try {
      const existing = await this.findById(id);
      if (!existing) {
        throw new NotFoundError("Player", id);
      }

      if (data.name && data.name !== existing.name) {
        const nameConflict = await this.findByName(data.name);
        if (nameConflict) {
          throw new DuplicateError("Player", "name", data.name);
        }
      }

      if (!data.name) {
        return existing; // Nothing to update
      }

      const [player] = await sql<Player[]>`
                UPDATE players 
                SET name = ${data.name}
                WHERE id = ${id}
                RETURNING *
            `;

      if (!player) {
        throw new NotFoundError("Player", id);
      }

      logger.info("Player updated successfully", {
        id: player.id,
        name: player.name,
      });
      return player;
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof DuplicateError)
        throw error;
      return this.handleDatabaseError(error, "update player");
    }
  }

  static async delete(id: number): Promise<boolean> {
    try {
      const existing = await this.findById(id);
      if (!existing) {
        return false;
      }

      const result = await sql`DELETE FROM players WHERE id = ${id}`;
      const deleted = result.count > 0;

      if (deleted) {
        logger.info("Player deleted successfully", { id, name: existing.name });
      }

      return deleted;
    } catch (error) {
      return this.handleDatabaseError(error, "delete player");
    }
  }

  static async exists(id: number): Promise<boolean> {
    try {
      const player = await this.findById(id);
      return player !== null;
    } catch (error) {
      return this.handleDatabaseError(error, "check player existence");
    }
  }

  static async count(): Promise<number> {
    try {
      const [result] = await sql<
        [{ count: string }]
      >`SELECT COUNT(*) as count FROM players`;
      return parseInt(result.count, 10);
    } catch (error) {
      return this.handleDatabaseError(error, "count players");
    }
  }
}
