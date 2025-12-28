import sql from "../db";
import { BaseModel } from "./BaseModel";
import type { PayerRotation } from "../types";

export class PayerRotationModel extends BaseModel {
  protected static override tableName = "payer_rotation";

  static override async createTable(): Promise<void> {
    await sql`
            CREATE TABLE IF NOT EXISTS payer_rotation (
                id SERIAL PRIMARY KEY,
                current_payer_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

    console.log("✅ Payer rotation table created successfully");
  }

  static async getCurrentPayer(): Promise<PayerRotation | null> {
    const [rotation] = await sql<PayerRotation[]>`
            SELECT * FROM payer_rotation LIMIT 1
        `;
    return rotation || null;
  }

  static async getCurrentPayerWithName(): Promise<{
    id: number;
    name: string;
  } | null> {
    const [result] = await sql<{ id: number; name: string }[]>`
            SELECT p.id, p.name
            FROM payer_rotation pr
            JOIN players p ON pr.current_payer_id = p.id
            LIMIT 1
        `;
    return result || null;
  }

  static async initializeWithFirstPlayer(): Promise<void> {
    // Check if rotation already exists
    const existing = await this.getCurrentPayer();
    if (existing) return;

    // Get first player
    const [firstPlayer] = await sql<{ id: number }[]>`
            SELECT id FROM players ORDER BY id ASC LIMIT 1
        `;

    if (!firstPlayer) {
      throw new Error("No players available to initialize payer rotation");
    }

    await sql`
            INSERT INTO payer_rotation (current_payer_id)
            VALUES (${firstPlayer.id})
        `;
  }

  static async updateCurrentPayer(payerId: number): Promise<void> {
    const existing = await this.getCurrentPayer();

    if (existing) {
      await sql`
                UPDATE payer_rotation
                SET current_payer_id = ${payerId},
                    updated_at = CURRENT_TIMESTAMP
            `;
    } else {
      await sql`
                INSERT INTO payer_rotation (current_payer_id)
                VALUES (${payerId})
            `;
    }
  }

  static async rotateToNextPayer(): Promise<void> {
    // Get all players
    const players = await sql<{ id: number }[]>`
            SELECT id FROM players ORDER BY id ASC
        `;

    if (players.length === 0) {
      throw new Error("No players available for rotation");
    }

    const currentPayer = await this.getCurrentPayerWithName();
    if (!currentPayer) {
      // Initialize with first player
      await this.updateCurrentPayer(players[0]!.id);
      return;
    }

    // Find current index and rotate to next
    const currentIndex = players.findIndex((p) => p.id === currentPayer.id);
    const nextIndex = (currentIndex + 1) % players.length;
    const nextPlayer = players[nextIndex];

    if (!nextPlayer) {
      throw new Error("Failed to determine next payer");
    }

    await this.updateCurrentPayer(nextPlayer.id);
  }
}
