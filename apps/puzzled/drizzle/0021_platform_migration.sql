-- Migration: Platform Architecture - Remove Auth/Billing, Add Platform-Compatible Tables
--
-- ARCHITECTURE: Platform (Sylphx) owns Identity, Auth, Billing, Sessions, Security
-- Apps store ONLY business data. User references use userId (UUID) without FK constraint.
--
-- This migration:
-- 1. Drops FK constraints to users table
-- 2. Drops auth/billing tables (platform handles these)
-- 3. Creates new platform-compatible tables
-- 4. Drops obsolete enums
-- 5. Creates new enums

-- ============================================================
-- STEP 1: Drop Foreign Key Constraints
-- We keep the columns but remove FKs since platform owns users
-- ============================================================

-- Drop FKs from tables that reference users
ALTER TABLE "game_sessions" DROP CONSTRAINT IF EXISTS "game_sessions_user_id_users_id_fk";
ALTER TABLE "user_stats" DROP CONSTRAINT IF EXISTS "user_stats_user_id_users_id_fk";
ALTER TABLE "notification_preferences" DROP CONSTRAINT IF EXISTS "notification_preferences_user_id_users_id_fk";
ALTER TABLE "push_subscriptions" DROP CONSTRAINT IF EXISTS "push_subscriptions_user_id_users_id_fk";
ALTER TABLE "announcement_dismissals" DROP CONSTRAINT IF EXISTS "announcement_dismissals_user_id_users_id_fk";
ALTER TABLE "announcements" DROP CONSTRAINT IF EXISTS "announcements_created_by_users_id_fk";
ALTER TABLE "feature_flags" DROP CONSTRAINT IF EXISTS "feature_flags_created_by_users_id_fk";

-- ============================================================
-- STEP 2: Drop Auth/Billing Tables (Platform Handles These)
-- Order matters due to FK dependencies
-- ============================================================

-- First drop tables that have FKs to users
DROP TABLE IF EXISTS "accounts" CASCADE;
DROP TABLE IF EXISTS "sessions" CASCADE;
DROP TABLE IF EXISTS "verifications" CASCADE;
DROP TABLE IF EXISTS "login_history" CASCADE;
DROP TABLE IF EXISTS "email_change_requests" CASCADE;
DROP TABLE IF EXISTS "security_alerts" CASCADE;
DROP TABLE IF EXISTS "verification_codes" CASCADE;
DROP TABLE IF EXISTS "two_factors" CASCADE;

-- Drop billing tables
DROP TABLE IF EXISTS "billing_transactions" CASCADE;
DROP TABLE IF EXISTS "plan_prices" CASCADE;
DROP TABLE IF EXISTS "subscriptions" CASCADE;
DROP TABLE IF EXISTS "plans" CASCADE;

-- Finally drop the users table
DROP TABLE IF EXISTS "users" CASCADE;

-- ============================================================
-- STEP 3: Create New Enums
-- ============================================================

-- Streak types for enhanced streak system
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'streak_type') THEN
    CREATE TYPE "public"."streak_type" AS ENUM('game', 'play', 'super');
  END IF;
END $$;

-- Game mode: daily or archive
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'game_mode') THEN
    CREATE TYPE "public"."game_mode" AS ENUM('daily', 'archive');
  END IF;
END $$;

-- Referral tracking status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'referral_status') THEN
    CREATE TYPE "public"."referral_status" AS ENUM('pending', 'completed', 'expired');
  END IF;
END $$;

-- Referral reward types
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'referral_reward_type') THEN
    CREATE TYPE "public"."referral_reward_type" AS ENUM('streak_freeze', 'premium_trial', 'points');
  END IF;
END $$;

-- Win-back email sequence types
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'win_back_email_type') THEN
    CREATE TYPE "public"."win_back_email_type" AS ENUM('day7', 'day14', 'day30');
  END IF;
END $$;

