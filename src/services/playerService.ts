import sql from '../db';
import type { Player, CreatePlayerDTO, PlayerStats } from '../types';

export class PlayerService {
    // Get all players
    async getAllPlayers(): Promise<Player[]> {
        const players = await sql<Player[]>`
            SELECT * FROM players ORDER BY created_at ASC
        `;
        return players;
    }

    // Get player by ID
    async getPlayerById(id: number): Promise<Player | null> {
        const [player] = await sql<Player[]>`
            SELECT * FROM players WHERE id = ${id}
        `;
        return player || null;
    }

    // Get player by name
    async getPlayerByName(name: string): Promise<Player | null> {
        const [player] = await sql<Player[]>`
            SELECT * FROM players WHERE name = ${name}
        `;
        return player || null;
    }

    // Create a new player
    async createPlayer(data: CreatePlayerDTO): Promise<Player> {
        const [player] = await sql<Player[]>`
            INSERT INTO players (name)
            VALUES (${data.name})
            RETURNING *
        `;
        
        if (!player) {
            throw new Error('Failed to create player');
        }
        
        // Initialize payer rotation if this is the first player
        const payerRotation = await sql`
            SELECT * FROM payer_rotation LIMIT 1
        `;
        
        if (payerRotation.length === 0) {
            await sql`
                INSERT INTO payer_rotation (current_payer_id)
                VALUES (${player.id})
            `;
        }
        
        return player;
    }

    // Delete a player
    async deletePlayer(id: number): Promise<boolean> {
        const result = await sql`
            DELETE FROM players WHERE id = ${id}
        `;
        return result.count > 0;
    }

    // Get all player statistics
    async getAllStats(): Promise<PlayerStats[]> {
        const stats = await sql<PlayerStats[]>`
            SELECT * FROM player_stats
        `;
        return stats;
    }

    // Get statistics for a specific player
    async getPlayerStats(id: number): Promise<PlayerStats | null> {
        const [stats] = await sql<PlayerStats[]>`
            SELECT * FROM player_stats WHERE id = ${id}
        `;
        return stats || null;
    }

    // Initialize default players (Minh, Toàn, Hải)
    async initializeDefaultPlayers(): Promise<void> {
        const defaultPlayers = ['Minh', 'Toàn', 'Hải'];
        
        for (const name of defaultPlayers) {
            const existing = await this.getPlayerByName(name);
            if (!existing) {
                await this.createPlayer({ name });
            }
        }
    }
}

export const playerService = new PlayerService();
