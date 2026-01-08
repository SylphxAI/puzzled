-- Migration: Eliminate games table, use gameSlug (TEXT) as identifier
-- This is the SSOT architecture change: Code registry is the sole source of truth
--
-- Step 1: Add gameSlug columns to tables that reference games
-- Step 2: Populate gameSlug from games.slug via join
-- Step 2.5: Validate data integrity before constraints
-- Step 3: Make gameSlug NOT NULL and create indexes
-- Step 4: Drop old indexes and foreign keys
-- Step 5: Drop gameId columns
-- Step 6: Drop games table

-- ============================================================
-- STEP 1: Add gameSlug columns (nullable initially)
-- Using DO blocks for idempotency
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_puzzles' AND column_name = 'game_slug') THEN
    ALTER TABLE "daily_puzzles" ADD COLUMN "game_slug" text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'game_sessions' AND column_name = 'game_slug') THEN
    ALTER TABLE "game_sessions" ADD COLUMN "game_slug" text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_stats' AND column_name = 'game_slug') THEN
    ALTER TABLE "user_stats" ADD COLUMN "game_slug" text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_streaks' AND column_name = 'game_slug') THEN
    ALTER TABLE "user_streaks" ADD COLUMN "game_slug" text;
  END IF;
END $$;

-- ============================================================
-- STEP 2: Populate gameSlug from games table
-- Only update rows where game_slug is NULL (idempotent)
-- ============================================================

UPDATE "daily_puzzles" dp
SET "game_slug" = g.slug
FROM "games" g
WHERE dp."game_id" = g.id AND dp."game_slug" IS NULL;

UPDATE "game_sessions" gs
SET "game_slug" = g.slug
FROM "games" g
WHERE gs."game_id" = g.id AND gs."game_slug" IS NULL;

UPDATE "user_stats" us
SET "game_slug" = g.slug
FROM "games" g
WHERE us."game_id" = g.id AND us."game_slug" IS NULL;

-- userStreaks.gameId can be NULL for play/super streaks
UPDATE "user_streaks" ust
SET "game_slug" = g.slug
FROM "games" g
WHERE ust."game_id" = g.id AND ust."game_slug" IS NULL;

-- ============================================================
-- STEP 2.5: Validate data integrity before constraints
-- Fail fast if there are orphaned references
-- ============================================================

DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  -- Only check if game_id column still exists (hasn't been dropped yet)
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_puzzles' AND column_name = 'game_id') THEN

    SELECT COUNT(*) INTO orphan_count FROM daily_puzzles WHERE game_slug IS NULL;
    IF orphan_count > 0 THEN
      RAISE EXCEPTION 'Migration failed: % daily_puzzles rows have NULL game_slug. Check for orphaned game_id references.', orphan_count;
    END IF;
  END IF;
END $$;

DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'game_sessions' AND column_name = 'game_id') THEN

    SELECT COUNT(*) INTO orphan_count FROM game_sessions WHERE game_slug IS NULL;
    IF orphan_count > 0 THEN
      RAISE EXCEPTION 'Migration failed: % game_sessions rows have NULL game_slug. Check for orphaned game_id references.', orphan_count;
    END IF;
  END IF;
END $$;

DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_stats' AND column_name = 'game_id') THEN

    SELECT COUNT(*) INTO orphan_count FROM user_stats WHERE game_slug IS NULL;
    IF orphan_count > 0 THEN
      RAISE EXCEPTION 'Migration failed: % user_stats rows have NULL game_slug. Check for orphaned game_id references.', orphan_count;
    END IF;
  END IF;
END $$;

-- user_streaks can have NULL game_slug for play/super streaks, so we only check
-- for rows that had a game_id but didn't get a game_slug (true orphans)
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_streaks' AND column_name = 'game_id') THEN

    SELECT COUNT(*) INTO orphan_count FROM user_streaks
    WHERE game_id IS NOT NULL AND game_slug IS NULL;
    IF orphan_count > 0 THEN
      RAISE EXCEPTION 'Migration failed: % user_streaks rows have game_id but NULL game_slug. Check for orphaned game_id references.', orphan_count;
    END IF;
  END IF;
END $$;

-- ============================================================
-- STEP 3: Make gameSlug NOT NULL (where applicable) and create indexes
-- Using DO blocks for idempotency on constraints
-- ============================================================