-- Dead letter queue status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dlq_status') THEN
    CREATE TYPE "public"."dlq_status" AS ENUM('pending', 'retrying', 'resolved', 'failed');
  END IF;
END $$;

-- Audit log action types
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_action') THEN
    CREATE TYPE "public"."audit_action" AS ENUM('create', 'update', 'delete', 'game_complete', 'streak_update', 'achievement_unlock', 'admin_action');
  END IF;
END $$;

-- ============================================================
-- STEP 4: Add game_mode Column to game_sessions
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'game_sessions' AND column_name = 'mode') THEN
    ALTER TABLE "game_sessions" ADD COLUMN "mode" "game_mode" DEFAULT 'daily' NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'game_sessions' AND column_name = 'archive_date') THEN
    ALTER TABLE "game_sessions" ADD COLUMN "archive_date" timestamp;
  END IF;
END $$;

-- Add index for archive_date if not exists
CREATE INDEX IF NOT EXISTS "game_sessions_archive_date_idx" ON "game_sessions" ("archive_date");

-- ============================================================
-- STEP 5: Create New Tables
-- ============================================================

-- User Preferences (App-Specific Settings)
CREATE TABLE IF NOT EXISTS "user_preferences" (
  "user_id" uuid PRIMARY KEY,
  "leaderboard_visible" boolean DEFAULT true NOT NULL,
  "compact_mode" boolean DEFAULT false NOT NULL,
  "username" text UNIQUE,
  "bio" text,
  "is_public_profile" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "user_preferences_leaderboard_visible_idx" ON "user_preferences" ("leaderboard_visible");

-- User Display Cache (For Leaderboards)
CREATE TABLE IF NOT EXISTS "user_display_cache" (
  "user_id" uuid PRIMARY KEY,
  "display_name" text,
  "avatar_url" text,
  "cached_at" timestamp DEFAULT now() NOT NULL
);

-- User Streaks (Enhanced Streak System)
CREATE TABLE IF NOT EXISTS "user_streaks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "type" "streak_type" NOT NULL,
  "game_slug" text,
  "current_streak" integer DEFAULT 0 NOT NULL,
  "max_streak" integer DEFAULT 0 NOT NULL,
  "last_played_date" timestamp,
  "freezes_available" integer DEFAULT 0 NOT NULL,
  "freezes_used" integer DEFAULT 0 NOT NULL,
  "auto_freeze_enabled" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Partial unique indexes for proper NULL handling
CREATE UNIQUE INDEX IF NOT EXISTS "user_streaks_user_type_game_slug_idx"
  ON "user_streaks" ("user_id", "type", "game_slug")
  WHERE "game_slug" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "user_streaks_user_type_global_idx"
  ON "user_streaks" ("user_id", "type")
  WHERE "game_slug" IS NULL;

CREATE INDEX IF NOT EXISTS "user_streaks_user_idx" ON "user_streaks" ("user_id");

-- Referrals
CREATE TABLE IF NOT EXISTS "referrals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "referrer_id" uuid NOT NULL,
  "referred_user_id" uuid,
  "referral_code" text NOT NULL,
  "status" "referral_status" DEFAULT 'pending' NOT NULL,
  "reward_type" "referral_reward_type" DEFAULT 'streak_freeze' NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp
);

CREATE INDEX IF NOT EXISTS "referrals_referrer_idx" ON "referrals" ("referrer_id");
CREATE INDEX IF NOT EXISTS "referrals_referred_user_idx" ON "referrals" ("referred_user_id");
CREATE INDEX IF NOT EXISTS "referrals_code_idx" ON "referrals" ("referral_code");
CREATE INDEX IF NOT EXISTS "referrals_status_idx" ON "referrals" ("status");
CREATE UNIQUE INDEX IF NOT EXISTS "referrals_referred_user_unique_idx" ON "referrals" ("referred_user_id");

