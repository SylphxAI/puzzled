CREATE TYPE "public"."announcement_type" AS ENUM('info', 'warning', 'success', 'maintenance');
CREATE TYPE "public"."audit_action" AS ENUM('create', 'update', 'delete', 'game_complete', 'streak_update', 'achievement_unlock', 'admin_action');
CREATE TYPE "public"."dlq_status" AS ENUM('pending', 'retrying', 'resolved', 'failed');
CREATE TYPE "public"."game_mode" AS ENUM('daily', 'archive');
CREATE TYPE "public"."game_status" AS ENUM('in_progress', 'won', 'lost', 'abandoned');
CREATE TYPE "public"."puzzle_difficulty" AS ENUM('easy', 'medium', 'hard');
CREATE TYPE "public"."win_back_email_type" AS ENUM('day7', 'day14', 'day30');
CREATE TABLE "announcement_dismissals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"announcement_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"dismissed_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"type" "announcement_type" DEFAULT 'info' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"target_all_users" boolean DEFAULT true NOT NULL,
	"target_premium_only" boolean DEFAULT false NOT NULL,
	"dismissible" boolean DEFAULT true NOT NULL,
	"show_once" boolean DEFAULT false NOT NULL,
	"starts_at" timestamp,
	"ends_at" timestamp,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid
);

CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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

CREATE TABLE "daily_puzzles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_slug" text NOT NULL,
	"puzzle_date" timestamp NOT NULL,
	"puzzle_data" jsonb NOT NULL,
	"solution" jsonb,
	"difficulty" "puzzle_difficulty",
	"seed" integer,
	"generator_version" text DEFAULT 'v1.0',
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "dead_letter_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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

CREATE TABLE "game_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"game_slug" text NOT NULL,
	"puzzle_id" uuid,
	"puzzle_date" timestamp,
	"difficulty" "puzzle_difficulty",
	"mode" "game_mode" DEFAULT 'daily' NOT NULL,
	"archive_date" timestamp,
	"status" "game_status" DEFAULT 'in_progress' NOT NULL,
	"state" jsonb,
	"score" integer,
	"attempts" integer DEFAULT 0 NOT NULL,
	"time_spent_ms" integer,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);

CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"push_enabled" boolean DEFAULT true NOT NULL,
	"push_daily_reminder" boolean DEFAULT true NOT NULL,
	"push_streak_alert" boolean DEFAULT true NOT NULL,
	"push_new_games" boolean DEFAULT true NOT NULL,
	"daily_reminder_time" text DEFAULT '09:00',
	"email_enabled" boolean DEFAULT true NOT NULL,
	"email_weekly_digest" boolean DEFAULT true NOT NULL,
	"email_marketing" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_user_id_unique" UNIQUE("user_id")
);

CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);

CREATE TABLE "user_display_cache" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"email" text,
	"display_name" text,
	"avatar_url" text,
	"cached_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "user_freeze_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"freezes_available" integer DEFAULT 0 NOT NULL,
	"freezes_used" integer DEFAULT 0 NOT NULL,
	"auto_freeze_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_freeze_data_user_id_unique" UNIQUE("user_id")
);

CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"leaderboard_visible" boolean DEFAULT true NOT NULL,
	"compact_mode" boolean DEFAULT false NOT NULL,
	"locale" text DEFAULT 'en-US',
	"username" text,
	"bio" text,
	"is_public_profile" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_username_unique" UNIQUE("username")
);

CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"event_created_at" timestamp NOT NULL,
	"processed_at" timestamp DEFAULT now() NOT NULL,
	"resource_id" text,
	CONSTRAINT "webhook_events_event_id_unique" UNIQUE("event_id")
);

CREATE TABLE "win_back_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"email_type" "win_back_email_type" NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"promotion_code" text,
	"user_returned" boolean DEFAULT false,
	"returned_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "announcement_dismissals" ADD CONSTRAINT "announcement_dismissals_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_puzzle_id_daily_puzzles_id_fk" FOREIGN KEY ("puzzle_id") REFERENCES "public"."daily_puzzles"("id") ON DELETE set null ON UPDATE no action;
CREATE UNIQUE INDEX "announcement_dismissals_unique_idx" ON "announcement_dismissals" USING btree ("announcement_id","user_id");
CREATE INDEX "audit_logs_user_idx" ON "audit_logs" USING btree ("user_id");
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_id");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs" USING btree ("resource_type","resource_id");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");
CREATE UNIQUE INDEX "daily_puzzles_game_date_difficulty_idx" ON "daily_puzzles" USING btree ("game_slug","puzzle_date","difficulty");
CREATE INDEX "daily_puzzles_date_idx" ON "daily_puzzles" USING btree ("puzzle_date");
CREATE INDEX "daily_puzzles_game_slug_idx" ON "daily_puzzles" USING btree ("game_slug");
CREATE INDEX "dlq_workflow_name_idx" ON "dead_letter_queue" USING btree ("workflow_name");
CREATE INDEX "dlq_status_idx" ON "dead_letter_queue" USING btree ("status");
CREATE INDEX "dlq_created_at_idx" ON "dead_letter_queue" USING btree ("created_at");
CREATE INDEX "game_sessions_user_idx" ON "game_sessions" USING btree ("user_id");
CREATE INDEX "game_sessions_game_slug_idx" ON "game_sessions" USING btree ("game_slug");
CREATE UNIQUE INDEX "game_sessions_user_puzzle_idx" ON "game_sessions" USING btree ("user_id","puzzle_id");
CREATE INDEX "game_sessions_date_idx" ON "game_sessions" USING btree ("puzzle_date");
CREATE INDEX "game_sessions_user_game_slug_date_mode_idx" ON "game_sessions" USING btree ("user_id","game_slug","puzzle_date","mode");
CREATE INDEX "game_sessions_difficulty_idx" ON "game_sessions" USING btree ("difficulty");
CREATE INDEX "game_sessions_completed_at_idx" ON "game_sessions" USING btree ("completed_at");
CREATE INDEX "game_sessions_status_idx" ON "game_sessions" USING btree ("status");
CREATE INDEX "game_sessions_archive_date_idx" ON "game_sessions" USING btree ("archive_date");
CREATE INDEX "game_sessions_game_slug_status_completed_idx" ON "game_sessions" USING btree ("game_slug","status","completed_at");
CREATE INDEX "game_sessions_game_slug_completed_idx" ON "game_sessions" USING btree ("game_slug","completed_at");
CREATE INDEX "push_subscriptions_user_idx" ON "push_subscriptions" USING btree ("user_id");
CREATE INDEX "user_freeze_data_user_id_idx" ON "user_freeze_data" USING btree ("user_id");
CREATE INDEX "user_preferences_leaderboard_visible_idx" ON "user_preferences" USING btree ("leaderboard_visible");
CREATE INDEX "webhook_events_event_idx" ON "webhook_events" USING btree ("event_id");
CREATE INDEX "webhook_events_resource_created_idx" ON "webhook_events" USING btree ("resource_id","event_created_at");
CREATE INDEX "win_back_emails_user_idx" ON "win_back_emails" USING btree ("user_id");
CREATE INDEX "win_back_emails_type_idx" ON "win_back_emails" USING btree ("email_type");
CREATE INDEX "win_back_emails_sent_at_idx" ON "win_back_emails" USING btree ("sent_at");
CREATE UNIQUE INDEX "win_back_emails_user_type_idx" ON "win_back_emails" USING btree ("user_id","email_type");
