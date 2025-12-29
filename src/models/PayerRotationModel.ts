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
    // Get all players with names
    const players = await sql<{ id: number; name: string }[]>`
            SELECT id, name FROM players
        `;

    if (players.length === 0) {
      throw new Error("No players available for rotation");
    }

    // Define Custom Flow Order
    const flowOrder = ['Hải', 'Toàn', 'Minh'];
    
    // Sort players based on flow order, others at the end
    players.sort((a, b) => {
        const indexA = flowOrder.indexOf(a.name);
        const indexB = flowOrder.indexOf(b.name);
        
        // If both in flow, sort by index
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        // If only A in flow, A comes first
        if (indexA !== -1) return -1;
        // If only B in flow, B comes first
        if (indexB !== -1) return 1;
        // Otherwise sort by name
        return a.name.localeCompare(b.name);
    });

    const currentPayer = await this.getCurrentPayerWithName();
    
    // If no current payer, set to first one (Hải)
    if (!currentPayer) {
      await this.updateCurrentPayer(players[0]!.id);
      return;
    }

    // Find current index and rotate to next
    const currentIndex = players.findIndex((p) => p.name === currentPayer.name);
    
    // If current payer not in list (e.g. name changed), reset to 0
    const validIndex = currentIndex === -1 ? 0 : currentIndex;
    
    const nextIndex = (validIndex + 1) % players.length;
    const nextPlayer = players[nextIndex];

    if (!nextPlayer) {
      throw new Error("Failed to determine next payer");
    }

    await this.updateCurrentPayer(nextPlayer.id);
  }
}