-- daily_puzzles: gameSlug must be NOT NULL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_puzzles' AND column_name = 'game_slug' AND is_nullable = 'YES') THEN
    ALTER TABLE "daily_puzzles" ALTER COLUMN "game_slug" SET NOT NULL;
  END IF;
END $$;

-- game_sessions: gameSlug must be NOT NULL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'game_sessions' AND column_name = 'game_slug' AND is_nullable = 'YES') THEN
    ALTER TABLE "game_sessions" ALTER COLUMN "game_slug" SET NOT NULL;
  END IF;
END $$;

-- user_stats: gameSlug must be NOT NULL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_stats' AND column_name = 'game_slug' AND is_nullable = 'YES') THEN
    ALTER TABLE "user_stats" ALTER COLUMN "game_slug" SET NOT NULL;
  END IF;
END $$;

-- user_streaks: gameSlug can be NULL (for play/super streaks that apply to all games)
-- Already nullable, no change needed

-- Create indexes for gameSlug (using IF NOT EXISTS for idempotency)
CREATE INDEX IF NOT EXISTS "daily_puzzles_game_slug_idx" ON "daily_puzzles" ("game_slug");
CREATE UNIQUE INDEX IF NOT EXISTS "daily_puzzles_game_slug_date_idx" ON "daily_puzzles" ("game_slug", "puzzle_date");
CREATE INDEX IF NOT EXISTS "game_sessions_game_slug_idx" ON "game_sessions" ("game_slug");
CREATE INDEX IF NOT EXISTS "game_sessions_user_game_slug_date_mode_idx" ON "game_sessions" ("user_id", "game_slug", "puzzle_date", "mode");
CREATE INDEX IF NOT EXISTS "game_sessions_game_slug_status_completed_idx" ON "game_sessions" ("game_slug", "status", "completed_at");
CREATE INDEX IF NOT EXISTS "game_sessions_game_slug_completed_idx" ON "game_sessions" ("game_slug", "completed_at");
CREATE UNIQUE INDEX IF NOT EXISTS "user_stats_user_game_slug_idx" ON "user_stats" ("user_id", "game_slug");
CREATE INDEX IF NOT EXISTS "user_stats_game_slug_idx" ON "user_stats" ("game_slug");
CREATE INDEX IF NOT EXISTS "user_stats_streak_idx" ON "user_stats" ("current_streak");
-- user_streaks: Use partial unique indexes to handle NULL game_slug correctly
-- PostgreSQL allows multiple NULLs in UNIQUE indexes, so we need two partial indexes:
-- 1. For game-specific streaks (game_slug IS NOT NULL)
-- 2. For global play/super streaks (game_slug IS NULL) - only one per user+type
CREATE UNIQUE INDEX IF NOT EXISTS "user_streaks_user_type_game_slug_idx"
  ON "user_streaks" ("user_id", "type", "game_slug")
  WHERE "game_slug" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "user_streaks_user_type_global_idx"
  ON "user_streaks" ("user_id", "type")
  WHERE "game_slug" IS NULL;

-- ============================================================
-- STEP 4: Drop old indexes (before dropping columns they reference)
-- ============================================================

DROP INDEX IF EXISTS "daily_puzzles_game_date_idx";
DROP INDEX IF EXISTS "game_sessions_game_idx";
DROP INDEX IF EXISTS "game_sessions_user_game_date_mode_idx";
DROP INDEX IF EXISTS "game_sessions_game_status_completed_idx";
DROP INDEX IF EXISTS "game_sessions_game_completed_idx";
DROP INDEX IF EXISTS "user_stats_user_game_idx";
DROP INDEX IF EXISTS "user_streaks_user_type_game_idx";

-- ============================================================
-- STEP 5: Drop gameId columns (cascades foreign key constraints)
-- Using IF EXISTS for idempotency
-- ============================================================

ALTER TABLE "daily_puzzles" DROP COLUMN IF EXISTS "game_id";
ALTER TABLE "game_sessions" DROP COLUMN IF EXISTS "game_id";
ALTER TABLE "user_stats" DROP COLUMN IF EXISTS "game_id";
ALTER TABLE "user_streaks" DROP COLUMN IF EXISTS "game_id";

-- ============================================================
-- STEP 6: Drop games table
-- ============================================================

DROP TABLE IF EXISTS "games";
