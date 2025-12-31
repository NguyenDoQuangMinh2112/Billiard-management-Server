import sql from "../db";
import { BaseModel } from "./BaseModel";
import type { Match, MatchWithNames, CreateMatchDTO } from "../types";

export class MatchModel extends BaseModel {
  protected static override tableName = "matches";

  static override async createTable(): Promise<void> {
    await sql`
            CREATE TABLE IF NOT EXISTS matches (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                winner_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
                loser_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
                payer_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
                cost DECIMAL(10, 2) NOT NULL CHECK (cost >= 0),
                date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                participants TEXT[],
                CONSTRAINT different_players CHECK (winner_id != loser_id)
            )
        `;

    // Migration for existing tables: Add participants column
    try {
        await sql`
            ALTER TABLE matches 
            ADD COLUMN IF NOT EXISTS participants TEXT[]
        `;
    } catch (e) {
        // Ignore if column exists or other minor error
        // console.log("Migration note:", e);
    }

    // Create indexes for better performance
    await sql`
            CREATE INDEX IF NOT EXISTS idx_matches_winner ON matches(winner_id)
        `;
    await sql`
            CREATE INDEX IF NOT EXISTS idx_matches_loser ON matches(loser_id)
        `;
    await sql`
            CREATE INDEX IF NOT EXISTS idx_matches_payer ON matches(payer_id)
        `;
    await sql`
            CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(date)
        `;

    // console.log("✅ Matches table created successfully");
  }

  static async findAll(): Promise<MatchWithNames[]> {
    return await sql<MatchWithNames[]>`
            SELECT 
                m.id,
                ARRAY(
                    SELECT pl.name 
                    FROM unnest(m.winners) AS winner_id
                    JOIN players pl ON pl.id = winner_id
                ) as winners,
                l.name as loser,
                p.name as payer,
                m.participants,
                m.cost,
                m.date,
                m.match_result
            FROM matches m
            JOIN players l ON m.loser_id = l.id
            JOIN players p ON m.payer_id = p.id
            ORDER BY m.date DESC
        `;
  }

  static async findById(id: string): Promise<MatchWithNames | null> {
    const [match] = await sql<MatchWithNames[]>`
            SELECT 
                m.id,
                ARRAY(
                    SELECT pl.name 
                    FROM unnest(m.winners) AS winner_id
                    JOIN players pl ON pl.id = winner_id
                ) as winners,
                l.name as loser,
                p.name as payer,
                m.participants,
                m.cost,
                m.date,
                m.match_result
            FROM matches m
            JOIN players l ON m.loser_id = l.id
            JOIN players p ON m.payer_id = p.id
            WHERE m.id = ${id}
        `;
    return match || null;
  }

  static async create(
    winnerNames: string[], // Changed to array to support multiple winners
    loserName: string,
    payerId: number,
    cost: number,
    participants: string[] = []
  ): Promise<Match> {
    // Get winner IDs - support multiple winners
    const winnerIds: number[] = [];
    for (const winnerName of winnerNames) {
      const [winner] = await sql`SELECT id FROM players WHERE name = ${winnerName}`;
      if (!winner) {
        throw new Error(`Winner "${winnerName}" not found`);
      }
      winnerIds.push(winner.id);
    }

    // Get loser ID
    const [loser] = await sql`SELECT id FROM players WHERE name = ${loserName}`;
    if (!loser) {
      throw new Error("Loser not found");
    }

    // Ensure winners don't include the loser
    if (winnerIds.includes(loser.id)) {
      throw new Error("Winners cannot include the loser");
    }

    // Determine match result
    const matchResult = winnerIds.length > 1 ? 'draw' : 'win';

    const [match] = await sql<Match[]>`
            INSERT INTO matches (winners, loser_id, payer_id, cost, participants, match_result)
            VALUES (${winnerIds}, ${loser.id}, ${payerId}, ${cost}, ${participants}, ${matchResult})
            RETURNING *
        `;

    if (!match) {
      throw new Error("Failed to create match");
    }

    return match;
  }

  static async delete(id: string): Promise<boolean> {
    const result = await sql`
            DELETE FROM matches WHERE id = ${id}
        `;
    return result.count > 0;
  }

  static async getRecentMatches(limit: number = 10): Promise<MatchWithNames[]> {
    return await sql<MatchWithNames[]>`
            SELECT 
                m.id,
                ARRAY(
                    SELECT pl.name 
                    FROM unnest(m.winners) AS winner_id
                    JOIN players pl ON pl.id = winner_id
                ) as winners,
                l.name as loser,
                p.name as payer,
                m.participants,
                m.cost,
                m.date,
                m.match_result
            FROM matches m
            JOIN players l ON m.loser_id = l.id
            JOIN players p ON m.payer_id = p.id
            ORDER BY m.date DESC
            LIMIT ${limit}
        `;
  }

  static async getExpensesByTimeframe(
    timeframe: "week" | "month" | "year" | "all" = "month"
  ): Promise<{ total: number; byPlayer: Record<string, number> }> {
    let dateFilter = sql`TRUE`;

    if (timeframe === "week") {
      dateFilter = sql`m.date >= NOW() - INTERVAL '7 days'`;
    } else if (timeframe === "month") {
      dateFilter = sql`EXTRACT(MONTH FROM m.date) = EXTRACT(MONTH FROM NOW()) 
                           AND EXTRACT(YEAR FROM m.date) = EXTRACT(YEAR FROM NOW())`;
    } else if (timeframe === "year") {
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
}
