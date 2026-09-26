-- First-touch campaign tags (utm_*, ref) for sign-ups and subscriptions, so a
-- referral (for example from Tryit) can be credited.
CREATE TABLE "account_attribution" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_term" text,
	"utm_content" text,
	"ref" text,
	"landing_path" text,
	"landed_at" timestamp,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "billing_subscriptions" ADD COLUMN "attribution" jsonb;
