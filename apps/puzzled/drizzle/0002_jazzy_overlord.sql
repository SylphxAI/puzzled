CREATE TYPE "public"."streak_type" AS ENUM('game', 'play', 'super');--> statement-breakpoint
CREATE TABLE "user_streaks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "streak_type" NOT NULL,
	"game_id" uuid,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"max_streak" integer DEFAULT 0 NOT NULL,
	"last_played_date" timestamp,
	"freezes_available" integer DEFAULT 0 NOT NULL,
	"freezes_used" integer DEFAULT 0 NOT NULL,
	"auto_freeze_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_streaks" ADD CONSTRAINT "user_streaks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_streaks" ADD CONSTRAINT "user_streaks_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_streaks_user_type_game_idx" ON "user_streaks" USING btree ("user_id","type","game_id");--> statement-breakpoint
CREATE INDEX "user_streaks_user_idx" ON "user_streaks" USING btree ("user_id");