-- Win-Back Emails
CREATE TABLE IF NOT EXISTS "win_back_emails" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "email_type" "win_back_email_type" NOT NULL,
  "sent_at" timestamp DEFAULT now() NOT NULL,
  "promotion_code" text,
  "user_returned" boolean DEFAULT false,
  "returned_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "win_back_emails_user_idx" ON "win_back_emails" ("user_id");
CREATE INDEX IF NOT EXISTS "win_back_emails_type_idx" ON "win_back_emails" ("email_type");
CREATE INDEX IF NOT EXISTS "win_back_emails_sent_at_idx" ON "win_back_emails" ("sent_at");
CREATE UNIQUE INDEX IF NOT EXISTS "win_back_emails_user_type_idx" ON "win_back_emails" ("user_id", "email_type");

-- Audit Logs
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid,
  "actor_id" uuid,
  "action" "audit_action" NOT NULL,
  "resource_type" text NOT NULL,
  "resource_id" text,
  "metadata" jsonb,
  "ip_address" text,
  "user_agent" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "audit_logs_user_idx" ON "audit_logs" ("user_id");
CREATE INDEX IF NOT EXISTS "audit_logs_actor_idx" ON "audit_logs" ("actor_id");
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs" ("action");
CREATE INDEX IF NOT EXISTS "audit_logs_resource_idx" ON "audit_logs" ("resource_type", "resource_id");
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs" ("created_at");

-- Dead Letter Queue
CREATE TABLE IF NOT EXISTS "dead_letter_queue" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workflow_name" text NOT NULL,
  "workflow_run_id" text,
  "payload" jsonb,
  "error" text NOT NULL,
  "error_stack" text,
  "status" "dlq_status" DEFAULT 'pending' NOT NULL,
  "retry_count" integer DEFAULT 0 NOT NULL,
  "max_retries" integer DEFAULT 3 NOT NULL,
  "last_retry_at" timestamp,
  "resolved_at" timestamp,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "dlq_workflow_name_idx" ON "dead_letter_queue" ("workflow_name");
CREATE INDEX IF NOT EXISTS "dlq_status_idx" ON "dead_letter_queue" ("status");
CREATE INDEX IF NOT EXISTS "dlq_created_at_idx" ON "dead_letter_queue" ("created_at");

-- Webhook Events (Idempotency)
-- Drop old webhook_events table (had different schema: stripe_event_id instead of event_id)
DROP TABLE IF EXISTS "webhook_events" CASCADE;
CREATE TABLE IF NOT EXISTS "webhook_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_id" text NOT NULL UNIQUE,
  "event_type" text NOT NULL,
  "event_created_at" timestamp NOT NULL,
  "processed_at" timestamp DEFAULT now() NOT NULL,
  "resource_id" text
);

CREATE INDEX IF NOT EXISTS "webhook_events_event_idx" ON "webhook_events" ("event_id");
CREATE INDEX IF NOT EXISTS "webhook_events_resource_created_idx" ON "webhook_events" ("resource_id", "event_created_at");

-- App Settings (Key-Value Store)
CREATE TABLE IF NOT EXISTS "app_settings" (
  "key" text PRIMARY KEY,
  "value" jsonb NOT NULL,
  "description" text,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "updated_by" uuid
);

-- ============================================================
-- STEP 6: Drop Obsolete Enums
-- ============================================================

DROP TYPE IF EXISTS "billing_interval" CASCADE;
DROP TYPE IF EXISTS "subscription_plan" CASCADE;
DROP TYPE IF EXISTS "subscription_status" CASCADE;
DROP TYPE IF EXISTS "security_alert_type" CASCADE;
DROP TYPE IF EXISTS "verification_code_type" CASCADE;

-- ============================================================
-- STEP 7: Add total_score Index for Leaderboard Queries
-- ============================================================

CREATE INDEX IF NOT EXISTS "user_stats_total_score_idx" ON "user_stats" ("total_score");
