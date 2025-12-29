import sql from "../db";

export class MatchStatsModel {
  static async createTable(): Promise<void> {
    await sql`
            CREATE TABLE IF NOT EXISTS match_stats (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
                player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
                wins INTEGER DEFAULT 0,
                losses INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(match_id, player_id)
            )
        `;

    // Index for faster stats aggregation
    await sql`
            CREATE INDEX IF NOT EXISTS idx_match_stats_player ON match_stats(player_id)
        `;
        
    // console.log("✅ MatchStats table created successfully");
  }

  static async addStats(matchId: string, playerId: number, wins: number, losses: number): Promise<void> {
    await sql`
            INSERT INTO match_stats (match_id, player_id, wins, losses)
            VALUES (${matchId}, ${playerId}, ${wins}, ${losses})
            ON CONFLICT (match_id, player_id) 
            DO UPDATE SET wins = ${wins}, losses = ${losses}
        `;
  }
  
  static async backfillFromMatches(): Promise<void> {
    // Check if empty
    const count = await sql`SELECT COUNT(*) FROM match_stats`;
    if (count[0].count > 0) return;

    // Backfill Winners (1 Win, 0 Loss)
    await sql`
        INSERT INTO match_stats (match_id, player_id, wins, losses)
        SELECT id, winner_id, 1, 0 FROM matches
    `;

    // Backfill Losers (0 Win, 1 Loss)
    await sql`
        INSERT INTO match_stats (match_id, player_id, wins, losses)
        SELECT id, loser_id, 0, 1 FROM matches
    `;
    
    // console.log("✅ Backfilled match_stats from matches");
  }
}
