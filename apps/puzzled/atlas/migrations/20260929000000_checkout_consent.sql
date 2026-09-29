-- The buyer's immediate-supply consent, one row per checkout started through
-- Sylphx Money: they asked for access now and understood the 14-day
-- cancellation right is lost. The id is a UUIDv7 minted by the api, so the
-- column has no default. Not a billing table; Money holds the payments.
CREATE TABLE "checkout_consents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_id" text NOT NULL,
	"price_key" text NOT NULL,
	"locale" text NOT NULL,
	"statement" text NOT NULL,
	"consented_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "checkout_consents_user_id_idx" ON "checkout_consents" USING btree ("user_id");
