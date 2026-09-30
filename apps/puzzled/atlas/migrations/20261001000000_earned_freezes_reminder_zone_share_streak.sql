-- Streak freezes are earned by play, so free players use them too: auto-cover
-- is on by default. Rows written before this migration keep the player's value.
ALTER TABLE "user_freeze_data" ALTER COLUMN "auto_freeze_enabled" SET DEFAULT true;

-- Milestone days that earned a freeze (the 7th, 14th, ... played day of a run).
-- One row per player and day, so a milestone is granted once, ever; "granted"
-- is false when the player already held the most freezes allowed.
CREATE TABLE "streak_freeze_awards" (
	"user_id" uuid NOT NULL,
	"day_key" date NOT NULL,
	"granted" boolean NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "streak_freeze_awards_user_id_day_key_pk" PRIMARY KEY ("user_id", "day_key")
);

-- Missed days a freeze covered. The streak reads these as bridged days.
CREATE TABLE "streak_freeze_uses" (
	"user_id" uuid NOT NULL,
	"day_key" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "streak_freeze_uses_user_id_day_key_pk" PRIMARY KEY ("user_id", "day_key")
);

-- The daily reminder goes out at the player's own time in the player's own
-- time zone (an IANA name such as "Europe/London"; null reads as UTC), once per
-- local day.
ALTER TABLE "notification_preferences" ADD COLUMN "timezone" text;
ALTER TABLE "notification_preferences" ADD COLUMN "last_daily_reminder_on" date;

-- The sharer's streak on the day of a same-day share, so the shared card can
-- show it. A number only; null when the share is of an earlier day.
ALTER TABLE "result_shares" ADD COLUMN "streak" integer;
