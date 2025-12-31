-- ============================================================================
-- Database Schema for Billiard Management System
-- Optimized for NeonDB (PostgreSQL-compatible serverless database)
-- ============================================================================

-- ============================================================================
-- TABLES
-- ============================================================================

-- Players Table
-- Stores all player information with automatic timestamp tracking
CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT players_name_not_empty CHECK (LENGTH(TRIM(name)) > 0)
);

-- Matches Table
-- Records all billiard match results with winners (supporting multiple), loser, payer, and cost
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    winners INTEGER[] NOT NULL, -- Array of winner player IDs to support draws/multiple winners
    loser_id INTEGER NOT NULL,
    payer_id INTEGER NOT NULL,
    cost DECIMAL(10, 2) NOT NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    participants TEXT[],
    match_result VARCHAR(20) DEFAULT 'win', -- 'win', 'draw', or 'tie' for UI display
    
    -- Foreign key constraints with CASCADE for data integrity
    -- Note: Arrays don't support direct FK constraints, validated in application logic
    CONSTRAINT fk_matches_loser FOREIGN KEY (loser_id) 
        REFERENCES players(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_matches_payer FOREIGN KEY (payer_id) 
        REFERENCES players(id) ON DELETE CASCADE ON UPDATE CASCADE,
    
    -- Business logic constraints
    CONSTRAINT positive_cost CHECK (cost >= 0),
    CONSTRAINT valid_date CHECK (date <= CURRENT_TIMESTAMP + INTERVAL '1 day'),
    CONSTRAINT winners_not_empty CHECK (array_length(winners, 1) > 0)
);

-- Payer Rotation Table
-- Tracks who pays next in the rotation system
CREATE TABLE IF NOT EXISTS payer_rotation (
    id SERIAL PRIMARY KEY,
    current_payer_id INTEGER NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraint
    CONSTRAINT fk_payer_rotation_player FOREIGN KEY (current_payer_id) 
        REFERENCES players(id) ON DELETE CASCADE ON UPDATE CASCADE,
    
    -- Ensure only one rotation record exists
    CONSTRAINT single_rotation_record CHECK (id = 1)
);

-- Match Detailed Stats Table
-- Stores granular win/loss data per player per match session
CREATE TABLE IF NOT EXISTS match_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(match_id, player_id)
);

-- Badges Table
-- Stores all available achievement badges
CREATE TABLE IF NOT EXISTS badges (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    criterion TEXT NOT NULL,
    short_description TEXT NOT NULL,
    icon VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Player Badges Table
-- Junction table tracking which badges have been awarded to which players
CREATE TABLE IF NOT EXISTS player_badges (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    badge_id VARCHAR(50) NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
    awarded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(player_id, badge_id, match_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================
-- Note: NeonDB (serverless PostgreSQL) benefits from selective indexing
-- These indexes are optimized for common query patterns in the application

-- Indexes for matches table to optimize common queries
CREATE INDEX IF NOT EXISTS idx_matches_winners ON matches USING GIN(winners); -- GIN index for array queries
CREATE INDEX IF NOT EXISTS idx_matches_loser ON matches(loser_id);
CREATE INDEX IF NOT EXISTS idx_matches_payer ON matches(payer_id);
CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(date DESC);
CREATE INDEX IF NOT EXISTS idx_matches_created_at ON matches(created_at DESC);

-- Composite index for player statistics queries (optimizes leaderboard)
CREATE INDEX IF NOT EXISTS idx_matches_loser_date ON matches(loser_id, date DESC);

-- Index for player name searches (case-insensitive, optimizes player lookup)
CREATE INDEX IF NOT EXISTS idx_players_name_lower ON players(LOWER(name));

-- Indexes for match_stats to optimize stats aggregation
CREATE INDEX IF NOT EXISTS idx_match_stats_player ON match_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_match_stats_match ON match_stats(match_id);

-- Indexes for player_badges to optimize badge queries
CREATE INDEX IF NOT EXISTS idx_player_badges_player ON player_badges(player_id);
CREATE INDEX IF NOT EXISTS idx_player_badges_badge ON player_badges(badge_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger to update players.updated_at on modification
DROP TRIGGER IF EXISTS update_players_updated_at ON players;
CREATE TRIGGER update_players_updated_at 
    BEFORE UPDATE ON players
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update payer_rotation.updated_at on modification
DROP TRIGGER IF EXISTS update_payer_rotation_updated_at ON payer_rotation;
CREATE TRIGGER update_payer_rotation_updated_at 
    BEFORE UPDATE ON payer_rotation
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Player Statistics View
-- Provides comprehensive statistics for each player
CREATE OR REPLACE VIEW player_stats AS
SELECT 
    p.id,
    p.name,
    COALESCE(ms.wins, 0)::INTEGER as wins,
    COALESCE(ms.losses, 0)::INTEGER as losses,
    COALESCE(spent.total, 0)::DECIMAL(10, 2) as total_spent,
    (COALESCE(ms.wins, 0) + COALESCE(ms.losses, 0))::INTEGER as matches_played,
    CASE 
        WHEN COALESCE(ms.wins, 0) + COALESCE(ms.losses, 0) > 0 
        THEN ROUND(
            (COALESCE(ms.wins, 0)::NUMERIC / 
            (COALESCE(ms.wins, 0) + COALESCE(ms.losses, 0))) * 100, 
            2
        )
        ELSE 0 
    END as win_rate,
    p.created_at,
    p.updated_at
FROM players p
LEFT JOIN (
    SELECT player_id, SUM(wins) as wins, SUM(losses) as losses
    FROM match_stats
    GROUP BY player_id
) ms ON p.id = ms.player_id
LEFT JOIN (
    SELECT payer_id, SUM(cost) as total
    FROM matches
    GROUP BY payer_id
) spent ON p.id = spent.payer_id
ORDER BY wins DESC, win_rate DESC, p.name ASC;

-- Recent Matches View
-- Shows the most recent matches with all player names
CREATE OR REPLACE VIEW recent_matches AS
SELECT 
    m.id,
    m.date,
    ARRAY(
        SELECT pl.name 
        FROM unnest(m.winners) AS winner_id
        JOIN players pl ON pl.id = winner_id
    ) as winners,
    l.name as loser,
    p.name as payer,
    m.cost,
    m.match_result,
    m.created_at
FROM matches m
JOIN players l ON m.loser_id = l.id
JOIN players p ON m.payer_id = p.id
ORDER BY m.date DESC
LIMIT 50;

-- ============================================================================
-- COMMENTS (for database documentation)
-- ============================================================================

COMMENT ON TABLE players IS 'Stores all billiard players in the system';
COMMENT ON TABLE matches IS 'Records all match results with winner, loser, payer and cost';
COMMENT ON TABLE match_stats IS 'Stores granular win/loss data per player per match session';
COMMENT ON TABLE payer_rotation IS 'Tracks the current payer in the rotation system';
COMMENT ON TABLE badges IS 'Stores all available achievement badges';
COMMENT ON TABLE player_badges IS 'Junction table tracking which badges have been awarded to which players';
COMMENT ON VIEW player_stats IS 'Comprehensive statistics for each player including wins, losses, and win rate (aggregated from match_stats)';
COMMENT ON VIEW recent_matches IS 'Most recent 50 matches with player names for quick access';
