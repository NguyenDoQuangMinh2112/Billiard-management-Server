-- Migration: Remove Badges System
-- Date: 2026-01-01
-- Description: Drop all badge-related tables and indexes

-- Drop player_badges table (must drop first due to foreign key)
DROP TABLE IF EXISTS player_badges CASCADE;

-- Drop badges table
DROP TABLE IF EXISTS badges CASCADE;

-- Note: Indexes are automatically dropped when tables are dropped
-- This migration removes the entire badge system from the database
