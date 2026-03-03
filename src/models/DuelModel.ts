import sql from "../db";
import type {
  DuelPlayer,
  DuelPlayerStats,
  DuelSession,
  DuelSessionSummary,
  DuelRound,
} from "../types";

export class DuelModel {
  // ── Table setup ──────────────────────────────────────────────────────────────

  static async createTables(): Promise<void> {
    // duel_players
    await sql`
      CREATE TABLE IF NOT EXISTS duel_players (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT duel_players_name_not_empty CHECK (LENGTH(TRIM(name)) > 0)
      )
    `;

    // duel_sessions
    await sql`
      CREATE TABLE IF NOT EXISTS duel_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        player1_id INTEGER NOT NULL REFERENCES duel_players(id) ON DELETE CASCADE,
        player2_id INTEGER NOT NULL REFERENCES duel_players(id) ON DELETE CASCADE,
        total_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
        payer_type VARCHAR(10) NOT NULL DEFAULT 'player1',
        payer_id INTEGER REFERENCES duel_players(id) ON DELETE SET NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP WITH TIME ZONE,
        CONSTRAINT different_duel_players CHECK (player1_id != player2_id),
        CONSTRAINT valid_total_cost CHECK (total_cost >= 0),
        CONSTRAINT valid_payer_type CHECK (payer_type IN ('player1', 'player2', 'split')),
        CONSTRAINT valid_status CHECK (status IN ('active', 'completed'))
      )
    `;

    // duel_rounds
    await sql`
      CREATE TABLE IF NOT EXISTS duel_rounds (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES duel_sessions(id) ON DELETE CASCADE,
        winner_id INTEGER REFERENCES duel_players(id) ON DELETE SET NULL,
        player1_wins INTEGER NOT NULL DEFAULT 0,
        player1_losses INTEGER NOT NULL DEFAULT 0,
        player2_wins INTEGER NOT NULL DEFAULT 0,
        player2_losses INTEGER NOT NULL DEFAULT 0,
        cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
        payer_type VARCHAR(10) NOT NULL DEFAULT 'player1',
        payer_id INTEGER REFERENCES duel_players(id) ON DELETE SET NULL,
        result VARCHAR(10) NOT NULL DEFAULT 'win',
        played_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT valid_round_cost CHECK (cost >= 0),
        CONSTRAINT valid_round_payer_type CHECK (payer_type IN ('player1', 'player2', 'split')),
        CONSTRAINT valid_round_result CHECK (result IN ('win', 'draw')),
        CONSTRAINT non_negative_scores CHECK (
          player1_wins >= 0 AND player1_losses >= 0 AND
          player2_wins >= 0 AND player2_losses >= 0
        )
      )
    `;

    // Indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_duel_sessions_player1 ON duel_sessions(player1_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_duel_sessions_player2 ON duel_sessions(player2_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_duel_sessions_created_at ON duel_sessions(created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_duel_sessions_status ON duel_sessions(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_duel_rounds_session ON duel_rounds(session_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_duel_rounds_winner ON duel_rounds(winner_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_duel_rounds_played_at ON duel_rounds(played_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_duel_players_name ON duel_players(LOWER(name))`;
  }

  // ── DuelPlayer ───────────────────────────────────────────────────────────────

  static async findOrCreatePlayer(name: string): Promise<DuelPlayer> {
    const trimmed = name.trim();
    const [existing] = await sql<DuelPlayer[]>`
      SELECT * FROM duel_players WHERE LOWER(name) = LOWER(${trimmed}) LIMIT 1
    `;
    if (existing) return existing;

    const [created] = await sql<DuelPlayer[]>`
      INSERT INTO duel_players (name) VALUES (${trimmed}) RETURNING *
    `;
    if (!created) throw new Error(`Failed to create duel player: ${trimmed}`);
    return created;
  }

  static async getAllPlayers(): Promise<DuelPlayerStats[]> {
    return await sql<DuelPlayerStats[]>`
      SELECT
        dp.id,
        dp.name,
        COALESCE(wins.total, 0)::INTEGER          AS total_wins,
        COALESCE(losses.total, 0)::INTEGER         AS total_losses,
        COALESCE(spent.total, 0)::DECIMAL(10,2)    AS total_spent,
        (COALESCE(wins.total, 0) + COALESCE(losses.total, 0))::INTEGER AS rounds_played,
        CASE
          WHEN COALESCE(wins.total, 0) + COALESCE(losses.total, 0) > 0
          THEN ROUND(
            COALESCE(wins.total, 0)::NUMERIC /
            (COALESCE(wins.total, 0) + COALESCE(losses.total, 0)) * 100, 2
          )
          ELSE 0
        END AS win_rate,
        dp.created_at
      FROM duel_players dp
      LEFT JOIN (
        SELECT winner_id AS player_id, COUNT(*) AS total
        FROM duel_rounds WHERE winner_id IS NOT NULL
        GROUP BY winner_id
      ) wins ON dp.id = wins.player_id
      LEFT JOIN (
        SELECT lost.player_id, COUNT(*) AS total FROM (
          SELECT s.player1_id AS player_id FROM duel_rounds r
          JOIN duel_sessions s ON r.session_id = s.id
          WHERE r.winner_id IS NOT NULL AND r.winner_id != s.player1_id
          UNION ALL
          SELECT s.player2_id AS player_id FROM duel_rounds r
          JOIN duel_sessions s ON r.session_id = s.id
          WHERE r.winner_id IS NOT NULL AND r.winner_id != s.player2_id
        ) lost GROUP BY player_id
      ) losses ON dp.id = losses.player_id
      LEFT JOIN (
        SELECT payer_id AS player_id, SUM(cost) AS total FROM duel_rounds
        WHERE payer_id IS NOT NULL AND payer_type != 'split'
        GROUP BY payer_id
      ) spent ON dp.id = spent.player_id
      ORDER BY total_wins DESC, win_rate DESC
    `;
  }

