-- Migration: Add puzzle difficulty support
-- Games can now have selectable difficulty levels (easy, medium, hard)
--
-- Changes:
-- 1. Create puzzle_difficulty enum
-- 2. Add difficulty column to daily_puzzles (nullable for backward compatibility)
-- 3. Add difficulty column to game_sessions (nullable for backward compatibility)
-- 4. Update unique index on daily_puzzles to include difficulty
-- 5. Add index on game_sessions.difficulty

-- ============================================================
-- STEP 1: Create puzzle_difficulty enum
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'puzzle_difficulty') THEN
    CREATE TYPE "public"."puzzle_difficulty" AS ENUM('easy', 'medium', 'hard');
  END IF;
END $$;

-- ============================================================
-- STEP 2: Add difficulty column to daily_puzzles
-- Nullable to support games without difficulty levels
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_puzzles' AND column_name = 'difficulty') THEN
    ALTER TABLE "daily_puzzles" ADD COLUMN "difficulty" "puzzle_difficulty";
  END IF;
END $$;

-- Drop old integer difficulty column if it exists (from legacy schema)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_puzzles' AND column_name = 'difficulty'
    AND data_type = 'integer') THEN
    ALTER TABLE "daily_puzzles" DROP COLUMN "difficulty";
    ALTER TABLE "daily_puzzles" ADD COLUMN "difficulty" "puzzle_difficulty";
  END IF;
END $$;

-- ============================================================
-- STEP 3: Add difficulty column to game_sessions
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'game_sessions' AND column_name = 'difficulty') THEN
    ALTER TABLE "game_sessions" ADD COLUMN "difficulty" "puzzle_difficulty";
  END IF;
END $$;

-- ============================================================
-- STEP 4: Update unique index on daily_puzzles
-- Now includes difficulty for games with difficulty levels
-- ============================================================

-- Drop old unique index
DROP INDEX IF EXISTS "daily_puzzles_game_slug_date_idx";

-- Create new unique index that includes difficulty
-- This allows:
-- - One puzzle per game per date for games WITHOUT difficulty (difficulty = NULL)
-- - One puzzle per game per date per difficulty for games WITH difficulty
CREATE UNIQUE INDEX IF NOT EXISTS "daily_puzzles_game_date_difficulty_idx"
  ON "daily_puzzles" ("game_slug", "puzzle_date", "difficulty");

-- ============================================================
-- STEP 5: Add index on game_sessions.difficulty
-- ============================================================

CREATE INDEX IF NOT EXISTS "game_sessions_difficulty_idx"
  ON "game_sessions" ("difficulty");
