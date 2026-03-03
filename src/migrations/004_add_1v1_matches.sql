-- ============================================================================
-- Migration 004: Add 1v1 Match Tables
-- Creates standalone tables for head-to-head (1v1) matches, completely
-- independent of the existing 3-player tournament system.
-- ============================================================================

-- 1v1 Players Table
-- Stores ad-hoc player names for 1v1 sessions (no relation to 3P players table)
CREATE TABLE IF NOT EXISTS duel_players (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT duel_players_name_not_empty CHECK (LENGTH(TRIM(name)) > 0)
);

-- 1v1 Sessions Table
-- A session groups multiple rounds played by the same two players
CREATE TABLE IF NOT EXISTS duel_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player1_id INTEGER NOT NULL REFERENCES duel_players(id) ON DELETE CASCADE,
    player2_id INTEGER NOT NULL REFERENCES duel_players(id) ON DELETE CASCADE,
    total_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
    payer_type VARCHAR(10) NOT NULL DEFAULT 'player1',  -- 'player1', 'player2', 'split'
    payer_id INTEGER REFERENCES duel_players(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',       -- 'active', 'completed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT different_duel_players CHECK (player1_id != player2_id),
    CONSTRAINT valid_total_cost CHECK (total_cost >= 0),
    CONSTRAINT valid_payer_type CHECK (payer_type IN ('player1', 'player2', 'split')),
    CONSTRAINT valid_status CHECK (status IN ('active', 'completed'))
);

-- 1v1 Rounds Table
-- Each round is a single game within a session
CREATE TABLE IF NOT EXISTS duel_rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES duel_sessions(id) ON DELETE CASCADE,
    winner_id INTEGER REFERENCES duel_players(id) ON DELETE SET NULL,  -- NULL = draw
    player1_wins INTEGER NOT NULL DEFAULT 0,
    player1_losses INTEGER NOT NULL DEFAULT 0,
    player2_wins INTEGER NOT NULL DEFAULT 0,
    player2_losses INTEGER NOT NULL DEFAULT 0,
    cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
    payer_type VARCHAR(10) NOT NULL DEFAULT 'player1',  -- 'player1', 'player2', 'split'
    payer_id INTEGER REFERENCES duel_players(id) ON DELETE SET NULL,
    result VARCHAR(10) NOT NULL DEFAULT 'win',          -- 'win', 'draw'
    played_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_round_cost CHECK (cost >= 0),
    CONSTRAINT valid_round_payer_type CHECK (payer_type IN ('player1', 'player2', 'split')),
    CONSTRAINT valid_round_result CHECK (result IN ('win', 'draw')),
    CONSTRAINT non_negative_scores CHECK (
        player1_wins >= 0 AND player1_losses >= 0 AND
        player2_wins >= 0 AND player2_losses >= 0
    )
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_duel_sessions_player1 ON duel_sessions(player1_id);
CREATE INDEX IF NOT EXISTS idx_duel_sessions_player2 ON duel_sessions(player2_id);
CREATE INDEX IF NOT EXISTS idx_duel_sessions_created_at ON duel_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_duel_sessions_status ON duel_sessions(status);

CREATE INDEX IF NOT EXISTS idx_duel_rounds_session ON duel_rounds(session_id);
CREATE INDEX IF NOT EXISTS idx_duel_rounds_winner ON duel_rounds(winner_id);
CREATE INDEX IF NOT EXISTS idx_duel_rounds_played_at ON duel_rounds(played_at DESC);

CREATE INDEX IF NOT EXISTS idx_duel_players_name ON duel_players(LOWER(name));

-- ============================================================================
-- TRIGGER: auto-update updated_at on duel_players
-- ============================================================================

DROP TRIGGER IF EXISTS update_duel_players_updated_at ON duel_players;
CREATE TRIGGER update_duel_players_updated_at
    BEFORE UPDATE ON duel_players
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEW: duel_session_summary
-- Aggregated view of each session with player names, scores, and cost
-- ============================================================================

CREATE OR REPLACE VIEW duel_session_summary AS
SELECT
    s.id,
    s.status,
    s.total_cost,
    s.payer_type,
    s.created_at,
    s.ended_at,

    p1.id   AS player1_id,
    p1.name AS player1_name,
    p2.id   AS player2_id,
    p2.name AS player2_name,

    COALESCE(SUM(CASE WHEN r.winner_id = s.player1_id THEN 1 ELSE 0 END), 0)::INTEGER AS player1_session_wins,
    COALESCE(SUM(CASE WHEN r.winner_id = s.player2_id THEN 1 ELSE 0 END), 0)::INTEGER AS player2_session_wins,
    COALESCE(COUNT(r.id), 0)::INTEGER AS total_rounds

FROM duel_sessions s
JOIN duel_players p1 ON s.player1_id = p1.id
JOIN duel_players p2 ON s.player2_id = p2.id
LEFT JOIN duel_rounds r ON r.session_id = s.id
GROUP BY s.id, p1.id, p1.name, p2.id, p2.name
ORDER BY s.created_at DESC;

-- ============================================================================
-- VIEW: duel_player_stats
-- Overall stats per 1v1 player across all sessions
-- ============================================================================

CREATE OR REPLACE VIEW duel_player_stats AS
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
    FROM duel_rounds
    WHERE winner_id IS NOT NULL
    GROUP BY winner_id
) wins ON dp.id = wins.player_id
LEFT JOIN (
    SELECT s.player1_id AS player_id, COUNT(*) AS total
    FROM duel_rounds r
    JOIN duel_sessions s ON r.session_id = s.id
    WHERE r.winner_id IS NOT NULL AND r.winner_id != s.player1_id
    GROUP BY s.player1_id
    UNION ALL
    SELECT s.player2_id AS player_id, COUNT(*) AS total
    FROM duel_rounds r
    JOIN duel_sessions s ON r.session_id = s.id
    WHERE r.winner_id IS NOT NULL AND r.winner_id != s.player2_id
    GROUP BY s.player2_id
) losses ON dp.id = losses.player_id
LEFT JOIN (
    SELECT payer_id, SUM(cost) AS total
    FROM duel_rounds
    WHERE payer_id IS NOT NULL AND payer_type != 'split'
    GROUP BY payer_id
) spent ON dp.id = spent.player_id
ORDER BY total_wins DESC, win_rate DESC;