  // ── DuelSession ──────────────────────────────────────────────────────────────

  static async createSession(
    player1Id: number,
    player2Id: number,
  ): Promise<DuelSession> {
    const [session] = await sql<DuelSession[]>`
      INSERT INTO duel_sessions (player1_id, player2_id)
      VALUES (${player1Id}, ${player2Id})
      RETURNING *
    `;
    if (!session) throw new Error("Failed to create duel session");
    return session as DuelSession;
  }

  static async getSessions(limit = 20): Promise<DuelSessionSummary[]> {
    return await sql<DuelSessionSummary[]>`
      SELECT
        s.id, s.status, s.total_cost, s.payer_type, s.created_at, s.ended_at,
        p1.id AS player1_id, p1.name AS player1_name,
        p2.id AS player2_id, p2.name AS player2_name,
        COALESCE(SUM(CASE WHEN r.winner_id = s.player1_id THEN 1 ELSE 0 END), 0)::INTEGER AS player1_session_wins,
        COALESCE(SUM(CASE WHEN r.winner_id = s.player2_id THEN 1 ELSE 0 END), 0)::INTEGER AS player2_session_wins,
        COALESCE(COUNT(r.id), 0)::INTEGER AS total_rounds
      FROM duel_sessions s
      JOIN duel_players p1 ON s.player1_id = p1.id
      JOIN duel_players p2 ON s.player2_id = p2.id
      LEFT JOIN duel_rounds r ON r.session_id = s.id
      GROUP BY s.id, p1.id, p1.name, p2.id, p2.name
      ORDER BY s.created_at DESC
      LIMIT ${limit}
    `;
  }

  static async getSessionById(id: string): Promise<DuelSessionSummary | null> {
    const [session] = await sql<DuelSessionSummary[]>`
      SELECT
        s.id, s.status, s.total_cost, s.payer_type, s.created_at, s.ended_at,
        p1.id AS player1_id, p1.name AS player1_name,
        p2.id AS player2_id, p2.name AS player2_name,
        COALESCE(SUM(CASE WHEN r.winner_id = s.player1_id THEN 1 ELSE 0 END), 0)::INTEGER AS player1_session_wins,
        COALESCE(SUM(CASE WHEN r.winner_id = s.player2_id THEN 1 ELSE 0 END), 0)::INTEGER AS player2_session_wins,
        COALESCE(COUNT(r.id), 0)::INTEGER AS total_rounds
      FROM duel_sessions s
      JOIN duel_players p1 ON s.player1_id = p1.id
      JOIN duel_players p2 ON s.player2_id = p2.id
      LEFT JOIN duel_rounds r ON r.session_id = s.id
      WHERE s.id = ${id}
      GROUP BY s.id, p1.id, p1.name, p2.id, p2.name
    `;
    return session ?? null;
  }

