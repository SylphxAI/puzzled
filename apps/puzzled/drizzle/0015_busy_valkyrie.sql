ALTER TABLE "game_sessions" ALTER COLUMN "mode" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "game_sessions" ALTER COLUMN "mode" SET DEFAULT 'daily'::text;--> statement-breakpoint
DROP TYPE "public"."game_mode";--> statement-breakpoint
CREATE TYPE "public"."game_mode" AS ENUM('daily', 'archive');--> statement-breakpoint
ALTER TABLE "game_sessions" ALTER COLUMN "mode" SET DEFAULT 'daily'::"public"."game_mode";--> statement-breakpoint
ALTER TABLE "game_sessions" ALTER COLUMN "mode" SET DATA TYPE "public"."game_mode" USING "mode"::"public"."game_mode";--> statement-breakpoint
ALTER TABLE "daily_puzzles" ADD COLUMN "seed" integer;--> statement-breakpoint
ALTER TABLE "daily_puzzles" ADD COLUMN "generator_version" text DEFAULT 'v1.0';