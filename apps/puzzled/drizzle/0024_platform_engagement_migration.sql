-- Migration: Remove redundant tables that duplicate Platform SDK services
--
-- This migration removes:
-- 1. user_stats - Platform SDK provides leaderboards + computed from game_sessions
-- 2. referrals - Platform SDK useReferral() hook already used in UI
-- 3. feature_flags - Platform SDK useFeatureFlags() provides this
-- 4. Simplifies user_streaks → user_freeze_data (keeps only premium freeze feature)
--
-- The freeze feature (freezesAvailable, autoFreezeEnabled) is a Puzzled-specific
-- premium perk that stays in the app database.

-- ==========================================
-- Step 1: Drop user_stats table
-- (Platform SDK leaderboards + computed from game_sessions)
-- ==========================================

DROP TABLE IF EXISTS user_stats CASCADE;

-- ==========================================
-- Step 2: Drop referrals table
-- (Platform SDK useReferral() already used)
-- ==========================================

DROP TABLE IF EXISTS referrals CASCADE;

-- Drop referral-related enums
DROP TYPE IF EXISTS referral_status CASCADE;
DROP TYPE IF EXISTS referral_reward_type CASCADE;

-- ==========================================
-- Step 3: Drop feature_flags table
-- (Platform SDK useFeatureFlags() provides this)
-- ==========================================

DROP TABLE IF EXISTS feature_flags CASCADE;

-- ==========================================
-- Step 4: Rename user_streaks → user_freeze_data
-- (Keep only freeze-related columns as premium feature)
-- ==========================================

-- Create new simplified table
CREATE TABLE IF NOT EXISTS user_freeze_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  freezes_available INTEGER NOT NULL DEFAULT 0,
  freezes_used INTEGER NOT NULL DEFAULT 0,
  auto_freeze_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index on user_id
CREATE INDEX IF NOT EXISTS user_freeze_data_user_id_idx ON user_freeze_data(user_id);

-- Migrate existing freeze data from user_streaks (if any exists)
INSERT INTO user_freeze_data (id, user_id, freezes_available, freezes_used, auto_freeze_enabled, created_at, updated_at)
SELECT
  gen_random_uuid(),
  user_id,
  COALESCE(MAX(freezes_available), 0),
  COALESCE(MAX(freezes_used), 0),
  COALESCE(BOOL_OR(auto_freeze_enabled), false),
  MIN(created_at),
  MAX(updated_at)
FROM user_streaks
WHERE type = 'play' AND game_slug IS NULL
GROUP BY user_id
ON CONFLICT (user_id) DO NOTHING;

-- Drop old user_streaks table
DROP TABLE IF EXISTS user_streaks CASCADE;

-- Drop streak_type enum (no longer needed)
DROP TYPE IF EXISTS streak_type CASCADE;
