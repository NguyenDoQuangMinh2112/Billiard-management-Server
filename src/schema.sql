-- Database Schema for Billiard Management System

-- Players Table
CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Matches Table
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    winner_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    loser_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    payer_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    cost DECIMAL(10, 2) NOT NULL CHECK (cost >= 0),
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT different_players CHECK (winner_id != loser_id)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_matches_winner ON matches(winner_id);
CREATE INDEX IF NOT EXISTS idx_matches_loser ON matches(loser_id);
CREATE INDEX IF NOT EXISTS idx_matches_payer ON matches(payer_id);
CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(date);

-- Payer Rotation Table (tracks who pays next)
CREATE TABLE IF NOT EXISTS payer_rotation (
    id SERIAL PRIMARY KEY,
    current_payer_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default payer rotation (will be initialized with first player)
-- This will be managed by the application

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for players table
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View for player statistics
CREATE OR REPLACE VIEW player_stats AS
SELECT 
    p.id,
    p.name,
    COALESCE(wins.count, 0) as wins,
    COALESCE(losses.count, 0) as losses,
    COALESCE(spent.total, 0) as total_spent,
    COALESCE(wins.count, 0) + COALESCE(losses.count, 0) as matches_played,
    CASE 
        WHEN COALESCE(wins.count, 0) + COALESCE(losses.count, 0) > 0 
        THEN ROUND(COALESCE(wins.count, 0)::NUMERIC / (COALESCE(wins.count, 0) + COALESCE(losses.count, 0)) * 100, 2)
        ELSE 0 
    END as win_rate
FROM players p
LEFT JOIN (
    SELECT winner_id, COUNT(*) as count
    FROM matches
    GROUP BY winner_id
) wins ON p.id = wins.winner_id
LEFT JOIN (
    SELECT loser_id, COUNT(*) as count
    FROM matches
    GROUP BY loser_id
) losses ON p.id = losses.loser_id
LEFT JOIN (
    SELECT payer_id, SUM(cost) as total
    FROM matches
    GROUP BY payer_id
) spent ON p.id = spent.payer_id
ORDER BY wins DESC, win_rate DESC;
