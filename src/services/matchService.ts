import sql from '../db';
import type { Match, MatchWithNames, CreateMatchDTO, ExpenseData } from '../types';
import { playerService } from './playerService';

export class MatchService {
    // Get all matches with player names
    async getAllMatches(): Promise<MatchWithNames[]> {
        const matches = await sql<MatchWithNames[]>`
            SELECT 
                m.id,
                w.name as winner,
                l.name as loser,
                p.name as payer,
                m.cost,
                m.date
            FROM matches m
            JOIN players w ON m.winner_id = w.id
            JOIN players l ON m.loser_id = l.id
            JOIN players p ON m.payer_id = p.id
            ORDER BY m.date DESC
        `;
        return matches;
    }

    // Get match by ID
    async getMatchById(id: string): Promise<MatchWithNames | null> {
        const [match] = await sql<MatchWithNames[]>`
            SELECT 
                m.id,
                w.name as winner,
                l.name as loser,
                p.name as payer,
                m.cost,
                m.date
            FROM matches m
            JOIN players w ON m.winner_id = w.id
            JOIN players l ON m.loser_id = l.id
            JOIN players p ON m.payer_id = p.id
            WHERE m.id = ${id}
        `;
        return match || null;
    }

    // Create a new match
    async createMatch(data: CreateMatchDTO): Promise<MatchWithNames> {
        // Get player IDs
        const winner = await playerService.getPlayerByName(data.winner);
        const loser = await playerService.getPlayerByName(data.loser);
        
        if (!winner || !loser) {
            throw new Error('Winner or loser not found');
        }

        if (winner.id === loser.id) {
            throw new Error('Winner and loser must be different players');
        }

        // Get current payer from rotation
        const [rotation] = await sql`
            SELECT current_payer_id FROM payer_rotation LIMIT 1
        `;

        if (!rotation) {
            throw new Error('Payer rotation not initialized');
        }

        const payerId = rotation.current_payer_id;

        // Create the match
        const [match] = await sql<Match[]>`
            INSERT INTO matches (winner_id, loser_id, payer_id, cost)
            VALUES (${winner.id}, ${loser.id}, ${payerId}, ${data.cost})
            RETURNING *
        `;

        if (!match) {
            throw new Error('Failed to create match');
        }

        // Rotate to next payer
        await this.rotateNextPayer();

        // Get the match with names
        const matchWithNames = await this.getMatchById(match.id);
        if (!matchWithNames) {
            throw new Error('Failed to retrieve created match');
        }

        return matchWithNames;
    }

    // Delete a match
    async deleteMatch(id: string): Promise<boolean> {
        const result = await sql`
            DELETE FROM matches WHERE id = ${id}
        `;
        return result.count > 0;
    }

    // Get next payer information
    async getNextPayer(): Promise<{ id: number; name: string }> {
        const [result] = await sql`
            SELECT p.id, p.name
            FROM payer_rotation pr
            JOIN players p ON pr.current_payer_id = p.id
            LIMIT 1
        `;

        if (!result) {
            // Initialize with first player if not set
            const players = await playerService.getAllPlayers();
            if (players.length === 0) {
                throw new Error('No players available');
            }

            const firstPlayer = players[0];
            if (!firstPlayer) {
                throw new Error('No players available');
            }

            await sql`
                INSERT INTO payer_rotation (current_payer_id)
                VALUES (${firstPlayer.id})
            `;

            return { id: firstPlayer.id, name: firstPlayer.name };
        }

        return { id: result.id, name: result.name };
    }

    // Rotate to next payer
    private async rotateNextPayer(): Promise<void> {
        const players = await playerService.getAllPlayers();
        if (players.length === 0) return;

        const currentPayer = await this.getNextPayer();
        const currentIndex = players.findIndex(p => p.id === currentPayer.id);
        const nextIndex = (currentIndex + 1) % players.length;
        const nextPlayer = players[nextIndex];
        
        if (!nextPlayer) {
            throw new Error('Failed to determine next payer');
        }
        
        const nextPayerId = nextPlayer.id;

        await sql`
            UPDATE payer_rotation
            SET current_payer_id = ${nextPayerId},
                updated_at = CURRENT_TIMESTAMP
        `;
    }

    // Get expenses by timeframe
    async getExpenses(timeframe: 'week' | 'month' | 'year' | 'all' = 'month'): Promise<ExpenseData> {
        let dateFilter = sql`TRUE`;

        if (timeframe === 'week') {
            dateFilter = sql`m.date >= NOW() - INTERVAL '7 days'`;
        } else if (timeframe === 'month') {
            dateFilter = sql`EXTRACT(MONTH FROM m.date) = EXTRACT(MONTH FROM NOW()) 
                           AND EXTRACT(YEAR FROM m.date) = EXTRACT(YEAR FROM NOW())`;
        } else if (timeframe === 'year') {
            dateFilter = sql`EXTRACT(YEAR FROM m.date) = EXTRACT(YEAR FROM NOW())`;
        }

        const results = await sql`
            SELECT 
                p.name,
                COALESCE(SUM(m.cost), 0) as total
            FROM players p
            LEFT JOIN matches m ON p.id = m.payer_id AND ${dateFilter}
            GROUP BY p.id, p.name
        `;

        const byPlayer: Record<string, number> = {};
        let total = 0;

        for (const row of results) {
            const amount = parseFloat(row.total.toString());
            byPlayer[row.name] = amount;
            total += amount;
        }

        return { total, byPlayer };
    }

    // Get recent matches (limit)
    async getRecentMatches(limit: number = 10): Promise<MatchWithNames[]> {
        const matches = await sql<MatchWithNames[]>`
            SELECT 
                m.id,
                w.name as winner,
                l.name as loser,
                p.name as payer,
                m.cost,
                m.date
            FROM matches m
            JOIN players w ON m.winner_id = w.id
            JOIN players l ON m.loser_id = l.id
            JOIN players p ON m.payer_id = p.id
            ORDER BY m.date DESC
            LIMIT ${limit}
        `;
        return matches;
    }
}

export const matchService = new MatchService();
