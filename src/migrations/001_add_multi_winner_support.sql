-- Migration Script: Add Multi-Winner Support
-- This script migrates the existing matches table to support multiple winners

-- Step 1: Add new columns
ALTER TABLE matches ADD COLUMN IF NOT EXISTS winners INTEGER[];
ALTER TABLE matches ADD COLUMN IF NOT EXISTS match_result VARCHAR(20) DEFAULT 'win';

-- Step 2: Populate winners array from existing winner_id
-- This assumes you have an existing winner_id column
UPDATE matches 
SET winners = ARRAY[winner_id]
WHERE winners IS NULL AND winner_id IS NOT NULL;

-- Step 3: Set match_result for existing matches (all are single winner)
UPDATE matches 
SET match_result = 'win'
WHERE match_result IS NULL;

-- Step 4: Drop old foreign key constraint (if exists)
ALTER TABLE matches DROP CONSTRAINT IF EXISTS fk_matches_winner;

-- Step 5: Drop old winner_id column
ALTER TABLE matches DROP COLUMN IF EXISTS winner_id;

-- Step 6: Drop old index
DROP INDEX IF EXISTS idx_matches_winner;
DROP INDEX IF EXISTS idx_matches_winner_date;

-- Step 7: Create new GIN index for array queries
CREATE INDEX IF NOT EXISTS idx_matches_winners ON matches USING GIN(winners);

-- Step 8: Add constraint to ensure winners array is not empty
ALTER TABLE matches DROP CONSTRAINT IF EXISTS winners_not_empty;
ALTER TABLE matches ADD CONSTRAINT winners_not_empty CHECK (array_length(winners, 1) > 0);

-- Step 9: Drop old different_players constraint (no longer applicable)
ALTER TABLE matches DROP CONSTRAINT IF EXISTS different_players;

-- Verify migration
SELECT 
    COUNT(*) as total_matches,
    COUNT(CASE WHEN match_result = 'win' THEN 1 END) as single_winner_matches,
    COUNT(CASE WHEN match_result = 'draw' THEN 1 END) as draw_matches,
    COUNT(CASE WHEN array_length(winners, 1) > 1 THEN 1 END) as multi_winner_matches
FROM matches;
