-- A player's shared daily result, addressed by an unguessable id. The share
-- link carries this id as `ref`, so a landing, a sign-up and a subscription can
-- be credited to the share that brought them (account_attribution.ref). Only the
-- facts the result card already shows are stored: never a solution or a grid.
CREATE TABLE "result_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"game_slug" text NOT NULL,
	"day_key" text NOT NULL,
	"difficulty" text,
	"status" text NOT NULL,
	"attempts" integer NOT NULL,
	"score" integer,
	"time_spent_ms" integer,
	"share_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_shared_at" timestamp DEFAULT now() NOT NULL
);

-- One share per player, module and product day; a second tap reuses the row.
CREATE UNIQUE INDEX "result_shares_user_game_day_uidx" ON "result_shares" ("user_id", "game_slug", "day_key");