  static async completeSession(
    id: string,
    totalCost: number,
    payerType: "player1" | "player2" | "split",
    payerId: number | null,
  ): Promise<DuelSession> {
    const [updated] = await sql<DuelSession[]>`
      UPDATE duel_sessions
      SET
        status = 'completed',
        total_cost = ${totalCost},
        payer_type = ${payerType},
        payer_id = ${payerId},
        ended_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;
    if (!updated) throw new Error(`Duel session not found: ${id}`);
    return updated as DuelSession;
  }

  static async deleteSession(id: string): Promise<void> {
    await sql`DELETE FROM duel_sessions WHERE id = ${id}`;
  }

  // ── DuelRound ────────────────────────────────────────────────────────────────

  static async addRound(
    sessionId: string,
    winnerId: number | null,
    player1Wins: number,
    player1Losses: number,
    player2Wins: number,
    player2Losses: number,
    cost: number,
    payerType: "player1" | "player2" | "split",
    payerId: number | null,
  ): Promise<DuelRound> {
    const result = winnerId === null ? "draw" : "win";

    const [round] = await sql<DuelRound[]>`
      INSERT INTO duel_rounds (
        session_id, winner_id,
        player1_wins, player1_losses,
        player2_wins, player2_losses,
        cost, payer_type, payer_id, result
      ) VALUES (
        ${sessionId}, ${winnerId},
        ${player1Wins}, ${player1Losses},
        ${player2Wins}, ${player2Losses},
        ${cost}, ${payerType}, ${payerId}, ${result}
      )
      RETURNING *
    `;
    if (!round) throw new Error("Failed to create duel round");
    return round as DuelRound;
  }

  static async getRoundsBySession(sessionId: string): Promise<DuelRound[]> {
    return await sql<DuelRound[]>`
      SELECT * FROM duel_rounds
      WHERE session_id = ${sessionId}
      ORDER BY played_at ASC
    `;
  }

  static async deleteRound(id: string): Promise<void> {
    await sql`DELETE FROM duel_rounds WHERE id = ${id}`;
  }

  // ── Leaderboard ───────────────────────────────────────────────────────────────

  static async getLeaderboard(limit = 20): Promise<DuelPlayerStats[]> {
    return await sql<DuelPlayerStats[]>`
      SELECT
        dp.id,
        dp.name,
        COALESCE(wins.total, 0)::INTEGER          AS total_wins,
        COALESCE(losses.total, 0)::INTEGER         AS total_losses,
        COALESCE(spent.total, 0)::DECIMAL(10,2)    AS total_spent,
        (COALESCE(wins.total, 0) + COALESCE(losses.total, 0))::INTEGER AS rounds_played,
        COALESCE(sessions_count.total, 0)::INTEGER  AS sessions_played,
        CASE
          WHEN COALESCE(wins.total, 0) + COALESCE(losses.total, 0) > 0
          THEN ROUND(
            COALESCE(wins.total, 0)::NUMERIC /
            (COALESCE(wins.total, 0) + COALESCE(losses.total, 0)) * 100, 2
          )
          ELSE 0
        END AS win_rate,
        dp.created_at
      FROM duel_players dp
      LEFT JOIN (
        SELECT winner_id AS player_id, COUNT(*) AS total
        FROM duel_rounds WHERE winner_id IS NOT NULL
        GROUP BY winner_id
      ) wins ON dp.id = wins.player_id
      LEFT JOIN (
        SELECT lost.player_id, COUNT(*) AS total FROM (
          SELECT s.player1_id AS player_id FROM duel_rounds r
          JOIN duel_sessions s ON r.session_id = s.id
          WHERE r.winner_id IS NOT NULL AND r.winner_id != s.player1_id
          UNION ALL
          SELECT s.player2_id AS player_id FROM duel_rounds r
          JOIN duel_sessions s ON r.session_id = s.id
          WHERE r.winner_id IS NOT NULL AND r.winner_id != s.player2_id
        ) lost GROUP BY player_id
      ) losses ON dp.id = losses.player_id
      LEFT JOIN (
        SELECT payer_id AS player_id, SUM(cost) AS total FROM duel_rounds
        WHERE payer_id IS NOT NULL AND payer_type != 'split'
        GROUP BY payer_id
      ) spent ON dp.id = spent.player_id
      LEFT JOIN (
        SELECT player_id, COUNT(*) AS total FROM (
          SELECT player1_id AS player_id FROM duel_sessions WHERE status = 'completed'
          UNION ALL
          SELECT player2_id AS player_id FROM duel_sessions WHERE status = 'completed'
        ) sc GROUP BY player_id
      ) sessions_count ON dp.id = sessions_count.player_id
      WHERE (COALESCE(wins.total, 0) + COALESCE(losses.total, 0)) > 0
      ORDER BY total_wins DESC, win_rate DESC
      LIMIT ${limit}
    `;
  }

  // ── History (completed sessions only) ────────────────────────────────────────

  static async getHistory(limit = 50): Promise<DuelSessionSummary[]> {
    return await sql<DuelSessionSummary[]>`
      SELECT
        s.id, s.status, s.total_cost, s.payer_type, s.created_at, s.ended_at,
        p1.id AS player1_id, p1.name AS player1_name,
        p2.id AS player2_id, p2.name AS player2_name,
        pay.name AS payer_name,
        COALESCE(SUM(CASE WHEN r.winner_id = s.player1_id THEN 1 ELSE 0 END), 0)::INTEGER AS player1_session_wins,
        COALESCE(SUM(CASE WHEN r.winner_id = s.player2_id THEN 1 ELSE 0 END), 0)::INTEGER AS player2_session_wins,
        COALESCE(COUNT(r.id), 0)::INTEGER AS total_rounds
      FROM duel_sessions s
      JOIN duel_players p1 ON s.player1_id = p1.id
      JOIN duel_players p2 ON s.player2_id = p2.id
      LEFT JOIN duel_players pay ON s.payer_id = pay.id
      LEFT JOIN duel_rounds r ON r.session_id = s.id
      WHERE s.status = 'completed'
      GROUP BY s.id, p1.id, p1.name, p2.id, p2.name, pay.name
      ORDER BY s.ended_at DESC
      LIMIT ${limit}
    `;
  }
}
