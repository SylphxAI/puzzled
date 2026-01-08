CREATE TYPE "public"."game_mode" AS ENUM('daily', 'practice', 'archive');--> statement-breakpoint
ALTER TABLE "game_sessions" ADD COLUMN "mode" "game_mode" DEFAULT 'daily' NOT NULL;--> statement-breakpoint
ALTER TABLE "game_sessions" ADD COLUMN "archive_date" timestamp;--> statement-breakpoint
CREATE INDEX "game_sessions_user_game_date_mode_idx" ON "game_sessions" USING btree ("user_id","game_id","puzzle_date","mode");