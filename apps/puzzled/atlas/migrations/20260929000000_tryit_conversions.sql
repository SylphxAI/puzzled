-- Conversions to report back to Tryit (sign-up, first paid invoice). One row per
-- account and event, so each is reported once; the sweep retries rows that are
-- neither reported nor given up. Holds the `ref` only, never anything about the
-- player.
CREATE TABLE "tryit_conversions" (
	"user_id" uuid NOT NULL,
	"event" text NOT NULL,
	"ref" text NOT NULL,
	"occurred_at" timestamp NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp,
	"last_error" text,
	"reported_at" timestamp,
	"gave_up_at" timestamp,
	CONSTRAINT "tryit_conversions_user_id_event_pk" PRIMARY KEY ("user_id", "event"),
	CONSTRAINT "tryit_conversions_event_check" CHECK ("event" IN ('signup', 'purchase'))
);

CREATE INDEX "tryit_conversions_pending_idx" ON "tryit_conversions" ("last_attempt_at")
	WHERE "reported_at" IS NULL AND "gave_up_at" IS NULL;
